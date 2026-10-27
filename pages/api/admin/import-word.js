// Route import đề thi Word (.docx) sang bài tập General (Phase 12 G3, mục 4.4).
// Nhận file .docx multipart qua formidable -> đọc bằng docxRead -> chia khúc splitForAi
// -> gọi Gemini song song -> buildImport -> trả nháp (không ghi DB, không upload ảnh lên Cloudinary).

const fs = require("fs");
const { formidable } = require("formidable");
const { requireAuth } = require("../../../lib/auth");
const { withTenant } = require("../../../lib/tenant");
const { connectDB } = require("../../../lib/db");
const gemini = require("../../../lib/gemini");
const { getGradingModels } = require("../../../lib/grading/aiModels");
const { lessonModels } = require("../../../lib/ai/common");
const { PROGRAMS } = require("../../../lib/curriculum");
const { readDocx } = require("../../../lib/docxRead");
const {
  splitForAi,
  WORD_IMPORT_SYSTEM,
  buildWordPrompt,
  WORD_SCHEMA,
  buildImport,
} = require("../../../lib/wordImport");

const MAX_IMG_RESPONSE_CHARS = 3 * 1024 * 1024; // Giới hạn tổng độ dài BASE64 (ảnh gửi dạng base64 trong JSON) tránh tràn payload Vercel

function getFirst(v) {
  return Array.isArray(v) ? v[0] : v;
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // Workspace demo không cho dùng AI
  if (req.ws.demo) {
    return res.status(403).json({ ok: false, error: "AI features are turned off in the demo workspace." });
  }

  // Gemini API key chưa cấu hình
  if (!gemini.isEnabled()) {
    return res.status(503).json({ ok: false, error: "AI is not configured (GEMINI_API_KEY missing)" });
  }

  let fields = {};
  let files = {};
  try {
    const form = formidable({ maxFileSize: 4 * 1024 * 1024 });
    [fields, files] = await form.parse(req);
  } catch (err) {
    return res.status(400).json({ ok: false, error: "Unable to read uploaded file (maximum size is 4 MB)" });
  }

  const uploadedFile = getFirst(files.file);
  const tempPath = uploadedFile ? uploadedFile.filepath : null;

  try {
    if (!uploadedFile || !tempPath) {
      return res.status(400).json({ ok: false, error: "No file was uploaded" });
    }

    const program = String(getFirst(fields.program) || "general").toLowerCase();
    const progConfig = PROGRAMS[program];
    if (!progConfig || !progConfig.wordImport) {
      return res.status(400).json({ ok: false, error: "Word import is not supported for this program" });
    }

    const subject = String(getFirst(fields.subject) || "").toLowerCase();
    if (!["grammar", "vocabulary", "reading", "listening"].includes(subject)) {
      return res.status(400).json({ ok: false, error: "Invalid subject for Word import" });
    }

    // Đọc file .docx
    let fileBuf;
    try {
      fileBuf = fs.readFileSync(tempPath);
    } catch {
      return res.status(400).json({ ok: false, error: "Unable to read uploaded file" });
    }

    let docxData;
    try {
      docxData = readDocx(fileBuf);
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message || "Failed to parse .docx file" });
    }

    // Chia khúc gửi AI
    const splitRes = splitForAi(docxData.text);
    if (splitRes.error) {
      return res.status(400).json({ ok: false, error: splitRes.error });
    }

    const { chunks, keyText } = splitRes;
    if (!chunks.length) {
      return res.status(400).json({ ok: false, error: "No question content found in the document" });
    }

    await connectDB();
    const models = lessonModels(await getGradingModels());
    const fileName = uploadedFile.originalFilename || "test.docx";

    // Xử lý từng chunk song song qua Gemini
    const chunkPromises = chunks.map(async (chunk, i) => {
      const prompt = buildWordPrompt(chunk, keyText, { subject });
      const { data } = await gemini.generateJSON({
        systemInstruction: WORD_IMPORT_SYSTEM,
        prompt,
        schema: WORD_SCHEMA,
        temperature: 0,
        thinkingBudget: 512,
        models,
        log: {
          purpose: "import.word",
          actor: req.auth,
          workspaceId: req.ws.workspaceId,
          source: req.url,
          context: {
            fileName,
            chunk: i + 1,
            chunks: chunks.length,
            subject,
            program,
          },
        },
      });
      return data;
    });

    const settled = await Promise.allSettled(chunkPromises);

    const chunkResults = settled.map((r, i) => {
      if (r.status === "fulfilled") {
        return { ok: true, data: r.value };
      } else {
        return {
          ok: false,
          error: r.reason?.error || r.reason?.message || "Chunk processing failed",
          code: r.reason?.code,
          snippet: chunks[i].slice(0, 30),
        };
      }
    });

    const allFailed = chunkResults.every((c) => !c.ok);
    if (allFailed) {
      const budgetErr = chunkResults.find((c) => c.code === "AI_BUDGET_EXCEEDED");
      if (budgetErr) {
        return res.status(429).json({ ok: false, error: budgetErr.error || "AI monthly budget exceeded" });
      }
      return res.status(502).json({
        ok: false,
        error: `AI request failed: ${chunkResults[0]?.error || "Could not process any section"}`,
      });
    }

    // Gom kết quả thành sections
    const importRes = buildImport(chunkResults, {
      subject,
      images: docxData.images,
      keyText,
    });

    // Chỉ giữ ảnh được tham chiếu
    const referenced = new Set(importRes.imageLinks.map((l) => l.ref));
    const allDocxImages = docxData.images || [];
    let keptImages = allDocxImages
      .filter((img) => referenced.has(img.ref))
      .map((img) => ({
        ref: img.ref,
        name: img.name,
        mimeType: img.mimeType,
        base64: img.buffer.toString("base64"),
        byteLength: img.buffer.length,
      }));

    // Cắt giảm ảnh nếu tổng độ dài base64 quá lớn (bỏ ảnh lớn nhất trước)
    let totalChars = keptImages.reduce((sum, img) => sum + img.base64.length, 0);
    if (totalChars > MAX_IMG_RESPONSE_CHARS) {
      keptImages.sort((a, b) => b.base64.length - a.base64.length);
      while (keptImages.length > 0 && totalChars > MAX_IMG_RESPONSE_CHARS) {
        const dropped = keptImages.shift();
        totalChars -= dropped.base64.length;
        importRes.warnings.push(
          `Image ${dropped.ref} (${dropped.name}) was omitted because the response is too large — add it by hand.`
        );
        // Gắn cờ cho mọi câu dùng ảnh này (gộp vào cờ có sẵn của cùng si/fi)
        const reason = "Image could not be included — add it by hand";
        for (const l of importRes.imageLinks.filter((x) => x.ref === dropped.ref)) {
          const ex = importRes.flags.find((f) => f.si === l.si && f.fi === l.fi);
          if (ex) {
            if (!String(ex.reason || "").includes(reason)) ex.reason = ex.reason ? `${ex.reason}; ${reason}` : reason;
          } else {
            importRes.flags.push({ si: l.si, fi: l.fi, reason });
          }
        }
        importRes.imageLinks = importRes.imageLinks.filter((l) => l.ref !== dropped.ref);
      }
      importRes.stats.flagged = importRes.flags.length;
    }

    const finalImages = keptImages.map(({ ref, name, mimeType, base64 }) => ({
      ref,
      name,
      mimeType,
      base64,
    }));

    return res.status(200).json({
      ok: true,
      sections: importRes.sections,
      flags: importRes.flags,
      imageLinks: importRes.imageLinks,
      images: finalImages,
      warnings: [...(docxData.warnings || []), ...importRes.warnings],
      stats: importRes.stats,
    });
  } finally {
    // Luôn dọn dẹp file tạm trên disk
    if (tempPath && fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {}
    }
  }
}

module.exports = requireAuth(withTenant(handler));
module.exports.default = module.exports;
module.exports.config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 60,
};

const { formidable } = require("formidable");
const fs = require("fs");
const { requireAuth } = require("../../../lib/auth");
const {
  parseCsv,
  parseContentCsv,
  rowsToSections,
  workbookToSections,
  workbookToGrammar,
  workbookToVocab,
} = require("../../../lib/csvImport");
const { readWorkbook } = require("../../../lib/xlsxRead");

function isXlsx(file) {
  const name = String(file.originalFilename || "").toLowerCase();
  if (name.endsWith(".xlsx")) return true;
  try {
    const fd = fs.openSync(file.filepath, "r");
    const b = Buffer.alloc(4);
    fs.readSync(fd, b, 0, 4, 0);
    fs.closeSync(fd);
    return b[0] === 0x50 && b[1] === 0x4b; // "PK" -> ZIP/xlsx
  } catch {
    return false;
  }
}

function readUploadedCsv(file) {
  const name = String(file.originalFilename || "").toLowerCase();
  if (!name.endsWith(".csv") && file.mimetype && !file.mimetype.includes("csv") && !file.mimetype.includes("text")) {
    fs.unlink(file.filepath, () => {});
    return { error: "Please upload a .csv or .xlsx file." };
  }
  let text;
  try {
    text = fs.readFileSync(file.filepath, "utf8");
  } catch (err) {
    return { error: "Unable to read the uploaded file" };
  } finally {
    fs.unlink(file.filepath, () => {});
  }
  if (text.length > 3 * 1024 * 1024) return { error: "File is too large" };
  return { text };
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  let fields, files;
  try {
    const form = formidable({ maxFileSize: 4 * 1024 * 1024 });
    [fields, files] = await form.parse(req);
  } catch (err) {
    return res.status(400).json({ ok: false, error: "Unable to read uploaded file" });
  }

  const file = Array.isArray(files.file) ? files.file[0] : files.file;
  if (!file) return res.status(400).json({ ok: false, error: "Missing file" });

  const mode = String((Array.isArray(fields.mode) ? fields.mode[0] : fields.mode) || "").toLowerCase();

  // ---- Grammar / Vocabulary: file bài tập (file) + file bài học (lessonFile) ----
  if (mode === "grammar" || mode === "vocab") {
    const readXlsxBuf = (f) => {
      try {
        const b = fs.readFileSync(f.filepath);
        return b.length > 4 * 1024 * 1024 ? { error: "File is too large" } : { wb: readWorkbook(b) };
      } catch (err) {
        return { error: "Could not read file: " + err.message };
      } finally {
        fs.unlink(f.filepath, () => {});
      }
    };
    const exRes = readXlsxBuf(file);
    const lessonF = Array.isArray(files.lessonFile) ? files.lessonFile[0] : files.lessonFile;
    const lessonRes = lessonF ? readXlsxBuf(lessonF) : { wb: null };
    if (exRes.error) return res.status(400).json({ ok: false, error: "Exercise file: " + exRes.error });
    if (lessonRes.error) return res.status(400).json({ ok: false, error: "Lesson file: " + lessonRes.error });

    const out =
      mode === "grammar"
        ? workbookToGrammar(exRes.wb, lessonRes.wb)
        : workbookToVocab(exRes.wb, lessonRes.wb);
    return res.status(200).json({ ok: true, ...out });
  }

  // ---- File .xlsx (nhiều tab): đọc thẳng, không cần tách/xuất CSV ----
  if (isXlsx(file)) {
    let buf;
    try {
      buf = fs.readFileSync(file.filepath);
    } catch (err) {
      return res.status(400).json({ ok: false, error: "Unable to read the uploaded file" });
    } finally {
      fs.unlink(file.filepath, () => {});
    }
    if (buf.length > 4 * 1024 * 1024) return res.status(400).json({ ok: false, error: "File is too large" });
    let wb;
    try {
      wb = readWorkbook(buf);
    } catch (err) {
      return res.status(400).json({ ok: false, error: "Could not read the .xlsx file: " + err.message });
    }
    const contentFile = Array.isArray(files.contentFile) ? files.contentFile[0] : files.contentFile;
    if (contentFile) fs.unlink(contentFile.filepath, () => {});
    const { sections, warnings } = workbookToSections(wb);
    return res.status(200).json({ ok: true, sections, warnings });
  }

  // ---- File .csv: luồng cũ (câu hỏi bắt buộc + nội dung tuỳ chọn) ----
  const questionsResult = readUploadedCsv(file);
  if (questionsResult.error) return res.status(400).json({ ok: false, error: questionsResult.error });

  let contentMap;
  const contentFile = Array.isArray(files.contentFile) ? files.contentFile[0] : files.contentFile;
  if (contentFile) {
    const contentResult = readUploadedCsv(contentFile);
    if (contentResult.error) return res.status(400).json({ ok: false, error: "Content file: " + contentResult.error });
    contentMap = parseContentCsv(parseCsv(contentResult.text));
  }

  const { sections, warnings } = rowsToSections(parseCsv(questionsResult.text), contentMap);
  return res.status(200).json({ ok: true, sections, warnings });
}

const handlerWithAuth = requireAuth(handler);
module.exports = handlerWithAuth;
module.exports.config = { api: { bodyParser: false } };
module.exports.default = module.exports;

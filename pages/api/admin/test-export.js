// Xuất đề thi ra Word / dữ liệu trang in (Phase 12 G4 bước 4). Chỉ giáo viên, chỉ chương trình có `questionBank`.
//   GET ?id=&code=0..4&kind=exam|key&format=docx|json     (kind=json = exam + format json)
// Ảnh: byte chỉ tải từ res.cloudinary.com theo URL của Image doc trong workspace (không theo client).
const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { withTenant, tenantFilter, assertOwned } = require("../../../lib/tenant");
const Test = require("../../../lib/models/Test");
const Image = require("../../../lib/models/Image");
const { PROGRAMS, programOf } = require("../../../lib/curriculum");
const { buildExam, collectImageIds, examForPrint } = require("../../../lib/exam/buildExam");
const { fetchImages } = require("../../../lib/exam/fetchImages");
const { renderExamDocx, renderAnswerKeyDocx } = require("../../../lib/exam/docx");

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const bad = (res, error, status = 400) => res.status(status).json({ ok: false, error });

// Tên file chỉ ASCII an toàn.
function safeName(title) {
  const base = String(title || "test")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return base || "test";
}

function warningHeader(list) {
  const counts = new Map();
  for (const w of list) counts.set(w, (counts.get(w) || 0) + 1);
  return [...counts.entries()]
    .map(([w, n]) => (n > 1 ? `${n} x ${w}` : w))
    .join("; ")
    .replace(/[^\x20-\x7e]/g, "")
    .slice(0, 400);
}

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return bad(res, "Method not allowed", 405);
  }
  await connectDB();
  const ws = req.ws;
  const q = req.query || {};

  let kind = String(q.kind || "exam");
  let format = String(q.format || "docx");
  if (kind === "json") {
    kind = "exam";
    format = "json";
  }
  if (!["exam", "key"].includes(kind)) return bad(res, "Invalid kind.");
  if (!["docx", "json"].includes(format)) return bad(res, "Invalid format.");
  const codeRaw = String(q.code == null || q.code === "" ? "0" : q.code);
  if (!/^[0-4]$/.test(codeRaw)) return bad(res, "Exam code must be 0 to 4.");
  const code = Number(codeRaw);

  const test = await assertOwned(ws, Test, q.id, { lean: true, message: "Test not found" });
  if (!PROGRAMS[programOf(test)].questionBank) return bad(res, "This program does not support exam export.");

  // Tra URL ảnh của đúng workspace.
  const imageIds = collectImageIds(test);
  const urlById = new Map();
  if (imageIds.length) {
    const docs = await Image.find(tenantFilter(ws, { _id: { $in: imageIds } })).select("cloudinaryUrl").lean();
    for (const d of docs) urlById.set(String(d._id), d.cloudinaryUrl);
  }
  const built = buildExam(test, { urlById, code });

  if (format === "json") {
    res.setHeader("Cache-Control", "no-store");
    if (kind === "key") return res.status(200).json({ ok: true, meta: built.meta, answers: built.exam.answers });
    // Đề: KHÔNG kèm đáp án.
    return res.status(200).json({ ok: true, meta: built.meta, exam: examForPrint(built.exam) });
  }

  let buf;
  const warnings = [];
  if (kind === "key") {
    buf = renderAnswerKeyDocx(built.exam, built.meta);
  } else {
    const got = await fetchImages(built.imageUrls);
    warnings.push(...got.warnings);
    buf = renderExamDocx(built.exam, built.meta, got.images);
    // Ảnh có trong đề nhưng không có Image doc (đã xoá) -> tính là thiếu.
    const lost = imageIds.filter((id) => !urlById.has(id)).length;
    if (lost) warnings.push("image missing (not found)");
  }
  const file = `${safeName(built.meta.title)}-${kind === "key" ? "answer-key" : "code-" + code}.docx`;
  res.setHeader("Content-Type", DOCX_MIME);
  res.setHeader("Content-Disposition", `attachment; filename="${file}"`);
  res.setHeader("Cache-Control", "no-store");
  if (warnings.length) res.setHeader("X-Export-Warnings", warningHeader(warnings));
  return res.status(200).send(buf);
}

module.exports = requireAuth(withTenant(handler));

module.exports.default = module.exports;

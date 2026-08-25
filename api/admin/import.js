const { formidable } = require("formidable");
const fs = require("fs");
const { requireAuth } = require("../../lib/auth");
const { parseCsv, rowsToSections } = require("../../lib/csvImport");

// Chỉ đọc & chuẩn hoá file CSV giáo viên tải lên thành dữ liệu sections/
// questions đúng shape editor phía client — KHÔNG ghi gì vào DB ở đây.
// Việc lưu thật vẫn đi qua api/admin/tests.js hoặc api/admin/units.js như
// bình thường sau khi giáo viên xem/sửa trong builder và bấm Lưu.
async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  let files;
  try {
    // Vercel Serverless Functions hard-cap the request body around ~4.5MB
    // (an AWS Lambda/API Gateway limit, not something raising the plan
    // tier changes) — keep well under that so a too-large file gets a
    // clear error instead of a confusing platform-level rejection.
    const form = formidable({ maxFileSize: 3 * 1024 * 1024 });
    [, files] = await form.parse(req);
  } catch (err) {
    return res.status(400).json({ ok: false, error: "Unable to read uploaded file" });
  }

  const file = Array.isArray(files.file) ? files.file[0] : files.file;
  if (!file) {
    return res.status(400).json({ ok: false, error: "Missing file" });
  }

  const name = String(file.originalFilename || "").toLowerCase();
  if (!name.endsWith(".csv") && file.mimetype && !file.mimetype.includes("csv") && !file.mimetype.includes("text")) {
    fs.unlink(file.filepath, () => {});
    return res.status(400).json({ ok: false, error: "Please upload a .csv file (export your spreadsheet as CSV first)." });
  }

  let text;
  try {
    text = fs.readFileSync(file.filepath, "utf8");
  } catch (err) {
    return res.status(400).json({ ok: false, error: "Unable to read the uploaded file" });
  } finally {
    fs.unlink(file.filepath, () => {});
  }

  if (text.length > 2 * 1024 * 1024) {
    return res.status(400).json({ ok: false, error: "File is too large" });
  }

  const rows = parseCsv(text);
  const { sections, warnings } = rowsToSections(rows);

  return res.status(200).json({ ok: true, sections, warnings });
}

const handlerWithAuth = requireAuth(handler);
module.exports = handlerWithAuth;
module.exports.config = {
  api: {
    bodyParser: false
  }
};

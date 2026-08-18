const { formidable } = require("formidable");
const fs = require("fs");
const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { uploadAudioFile } = require("../../../lib/cloudinary");
const Audio = require("../../../lib/models/Audio");

async function handler(req, res) {
  await connectDB();

  if (req.method === "GET") {
    const rows = await Audio.find().sort({ uploadedAt: -1 }).lean();
    return res.status(200).json({ ok: true, rows });
  }

  if (req.method === "POST") {
    let fields, files;
    try {
      const form = formidable({ maxFileSize: 30 * 1024 * 1024 });
      [fields, files] = await form.parse(req);
    } catch (err) {
      console.error("FORMIDABLE PARSE ERROR:", err);
      return res.status(400).json({ ok: false, error: "Không đọc được file gửi lên" });
    }

    const file = Array.isArray(files.audio) ? files.audio[0] : files.audio;
    if (!file) {
      return res.status(400).json({ ok: false, error: "Thiếu file âm thanh" });
    }

    const title = String((Array.isArray(fields.title) ? fields.title[0] : fields.title) || "").trim();
    const unit = String((Array.isArray(fields.unit) ? fields.unit[0] : fields.unit) || "").trim();
    if (!title) {
      return res.status(400).json({ ok: false, error: "Thiếu tiêu đề bài nghe" });
    }

    let uploadResult;
    try {
      uploadResult = await uploadAudioFile(file.filepath);
    } catch (err) {
      return res.status(502).json({ ok: false, error: "Tải file lên Cloudinary thất bại" });
    } finally {
      fs.unlink(file.filepath, () => {});
    }

    const audio = await Audio.create({
      title,
      unit,
      cloudinaryUrl: uploadResult.secure_url,
      cloudinaryPublicId: uploadResult.public_id
    });

    return res.status(201).json({ ok: true, audio });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

// Note: Vercel's Node runtime does not auto-parse multipart/form-data,
// so formidable can read the raw request stream above without extra config.
const handlerWithAuth = requireAuth(handler);
module.exports = handlerWithAuth;
module.exports.config = {
  api: {
    bodyParser: false
  }
};

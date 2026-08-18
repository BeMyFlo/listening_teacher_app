const { formidable } = require("formidable");
const fs = require("fs");
const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { uploadImageFile } = require("../../../lib/cloudinary");
const Image = require("../../../lib/models/Image");

async function handler(req, res) {
  await connectDB();

  if (req.method === "GET") {
    const rows = await Image.find().sort({ uploadedAt: -1 }).lean();
    return res.status(200).json({ ok: true, rows });
  }

  if (req.method === "POST") {
    let fields, files;
    try {
      const form = formidable({ maxFileSize: 15 * 1024 * 1024 });
      [fields, files] = await form.parse(req);
    } catch (err) {
      return res.status(400).json({ ok: false, error: "Không đọc được file gửi lên" });
    }

    const file = Array.isArray(files.image) ? files.image[0] : files.image;
    if (!file) {
      return res.status(400).json({ ok: false, error: "Thiếu file ảnh" });
    }

    const title = String((Array.isArray(fields.title) ? fields.title[0] : fields.title) || "").trim();
    const unit = String((Array.isArray(fields.unit) ? fields.unit[0] : fields.unit) || "").trim();
    if (!title) {
      return res.status(400).json({ ok: false, error: "Thiếu tiêu đề ảnh" });
    }

    let uploadResult;
    try {
      uploadResult = await uploadImageFile(file.filepath);
    } catch (err) {
      return res.status(502).json({ ok: false, error: "Tải ảnh lên Cloudinary thất bại" });
    } finally {
      fs.unlink(file.filepath, () => {});
    }

    const image = await Image.create({
      title,
      unit,
      cloudinaryUrl: uploadResult.secure_url,
      cloudinaryPublicId: uploadResult.public_id
    });

    return res.status(201).json({ ok: true, image });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

const handlerWithAuth = requireAuth(handler);
module.exports = handlerWithAuth;
module.exports.config = {
  api: {
    bodyParser: false
  }
};

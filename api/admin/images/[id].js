const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { deleteImageFile } = require("../../../lib/cloudinary");
const Image = require("../../../lib/models/Image");
const Test = require("../../../lib/models/Test");

async function handler(req, res) {
  await connectDB();
  const { id } = req.query;

  let image;
  try {
    image = await Image.findById(id);
  } catch (err) {
    return res.status(404).json({ ok: false, error: "Không tìm thấy ảnh" });
  }
  if (!image) {
    return res.status(404).json({ ok: false, error: "Không tìm thấy ảnh" });
  }

  if (req.method === "PUT") {
    const title = req.body && req.body.title;
    const unit = req.body && req.body.unit;
    if (title != null) image.title = String(title).trim();
    if (unit != null) image.unit = String(unit).trim();
    await image.save();
    return res.status(200).json({ ok: true, image });
  }

  if (req.method === "DELETE") {
    const inUse = await Test.exists({ "sections.imageId": image._id });
    if (inUse) {
      return res.status(409).json({
        ok: false,
        error: "Ảnh này đang được dùng trong một bài kiểm tra, không thể xoá."
      });
    }
    try {
      await deleteImageFile(image.cloudinaryPublicId);
    } catch (err) {
      // Continue even if Cloudinary cleanup fails — don't block deleting the record.
    }
    await image.deleteOne();
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "PUT, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireAuth(handler);

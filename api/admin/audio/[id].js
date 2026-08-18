const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { deleteAudioFile } = require("../../../lib/cloudinary");
const Audio = require("../../../lib/models/Audio");
const Test = require("../../../lib/models/Test");

async function handler(req, res) {
  await connectDB();
  const { id } = req.query;

  let audio;
  try {
    audio = await Audio.findById(id);
  } catch (err) {
    return res.status(404).json({ ok: false, error: "Không tìm thấy bài nghe" });
  }
  if (!audio) {
    return res.status(404).json({ ok: false, error: "Không tìm thấy bài nghe" });
  }

  if (req.method === "PUT") {
    const title = req.body && req.body.title;
    const unit = req.body && req.body.unit;
    if (title != null) audio.title = String(title).trim();
    if (unit != null) audio.unit = String(unit).trim();
    await audio.save();
    return res.status(200).json({ ok: true, audio });
  }

  if (req.method === "DELETE") {
    const inUse = await Test.exists({ "sections.audioId": audio._id });
    if (inUse) {
      return res.status(409).json({
        ok: false,
        error: "Bài nghe này đang được dùng trong một bài kiểm tra, không thể xoá."
      });
    }
    try {
      await deleteAudioFile(audio.cloudinaryPublicId);
    } catch (err) {
      // Continue even if Cloudinary cleanup fails — don't block deleting the record.
    }
    await audio.deleteOne();
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "PUT, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireAuth(handler);

const { connectDB } = require("../../lib/db");
const { requireAuth } = require("../../lib/auth");
const { deleteAudioFile } = require("../../lib/cloudinary");
const Audio = require("../../lib/models/Audio");
const Test = require("../../lib/models/Test");

async function handler(req, res) {
  await connectDB();

  if (req.method === "GET") {
    const rows = await Audio.find().sort({ uploadedAt: -1 }).lean();
    return res.status(200).json({ ok: true, rows });
  }

  if (req.method === "POST") {
    // The file itself is uploaded straight from the browser to Cloudinary
    // (see assets/api.js Api.uploadToCloudinary) — Vercel Serverless
    // Functions hard-cap the request body at ~4.5MB, too small for real
    // audio files, so this endpoint only ever receives a small JSON body.
    const title = String((req.body && req.body.title) || "").trim();
    const unit = String((req.body && req.body.unit) || "").trim();
    const cloudinaryUrl = req.body && req.body.cloudinaryUrl;
    const cloudinaryPublicId = req.body && req.body.cloudinaryPublicId;

    if (!title) {
      return res.status(400).json({ ok: false, error: "Missing audio track title" });
    }
    if (!cloudinaryUrl || !cloudinaryPublicId) {
      return res.status(400).json({ ok: false, error: "Missing uploaded file information" });
    }

    const audio = await Audio.create({ title, unit, cloudinaryUrl, cloudinaryPublicId });
    return res.status(201).json({ ok: true, audio });
  }

  if (req.method === "PUT" || req.method === "DELETE") {
    const { id } = req.query;
    let audio;
    try {
      audio = await Audio.findById(id);
    } catch (err) {
      return res.status(404).json({ ok: false, error: "Audio track not found" });
    }
    if (!audio) {
      return res.status(404).json({ ok: false, error: "Audio track not found" });
    }

    if (req.method === "PUT") {
      const title = req.body && req.body.title;
      const unit = req.body && req.body.unit;
      if (title != null) audio.title = String(title).trim();
      if (unit != null) audio.unit = String(unit).trim();
      await audio.save();
      return res.status(200).json({ ok: true, audio });
    }

    const inUse = await Test.exists({ "sections.audioId": audio._id });
    if (inUse) {
      return res.status(409).json({
        ok: false,
        error: "This audio track is currently used in a mock test and cannot be deleted."
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

  res.setHeader("Allow", "GET, POST, PUT, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireAuth(handler);

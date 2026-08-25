const { connectDB } = require("../../lib/db");
const { requireAuth } = require("../../lib/auth");
const { deleteImageFile } = require("../../lib/cloudinary");
const Image = require("../../lib/models/Image");
const Test = require("../../lib/models/Test");

async function handler(req, res) {
  await connectDB();

  if (req.method === "GET") {
    const rows = await Image.find().sort({ uploadedAt: -1 }).lean();
    return res.status(200).json({ ok: true, rows });
  }

  if (req.method === "POST") {
    // The file itself is uploaded straight from the browser to Cloudinary
    // (see assets/api.js Api.uploadToCloudinary) — Vercel Serverless
    // Functions hard-cap the request body at ~4.5MB, so this endpoint only
    // ever receives a small JSON body.
    const title = String((req.body && req.body.title) || "").trim();
    const unit = String((req.body && req.body.unit) || "").trim();
    const cloudinaryUrl = req.body && req.body.cloudinaryUrl;
    const cloudinaryPublicId = req.body && req.body.cloudinaryPublicId;

    if (!title) {
      return res.status(400).json({ ok: false, error: "Missing image title" });
    }
    if (!cloudinaryUrl || !cloudinaryPublicId) {
      return res.status(400).json({ ok: false, error: "Missing uploaded file information" });
    }

    const image = await Image.create({ title, unit, cloudinaryUrl, cloudinaryPublicId });
    return res.status(201).json({ ok: true, image });
  }

  if (req.method === "PUT" || req.method === "DELETE") {
    const { id } = req.query;
    let image;
    try {
      image = await Image.findById(id);
    } catch (err) {
      return res.status(404).json({ ok: false, error: "Image not found" });
    }
    if (!image) {
      return res.status(404).json({ ok: false, error: "Image not found" });
    }

    if (req.method === "PUT") {
      const title = req.body && req.body.title;
      const unit = req.body && req.body.unit;
      if (title != null) image.title = String(title).trim();
      if (unit != null) image.unit = String(unit).trim();
      await image.save();
      return res.status(200).json({ ok: true, image });
    }

    const inUse = await Test.exists({ "sections.imageId": image._id });
    if (inUse) {
      return res.status(409).json({
        ok: false,
        error: "This image is currently used in a mock test and cannot be deleted."
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

  res.setHeader("Allow", "GET, POST, PUT, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireAuth(handler);

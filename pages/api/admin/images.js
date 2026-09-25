const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { withTenant, tenantFilter, assertOwned } = require("../../../lib/tenant");
const { deleteImageFile } = require("../../../lib/cloudinary");
const Image = require("../../../lib/models/Image");
const Test = require("../../../lib/models/Test");
const Unit = require("../../../lib/models/Unit");

async function handler(req, res) {
  await connectDB();

  if (req.method === "GET") {
    // Có trần để trang thư viện không tải nguyên collection khi file nhiều dần.
    const rows = await Image.find(tenantFilter(req.ws)).sort({ uploadedAt: -1 }).limit(500).lean();
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

    const image = await Image.create({ title, unit, cloudinaryUrl, cloudinaryPublicId, workspaceId: req.ws.workspaceId });
    return res.status(201).json({ ok: true, image });
  }

  if (req.method === "PUT" || req.method === "DELETE") {
    const { id } = req.query;
    const image = await assertOwned(req.ws, Image, id, { message: "Image not found" });

    if (req.method === "PUT") {
      const title = req.body && req.body.title;
      const unit = req.body && req.body.unit;
      if (title != null) image.title = String(title).trim();
      if (unit != null) image.unit = String(unit).trim();
      await image.save();
      return res.status(200).json({ ok: true, image });
    }

    // Trước đây chỉ dò `Test` với path "sections.imageId" — path đó không tồn
    // tại trong schema thật, và route còn bỏ sót hẳn `Unit` (lesson), nơi ảnh
    // dùng nhiều hơn cả mock test (theory + exercise + prompt + topic/group
    // exercise). Chốt "đang dùng" trước đây vì vậy chưa từng chặn lần xoá nào.
    const [inTest, inUnit] = await Promise.all([
      Test.exists(tenantFilter(req.ws, {
        $or: [
          { "skills.listening.sections.imageId": image._id },
          { "skills.reading.sections.imageId": image._id },
          { "skills.writing.prompts.imageId": image._id },
          { "skills.speaking.prompts.imageId": image._id },
        ],
      })),
      Unit.exists(tenantFilter(req.ws, {
        $or: [
          { "categories.theory.imageId": image._id },
          { "categories.exercises.sections.imageId": image._id },
          { "categories.prompts.imageId": image._id },
          { "categories.topics.exercises.sections.imageId": image._id },
          { "categories.groups.exercises.sections.imageId": image._id },
        ],
      })),
    ]);
    if (inTest || inUnit) {
      return res.status(409).json({
        ok: false,
        error: `This image is currently used in ${inUnit ? "a lesson" : "a mock test"} and cannot be deleted.`,
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

module.exports = requireAuth(withTenant(handler));

module.exports.default = module.exports;

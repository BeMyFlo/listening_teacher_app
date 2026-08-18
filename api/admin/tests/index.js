const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const Test = require("../../../lib/models/Test");
const { normalizeSections, validateSections } = require("../../../lib/testSections");

async function handler(req, res) {
  await connectDB();

  if (req.method === "GET") {
    const rows = await Test.find()
      .sort({ updatedAt: -1 })
      .populate("sections.audioId", "title unit cloudinaryUrl")
      .populate("sections.imageId", "title unit cloudinaryUrl")
      .lean();
    return res.status(200).json({ ok: true, rows });
  }

  if (req.method === "POST") {
    const { title, unit, instructions, sections } = req.body || {};
    const subject = req.body && req.body.subject === "reading" ? "reading" : "listening";
    if (!title || !String(title).trim()) {
      return res.status(400).json({ ok: false, error: "Thiếu tên bài kiểm tra" });
    }

    const normalized = normalizeSections(sections);
    const error = await validateSections(subject, normalized);
    if (error) return res.status(400).json({ ok: false, error });

    const test = await Test.create({
      subject,
      title: String(title).trim(),
      unit: String(unit || "").trim(),
      instructions: String(instructions || ""),
      status: "draft",
      sections: normalized
    });

    return res.status(201).json({ ok: true, test });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireAuth(handler);

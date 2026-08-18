const { connectDB } = require("../../lib/db");
const { requireAuth } = require("../../lib/auth");
const Test = require("../../lib/models/Test");
const { normalizeSections, validateSections } = require("../../lib/testSections");

async function handler(req, res) {
  await connectDB();
  const { id } = req.query;

  if (req.method === "GET" && !id) {
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

  // GET-with-id / PUT / DELETE all operate on a single test.
  let test;
  try {
    test = await Test.findById(id);
  } catch (err) {
    return res.status(404).json({ ok: false, error: "Không tìm thấy bài kiểm tra" });
  }
  if (!test) {
    return res.status(404).json({ ok: false, error: "Không tìm thấy bài kiểm tra" });
  }

  if (req.method === "GET") {
    await test.populate("sections.audioId", "title unit cloudinaryUrl");
    await test.populate("sections.imageId", "title unit cloudinaryUrl");
    return res.status(200).json({ ok: true, test });
  }

  if (req.method === "PUT") {
    const { title, unit, instructions, sections, status, subject } = req.body || {};

    if (subject != null) {
      if (!["listening", "reading"].includes(subject)) {
        return res.status(400).json({ ok: false, error: "Kỹ năng không hợp lệ" });
      }
      test.subject = subject;
    }
    if (title != null) {
      if (!String(title).trim()) {
        return res.status(400).json({ ok: false, error: "Tên bài kiểm tra không được để trống" });
      }
      test.title = String(title).trim();
    }
    if (unit != null) test.unit = String(unit).trim();
    if (instructions != null) test.instructions = String(instructions);

    if (sections != null) {
      const normalized = normalizeSections(sections);
      const error = await validateSections(test.subject, normalized);
      if (error) return res.status(400).json({ ok: false, error });
      test.sections = normalized;
    }

    if (status != null) {
      if (!["draft", "published"].includes(status)) {
        return res.status(400).json({ ok: false, error: "Trạng thái không hợp lệ" });
      }
      if (status === "published" && test.sections.length === 0) {
        return res.status(400).json({ ok: false, error: "Cần ít nhất một phần trước khi công bố bài" });
      }
      test.status = status;
    }

    await test.save();
    return res.status(200).json({ ok: true, test });
  }

  if (req.method === "DELETE") {
    await test.deleteOne();
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST, PUT, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireAuth(handler);

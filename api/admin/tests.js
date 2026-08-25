const { connectDB } = require("../../lib/db");
const { requireAuth } = require("../../lib/auth");
const Test = require("../../lib/models/Test");
const { normalizeSections, validateSections } = require("../../lib/testSections");

// Phase 4 — parse + validate lịch thi từ body. Chỉ nhận field nào có mặt
// trong body; chuỗi rỗng = xoá mốc thời gian đó. `current` là test hiện tại
// (khi PUT) để validate cặp opensAt/closesAt sau khi merge.
function parseSchedule(body, current) {
  const out = {};
  const readDate = (key) => {
    if (!(key in body)) return undefined;
    const raw = body[key];
    if (raw === null || String(raw).trim() === "") return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? { error: "Invalid date time: " + key } : d;
  };

  for (const key of ["publishAt", "opensAt", "closesAt"]) {
    const v = readDate(key);
    if (v && v.error) return v;
    if (v !== undefined) out[key] = v;
  }

  if ("durationMinutes" in body) {
    const raw = body.durationMinutes;
    if (raw === null || String(raw).trim() === "") {
      out.durationMinutes = null;
    } else {
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) return { error: "Duration must be greater than 0" };
      out.durationMinutes = n;
    }
  }

  const effectiveOpens = "opensAt" in out ? out.opensAt : current && current.opensAt;
  const effectiveCloses = "closesAt" in out ? out.closesAt : current && current.closesAt;
  if (effectiveOpens && effectiveCloses && effectiveOpens >= effectiveCloses) {
    return { error: "Opening time must be before closing time" };
  }
  return out;
}

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
    const level = Number(req.body && req.body.level);
    if (!title || !String(title).trim()) {
      return res.status(400).json({ ok: false, error: "Missing test title" });
    }
    if (!Number.isInteger(level) || level < 1) {
      return res.status(400).json({ ok: false, error: "Please select a valid level" });
    }

    const normalized = normalizeSections(sections);
    const error = await validateSections(subject, normalized);
    if (error) return res.status(400).json({ ok: false, error });

    const schedule = parseSchedule(req.body || {}, null);
    if (schedule.error) return res.status(400).json({ ok: false, error: schedule.error });

    const test = await Test.create({
      subject,
      title: String(title).trim(),
      unit: String(unit || "").trim(),
      level,
      instructions: String(instructions || ""),
      status: "draft",
      publishAt: schedule.publishAt || null,
      opensAt: schedule.opensAt || null,
      closesAt: schedule.closesAt || null,
      durationMinutes: schedule.durationMinutes || null,
      sections: normalized
    });

    return res.status(201).json({ ok: true, test });
  }

  // GET-with-id / PUT / DELETE all operate on a single test.
  let test;
  try {
    test = await Test.findById(id);
  } catch (err) {
    return res.status(404).json({ ok: false, error: "Mock test not found" });
  }
  if (!test) {
    return res.status(404).json({ ok: false, error: "Mock test not found" });
  }

  if (req.method === "GET") {
    await test.populate("sections.audioId", "title unit cloudinaryUrl");
    await test.populate("sections.imageId", "title unit cloudinaryUrl");
    return res.status(200).json({ ok: true, test });
  }

  if (req.method === "PUT") {
    const { title, unit, instructions, sections, status, subject, level } = req.body || {};

    if (subject != null) {
      if (!["listening", "reading"].includes(subject)) {
        return res.status(400).json({ ok: false, error: "Invalid subject" });
      }
      test.subject = subject;
    }
    if (title != null) {
      if (!String(title).trim()) {
        return res.status(400).json({ ok: false, error: "Test title cannot be empty" });
      }
      test.title = String(title).trim();
    }
    if (unit != null) test.unit = String(unit).trim();
    if (instructions != null) test.instructions = String(instructions);
    if (level != null) {
      const lvl = Number(level);
      if (!Number.isInteger(lvl) || lvl < 1) {
        return res.status(400).json({ ok: false, error: "Invalid level" });
      }
      test.level = lvl;
    }

    if (sections != null) {
      const normalized = normalizeSections(sections);
      const error = await validateSections(test.subject, normalized);
      if (error) return res.status(400).json({ ok: false, error });
      test.sections = normalized;
    }

    if (status != null) {
      if (!["draft", "published"].includes(status)) {
        return res.status(400).json({ ok: false, error: "Invalid status" });
      }
      if (status === "published" && test.sections.length === 0) {
        return res.status(400).json({ ok: false, error: "Requires at least one section before publishing" });
      }
      test.status = status;
    }

    const schedule = parseSchedule(req.body || {}, test);
    if (schedule.error) return res.status(400).json({ ok: false, error: schedule.error });
    for (const key of ["publishAt", "opensAt", "closesAt", "durationMinutes"]) {
      if (key in schedule) test[key] = schedule[key];
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

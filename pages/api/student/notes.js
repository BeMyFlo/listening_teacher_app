const { connectDB } = require("../../../lib/db");
const { requireStudent } = require("../../../lib/auth");
const StudentNote = require("../../../lib/models/StudentNote");

const S = (v, max) => String(v == null ? "" : v).slice(0, max || 4000);

// Chỉ nhận id ObjectId-ish; href phải là đường dẫn nội bộ ("/student/...").
function cleanSource(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  const kind = ["lesson", "test", "free"].includes(s.kind) ? s.kind : "free";
  const out = {
    kind,
    contextName: S(s.contextName, 200),
    skill: S(s.skill, 40),
    itemLabel: S(s.itemLabel, 300),
    href: /^\/[A-Za-z0-9/_\-?=&.]*$/.test(String(s.href || "")) ? S(s.href, 300) : "",
  };
  if (kind === "lesson" && /^[a-f0-9]{24}$/i.test(String(s.unitId || ""))) out.unitId = s.unitId;
  if (kind === "test" && /^[a-f0-9]{24}$/i.test(String(s.testId || ""))) out.testId = s.testId;
  return out;
}

async function handler(req, res) {
  await connectDB();
  const studentId = req.auth.studentId;

  if (req.method === "GET") {
    const q = { studentId };
    if (/^[a-f0-9]{24}$/i.test(String(req.query.unitId || ""))) q["source.unitId"] = req.query.unitId;
    if (/^[a-f0-9]{24}$/i.test(String(req.query.testId || ""))) q["source.testId"] = req.query.testId;
    const notes = await StudentNote.find(q).sort({ pinned: -1, updatedAt: -1 }).limit(500).lean();
    return res.status(200).json({ ok: true, notes });
  }

  if (req.method === "POST") {
    const { body, quote, color, source } = req.body || {};
    if (!String(body || "").trim()) {
      return res.status(400).json({ ok: false, error: "Note cannot be empty" });
    }
    const note = await StudentNote.create({
      studentId,
      body: S(body, 4000).trim(),
      quote: S(quote, 2000),
      color: S(color, 20) || "yellow",
      source: cleanSource(source),
    });
    return res.status(201).json({ ok: true, note });
  }

  const { id } = req.query;
  if (!/^[a-f0-9]{24}$/i.test(String(id || ""))) {
    return res.status(404).json({ ok: false, error: "Note not found" });
  }

  if (req.method === "PATCH") {
    const patch = {};
    if (req.body && typeof req.body.body === "string") {
      if (!req.body.body.trim()) return res.status(400).json({ ok: false, error: "Note cannot be empty" });
      patch.body = S(req.body.body, 4000).trim();
    }
    if (req.body && typeof req.body.color === "string") patch.color = S(req.body.color, 20);
    if (req.body && typeof req.body.pinned === "boolean") patch.pinned = req.body.pinned;
    const note = await StudentNote.findOneAndUpdate({ _id: id, studentId }, patch, { new: true }).lean();
    if (!note) return res.status(404).json({ ok: false, error: "Note not found" });
    return res.status(200).json({ ok: true, note });
  }

  if (req.method === "DELETE") {
    const r = await StudentNote.deleteOne({ _id: id, studentId });
    if (!r.deletedCount) return res.status(404).json({ ok: false, error: "Note not found" });
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireStudent(handler);
module.exports.default = module.exports;

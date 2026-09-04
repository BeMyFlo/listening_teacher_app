// Danh sách MỌI bài Writing/Speaking chưa xuất bản điểm (lesson + mock test),
// kèm đường dẫn để bấm vào chấm thẳng.
const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const Submission = require("../../../lib/models/Submission");
const Unit = require("../../../lib/models/Unit");

function promptTitle(unit, promptId) {
  for (const c of (unit && unit.categories) || []) {
    for (const p of c.prompts || []) {
      if (String(p._id) === String(promptId)) return p.title || "";
    }
  }
  return "";
}

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  await connectDB();

  const subs = await Submission.find({
    kind: { $in: ["writing", "speaking"] },
    gradingStatus: { $ne: "graded" },
  })
    .sort({ submittedAt: -1 })
    .select("studentId studentName kind unitId promptId testId testTitle testSkill submittedAt isLate gradingStatus attemptNumber parentSubmissionId")
    .lean();

  const unitIds = [...new Set(subs.filter((s) => s.unitId).map((s) => String(s.unitId)))];
  const units = await Unit.find({ _id: { $in: unitIds } }).select("name categories").lean();
  const unitById = new Map(units.map((u) => [String(u._id), u]));

  const rows = subs.map((s) => {
    const isLesson = !!s.unitId;
    const u = isLesson ? unitById.get(String(s.unitId)) : null;
    return {
      _id: s._id,
      studentId: s.studentId,
      studentName: s.studentName,
      kind: s.kind,
      source: isLesson ? "lesson" : "mock",
      where: isLesson ? (u ? u.name : "Lesson") : s.testTitle || "Mock test",
      promptTitle: isLesson ? promptTitle(u, s.promptId) : s.testSkill || "",
      submittedAt: s.submittedAt,
      isLate: !!s.isLate,
      gradingStatus: s.gradingStatus, // submitted | draft | ai_draft
      attemptNumber: s.attemptNumber || 1,
      href: isLesson
        ? `/teacher/lessons/${s.unitId}/submissions/${s.studentId}`
        : `/teacher/submissions?open=${s._id}`,
    };
  });

  return res.status(200).json({
    ok: true,
    rows,
    counts: {
      total: rows.length,
      pending: rows.filter((r) => r.gradingStatus === "submitted").length,
      drafts: rows.filter((r) => r.gradingStatus === "draft" || r.gradingStatus === "ai_draft").length,
      lesson: rows.filter((r) => r.source === "lesson").length,
      mock: rows.filter((r) => r.source === "mock").length,
    },
  });
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;

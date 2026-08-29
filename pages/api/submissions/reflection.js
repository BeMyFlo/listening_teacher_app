const { connectDB } = require("../../../lib/db");
const { requireStudent } = require("../../../lib/auth");
const Submission = require("../../../lib/models/Submission");
const { getReflectionQuestions } = require("../../../lib/grading/reflection");

// Học sinh tự ghi Reflection Log cho bài đã chấm (attempt 1), trước khi nộp
// lại. Câu hỏi cố định theo kind — không nhận field ngoài danh sách đó.
async function handler(req, res) {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  await connectDB();
  const { id } = req.query;
  let submission;
  try {
    submission = await Submission.findOne({ _id: id, studentId: req.auth.studentId });
  } catch (err) {
    return res.status(404).json({ ok: false, error: "Submission not found" });
  }
  if (!submission) {
    return res.status(404).json({ ok: false, error: "Submission not found" });
  }
  if (submission.kind !== "writing" && submission.kind !== "speaking") {
    return res.status(400).json({ ok: false, error: "Reflection Log is only for Writing and Speaking submissions" });
  }
  if (submission.gradingStatus !== "graded") {
    return res.status(400).json({ ok: false, error: "This submission has not been graded yet" });
  }
  if (submission.reflectionLog) {
    return res.status(400).json({ ok: false, error: "Reflection Log has already been submitted" });
  }

  const questions = getReflectionQuestions(submission.kind);
  const { mistake, focusTags, nextAction } = req.body || {};
  if (!String(mistake || "").trim() || !String(nextAction || "").trim()) {
    return res.status(400).json({ ok: false, error: "Please answer all Reflection Log questions" });
  }

  submission.reflectionLog = {
    mistake: String(mistake).trim(),
    focusTags: Array.isArray(focusTags) ? focusTags.map((t) => String(t).trim()).filter(Boolean) : [],
    nextAction: String(nextAction).trim(),
    submittedAt: new Date(),
  };
  await submission.save();

  return res.status(200).json({ ok: true, reflectionLog: submission.reflectionLog, questions });
}

module.exports = requireStudent(handler);

module.exports.default = module.exports;

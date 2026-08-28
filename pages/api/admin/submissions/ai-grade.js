// Tạo job chấm AI (Gemini) và trả về ngay. Việc gọi Gemini chạy ngầm ở lần
// poll đầu tới /api/admin/grading-jobs?id=<jobId> — tránh timeout.

const { connectDB } = require("../../../../lib/db");
const { requireAuth } = require("../../../../lib/auth");
const Submission = require("../../../../lib/models/Submission");
const GradingJob = require("../../../../lib/models/GradingJob");
const { isEnabled, DEFAULT_MODEL } = require("../../../../lib/gemini");

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  if (!isEnabled()) {
    return res.status(503).json({ ok: false, error: "AI grading is not configured (GEMINI_API_KEY missing)" });
  }

  await connectDB();
  const { id } = req.query;
  let submission;
  try {
    submission = await Submission.findById(id).select("kind essayText audioUrl").lean();
  } catch (err) {
    return res.status(404).json({ ok: false, error: "Submission not found" });
  }
  if (!submission) return res.status(404).json({ ok: false, error: "Submission not found" });
  if (submission.kind === "writing" && !String(submission.essayText || "").trim()) {
    return res.status(400).json({ ok: false, error: "This essay is empty" });
  }
  if (submission.kind === "speaking" && !submission.audioUrl) {
    return res.status(400).json({ ok: false, error: "No audio recording to grade" });
  }
  if (submission.kind !== "writing" && submission.kind !== "speaking") {
    return res.status(400).json({ ok: false, error: "Only Writing and Speaking can be AI-graded" });
  }

  // Dùng lại job pending/running gần nhất (chống double-click).
  const existing = await GradingJob.findOne({
    submissionId: id,
    status: { $in: ["pending", "running"] },
  }).sort({ createdAt: -1 });
  if (existing) {
    return res.status(202).json({ ok: true, jobId: existing._id, status: existing.status });
  }

  const job = await GradingJob.create({
    submissionId: id,
    kind: submission.kind,
    status: "pending",
    model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
    requestedBy: req.auth.teacherId,
  });
  return res.status(202).json({ ok: true, jobId: job._id, status: "pending" });
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;

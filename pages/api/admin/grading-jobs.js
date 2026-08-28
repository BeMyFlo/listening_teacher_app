// Poll trạng thái job chấm AI. Lần poll đầu tiên thấy job "pending" sẽ TỰ CHẠY
// Gemini trong chính request này (chạy ngầm — request tạo job đã trả về từ trước).
// maxDuration 60s (giới hạn Hobby). Speaking audio dài có thể sát mức này.

const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const GradingJob = require("../../../lib/models/GradingJob");
const { runAiGrade } = require("../../../lib/grading/runAiGrade");

// Job "running" quá lâu (client bỏ đi / function bị kill khi vượt maxDuration)
// -> cho chạy lại. Đặt ngay trên mức maxDuration (60s) để retry nhanh.
const STALE_MS = 90 * 1000;

function publicJob(j) {
  return {
    jobId: j._id,
    status: j.status,
    kind: j.kind,
    draft: j.status === "done" ? j.result : undefined,
    error: j.status === "error" ? j.error : undefined,
  };
}

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  await connectDB();
  const { id, submissionId } = req.query;

  let job;
  if (id) {
    try {
      job = await GradingJob.findById(id);
    } catch (err) {
      return res.status(404).json({ ok: false, error: "Job not found" });
    }
    if (!job) return res.status(404).json({ ok: false, error: "Job not found" });
  } else if (submissionId) {
    // Job gần đây nhất của bài này (bỏ qua job cũ hơn 30 phút).
    job = await GradingJob.findOne({
      submissionId,
      createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) },
    }).sort({ createdAt: -1 });
    if (!job) return res.status(200).json({ ok: true, status: "none" });
  } else {
    return res.status(400).json({ ok: false, error: "id or submissionId required" });
  }

  // Reset job treo.
  if (job.status === "running" && job.startedAt && Date.now() - job.startedAt.getTime() > STALE_MS) {
    job.status = "pending";
    await job.save();
  }

  if (job.status !== "pending") {
    return res.status(200).json({ ok: true, ...publicJob(job) });
  }

  // Cố "giành" job (atomic) rồi chạy Gemini ngay trong request này.
  const claimed = await GradingJob.findOneAndUpdate(
    { _id: id, status: "pending" },
    { $set: { status: "running", startedAt: new Date() } },
    { new: true }
  );
  if (!claimed) {
    // request khác đã giành -> trả trạng thái hiện tại
    const fresh = await GradingJob.findById(id).lean();
    return res.status(200).json({ ok: true, ...publicJob(fresh) });
  }

  try {
    const { draft } = await runAiGrade(claimed.submissionId);
    claimed.status = "done";
    claimed.result = draft;
    claimed.finishedAt = new Date();
    await claimed.save();
  } catch (err) {
    claimed.status = "error";
    claimed.error = String(err.message || err).slice(0, 500);
    claimed.finishedAt = new Date();
    await claimed.save();
    console.error("[ai-grade] job failed:", err.message);
  }
  return res.status(200).json({ ok: true, ...publicJob(claimed) });
}

module.exports = requireAuth(handler);

// Cho phép hàm chạy tới 60s (giới hạn Hobby) để kịp gọi Gemini.
module.exports.config = { maxDuration: 60 };

module.exports.default = module.exports;

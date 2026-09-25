// Poll trạng thái job chấm AI. Lần poll đầu tiên thấy job "pending" sẽ TỰ CHẠY
// Gemini trong chính request này (chạy ngầm — request tạo job đã trả về từ trước).
// maxDuration 60s (giới hạn Hobby). Speaking audio dài có thể sát mức này.

const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { withTenant, tenantFilter, assertOwned } = require("../../../lib/tenant");
const GradingJob = require("../../../lib/models/GradingJob");
const { runAiGrade } = require("../../../lib/grading/runAiGrade");
const Submission = require("../../../lib/models/Submission");

// Lưu draft AI vào submission dưới dạng nháp — học sinh CHƯA thấy (gradingStatus
// "ai_draft"). Chỉ ghi khi bài chưa được chấm để không đè bản của giáo viên.
async function persistDraft(ws, submissionId, draft) {
  const s = await assertOwned(ws, Submission, submissionId, { message: "Submission not found" });
  if (s.gradingStatus === "graded") return;
  if (Array.isArray(draft.criteria)) {
    s.criteria = draft.criteria.map((c) => ({ key: c.key, band: c.band != null ? Number(c.band) : null, comment: String(c.comment || "") }));
  }
  if (Array.isArray(draft.annotations)) s.annotations = draft.annotations;
  if (typeof draft.overallFeedback === "string") s.manualFeedback = draft.overallFeedback;
  if (Number.isFinite(Number(draft.suggestedOverall))) s.manualScore = Number(draft.suggestedOverall);
  if (Array.isArray(draft.priorities)) s.priorities = draft.priorities;
  if (Array.isArray(draft.topicVocabulary)) s.topicVocabulary = draft.topicVocabulary;
  if (typeof draft.improvedSample === "string") s.improvedSample = draft.improvedSample;
  if (typeof draft.mainIssue === "string") s.mainIssue = draft.mainIssue;
  if (typeof draft.transcript === "string") s.transcript = draft.transcript;
  if (Array.isArray(draft.speakingNotes)) s.speakingNotes = draft.speakingNotes;
  s.gradeSource = "ai";
  s.gradingStatus = "ai_draft";
  await s.save();
}

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
    job = await assertOwned(req.ws, GradingJob, id, { message: "Job not found" });
  } else if (submissionId) {
    // Job gần đây nhất của bài này (bỏ qua job cũ hơn 30 phút).
    job = await GradingJob.findOne(tenantFilter(req.ws, {
      submissionId,
      createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) },
    })).sort({ createdAt: -1 });
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
  // Dùng job._id (đã xác định ở trên, qua cả 2 nhánh id/submissionId) —
  // KHÔNG dùng lại biến `id` gốc: ở nhánh submissionId nó luôn undefined,
  // nên trước đây findOneAndUpdate không bao giờ khớp và job pending không
  // bao giờ được giành để chạy AI (luôn rơi vào nhánh "đã bị giành").
  const claimed = await GradingJob.findOneAndUpdate(
    { _id: job._id, status: "pending" },
    { $set: { status: "running", startedAt: new Date() } },
    { new: true }
  );
  if (!claimed) {
    // request khác đã giành -> trả trạng thái hiện tại
    const fresh = await assertOwned(req.ws, GradingJob, job._id, { lean: true, message: "Job not found" });
    return res.status(200).json({ ok: true, ...publicJob(fresh) });
  }

  try {
    const { draft, model } = await runAiGrade(claimed.submissionId, { actor: req.auth, source: req.url });
    claimed.status = "done";
    claimed.result = { ...draft, model };
    claimed.model = model;
    claimed.finishedAt = new Date();
    await claimed.save();
    try {
      await persistDraft(req.ws, claimed.submissionId, draft);
    } catch (e) {
      console.error("[ai-grade] could not persist draft:", e.message);
    }
  } catch (err) {
    claimed.status = "error";
    claimed.error = String(err.message || err).slice(0, 500);
    claimed.finishedAt = new Date();
    await claimed.save();
    console.error("[ai-grade] job failed:", err.message);
  }
  return res.status(200).json({ ok: true, ...publicJob(claimed) });
}

module.exports = requireAuth(withTenant(handler));

// Cho phép hàm chạy tới 60s (giới hạn Hobby) để kịp gọi Gemini.
module.exports.config = { maxDuration: 60 };

module.exports.default = module.exports;

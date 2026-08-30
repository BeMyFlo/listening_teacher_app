// Xem trạng thái job gửi thông báo hạn nộp của 1 Unit (cho giáo viên).
//
//   GET /api/admin/deadline-jobs?unitId=<id>
//
// Tự "chữa": nếu có job pending / running-treo thì chạy tới khi xong ngay trong
// request này (giống cách /api/admin/grading-jobs chạy job pending khi được poll)
// — nên chỉ cần mở lại Unit là các mail còn sót được gửi nốt.

const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const DeadlineEmailJob = require("../../../lib/models/DeadlineEmailJob");
const { runDeadlineEmailJob } = require("../../../lib/notifications/deadlineAssign");

const RECENT_MS = 60 * 60 * 1000; // chỉ liệt kê job trong 1h gần đây

function publicJob(j) {
  return {
    id: String(j._id),
    unitId: String(j.unitId),
    classId: String(j.classId),
    categoryKey: j.categoryKey || null,
    dueAt: j.dueAt,
    status: j.status,
    progress: j.progress,
    error: j.status === "error" ? j.error : undefined,
    createdAt: j.createdAt,
  };
}

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  await connectDB();
  const { unitId } = req.query;
  if (!unitId) {
    return res.status(400).json({ ok: false, error: "unitId is required" });
  }

  let jobs;
  try {
    jobs = await DeadlineEmailJob.find({
      unitId,
      createdAt: { $gte: new Date(Date.now() - RECENT_MS) },
    })
      .sort({ createdAt: -1 })
      .lean();
  } catch (err) {
    return res.status(400).json({ ok: false, error: "Invalid unitId" });
  }

  // Chạy nốt job chưa xong.
  for (const j of jobs) {
    const stale =
      j.status === "running" &&
      j.startedAt &&
      Date.now() - new Date(j.startedAt).getTime() > 90 * 1000;
    if (j.status === "pending" || stale) {
      try {
        await runDeadlineEmailJob(j._id);
      } catch (err) {
        console.error(`[deadline-job ${j._id}] self-heal failed:`, err.message);
      }
    }
  }

  const fresh = await DeadlineEmailJob.find({
    unitId,
    createdAt: { $gte: new Date(Date.now() - RECENT_MS) },
  })
    .sort({ createdAt: -1 })
    .lean();

  return res.status(200).json({ ok: true, jobs: fresh.map(publicJob) });
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;
module.exports.config = { maxDuration: 60 };

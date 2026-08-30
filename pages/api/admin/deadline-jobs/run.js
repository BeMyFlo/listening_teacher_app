// Worker gửi thông báo "vừa có hạn nộp" (chạy ngầm).
//
//   POST body { ids: [jobId, ...] }  -> chạy đúng các job đó
//   POST body {}                     -> sweepDeadlineEmailJobs() (dùng cho cron)
//
// Auth: header "Authorization: Bearer <CRON_SECRET>" (đường nội bộ / cron)
//       HOẶC token giáo viên hợp lệ.
//
// Kích bằng keepalive fetch trong app/teacher/lessons/[unitId]/page.js ngay sau
// khi Save — request sống sót qua điều hướng trang. maxDuration 60s; job đông
// người sẽ để dở (status "pending") và cron/lần mở lại chạy tiếp.

const jwt = require("jsonwebtoken");
const { connectDB } = require("../../../../lib/db");
const {
  runDeadlineEmailJob,
  sweepDeadlineEmailJobs,
} = require("../../../../lib/notifications/deadlineAssign");

function authorized(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) return false;

  const secret = process.env.CRON_SECRET;
  if (secret && token === secret) return true;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.role === "teacher";
  } catch {
    return false;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  if (!authorized(req)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  await connectDB();

  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids.filter(Boolean) : [];

  try {
    if (ids.length) {
      const jobs = [];
      for (const id of ids) {
        let job;
        try {
          job = await runDeadlineEmailJob(id);
        } catch (err) {
          console.error(`[deadline-job ${id}] run failed:`, err.message);
        }
        if (job) {
          jobs.push({ id: String(job._id), status: job.status, progress: job.progress });
        }
      }
      return res.status(200).json({ ok: true, jobs });
    }

    const swept = await sweepDeadlineEmailJobs();
    return res.status(200).json({ ok: true, ...swept });
  } catch (err) {
    console.error("[deadline-jobs/run] failed:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};

module.exports.default = module.exports;
module.exports.config = { maxDuration: 60 };

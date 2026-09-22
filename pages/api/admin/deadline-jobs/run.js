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

const { connectDB } = require("../../../../lib/db");
const { requireTeacher } = require("../../../../lib/auth");
const {
  runDeadlineEmailJob,
  sweepDeadlineEmailJobs,
} = require("../../../../lib/notifications/deadlineAssign");

// Đường nội bộ / cron: header "Authorization: Bearer <CRON_SECRET>".
function isCronCall(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") && header.slice(7).trim() === secret;
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
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
}

// Cron gọi bằng CRON_SECRET thì đi thẳng; còn lại đi qua requireTeacher như
// mọi route khác, để dùng chung một chỗ verify JWT và vẫn ghi audit log.
module.exports = async (req, res) => {
  if (isCronCall(req)) return handler(req, res);
  return requireTeacher(handler)(req, res);
};

module.exports.default = module.exports;
module.exports.config = { maxDuration: 60 };

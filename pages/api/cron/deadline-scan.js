// Cron: quét hạn nộp sắp tới cho MỌI học sinh và sinh thông báo (in-app +
// email). Chạy định kỳ qua Vercel Cron (xem vercel.json).
//
// Bảo vệ: Vercel Cron tự gắn header "Authorization: Bearer $CRON_SECRET".
// CRON_SECRET là BẮT BUỘC — thiếu thì endpoint trả 500 chứ không mở tự do,
// kể cả khi chạy local.

const { connectDB } = require("../../../lib/db");
const { generateDeadlineNotificationsForAll } = require("../../../lib/notifications/generate");
const { sweepDeadlineEmailJobs } = require("../../../lib/notifications/deadlineAssign");

module.exports = async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || "";
  // Không có CRON_SECRET thì endpoint đóng, ở MỌI môi trường. Trước đây khi
  // NODE_ENV khác "production" nó chạy tự do — ai gọi cũng kích được một đợt
  // quét và gửi email hàng loạt.
  if (!secret) {
    return res.status(500).json({ ok: false, error: "CRON_SECRET not configured" });
  }
  if (auth !== `Bearer ${secret}`) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    await connectDB();
  } catch (err) {
    console.error("[cron] deadline-scan: DB connect failed:", err.message);
    return res.status(500).json({ ok: false, error: "Database unavailable" });
  }
  try {
    const result = await generateDeadlineNotificationsForAll();
    // Lưới an toàn: gửi nốt job "vừa có hạn nộp" mà keepalive fetch lúc Save
    // không kịp chạy / để dở.
    let deadlineEmailJobs = null;
    try {
      deadlineEmailJobs = await sweepDeadlineEmailJobs();
    } catch (err) {
      console.error("[cron] deadline email sweep failed:", err.message);
    }
    return res.status(200).json({ ok: true, ...result, deadlineEmailJobs });
  } catch (err) {
    console.error("[cron] deadline-scan failed:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};

module.exports.default = module.exports;

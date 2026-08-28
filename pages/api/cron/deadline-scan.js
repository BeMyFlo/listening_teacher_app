// Cron: quét hạn nộp sắp tới cho MỌI học sinh và sinh thông báo (in-app +
// email). Chạy định kỳ qua Vercel Cron (xem vercel.json).
//
// Bảo vệ: Vercel Cron tự gắn header "Authorization: Bearer $CRON_SECRET".
// Đặt env CRON_SECRET để chặn gọi tay từ ngoài. Không đặt -> chỉ chạy khi
// không phải môi trường production.

const { connectDB } = require("../../../lib/db");
const { generateDeadlineNotificationsForAll } = require("../../../lib/notifications/generate");

module.exports = async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || "";
  if (secret) {
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
  } else if (process.env.NODE_ENV === "production") {
    return res.status(500).json({ ok: false, error: "CRON_SECRET not configured" });
  }

  await connectDB();
  try {
    const result = await generateDeadlineNotificationsForAll();
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron] deadline-scan failed:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};

module.exports.default = module.exports;

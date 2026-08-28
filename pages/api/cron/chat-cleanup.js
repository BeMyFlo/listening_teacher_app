// Cron ngày: xoá file ảnh/video chat trên Cloudinary quá 30 ngày. Tin nhắn
// tự hết hạn qua Mongo TTL (Message model). Bảo vệ bằng CRON_SECRET.

const { cleanupChatMedia } = require("../../../lib/cloudinary");

module.exports = async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || "";
  if (secret) {
    if (auth !== `Bearer ${secret}`) return res.status(401).json({ ok: false, error: "Unauthorized" });
  } else if (process.env.NODE_ENV === "production") {
    return res.status(500).json({ ok: false, error: "CRON_SECRET not configured" });
  }

  try {
    const r = await cleanupChatMedia({ maxAgeDays: 30 });
    return res.status(200).json({ ok: true, ...r });
  } catch (err) {
    console.error("[cron] chat-cleanup failed:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};

module.exports.config = { maxDuration: 60 };
module.exports.default = module.exports;

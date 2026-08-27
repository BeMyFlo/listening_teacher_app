const { connectDB } = require("../../lib/db");
const { requireStudent } = require("../../lib/auth");
const Student = require("../../lib/models/Student");
const Notification = require("../../lib/models/Notification");
const { generateDeadlineNotifications } = require("../../lib/notifications/generate");

const LIMIT = 50;

function toPublic(n) {
  return {
    _id: n._id,
    type: n.type,
    unitId: n.unitId || null,
    title: n.title,
    body: n.body,
    dueAt: n.dueAt || null,
    read: !!(n.deliveries && n.deliveries.inapp && n.deliveries.inapp.readAt),
    createdAt: n.createdAt,
  };
}

async function handler(req, res) {
  await connectDB();

  const student = await Student.findById(req.auth.studentId);
  if (!student) {
    return res.status(401).json({ ok: false, error: "Account no longer exists, please sign in again" });
  }

  if (req.method === "GET") {
    // Sinh thông báo nhắc hạn (lazy) trước khi trả danh sách. Lỗi ở bước này
    // không được làm hỏng cả response — chuông vẫn phải hiện cái đã có.
    try {
      await generateDeadlineNotifications(student);
    } catch (err) {
      console.error("[notifications] generate failed:", err.message);
    }

    const rows = await Notification.find({ studentId: student._id })
      .sort({ createdAt: -1 })
      .limit(LIMIT)
      .lean();
    const unreadCount = await Notification.countDocuments({
      studentId: student._id,
      "deliveries.inapp.readAt": null,
    });
    return res.status(200).json({ ok: true, rows: rows.map(toPublic), unreadCount });
  }

  if (req.method === "PUT") {
    const { markAllRead, ids } = req.body || {};
    const filter = { studentId: student._id, "deliveries.inapp.readAt": null };
    if (!markAllRead) {
      if (!Array.isArray(ids) || !ids.length) {
        return res.status(400).json({ ok: false, error: "Nothing to mark" });
      }
      filter._id = { $in: ids };
    }
    await Notification.updateMany(filter, { $set: { "deliveries.inapp.readAt": new Date() } });
    const unreadCount = await Notification.countDocuments({
      studentId: student._id,
      "deliveries.inapp.readAt": null,
    });
    return res.status(200).json({ ok: true, unreadCount });
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireStudent(handler);

module.exports.default = module.exports;

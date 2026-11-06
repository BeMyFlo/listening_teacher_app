const mongoose = require("mongoose");
const { connectDB } = require("../../../lib/db");
const { requireTeacher } = require("../../../lib/auth");
const Teacher = require("../../../lib/models/Teacher");
const Notification = require("../../../lib/models/Notification");

const LIMIT = 50;

function toPublic(n) {
  return {
    _id: n._id,
    type: n.type,
    unitId: n.unitId || null,
    link: n.link || (n.unitId ? "/teacher/lessons/" + n.unitId : ""),
    title: n.title,
    body: n.body,
    dueAt: n.dueAt || null,
    read: !!(n.deliveries && n.deliveries.inapp && n.deliveries.inapp.readAt),
    createdAt: n.createdAt,
  };
}

async function handler(req, res) {
  await connectDB();

  const teacher = await Teacher.findById(req.auth.teacherId).select("_id").lean();
  if (!teacher) {
    return res.status(401).json({ ok: false, error: "Account no longer exists, please sign in again" });
  }

  if (req.method === "GET") {
    const rows = await Notification.find({ teacherId: teacher._id, dismissedAt: null })
      .sort({ createdAt: -1 })
      .limit(LIMIT)
      .lean();
    const unreadCount = await Notification.countDocuments({
      teacherId: teacher._id,
      dismissedAt: null,
      "deliveries.inapp.readAt": null,
    });
    return res.status(200).json({ ok: true, rows: rows.map(toPublic), unreadCount });
  }

  if (req.method === "PUT") {
    const { markAllRead, ids, dismiss, dismissAll } = req.body || {};

    // Ẩn (×) 1 vài thông báo hoặc tất cả — coi như đã đọc luôn.
    if (dismiss || dismissAll) {
      const f = { teacherId: teacher._id, dismissedAt: null };
      if (!dismissAll) {
        if (!Array.isArray(ids) || !ids.length) {
          return res.status(400).json({ ok: false, error: "Nothing to dismiss" });
        }
        f._id = { $in: ids.filter((x) => mongoose.Types.ObjectId.isValid(String(x))) };
      }
      const now = new Date();
      await Notification.updateMany(f, { $set: { dismissedAt: now } });
      await Notification.updateMany({ ...f, dismissedAt: now, "deliveries.inapp.readAt": null }, { $set: { "deliveries.inapp.readAt": now } });
      return res.status(200).json({ ok: true });
    }
    const filter = { teacherId: teacher._id, "deliveries.inapp.readAt": null };
    if (!markAllRead) {
      if (!Array.isArray(ids) || !ids.length) {
        return res.status(400).json({ ok: false, error: "Nothing to mark" });
      }
      filter._id = { $in: ids };
    }
    await Notification.updateMany(filter, { $set: { "deliveries.inapp.readAt": new Date() } });
    const unreadCount = await Notification.countDocuments({
      teacherId: teacher._id,
      dismissedAt: null,
      "deliveries.inapp.readAt": null,
    });
    return res.status(200).json({ ok: true, unreadCount });
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireTeacher(handler);

module.exports.default = module.exports;

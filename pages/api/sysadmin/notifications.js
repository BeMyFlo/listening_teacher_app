const { connectDB } = require("../../../lib/db");
const { requireRole } = require("../../../lib/auth");
const Notification = require("../../../lib/models/Notification");
const Student = require("../../../lib/models/Student");
const Teacher = require("../../../lib/models/Teacher");

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  await connectDB();

  const { type, recipient, emailStatus, page = "0", limit = "50" } = req.query;
  const lim = Math.min(200, Math.max(1, Number(limit) || 50));
  const skip = Math.max(0, Number(page) || 0) * lim;

  const filter = {};
  if (type) filter.type = type;
  if (recipient === "student") filter.studentId = { $ne: null };
  if (recipient === "teacher") filter.teacherId = { $ne: null };
  if (emailStatus) filter["deliveries.email.status"] = emailStatus;

  const [rows, total, byType] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
    Notification.countDocuments(filter),
    Notification.aggregate([{ $group: { _id: "$type", n: { $sum: 1 } } }]),
  ]);

  const sIds = rows.filter((r) => r.studentId).map((r) => r.studentId);
  const tIds = rows.filter((r) => r.teacherId).map((r) => r.teacherId);
  const [students, teachers] = await Promise.all([
    Student.find({ _id: { $in: sIds } }).select("name").lean(),
    Teacher.find({ _id: { $in: tIds } }).select("name").lean(),
  ]);
  const nameById = {};
  students.forEach((s) => (nameById[String(s._id)] = s.name));
  teachers.forEach((t) => (nameById[String(t._id)] = t.name));

  return res.status(200).json({
    ok: true,
    total,
    page: Number(page) || 0,
    limit: lim,
    byType: byType.reduce((m, x) => ((m[x._id] = x.n), m), {}),
    rows: rows.map((r) => ({
      _id: r._id,
      type: r.type,
      recipientRole: r.studentId ? "student" : "teacher",
      recipientName: nameById[String(r.studentId || r.teacherId)] || "(deleted)",
      title: r.title,
      body: r.body,
      inappRead: !!(r.deliveries && r.deliveries.inapp && r.deliveries.inapp.readAt),
      emailStatus: (r.deliveries && r.deliveries.email && r.deliveries.email.status) || "none",
      emailError: (r.deliveries && r.deliveries.email && r.deliveries.email.error) || "",
      createdAt: r.createdAt,
    })),
  });
}

module.exports = requireRole("admin")(handler);

module.exports.default = module.exports;

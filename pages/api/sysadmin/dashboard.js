const { connectDB } = require("../../../lib/db");
const { requireRole } = require("../../../lib/auth");
const User = require("../../../lib/models/User");
const Class = require("../../../lib/models/Class");
const Unit = require("../../../lib/models/Unit");
const Test = require("../../../lib/models/Test");
const Submission = require("../../../lib/models/Submission");
const Notification = require("../../../lib/models/Notification");
const AuditLog = require("../../../lib/models/AuditLog");

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  await connectDB();

  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const dayAgo = new Date(Date.now() - 864e5);

  const [
    usersByRole, classes, unitsPub, unitsDraft, testsPub, testsDraft,
    subsTotal, subsWeek, pendingGrading, notif24h, recentAudit, recentSubs,
  ] = await Promise.all([
    User.aggregate([{ $group: { _id: "$role", n: { $sum: 1 } } }]),
    Class.countDocuments(),
    Unit.countDocuments({ status: "published" }),
    Unit.countDocuments({ status: "draft" }),
    Test.countDocuments({ status: "published" }),
    Test.countDocuments({ status: "draft" }),
    Submission.countDocuments(),
    Submission.countDocuments({ submittedAt: { $gte: weekAgo } }),
    Submission.countDocuments({ kind: { $in: ["writing", "speaking"] }, gradingStatus: { $ne: "graded" } }),
    Notification.countDocuments({ createdAt: { $gte: dayAgo } }),
    AuditLog.find().sort({ at: -1 }).limit(12).lean(),
    Submission.find().sort({ submittedAt: -1 }).limit(8)
      .select("studentName kind testTitle exerciseTitle submittedAt gradingStatus manualScore score total").lean(),
  ]);

  const users = { admin: 0, teacher: 0, student: 0 };
  usersByRole.forEach((r) => { if (r._id in users) users[r._id] = r.n; });

  return res.status(200).json({
    ok: true,
    users,
    classes,
    units: { published: unitsPub, draft: unitsDraft },
    tests: { published: testsPub, draft: testsDraft },
    submissions: { total: subsTotal, week: subsWeek, pendingGrading },
    notifications24h: notif24h,
    recentAudit: recentAudit.map((a) => ({
      at: a.at, actorRole: a.actorRole, actorName: a.actorName, action: a.action, path: a.path, status: a.status,
    })),
    recentSubmissions: recentSubs,
  });
}

module.exports = requireRole("admin")(handler);

module.exports.default = module.exports;

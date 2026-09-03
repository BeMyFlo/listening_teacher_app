// Dữ liệu dashboard học sinh cần TỪ SERVER: streak (cần hạn nộp đầy đủ của Unit)
// + bảng xếp hạng lớp (cần dữ liệu của các bạn cùng lớp). Phần còn lại
// (Continue card, Strengths & Weaknesses, Your tasks, Recent activity) client tự
// tính từ /api/units + /api/submissions.

const { connectDB } = require("../../../lib/db");
const { requireStudent } = require("../../../lib/auth");
const Student = require("../../../lib/models/Student");
const Class = require("../../../lib/models/Class");
const Unit = require("../../../lib/models/Unit");
const Submission = require("../../../lib/models/Submission");
const { computeStreak } = require("../../../lib/student/streak");
const { buildClassLeaderboard } = require("../../../lib/student/leaderboard");

const EMPTY = {
  ok: true,
  streak: { current: 0, longest: 0 },
  leaderboard: { rows: [], myRank: null, myPoints: 0 },
  className: null,
  classLevel: null,
};

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  await connectDB();

  const me = await Student.findById(req.auth.studentId).lean();
  if (!me) {
    return res.status(401).json({ ok: false, error: "Account no longer exists, please sign in again" });
  }
  if (!me.classId) return res.status(200).json(EMPTY);

  const cls = await Class.findById(me.classId).lean();
  if (!cls) return res.status(200).json(EMPTY);

  // Cùng quy tắc lọc Unit như pages/api/units.js: Unit chưa gán lớp -> mọi HS
  // đúng level; ngoài ra chỉ Unit gán đúng lớp mình.
  const classFilter = {
    $or: [
      { classIds: { $exists: false } },
      { classIds: { $size: 0 } },
      { classIds: cls._id },
    ],
  };

  const [units, classmates] = await Promise.all([
    Unit.find({ status: "published", level: cls.level, ...classFilter }).lean(),
    Student.find({ classId: cls._id }).select("name").lean(),
  ]);

  const classmateIds = classmates.map((s) => s._id);
  const submissions = await Submission.find({ studentId: { $in: classmateIds } })
    .select(
      "studentId kind score total manualScore gradingStatus exerciseId promptId testId testSkill unitId isLate submittedAt"
    )
    .lean();

  const mySubs = submissions.filter((s) => String(s.studentId) === String(me._id));
  const streak = computeStreak({ units, subs: mySubs, classId: cls._id });
  const leaderboard = buildClassLeaderboard({ students: classmates, submissions, meId: me._id });

  return res.status(200).json({
    ok: true,
    streak,
    leaderboard,
    className: cls.name,
    classLevel: cls.level,
  });
}

module.exports = requireStudent(handler);

module.exports.default = module.exports;

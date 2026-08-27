const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const Submission = require("../../../lib/models/Submission");
const Test = require("../../../lib/models/Test");
const Unit = require("../../../lib/models/Unit");
const Audio = require("../../../lib/models/Audio");

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  await connectDB();

  const [totalTests, publishedTests, totalAudio, totalUnits, pendingGrading, submissions, byTest, recent] = await Promise.all([
    Test.countDocuments(),
    Test.countDocuments({ status: "published" }),
    Audio.countDocuments(),
    Unit.countDocuments(),
    Submission.countDocuments({ kind: { $in: ["writing", "speaking"] }, gradingStatus: "submitted" }),
    Submission.find().lean(),
    // Nhóm theo cả testSkill — 1 Test giờ có 4 kỹ năng độc lập, gộp chung
    // testId sẽ trộn lẫn điểm Listening/Reading/Writing/Speaking (khác
    // thang điểm) vào 1 trung bình vô nghĩa.
    Submission.aggregate([
      { $match: { testId: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: { testId: "$testId", testTitle: "$testTitle", testSkill: "$testSkill" },
          submissions: { $sum: 1 },
          avgScorePct: { $avg: { $cond: [{ $gt: ["$total", 0] }, { $multiply: [{ $divide: ["$score", "$total"] }, 100] }, 0] } }
        }
      },
      { $sort: { submissions: -1 } }
    ]),
    Submission.find().sort({ submittedAt: -1 }).limit(8).lean()
  ]);

  const totalSubmissions = submissions.length;
  const uniqueStudents = new Set(submissions.map((s) => s.studentName.trim().toLowerCase())).size;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const submissionsThisWeek = submissions.filter((s) => new Date(s.submittedAt).getTime() >= weekAgo).length;
  const avgScorePct = totalSubmissions
    ? submissions.reduce((sum, s) => sum + (s.total > 0 ? (s.score / s.total) * 100 : 0), 0) / totalSubmissions
    : 0;

  return res.status(200).json({
    ok: true,
    summary: {
      totalTests,
      publishedTests,
      totalAudio,
      totalUnits,
      pendingGrading,
      totalSubmissions,
      submissionsThisWeek,
      uniqueStudents,
      avgScorePct: Math.round(avgScorePct)
    },
    byTest: byTest.map((t) => ({
      testId: t._id.testId,
      testTitle: t._id.testTitle,
      testSkill: t._id.testSkill || null,
      submissions: t.submissions,
      avgScorePct: Math.round(t.avgScorePct)
    })),
    recent
  });
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;

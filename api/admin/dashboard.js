const { connectDB } = require("../../lib/db");
const { requireAuth } = require("../../lib/auth");
const Submission = require("../../lib/models/Submission");
const Test = require("../../lib/models/Test");
const Audio = require("../../lib/models/Audio");

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  await connectDB();

  const [totalTests, publishedTests, totalAudio, submissions, byTest, recent] = await Promise.all([
    Test.countDocuments(),
    Test.countDocuments({ status: "published" }),
    Audio.countDocuments(),
    Submission.find().lean(),
    Submission.aggregate([
      {
        $group: {
          _id: { testId: "$testId", testTitle: "$testTitle" },
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
  const avgScorePct = totalSubmissions
    ? submissions.reduce((sum, s) => sum + (s.total > 0 ? (s.score / s.total) * 100 : 0), 0) / totalSubmissions
    : 0;

  return res.status(200).json({
    ok: true,
    summary: {
      totalTests,
      publishedTests,
      totalAudio,
      totalSubmissions,
      uniqueStudents,
      avgScorePct: Math.round(avgScorePct)
    },
    byTest: byTest.map((t) => ({
      testId: t._id.testId,
      testTitle: t._id.testTitle,
      submissions: t.submissions,
      avgScorePct: Math.round(t.avgScorePct)
    })),
    recent
  });
}

module.exports = requireAuth(handler);

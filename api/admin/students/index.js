const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const Student = require("../../../lib/models/Student");
const Submission = require("../../../lib/models/Submission");

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  await connectDB();

  const [students, counts] = await Promise.all([
    Student.find().sort({ createdAt: -1 }).lean(),
    Submission.aggregate([{ $group: { _id: "$studentId", count: { $sum: 1 } } }])
  ]);

  const countByStudent = {};
  counts.forEach((c) => (countByStudent[String(c._id)] = c.count));

  const rows = students.map((s) => ({
    _id: s._id,
    name: s.name,
    username: s.username,
    createdAt: s.createdAt,
    submissionCount: countByStudent[String(s._id)] || 0
  }));

  return res.status(200).json({ ok: true, rows });
}

module.exports = requireAuth(handler);

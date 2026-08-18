const bcrypt = require("bcryptjs");
const { connectDB } = require("../../lib/db");
const { requireAuth } = require("../../lib/auth");
const Student = require("../../lib/models/Student");
const Submission = require("../../lib/models/Submission");

async function handler(req, res) {
  await connectDB();

  if (req.method === "GET") {
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

  if (req.method === "PUT" || req.method === "DELETE") {
    const { id } = req.query;
    let student;
    try {
      student = await Student.findById(id);
    } catch (err) {
      return res.status(404).json({ ok: false, error: "Không tìm thấy học viên" });
    }
    if (!student) {
      return res.status(404).json({ ok: false, error: "Không tìm thấy học viên" });
    }

    if (req.method === "PUT") {
      const password = String((req.body && req.body.password) || "");
      if (password.length < 4) {
        return res.status(400).json({ ok: false, error: "Mật khẩu cần ít nhất 4 ký tự" });
      }
      student.passwordHash = await bcrypt.hash(password, 10);
      await student.save();
      return res.status(200).json({ ok: true });
    }

    // Past submissions are left in place as a historical record (studentId
    // just won't resolve to an account anymore) — same reasoning as keeping
    // testTitle snapshots after a test is edited.
    await student.deleteOne();
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, PUT, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireAuth(handler);

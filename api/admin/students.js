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
      level: s.level,
      createdAt: s.createdAt,
      submissionCount: countByStudent[String(s._id)] || 0
    }));

    return res.status(200).json({ ok: true, rows });
  }

  if (req.method === "POST") {
    const name = String((req.body && req.body.name) || "").trim();
    const username = String((req.body && req.body.username) || "").trim().toLowerCase();
    const password = String((req.body && req.body.password) || "");
    const level = Number((req.body && req.body.level));

    if (!name) return res.status(400).json({ ok: false, error: "Please enter full name" });
    if (!/^[a-z0-9_.]{3,30}$/.test(username)) {
      return res.status(400).json({ ok: false, error: "Username can only contain lowercase letters, numbers, dots/underscores, 3-30 characters" });
    }
    if (password.length < 4) {
      return res.status(400).json({ ok: false, error: "Password must be at least 4 characters" });
    }
    if (!Number.isInteger(level) || level < 1) {
      return res.status(400).json({ ok: false, error: "Please select a valid level" });
    }

    const existing = await Student.exists({ username });
    if (existing) {
      return res.status(409).json({ ok: false, error: "Username is already taken, please choose another" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const student = await Student.create({ name, username, passwordHash, level });
    return res.status(201).json({ ok: true, student: { _id: student._id, name: student.name, username: student.username, level: student.level } });
  }

  if (req.method === "PUT" || req.method === "DELETE") {
    const { id } = req.query;
    let student;
    try {
      student = await Student.findById(id);
    } catch (err) {
      return res.status(404).json({ ok: false, error: "Student not found" });
    }
    if (!student) {
      return res.status(404).json({ ok: false, error: "Student not found" });
    }

    if (req.method === "PUT") {
      const { password, level } = req.body || {};
      if (password != null) {
        if (String(password).length < 4) {
          return res.status(400).json({ ok: false, error: "Password must be at least 4 characters" });
        }
        student.passwordHash = await bcrypt.hash(String(password), 10);
      }
      if (level != null) {
        const lvl = Number(level);
        if (!Number.isInteger(lvl) || lvl < 1) {
          return res.status(400).json({ ok: false, error: "Invalid level" });
        }
        student.level = lvl;
      }
      await student.save();
      return res.status(200).json({ ok: true });
    }

    // Past submissions are left in place as a historical record (studentId
    // just won't resolve to an account anymore) — same reasoning as keeping
    // testTitle snapshots after a test is edited.
    await student.deleteOne();
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST, PUT, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireAuth(handler);

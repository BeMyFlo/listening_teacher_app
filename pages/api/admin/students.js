const bcrypt = require("bcryptjs");
const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const Student = require("../../../lib/models/Student");
const Submission = require("../../../lib/models/Submission");
const Class = require("../../../lib/models/Class");

async function handler(req, res) {
  await connectDB();

  if (req.method === "GET") {
    const [students, counts, classes] = await Promise.all([
      Student.find().sort({ createdAt: -1 }).lean(),
      Submission.aggregate([{ $group: { _id: "$studentId", count: { $sum: 1 } } }]),
      Class.find().lean(),
    ]);

    const countByStudent = {};
    counts.forEach((c) => (countByStudent[String(c._id)] = c.count));
    const classById = {};
    classes.forEach((c) => (classById[String(c._id)] = c));

    const rows = students.map((s) => {
      const cls = s.classId ? classById[String(s.classId)] : null;
      return {
        _id: s._id,
        name: s.name,
        username: s.username,
        email: s.email || "",
        classId: s.classId || null,
        className: cls ? cls.name : null,
        level: cls ? cls.level : null, // suy từ lớp, để hiển thị
        createdAt: s.createdAt,
        submissionCount: countByStudent[String(s._id)] || 0,
      };
    });

    return res.status(200).json({ ok: true, rows });
  }

  if (req.method === "POST") {
    const name = String((req.body && req.body.name) || "").trim();
    const username = String((req.body && req.body.username) || "").trim().toLowerCase();
    const password = String((req.body && req.body.password) || "");
    const classId = req.body && req.body.classId;
    const email = String((req.body && req.body.email) || "").trim().toLowerCase();

    if (!name) return res.status(400).json({ ok: false, error: "Please enter full name" });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: "Invalid email address" });
    }
    if (!/^[a-z0-9_.]{3,30}$/.test(username)) {
      return res.status(400).json({
        ok: false,
        error: "Username can only contain lowercase letters, numbers, dots/underscores, 3-30 characters",
      });
    }
    if (password.length < 4) {
      return res.status(400).json({ ok: false, error: "Password must be at least 4 characters" });
    }
    if (!classId) {
      return res.status(400).json({ ok: false, error: "Please select a class" });
    }
    let cls;
    try {
      cls = await Class.findById(classId);
    } catch (err) {
      return res.status(400).json({ ok: false, error: "Class not found" });
    }
    if (!cls) return res.status(400).json({ ok: false, error: "Class not found" });

    const existing = await Student.exists({ username });
    if (existing) {
      return res.status(409).json({ ok: false, error: "Username is already taken, please choose another" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const student = await Student.create({ name, username, passwordHash, classId: cls._id, email });
    return res.status(201).json({
      ok: true,
      student: { _id: student._id, name: student.name, username: student.username },
    });
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
      const { password, classId, name, email } = req.body || {};
      if (name != null) {
        if (!String(name).trim()) {
          return res.status(400).json({ ok: false, error: "Full name cannot be empty" });
        }
        student.name = String(name).trim();
      }
      if (email != null) {
        const e = String(email).trim().toLowerCase();
        if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
          return res.status(400).json({ ok: false, error: "Invalid email address" });
        }
        student.email = e;
      }
      if (password != null) {
        if (String(password).length < 4) {
          return res.status(400).json({ ok: false, error: "Password must be at least 4 characters" });
        }
        student.passwordHash = await bcrypt.hash(String(password), 10);
      }
      if ("classId" in (req.body || {})) {
        if (classId == null || String(classId).trim() === "") {
          student.classId = null;
        } else {
          let cls;
          try {
            cls = await Class.findById(classId);
          } catch (err) {
            return res.status(400).json({ ok: false, error: "Class not found" });
          }
          if (!cls) return res.status(400).json({ ok: false, error: "Class not found" });
          student.classId = cls._id;
        }
      }
      await student.save();
      return res.status(200).json({ ok: true });
    }

    await student.deleteOne();
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST, PUT, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;

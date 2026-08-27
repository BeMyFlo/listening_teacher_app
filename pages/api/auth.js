const bcrypt = require("bcryptjs");
const { connectDB } = require("../../lib/db");
const { signTeacherToken, signStudentToken } = require("../../lib/auth");
const Teacher = require("../../lib/models/Teacher");
const Student = require("../../lib/models/Student");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  await connectDB();

  const username = String((req.body && req.body.username) || "").trim().toLowerCase();
  const password = String((req.body && req.body.password) || "");

  if (!username || !password) {
    return res.status(400).json({ ok: false, error: "Please enter your username and password" });
  }

  // Bootstrap: if no Teacher exists in DB -> create first Teacher
  const teacherCount = await Teacher.countDocuments();
  if (teacherCount === 0) {
    const bootstrapPassword = process.env.TEACHER_PASSWORD;
    if (bootstrapPassword && password === bootstrapPassword) {
      const passwordHash = await bcrypt.hash(password, 10);
      const teacher = await Teacher.create({
        name: "Teacher",
        username: username || "admin",
        passwordHash
      });
      return res.status(200).json({ ok: true, role: "teacher", token: signTeacherToken(teacher), name: teacher.name });
    }
  }

  const teacher = await Teacher.findOne({ username });
  if (teacher && (await bcrypt.compare(password, teacher.passwordHash))) {
    return res.status(200).json({ ok: true, role: "teacher", token: signTeacherToken(teacher), name: teacher.name });
  }

  const student = await Student.findOne({ username });
  if (student && (await bcrypt.compare(password, student.passwordHash))) {
    return res.status(200).json({
      ok: true,
      role: "student",
      token: signStudentToken(student),
      name: student.name,
      level: student.level
    });
  }

  return res.status(401).json({ ok: false, error: "Invalid username or password" });
};

module.exports.default = module.exports;

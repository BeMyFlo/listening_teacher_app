const bcrypt = require("bcryptjs");
const { connectDB } = require("../../../lib/db");
const { signStudentToken } = require("../../../lib/auth");
const Student = require("../../../lib/models/Student");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  await connectDB();

  const username = String((req.body && req.body.username) || "").trim().toLowerCase();
  const password = String((req.body && req.body.password) || "");

  const student = await Student.findOne({ username });
  if (!student) {
    return res.status(401).json({ ok: false, error: "Sai tên đăng nhập hoặc mật khẩu" });
  }

  const match = await bcrypt.compare(password, student.passwordHash);
  if (!match) {
    return res.status(401).json({ ok: false, error: "Sai tên đăng nhập hoặc mật khẩu" });
  }

  return res.status(200).json({ ok: true, token: signStudentToken(student), name: student.name });
};

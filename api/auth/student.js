const bcrypt = require("bcryptjs");
const { connectDB } = require("../../lib/db");
const { signStudentToken } = require("../../lib/auth");
const Student = require("../../lib/models/Student");

async function handleLogin(req, res) {
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
}

async function handleRegister(req, res) {
  const name = String((req.body && req.body.name) || "").trim();
  const username = String((req.body && req.body.username) || "").trim().toLowerCase();
  const password = String((req.body && req.body.password) || "");

  if (!name) return res.status(400).json({ ok: false, error: "Vui lòng nhập họ tên" });
  if (!/^[a-z0-9_.]{3,30}$/.test(username)) {
    return res.status(400).json({ ok: false, error: "Tên đăng nhập chỉ gồm chữ thường, số, dấu chấm/gạch dưới, 3-30 ký tự" });
  }
  if (password.length < 4) {
    return res.status(400).json({ ok: false, error: "Mật khẩu cần ít nhất 4 ký tự" });
  }

  const existing = await Student.exists({ username });
  if (existing) {
    return res.status(409).json({ ok: false, error: "Tên đăng nhập đã có người dùng, hãy chọn tên khác" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const student = await Student.create({ name, username, passwordHash });

  return res.status(201).json({ ok: true, token: signStudentToken(student), name: student.name });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  await connectDB();

  if (req.query.action === "register") {
    return handleRegister(req, res);
  }
  return handleLogin(req, res);
};

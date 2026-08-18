const bcrypt = require("bcryptjs");
const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const Student = require("../../../lib/models/Student");

async function handler(req, res) {
  await connectDB();
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

  if (req.method === "DELETE") {
    // Past submissions are left in place as a historical record (studentId
    // just won't resolve to an account anymore) — same reasoning as keeping
    // testTitle snapshots after a test is edited.
    await student.deleteOne();
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "PUT, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireAuth(handler);

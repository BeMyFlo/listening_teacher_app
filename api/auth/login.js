const { signTeacherToken } = require("../../lib/auth");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const password = (req.body && req.body.password) || "";
  const expected = process.env.TEACHER_PASSWORD;

  if (!expected) {
    return res.status(500).json({ ok: false, error: "Server chưa cấu hình TEACHER_PASSWORD" });
  }

  if (password !== expected) {
    return res.status(401).json({ ok: false, error: "Sai mật khẩu" });
  }

  const token = signTeacherToken();
  return res.status(200).json({ ok: true, token });
};

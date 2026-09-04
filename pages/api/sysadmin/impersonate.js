// Admin "đăng nhập hộ" 1 giáo viên để kiểm tra / sửa lỗi. Trả về 1 token
// teacher ngắn hạn (2h) có gắn impBy = userId của admin (để audit log ghi rõ).
const { connectDB } = require("../../../lib/db");
const { requireRole, signUserToken } = require("../../../lib/auth");
const audit = require("../../../lib/audit");
const User = require("../../../lib/models/User");
const Teacher = require("../../../lib/models/Teacher");

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  await connectDB();

  const { userId } = req.body || {};
  const target = await User.findById(userId).catch(() => null);
  if (!target) return res.status(404).json({ ok: false, error: "User not found" });
  if (target.role !== "teacher" || !target.teacherId) {
    return res.status(400).json({ ok: false, error: "You can only log in as a teacher account" });
  }
  if (target.active === false) {
    return res.status(400).json({ ok: false, error: "That account is disabled" });
  }

  const teacher = await Teacher.findById(target.teacherId).lean();
  const token = signUserToken(target, teacher, { impBy: req.auth.userId, expiresIn: "2h" });

  audit.record({
    req, res,
    action: "impersonate.start",
    status: 200,
    meta: { targetUserId: String(target._id), targetName: (teacher && teacher.name) || target.name },
  });

  return res.status(200).json({ ok: true, token, name: (teacher && teacher.name) || target.name });
}

module.exports = requireRole("admin")(handler);

module.exports.default = module.exports;

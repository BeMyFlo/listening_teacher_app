const bcrypt = require("bcryptjs");
const { connectDB } = require("../../lib/db");
const { signUserToken } = require("../../lib/auth");
const users = require("../../lib/users");
const User = require("../../lib/models/User");
const Teacher = require("../../lib/models/Teacher");
const Student = require("../../lib/models/Student");
const audit = require("../../lib/audit");
const rateLimit = require("../../lib/rateLimit");

// Hồ sơ nghiệp vụ của 1 User (để lấy tên). Admin không có hồ sơ.
async function profileFor(user) {
  if (user.teacherId) return Teacher.findById(user.teacherId).lean();
  if (user.studentId) return Student.findById(user.studentId).lean();
  return null;
}

// Tài khoản cũ (Teacher/Student tạo trước khi có bảng User) -> tạo User on-the-fly.
async function backfillUser(profile, role) {
  const link = role === "teacher" ? { teacherId: profile._id } : { studentId: profile._id };
  return User.create({
    username: profile.username,
    passwordHash: profile.passwordHash,
    role,
    name: profile.name || "",
    email: profile.email || "",
    ...link,
  });
}

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

  // Chặn dò mật khẩu: đếm theo cả (IP + username) lẫn IP. Cặp IP+username chặn
  // dò 1 tài khoản; riêng IP chặn quét nhiều tài khoản một lượt.
  const ip = rateLimit.clientIp(req);
  const userKey = `login:${ip}:${username}`;
  const ipKey = `login:${ip}`;
  const gate = rateLimit.hit(userKey);
  const ipGate = rateLimit.hit(ipKey, { max: rateLimit.MAX_ATTEMPTS * 5 });
  if (gate.limited || ipGate.limited) {
    const retry = Math.max(gate.retryAfterSec, ipGate.retryAfterSec);
    res.setHeader("Retry-After", String(retry));
    audit.record({
      req, res,
      actor: { role: "system" },
      action: "auth.login_rate_limited",
      status: 429,
      meta: { username },
    });
    return res.status(429).json({
      ok: false,
      error: `Too many sign-in attempts. Please try again in ${Math.ceil(retry / 60)} minute(s).`,
    });
  }

  const respond = async (user, profile) => {
    rateLimit.reset(userKey);
    rateLimit.reset(ipKey);
    await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
    audit.record({
      req, res,
      actor: { role: user.role, userId: user._id, name: (profile && profile.name) || user.name },
      action: "auth.login",
      status: 200,
    });
    return res.status(200).json({
      ok: true,
      role: user.role,
      token: signUserToken(user, profile),
      name: (profile && profile.name) || user.name || "",
    });
  };

  // So khớp mật khẩu an toàn kể cả khi bản ghi thiếu passwordHash (tài khoản
  // do script migrate tạo dở) — bcrypt.compare(pw, undefined) sẽ ném lỗi.
  const passwordMatches = async (hash) => !!hash && bcrypt.compare(password, hash);

  // 1) Bootstrap admin đầu tiên qua ADMIN_PASSWORD.
  // Nhánh này chỉ mở khi KHÔNG còn admin nào (adminCount === 0). Trạng thái đó
  // không đạt tới được từ giao diện: pages/api/sysadmin/users.js chặn xoá / vô
  // hiệu hoá admin cuối cùng. Sửa hai chỗ đó thì phải xem lại chỗ này.
  if (process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) {
    const adminCount = await User.countDocuments({ role: "admin" });
    if (adminCount === 0) {
      if (await User.exists({ username })) {
        return res.status(400).json({
          ok: false,
          error: `"${username}" is already a user — pick a different username for the admin account`,
        });
      }
      try {
        const { user } = await users.createAdmin({ name: "Admin", username, password });
        return respond(user, null);
      } catch (e) {
        return res.status(e.status || 400).json({ ok: false, error: e.message });
      }
    }
  }

  // 2) Bootstrap giáo viên đầu tiên qua TEACHER_PASSWORD (giữ luồng cũ).
  if (process.env.TEACHER_PASSWORD && password === process.env.TEACHER_PASSWORD) {
    const teacherCount = await Teacher.countDocuments();
    if (teacherCount === 0 && !(await User.exists({ username }))) {
      try {
        const { user, teacher } = await users.createTeacher({ name: "Teacher", username, password });
        return respond(user, teacher);
      } catch (e) {
        return res.status(e.status || 400).json({ ok: false, error: e.message });
      }
    }
  }

  // 3) Đăng nhập thường qua bảng User.
  const user = await User.findOne({ username });
  if (user && (await passwordMatches(user.passwordHash))) {
    if (!user.active) {
      return res.status(403).json({ ok: false, error: "This account has been disabled" });
    }
    return respond(user, await profileFor(user));
  }

  // 4) Tài khoản chưa migrate -> khớp trực tiếp Teacher/Student rồi tạo User.
  if (!user) {
    const teacher = await Teacher.findOne({ username });
    if (teacher && (await passwordMatches(teacher.passwordHash))) {
      return respond(await backfillUser(teacher, "teacher"), teacher);
    }
    const student = await Student.findOne({ username });
    if (student && (await passwordMatches(student.passwordHash))) {
      return respond(await backfillUser(student, "student"), student);
    }
  }

  audit.record({ req, res, actor: { role: "system" }, action: "auth.login_failed", status: 401, meta: { username } });
  return res.status(401).json({ ok: false, error: "Invalid username or password" });
};

module.exports.default = module.exports;

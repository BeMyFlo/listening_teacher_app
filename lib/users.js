// Nơi DUY NHẤT giữ User <-> hồ sơ (Teacher/Student) đồng bộ. Mọi chỗ tạo/xoá/
// đổi mật khẩu tài khoản phải đi qua đây (pages/api/auth.js, admin/students.js,
// pages/api/sysadmin/users.js).
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const Teacher = require("./models/Teacher");
const Student = require("./models/Student");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9_.]{3,30}$/;

function normUsername(u) {
  return String(u || "").trim().toLowerCase();
}

async function assertUsernameFree(username) {
  if (!USERNAME_RE.test(username)) {
    const e = new Error("Username can only contain lowercase letters, numbers, dots/underscores, 3-30 characters");
    e.status = 400;
    throw e;
  }
  if (await User.exists({ username })) {
    const e = new Error("Username is already taken, please choose another");
    e.status = 409;
    throw e;
  }
}

function cleanEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  if (e && !EMAIL_RE.test(e)) {
    const err = new Error("Invalid email address");
    err.status = 400;
    throw err;
  }
  return e;
}

// role "teacher"
async function createTeacher({ name, username, password, email, classIds = [] }) {
  username = normUsername(username);
  const nm = String(name || "").trim();
  if (!nm) { const e = new Error("Please enter full name"); e.status = 400; throw e; }
  if (String(password || "").length < 4) { const e = new Error("Password must be at least 4 characters"); e.status = 400; throw e; }
  const em = cleanEmail(email);
  await assertUsernameFree(username);

  const passwordHash = await bcrypt.hash(String(password), 10);
  const teacher = await Teacher.create({ name: nm, username, passwordHash, email: em, classIds });
  const user = await User.create({
    username, passwordHash, role: "teacher", teacherId: teacher._id, name: nm, email: em,
  });
  return { user, teacher };
}

// role "student"
async function createStudent({ name, username, password, email, classId = null }) {
  username = normUsername(username);
  const nm = String(name || "").trim();
  if (!nm) { const e = new Error("Please enter full name"); e.status = 400; throw e; }
  if (String(password || "").length < 4) { const e = new Error("Password must be at least 4 characters"); e.status = 400; throw e; }
  const em = cleanEmail(email);
  await assertUsernameFree(username);

  const passwordHash = await bcrypt.hash(String(password), 10);
  const student = await Student.create({ name: nm, username, passwordHash, email: em, classId });
  const user = await User.create({
    username, passwordHash, role: "student", studentId: student._id, name: nm, email: em,
  });
  return { user, student };
}

// role "admin" — không có hồ sơ Teacher/Student
async function createAdmin({ name, username, password, email }) {
  username = normUsername(username);
  const nm = String(name || "Admin").trim() || "Admin";
  if (String(password || "").length < 4) { const e = new Error("Password must be at least 4 characters"); e.status = 400; throw e; }
  const em = cleanEmail(email);
  await assertUsernameFree(username);

  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = await User.create({ username, passwordHash, role: "admin", name: nm, email: em });
  return { user };
}

// Đổi mật khẩu — cập nhật cả User lẫn hồ sơ.
async function setPassword(userId, password) {
  if (String(password || "").length < 4) { const e = new Error("Password must be at least 4 characters"); e.status = 400; throw e; }
  const user = await User.findById(userId);
  if (!user) { const e = new Error("User not found"); e.status = 404; throw e; }
  const hash = await bcrypt.hash(String(password), 10);
  user.passwordHash = hash;
  await user.save();
  if (user.teacherId) await Teacher.updateOne({ _id: user.teacherId }, { $set: { passwordHash: hash } });
  if (user.studentId) await Student.updateOne({ _id: user.studentId }, { $set: { passwordHash: hash } });
  return user;
}

// Đổi tên hiển thị — cập nhật cả 2.
async function renameUser(userId, name) {
  const nm = String(name || "").trim();
  if (!nm) { const e = new Error("Full name cannot be empty"); e.status = 400; throw e; }
  const user = await User.findById(userId);
  if (!user) { const e = new Error("User not found"); e.status = 404; throw e; }
  user.name = nm;
  await user.save();
  if (user.teacherId) await Teacher.updateOne({ _id: user.teacherId }, { $set: { name: nm } });
  if (user.studentId) await Student.updateOne({ _id: user.studentId }, { $set: { name: nm } });
  return user;
}

async function setEmail(userId, email) {
  const em = cleanEmail(email);
  const user = await User.findById(userId);
  if (!user) { const e = new Error("User not found"); e.status = 404; throw e; }
  user.email = em;
  await user.save();
  if (user.teacherId) await Teacher.updateOne({ _id: user.teacherId }, { $set: { email: em } });
  if (user.studentId) await Student.updateOne({ _id: user.studentId }, { $set: { email: em } });
  return user;
}

async function setActive(userId, active) {
  const user = await User.findByIdAndUpdate(userId, { $set: { active: !!active } }, { new: true });
  if (!user) { const e = new Error("User not found"); e.status = 404; throw e; }
  return user;
}

// Xoá tài khoản + hồ sơ. (Submission/Notification/Attendance để lại — dọn ở phase sau.)
async function deleteUserCascade(userId) {
  const user = await User.findById(userId);
  if (!user) { const e = new Error("User not found"); e.status = 404; throw e; }
  if (user.teacherId) await Teacher.deleteOne({ _id: user.teacherId });
  if (user.studentId) await Student.deleteOne({ _id: user.studentId });
  await user.deleteOne();
  return { deleted: true, role: user.role };
}

// Xoá hồ sơ Student/Teacher -> gỡ luôn User đã link (dùng khi luồng cũ xoá hồ sơ trực tiếp).
async function deleteUserByProfile({ teacherId, studentId }) {
  const q = teacherId ? { teacherId } : studentId ? { studentId } : null;
  if (!q) return;
  await User.deleteOne(q);
}

module.exports = {
  createTeacher,
  createStudent,
  createAdmin,
  setPassword,
  renameUser,
  setEmail,
  setActive,
  deleteUserCascade,
  deleteUserByProfile,
  USERNAME_RE,
  EMAIL_RE,
};

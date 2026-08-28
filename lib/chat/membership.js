// Thành viên phòng chat của 1 lớp = học sinh thuộc lớp + giáo viên phụ trách
// lớp (Teacher.classIds; chưa gán lớp nào -> phụ trách tất cả). Suy ra, không
// lưu. Mọi route trong pages/api/chat/* phải check quyền qua đây.

const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const Class = require("../models/Class");

// req.auth từ requireStudent/requireTeacher: { role, studentId | teacherId }
function userFromAuth(auth) {
  if (auth.role === "student") return { role: "student", id: String(auth.studentId), name: auth.name };
  if (auth.role === "teacher") return { role: "teacher", id: String(auth.teacherId), name: auth.name };
  return null;
}

// Danh sách classId (string) mà user được vào chat.
async function classIdsForUser(user) {
  if (!user) return [];
  if (user.role === "student") {
    const s = await Student.findById(user.id).select("classId name").lean();
    return s && s.classId ? [String(s.classId)] : [];
  }
  const t = await Teacher.findById(user.id).select("classIds").lean();
  if (t && Array.isArray(t.classIds) && t.classIds.length) return t.classIds.map(String);
  const all = await Class.find().select("_id").lean();
  return all.map((c) => String(c._id));
}

async function canAccessClassChat(user, classId) {
  const ids = await classIdsForUser(user);
  return ids.includes(String(classId));
}

module.exports = { userFromAuth, classIdsForUser, canAccessClassChat };

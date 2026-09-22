// Phạm vi lớp của giáo viên đang đăng nhập.
//
// Quy ước (lấy đúng theo pages/api/admin/dashboard.js đã làm từ trước):
//   Teacher.classIds rỗng  -> giáo viên "toàn quyền", thấy mọi lớp.
//   Teacher.classIds có giá trị -> chỉ thấy đúng những lớp đó.
//
// Nhờ vậy cấu hình cũ (chưa ai gán classIds) chạy y như trước, còn khi admin
// bắt đầu gán lớp thì ranh giới được siết ở TẦNG API chứ không chỉ ở giao diện.

const Teacher = require("./models/Teacher");

// Trả { all: true } nếu được xem tất cả, hoặc { all: false, classIds: [...] }.
async function teacherScope(auth) {
  const teacher = auth && auth.teacherId
    ? await Teacher.findById(auth.teacherId).select("classIds").lean()
    : null;
  const ids = teacher && Array.isArray(teacher.classIds) ? teacher.classIds : [];
  if (!ids.length) return { all: true, classIds: null };
  return { all: false, classIds: ids };
}

// Ghép điều kiện lớp vào filter của mongoose.
//   scopeFilter(scope, "classId")  -> { classId: { $in: [...] } }
//   all: true -> {} (không giới hạn)
function scopeFilter(scope, field = "classId") {
  if (!scope || scope.all) return {};
  return { [field]: { $in: scope.classIds } };
}

// Giáo viên này có được đụng vào lớp cụ thể đó không.
function canAccessClass(scope, classId) {
  if (!scope || scope.all) return true;
  if (!classId) return false;
  return scope.classIds.some((id) => String(id) === String(classId));
}

module.exports = { teacherScope, scopeFilter, canAccessClass };

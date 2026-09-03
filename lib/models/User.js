const mongoose = require("mongoose");

// Danh tính đăng nhập DUY NHẤT của mọi vai trò. Giữ credentials + role ở đây;
// hồ sơ nghiệp vụ nằm ở Teacher / Student và được trỏ tới qua teacherId/studentId.
//   role "admin"   -> không có hồ sơ (quản trị viên hệ thống)
//   role "teacher" -> teacherId trỏ tới Teacher
//   role "student" -> studentId trỏ tới Student
// name/email là bản sao tiện cho trang quản trị; nguồn sự thật vẫn là hồ sơ.
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["admin", "teacher", "student"], required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", default: null },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", default: null },
  name: { type: String, default: "" },
  email: { type: String, trim: true, lowercase: true, default: "" },
  active: { type: Boolean, default: true },
  lastLoginAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

UserSchema.index({ teacherId: 1 }, { unique: true, sparse: true });
UserSchema.index({ studentId: 1 }, { unique: true, sparse: true });
UserSchema.index({ role: 1 });

module.exports = mongoose.models.User || mongoose.model("User", UserSchema);

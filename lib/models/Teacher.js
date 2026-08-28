const mongoose = require("mongoose");

const TeacherSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  // Kênh email: nhận thông báo khi học sinh nộp Writing/Speaking cần chấm.
  email: { type: String, trim: true, lowercase: true, default: "" },
  // Lớp giáo viên phụ trách. [] = phụ trách tất cả (khi chưa gán lớp cụ thể),
  // để thông báo không bị mất. Xem lib/notifications/teacher.js.
  classIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Class" }], default: [] },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Teacher || mongoose.model("Teacher", TeacherSchema);

const mongoose = require("mongoose");

// Level của học sinh = level của Lớp mà học sinh thuộc về (không còn field
// level riêng trên Student). Học sinh chưa xếp lớp thì chưa có nội dung.
const StudentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class", default: null },
  // Optional — chưa dùng để đăng nhập. Dành cho kênh gửi email nhắc hạn nộp
  // (lib/notifications/channels/email.js) khi được bật sau này.
  email: { type: String, trim: true, lowercase: true, default: "" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Student || mongoose.model("Student", StudentSchema);

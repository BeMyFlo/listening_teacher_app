const mongoose = require("mongoose");

// Level của học sinh = level của Lớp mà học sinh thuộc về (không còn field
// level riêng trên Student). Học sinh chưa xếp lớp thì chưa có nội dung.
const StudentSchema = new mongoose.Schema({
  // Workspace sở hữu document này — xem ghi chú ở lib/models/Class.js.
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class", default: null },
  // Optional — chưa dùng để đăng nhập. Dành cho kênh gửi email nhắc hạn nộp
  // (lib/notifications/channels/email.js) khi được bật sau này.
  email: { type: String, trim: true, lowercase: true, default: "" },
  // Version mới nhất của lib/changelog.js mà học sinh đã xem popup "Có gì mới".
  lastSeenChangelogVersion: { type: String, default: "" },
  // Giáo viên xác nhận trung tâm đã có sự đồng ý của học viên (và cha mẹ/giám hộ nếu dưới 16 tuổi)
  // khi tạo tài khoản (Luật 91/2025 Đ.9, Đ.24). Null = tài khoản tạo trước khi có xác nhận này
  // hoặc tạo qua đường khác (sysadmin, nhập file).
  consentConfirmedAt: { type: Date, default: null },
  consentConfirmedBy: { type: String, default: "" }, // userId của người xác nhận
  consentPolicyVersion: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now }
});

StudentSchema.index({ workspaceId: 1, classId: 1 });

module.exports = mongoose.models.Student || mongoose.model("Student", StudentSchema);

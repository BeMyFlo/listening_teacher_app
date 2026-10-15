const mongoose = require("mongoose");

// Yêu cầu dùng thử gửi từ form ở trang giới thiệu (www.bemyflo.com). Đây KHÔNG phải đăng ký tự phục vụ:
// không tạo tài khoản nào. Admin xem danh sách rồi tự tạo workspace/tài khoản giáo viên
// (đúng quy tắc "không tự đăng ký", xem PLAN-MULTI-TENANT.md).
//
// Doc tầng PLATFORM: không thuộc workspace nào nên KHÔNG có workspaceId (và không bao giờ `required`).
// Chứa dữ liệu cá nhân của người lạ -> chỉ admin đọc được, admin xoá được từng dòng.
const STATUSES = ["new", "contacted", "accepted", "rejected"];

const SignupRequestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, default: "", trim: true, maxlength: 30 },
    organization: { type: String, default: "", trim: true, maxlength: 120 },
    message: { type: String, default: "", trim: true, maxlength: 1000 },
    status: { type: String, enum: STATUSES, default: "new", index: true },
    note: { type: String, default: "", trim: true, maxlength: 1000 }, // ghi chú nội bộ của admin
  },
  { timestamps: true }
);

SignupRequestSchema.index({ createdAt: -1 });
SignupRequestSchema.index({ email: 1, createdAt: -1 });

SignupRequestSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.models.SignupRequest || mongoose.model("SignupRequest", SignupRequestSchema);

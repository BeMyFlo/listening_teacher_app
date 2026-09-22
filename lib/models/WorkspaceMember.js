const mongoose = require("mongoose");

// Ai thuộc workspace nào. V1 mỗi workspace chỉ có đúng 1 dòng (owner), nhưng
// bảng này vẫn được tạo NGAY TỪ ĐẦU — xem PLAN-MULTI-TENANT.md mục 0.3.2.
//
// Lý do: quan hệ thành viên là thứ đắt nhất khi retrofit. Tạo sẵn bảng với 1
// dòng/workspace gần như không tốn gì, nhưng mở được phase 9 ("một trung tâm
// nhiều giáo viên") mà không phải migrate lại dữ liệu.
const ROLES = ["owner", "teacher"];

const WorkspaceMemberSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: ROLES, default: "owner" },
  createdAt: { type: Date, default: Date.now },
});

// Một user chỉ có một dòng trong một workspace. Unique ở tầng DB chứ không
// chỉ ở code: script migration chạy lại nhiều lần không được sinh bản sao.
WorkspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
// lib/tenant.js giải workspace của người đang đăng nhập bằng đúng index này.
WorkspaceMemberSchema.index({ userId: 1 });

WorkspaceMemberSchema.statics.ROLES = ROLES;

module.exports =
  mongoose.models.WorkspaceMember || mongoose.model("WorkspaceMember", WorkspaceMemberSchema);

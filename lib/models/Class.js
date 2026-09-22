const mongoose = require("mongoose");

// Một Lớp = nhóm học sinh học cùng nhau, chung 1 level. Level là của Lớp:
// khi gán học sinh vào lớp, Student.level được đồng bộ = Class.level (giữ
// level trên Student làm khóa lọc nội dung cho api/units.js & api/tests.js).
const ClassSchema = new mongoose.Schema(
  {
    // Workspace sở hữu document này — RANH GIỚI CÔ LẬP giữa các trung tâm.
    // Phase 1 để optional để dữ liệu cũ và code cũ vẫn chạy; Phase 4 mới siết
    // `required: true` sau khi scripts/check-orphans.js xác nhận không còn doc
    // nào thiếu. Xem PLAN-MULTI-TENANT.md mục 4.2.
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", index: true },
    name: { type: String, required: true, trim: true },
    level: { type: Number, required: true, min: 1 },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Class || mongoose.model("Class", ClassSchema);

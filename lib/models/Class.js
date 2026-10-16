const mongoose = require("mongoose");
const { PROGRAM_KEYS } = require("../curriculum");

// Một Lớp = nhóm học sinh học cùng nhau, chung 1 level. Level là của Lớp:
// khi gán học sinh vào lớp, Student.level được đồng bộ = Class.level (giữ
// level trên Student làm khóa lọc nội dung cho api/units.js & api/tests.js).
const ClassSchema = new mongoose.Schema(
  {
    // Workspace sở hữu document này — RANH GIỚI CÔ LẬP giữa các trung tâm.
    // `required: true` từ Phase 4 — siết sau khi scripts/check-orphans.js xác
    // nhận không còn doc nào thiếu. Xem PLAN-MULTI-TENANT.md mục 4.2.
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    // Chương trình học (ielts | toeic). Default "ielts" để doc cũ chưa backfill
    // vẫn đọc ra đúng; KHÔNG required (xem lib/curriculum.js programFilter).
    program: { type: String, enum: PROGRAM_KEYS, default: "ielts" },
    name: { type: String, required: true, trim: true },
    level: { type: Number, required: true, min: 1 },
  },
  { timestamps: true }
);

ClassSchema.index({ workspaceId: 1, level: 1, name: 1 });
// Phase 8: index mới thêm cạnh index cũ (chưa thay/xoá index cũ).
ClassSchema.index({ workspaceId: 1, program: 1, level: 1, name: 1 });

module.exports = mongoose.models.Class || mongoose.model("Class", ClassSchema);

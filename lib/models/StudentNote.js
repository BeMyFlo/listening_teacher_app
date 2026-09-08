const mongoose = require("mongoose");

// Cuốn sổ tay của học sinh. Mỗi bản ghi = 1 ghi chú, tạo từ việc bôi đen 1
// đoạn (quote) rồi ghi chú, hoặc ghi chú tự do (quote rỗng). `source` được lưu
// sẵn tên/đường dẫn để trang Notebook hiển thị mà không cần populate Unit/Test.
// Vệt highlight vàng trên nội dung vẫn nằm ở localStorage từng máy — bản ghi
// này mới là bản chính, đồng bộ mọi thiết bị.
const SourceSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["lesson", "test", "free"], default: "free" },
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: "Unit" },
    testId: { type: mongoose.Schema.Types.ObjectId, ref: "Test" },
    contextName: { type: String, default: "" }, // "Unit 3" | "IELTS Practice · Test 2"
    skill: { type: String, default: "" }, // categoryKey / test skill
    itemLabel: { type: String, default: "" }, // tên section / bài tập / passage
    href: { type: String, default: "" }, // link tương đối quay lại
  },
  { _id: false }
);

const StudentNoteSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    quote: { type: String, default: "", maxlength: 2000 },
    color: { type: String, default: "yellow" },
    pinned: { type: Boolean, default: false },
    source: { type: SourceSchema, default: () => ({}) },
  },
  { timestamps: true }
);

StudentNoteSchema.index({ studentId: 1, updatedAt: -1 });

module.exports = mongoose.models.StudentNote || mongoose.model("StudentNote", StudentNoteSchema);

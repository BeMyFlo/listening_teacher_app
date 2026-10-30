const mongoose = require("mongoose");
const { FieldSchema } = require("./schemas/questionSchema");

// Ngân hàng câu hỏi (Phase 12 G4, 2.1): mỗi mục là 1 câu (single) hoặc 1 nhóm (group =
// đoạn văn/ảnh + các câu). Bốc câu vào đề là CHÉP, nên sửa/xoá mục ở đây không đổi đề cũ.
const QuestionItemSchema = new mongoose.Schema(
  {
    // Workspace sở hữu document này — xem ghi chú ở lib/models/Class.js.
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    program: { type: String, default: "general" },
    level: { type: Number, required: true }, // khối
    textbook: { type: String, default: "" },
    unitLabel: { type: String, default: "" },
    topic: { type: String, default: "" },
    difficulty: { type: String, default: "" }, // nb | th | vd | vdc | ""
    format: { type: String, required: true }, // key g-* của cả mục
    kind: { type: String, enum: ["single", "group"], default: "single" },
    passageText: { type: String, default: "" },
    imageId: { type: mongoose.Schema.Types.ObjectId, ref: "Image" },
    fields: { type: [FieldSchema], default: [] },
    questionCount: { type: Number, default: 1 },
    createdBy: { type: String, default: "" },
    sourceRef: { type: String, default: "" }, // vd "unit:<id>" / "word-import"
  },
  { timestamps: true }
);

QuestionItemSchema.index({ workspaceId: 1, program: 1, level: 1, format: 1, difficulty: 1 });

module.exports = mongoose.models.QuestionItem || mongoose.model("QuestionItem", QuestionItemSchema);

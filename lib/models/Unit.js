const mongoose = require("mongoose");
const { SectionSchema } = require("./schemas/questionSchema");
const { PromptSchema } = require("./schemas/promptSchema");
const { GrammarTopicSchema, VocabGroupSchema } = require("./schemas/lessonSchema");
// Register the models that sections/prompts reference, so .populate() of
// audioId / imageId works no matter which API route loads Unit first.
require("./Audio");
require("./Image");

const CATEGORY_KEYS = ["grammar", "vocabulary", "listening", "reading", "writing", "speaking"];

// Exercise/Prompt/Category intentionally keep Mongoose-generated _ids so each
// can be addressed individually by the API (submissions reference them too).
const ExerciseSchema = new mongoose.Schema(
  { title: { type: String, default: "" }, sections: { type: [SectionSchema], default: [] } },
  { timestamps: true }
);

// Hạn nộp bài của 1 Unit cho 1 lớp. categoryKey rỗng/null = hạn chung cả
// Unit; có categoryKey = hạn riêng cho đúng kỹ năng đó (đè lên hạn chung).
// Khi chấm trễ: tra hạn theo (lớp, kỹ năng) trước, không có thì lấy hạn
// chung của Unit. [] = không hạn. Nộp sau hạn vẫn được, chỉ bị đánh isLate.
const DeadlineSchema = new mongoose.Schema(
  {
    classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
    categoryKey: { type: String, enum: CATEGORY_KEYS, default: null },
    dueAt: { type: Date, required: true },
  },
  { _id: false }
);

const CategorySchema = new mongoose.Schema({
  key: { type: String, enum: CATEGORY_KEYS, required: true },
  theory: {
    html: { type: String, default: "" },
    audioId: { type: mongoose.Schema.Types.ObjectId, ref: "Audio" },
    imageId: { type: mongoose.Schema.Types.ObjectId, ref: "Image" },
    // Link tới file/bài lý thuyết bên ngoài (Google Docs, Drive, PDF...) do
    // giáo viên dán vào. Học sinh bấm để mở tab mới. resourceLabel = tên hiển thị.
    resourceUrl: { type: String, default: "" },
    resourceLabel: { type: String, default: "" }
  },
  exercises: { type: [ExerciseSchema], default: [] },
  prompts: { type: [PromptSchema], default: [] },
  // Grammar: danh sách chủ điểm (lý thuyết cấu trúc + bài tập). Vocab:
  // danh sách nhóm từ (flashcard + bài tập). 4 category kia không dùng.
  topics: { type: [GrammarTopicSchema], default: [] },
  groups: { type: [VocabGroupSchema], default: [] }
});

function seedCategories() {
  return CATEGORY_KEYS.map((key) => ({ key, theory: {}, exercises: [], prompts: [] }));
}

const UnitSchema = new mongoose.Schema(
  {
    level: { type: Number, required: true, min: 1 },
    name: { type: String, required: true },
    order: { type: Number, default: 0 },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    // Lớp được gán học bài này. [] = mọi học sinh đúng level đều thấy (tương
    // thích ngược). Có phần tử = chỉ học sinh thuộc các lớp đó thấy.
    classIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Class" }], default: [] },
    // Hạn nộp theo lớp (tối đa 1 mốc / lớp). Xem DeadlineSchema.
    deadlines: { type: [DeadlineSchema], default: [] },
    categories: { type: [CategorySchema], default: seedCategories }
  },
  { timestamps: true }
);

UnitSchema.statics.CATEGORY_KEYS = CATEGORY_KEYS;
UnitSchema.statics.seedCategories = seedCategories;

module.exports = mongoose.models.Unit || mongoose.model("Unit", UnitSchema);

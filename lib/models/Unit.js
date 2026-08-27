const mongoose = require("mongoose");
const { SectionSchema } = require("./schemas/questionSchema");
const { PromptSchema } = require("./schemas/promptSchema");
const { GrammarTopicSchema, VocabGroupSchema } = require("./schemas/lessonSchema");

const CATEGORY_KEYS = ["grammar", "vocabulary", "listening", "reading", "writing", "speaking"];

// Exercise/Prompt/Category intentionally keep Mongoose-generated _ids so each
// can be addressed individually by the API (submissions reference them too).
const ExerciseSchema = new mongoose.Schema(
  { title: { type: String, default: "" }, sections: { type: [SectionSchema], default: [] } },
  { timestamps: true }
);

const CategorySchema = new mongoose.Schema({
  key: { type: String, enum: CATEGORY_KEYS, required: true },
  theory: {
    html: { type: String, default: "" },
    audioId: { type: mongoose.Schema.Types.ObjectId, ref: "Audio" },
    imageId: { type: mongoose.Schema.Types.ObjectId, ref: "Image" }
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
    categories: { type: [CategorySchema], default: seedCategories }
  },
  { timestamps: true }
);

UnitSchema.statics.CATEGORY_KEYS = CATEGORY_KEYS;
UnitSchema.statics.seedCategories = seedCategories;

module.exports = mongoose.models.Unit || mongoose.model("Unit", UnitSchema);

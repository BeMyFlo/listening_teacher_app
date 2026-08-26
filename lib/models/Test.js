const mongoose = require("mongoose");
const { SectionSchema } = require("./schemas/questionSchema");
const { PromptSchema } = require("./schemas/promptSchema");

// Listening/Reading: câu hỏi tự chấm (chung engine với Lesson Unit exercises).
const QuestionSkillSchema = new mongoose.Schema(
  {
    durationMinutes: { type: Number, default: null },
    instructions: { type: String, default: "" },
    sections: { type: [SectionSchema], default: [] }
  },
  { _id: false }
);

// Writing/Speaking: đề bài (prompt), giáo viên chấm tay — chung cơ chế với
// Lesson Unit prompts.
const PromptSkillSchema = new mongoose.Schema(
  {
    durationMinutes: { type: Number, default: null },
    instructions: { type: String, default: "" },
    prompts: { type: [PromptSchema], default: [] }
  },
  { _id: false }
);

// Một Test = một bài thi thử đủ 4 kỹ năng, mở/khoá theo 1 khung giờ chung
// (opensAt/closesAt); mỗi kỹ năng có nội dung + thời lượng riêng vì IELTS
// thật mỗi kỹ năng thời gian khác nhau (~30/60/60/14 phút).
const TestSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    unit: { type: String, default: "" },
    level: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    opensAt: { type: Date, default: null },
    closesAt: { type: Date, default: null },
    skills: {
      listening: { type: QuestionSkillSchema, default: () => ({}) },
      reading: { type: QuestionSkillSchema, default: () => ({}) },
      writing: { type: PromptSkillSchema, default: () => ({}) },
      speaking: { type: PromptSkillSchema, default: () => ({}) }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Test || mongoose.model("Test", TestSchema);

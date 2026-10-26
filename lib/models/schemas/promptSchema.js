const mongoose = require("mongoose");
const { TOEIC_TASK_KEYS } = require("../../toeicTasks");

// Dùng cho Writing/Speaking — cả ở Lesson Unit (Unit.js) lẫn Mock Test
// (Test.js). Đề bài thuần văn bản, học sinh nộp bài luận/ghi âm, giáo viên
// chấm tay (xem Submission.js: kind "writing"/"speaking").
const PromptSchema = new mongoose.Schema(
  {
    title: { type: String, default: "" },
    instructions: { type: String, default: "" },
    imageId: { type: mongoose.Schema.Types.ObjectId, ref: "Image" },
    // Chỉ có ý nghĩa với prompt Writing: quyết định rubric chấm (tiêu chí đầu
    // là Task Achievement cho task1, Task Response cho task2). Speaking bỏ qua.
    writingTask: { type: String, enum: ["task1", "task2"], default: "task2" },
    // --- TOEIC Speaking/Writing (Phase 8B, lib/toeicTasks.js). "" = đề IELTS (như cũ):
    // mọi chỗ đọc phải coi các field dưới đây như không có khi taskType rỗng.
    taskType: { type: String, enum: [...TOEIC_TASK_KEYS, ""], default: "" },
    // Chỉ toeic.w.picture: đúng 2 từ bắt buộc dùng trong câu.
    requiredWords: { type: [String], default: [], validate: (v) => v.length <= 2 },
    // Audio câu hỏi (toeic.s.respond / toeic.s.info), phát audioPlays lần (câu 10 phát 2 lần).
    audioId: { type: mongoose.Schema.Types.ObjectId, ref: "Audio", default: null },
    audioPlays: { type: Number, min: 1, max: 2, default: 1 },
    // null = lấy mặc định của taskType (toeicTasks.effectivePrep / effectiveResponse).
    prepSeconds: { type: Number, min: 0, max: 600, default: null },
    responseSeconds: { type: Number, min: 5, max: 3600, default: null }
  },
  { timestamps: true }
);

module.exports = { PromptSchema };

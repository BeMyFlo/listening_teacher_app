const mongoose = require("mongoose");

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
    writingTask: { type: String, enum: ["task1", "task2"], default: "task2" }
  },
  { timestamps: true }
);

module.exports = { PromptSchema };

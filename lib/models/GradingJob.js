const mongoose = require("mongoose");

// Job chấm bài bằng AI (Gemini). Chạy NGẦM: endpoint tạo job trả về ngay,
// việc gọi Gemini (có thể 30–60s, nhất là Speaking nghe audio) chạy trong lần
// poll đầu tiên tới /api/admin/grading-jobs — tránh timeout ở request tạo job.
//
// status: pending -> running -> done | error
// result: bản nháp chấm (draft) để giáo viên xem lại rồi Save.
const GradingJobSchema = new mongoose.Schema({
  submissionId: { type: mongoose.Schema.Types.ObjectId, ref: "Submission", required: true, index: true },
  kind: { type: String, enum: ["writing", "speaking"], required: true },
  status: { type: String, enum: ["pending", "running", "done", "error"], default: "pending", index: true },
  model: String,
  result: { type: mongoose.Schema.Types.Mixed },
  error: String,
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
  startedAt: Date,
  finishedAt: Date,
  createdAt: { type: Date, default: Date.now },
});

// Tự dọn job cũ sau 1 ngày.
GradingJobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

module.exports = mongoose.models.GradingJob || mongoose.model("GradingJob", GradingJobSchema);

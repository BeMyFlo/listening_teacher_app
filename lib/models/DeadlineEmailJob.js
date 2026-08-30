const mongoose = require("mongoose");

// Job gửi thông báo "vừa có hạn nộp" cho học sinh 1 lớp. Chạy NGẦM giống
// GradingJob: PUT /api/admin/units chỉ tạo job doc; việc gọi emit() (in-app +
// email SMTP) cho từng học sinh chạy ở request /api/admin/deadline-jobs/run
// (kích bằng keepalive fetch sau khi Save) và ở cron deadline-scan (lưới an toàn).
//
//   status: pending -> running -> done | error
//   recipientIds: chụp danh sách học sinh của lớp lúc tạo job (roster đổi giữa
//                 chừng không làm sót/nhân đôi).
//   cursor: chỉ số học sinh kế tiếp cần xử lý — cho phép chạy tiếp qua nhiều
//           request khi lớp đông (giới hạn 60s của Vercel).
const DeadlineEmailJobSchema = new mongoose.Schema({
  unitId: { type: mongoose.Schema.Types.ObjectId, ref: "Unit", required: true, index: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
  categoryKey: { type: String, default: null }, // null = hạn chung cả Unit
  dueAt: { type: Date, required: true },
  status: { type: String, enum: ["pending", "running", "done", "error"], default: "pending", index: true },
  recipientIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }], default: [] },
  cursor: { type: Number, default: 0 },
  progress: {
    total: { type: Number, default: 0 },
    notified: { type: Number, default: 0 },
    emailSent: { type: Number, default: 0 },
    emailSkipped: { type: Number, default: 0 },
    emailFailed: { type: Number, default: 0 },
  },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
  error: String,
  startedAt: Date, // heartbeat — cập nhật mỗi batch để phát hiện job treo
  finishedAt: Date,
  createdAt: { type: Date, default: Date.now },
});

// Tự dọn job cũ sau 3 ngày.
DeadlineEmailJobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3 * 24 * 60 * 60 });
DeadlineEmailJobSchema.index({ status: 1, createdAt: 1 });

module.exports =
  mongoose.models.DeadlineEmailJob || mongoose.model("DeadlineEmailJob", DeadlineEmailJobSchema);

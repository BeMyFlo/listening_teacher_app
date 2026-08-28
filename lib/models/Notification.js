const mongoose = require("mongoose");

// Thông báo gửi cho 1 người nhận — học sinh HOẶC giáo viên (đúng 1 trong 2).
// Bản ghi này là "sự kiện gốc" — các kênh gửi (in-app chuông, email…) đọc từ
// đây. dedupeKey đảm bảo mỗi sự kiện chỉ đẻ đúng 1 bản ghi dù API sinh thông
// báo được gọi lại nhiều lần.
//
//   deadline_soon        : còn <=24h là tới hạn nộp — 1 lần / học sinh / mốc hạn
//   submission_late      : học sinh vừa nộp 1 bài sau hạn — 1 lần / submission
//   submission_received  : học sinh vừa nộp Writing/Speaking — 1 lần / submission / giáo viên
const NotificationSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", index: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", index: true },
  type: {
    type: String,
    enum: ["deadline_soon", "submission_late", "submission_received"],
    required: true,
  },

  unitId: { type: mongoose.Schema.Types.ObjectId, ref: "Unit" },
  submissionId: { type: mongoose.Schema.Types.ObjectId, ref: "Submission" },
  // Đường dẫn tương đối để chuông điều hướng khi bấm (ưu tiên hơn unitId).
  link: { type: String, default: "" },

  title: { type: String, default: "" },
  body: { type: String, default: "" },
  dueAt: { type: Date },

  dedupeKey: { type: String, required: true, unique: true },

  // Trạng thái gửi theo từng kênh. Chuông chỉ cần deliveries.inapp.readAt.
  deliveries: {
    inapp: {
      readAt: { type: Date, default: null },
    },
    email: {
      status: { type: String, enum: ["none", "pending", "sent", "failed", "skipped"], default: "none" },
      sentAt: { type: Date },
      error: { type: String },
    },
  },

  createdAt: { type: Date, default: Date.now },
});

NotificationSchema.index({ studentId: 1, createdAt: -1 });
NotificationSchema.index({ teacherId: 1, createdAt: -1 });

NotificationSchema.pre("validate", function (next) {
  if (!this.studentId && !this.teacherId) {
    return next(new Error("Notification needs a studentId or a teacherId"));
  }
  next();
});

module.exports = mongoose.models.Notification || mongoose.model("Notification", NotificationSchema);

const mongoose = require("mongoose");

// Thông báo gửi cho 1 học sinh. Bản ghi này là "sự kiện gốc" — các kênh gửi
// (in-app chuông, email…) đọc từ đây. dedupeKey đảm bảo mỗi sự kiện chỉ đẻ
// đúng 1 bản ghi dù API sinh thông báo được gọi lại nhiều lần.
//
//   deadline_soon   : còn <=24h là tới hạn nộp 1 Unit — 1 lần / học sinh / unit
//   submission_late : học sinh vừa nộp 1 bài sau hạn      — 1 lần / submission
const NotificationSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  type: { type: String, enum: ["deadline_soon", "submission_late"], required: true },

  unitId: { type: mongoose.Schema.Types.ObjectId, ref: "Unit" },
  submissionId: { type: mongoose.Schema.Types.ObjectId, ref: "Submission" },

  title: { type: String, default: "" },
  body: { type: String, default: "" },
  dueAt: { type: Date },

  dedupeKey: { type: String, required: true, unique: true },

  // Trạng thái gửi theo từng kênh. Chuông chỉ cần deliveries.inapp.readAt.
  // Email hiện là stub (status giữ "none"); khi bật kênh email, worker sẽ
  // drain các bản ghi status="pending".
  deliveries: {
    inapp: {
      readAt: { type: Date, default: null },
    },
    email: {
      status: { type: String, enum: ["none", "pending", "sent", "failed"], default: "none" },
      sentAt: { type: Date },
      error: { type: String },
    },
  },

  createdAt: { type: Date, default: Date.now },
});

NotificationSchema.index({ studentId: 1, createdAt: -1 });

module.exports = mongoose.models.Notification || mongoose.model("Notification", NotificationSchema);

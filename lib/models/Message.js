const mongoose = require("mongoose");

// Tin nhắn trong group chat của 1 lớp. Tự xoá sau 30 ngày (TTL index).
// Thành viên phòng chat suy ra từ Student.classId + Teacher.classIds — không
// lưu danh sách thành viên ở đây. Xem lib/chat/membership.js.
const AttachmentSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["image", "video"], required: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    width: Number,
    height: Number,
    bytes: Number,
  },
  { _id: false }
);

const MessageSchema = new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  senderRole: { type: String, enum: ["teacher", "student"], required: true },
  senderName: { type: String, default: "" },
  text: { type: String, default: "" },
  attachments: { type: [AttachmentSchema], default: [] },
  deletedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

// Tự xoá tin nhắn quá 30 ngày.
MessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
// Truy vấn lịch sử theo lớp.
MessageSchema.index({ classId: 1, createdAt: -1 });

module.exports = mongoose.models.Message || mongoose.model("Message", MessageSchema);

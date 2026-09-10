const mongoose = require("mongoose");

// Phiếu hỗ trợ do HỌC SINH hoặc GIÁO VIÊN gửi cho admin (IT). Một luồng
// trao đổi qua lại: reporter mở phiếu, admin trả lời + đổi trạng thái, mỗi
// lần admin cập nhật -> bắn thông báo (chuông) về đúng reporter.
//
//   kind:     bug     — báo lỗi
//             feature — yêu cầu thêm tính năng / góp ý
//   status:   open        — mới gửi, chưa xử lý
//             in_progress — admin đang làm
//             resolved    — đã xong
//             closed       — đóng (không làm / trùng / hết hạn)
//   priority: low | normal | high  — admin tự đặt
//
// reporterRole là chỗ TÁCH "yêu cầu từ học sinh" vs "yêu cầu từ giáo viên".
const KINDS = ["bug", "feature"];
const STATUSES = ["open", "in_progress", "resolved", "closed"];
const PRIORITIES = ["low", "normal", "high"];

const ImageSchema = new mongoose.Schema(
  { url: { type: String, required: true }, publicId: { type: String, default: "" } },
  { _id: false }
);

const MessageSchema = new mongoose.Schema(
  {
    authorRole: { type: String, enum: ["student", "teacher", "admin"], required: true },
    authorName: { type: String, default: "" },
    body: { type: String, default: "" },
    images: { type: [ImageSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const TicketSchema = new mongoose.Schema(
  {
    reporterRole: { type: String, enum: ["student", "teacher"], required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", index: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", index: true },
    reporterName: { type: String, default: "" },

    kind: { type: String, enum: KINDS, default: "bug" },
    title: { type: String, required: true, trim: true },
    body: { type: String, default: "" },
    pageUrl: { type: String, default: "" }, // trang reporter đang đứng khi gửi
    images: { type: [ImageSchema], default: [] },

    status: { type: String, enum: STATUSES, default: "open", index: true },
    priority: { type: String, enum: PRIORITIES, default: "normal" },

    messages: { type: [MessageSchema], default: [] },

    // Cờ "có gì đó chưa xem" cho từng phía -> dùng để đếm badge.
    lastReplyRole: { type: String, enum: ["student", "teacher", "admin"], default: null },
    adminUnread: { type: Boolean, default: true },
    reporterUnread: { type: Boolean, default: false },

    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

TicketSchema.index({ reporterRole: 1, status: 1, updatedAt: -1 });
TicketSchema.index({ studentId: 1, updatedAt: -1 });
TicketSchema.index({ teacherId: 1, updatedAt: -1 });

TicketSchema.pre("validate", function (next) {
  if (!this.studentId && !this.teacherId) {
    return next(new Error("Ticket needs a studentId or a teacherId"));
  }
  next();
});

TicketSchema.statics.KINDS = KINDS;
TicketSchema.statics.STATUSES = STATUSES;
TicketSchema.statics.PRIORITIES = PRIORITIES;

module.exports = mongoose.models.Ticket || mongoose.model("Ticket", TicketSchema);

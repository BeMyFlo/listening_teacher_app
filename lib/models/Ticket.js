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
    authorName: { type: String, default: "", maxlength: 120 },
    body: { type: String, default: "", maxlength: 4000 },
    images: { type: [ImageSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const TicketSchema = new mongoose.Schema(
  {
    // Workspace liên quan — CHỈ để admin lọc khi xem. KHÔNG đặt `required` kể cả
    // ở Phase 4: đây là doc tầng platform, có thể sinh ra khi chưa xác định được
    // workspace. Xem PLAN-MULTI-TENANT.md mục 4.2.
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", index: true },
    reporterRole: { type: String, enum: ["student", "teacher"], required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", index: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", index: true },
    reporterName: { type: String, default: "", maxlength: 120 },

    kind: { type: String, enum: KINDS, default: "bug" },
    // Cận trên bắt buộc có ở tầng schema: client có maxLength trên input nhưng
    // gọi thẳng API thì không đi qua đó.
    title: { type: String, required: true, trim: true, maxlength: 140 },
    body: { type: String, default: "", maxlength: 4000 },
    pageUrl: { type: String, default: "", maxlength: 300 }, // trang reporter đang đứng khi gửi
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

// Trần số lượt trao đổi trong 1 phiếu — không có trần thì một phiếu có thể bị
// bơm vô hạn message.
const MAX_MESSAGES = 200;

TicketSchema.pre("validate", function (next) {
  if (!this.studentId && !this.teacherId) {
    return next(new Error("Ticket needs a studentId or a teacherId"));
  }
  if (this.messages && this.messages.length > MAX_MESSAGES) {
    return next(new Error("This ticket has reached the maximum number of replies"));
  }
  next();
});

TicketSchema.statics.MAX_MESSAGES = MAX_MESSAGES;
TicketSchema.statics.KINDS = KINDS;
TicketSchema.statics.STATUSES = STATUSES;
TicketSchema.statics.PRIORITIES = PRIORITIES;

module.exports = mongoose.models.Ticket || mongoose.model("Ticket", TicketSchema);

const mongoose = require("mongoose");

// Nhật ký mọi thay đổi dữ liệu. TTL: tự xoá sau 3 ngày.
const AuditLogSchema = new mongoose.Schema({
  at: { type: Date, default: Date.now },
  actorRole: { type: String, default: "system" }, // admin | teacher | student | system
  actorId: { type: mongoose.Schema.Types.ObjectId, default: null }, // userId
  actorName: { type: String, default: "" },
  impBy: { type: mongoose.Schema.Types.ObjectId, default: null }, // admin đang đăng nhập hộ
  method: { type: String, default: "" },
  path: { type: String, default: "" },
  status: { type: Number, default: 0 },
  action: { type: String, default: "" }, // slug: "students.create", "units.publish"...
  meta: { type: mongoose.Schema.Types.Mixed },
  ip: { type: String, default: "" },
});

AuditLogSchema.index({ at: 1 }, { expireAfterSeconds: 3 * 24 * 60 * 60 });
AuditLogSchema.index({ at: -1 });
AuditLogSchema.index({ actorRole: 1, at: -1 });
AuditLogSchema.index({ action: 1, at: -1 });

module.exports = mongoose.models.AuditLog || mongoose.model("AuditLog", AuditLogSchema);

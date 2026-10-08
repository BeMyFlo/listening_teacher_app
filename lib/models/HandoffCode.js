const mongoose = require("mongoose");

// Mã chuyển phiên đăng nhập 1 lần từ domain gốc sang subdomain của trung tâm
// (PLAN-MULTI-TENANT.md Phase 10B). Chỉ lưu BẢN BĂM của mã và của state: lộ DB
// cũng không dùng được mã. Sống 60 giây, dùng đúng một lần (xoá nguyên tử khi dùng).
const HandoffCodeSchema = new mongoose.Schema({
  codeHash: { type: String, required: true, unique: true },
  stateHash: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: ["teacher", "student"], required: true },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
  expiresAt: { type: Date, required: true },
});

// Dọn rác: MongoDB xoá sau expiresAt + 120s (tiến trình TTL chạy mỗi ~60s, nên việc
// kiểm hạn thật vẫn nằm ở code khi dùng mã).
HandoffCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 120 });

module.exports = mongoose.models.HandoffCode || mongoose.model("HandoffCode", HandoffCodeSchema);

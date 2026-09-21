const mongoose = require("mongoose");

// Tổng tiền AI đã dùng theo tháng (giờ Việt Nam), _id = "YYYY-MM". Cộng dồn
// ($inc) sau mỗi lần gọi — dùng để chặn khi vượt giới hạn. Tách khỏi AiLog vì
// AiLog tự xoá sau 30 ngày, tháng 31 ngày sẽ bị hụt nếu cộng từ log.
const AiSpendSchema = new mongoose.Schema({
  _id: { type: String },
  costUsd: { type: Number, default: 0 },
  calls: { type: Number, default: 0 },
  blocked: { type: Number, default: 0 }, // số lần bị chặn vì hết tiền
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.AiSpend || mongoose.model("AiSpend", AiSpendSchema);

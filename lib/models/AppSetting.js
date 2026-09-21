const mongoose = require("mongoose");

// Cấu hình toàn app dạng key-value (singleton theo `key`).
//   key "grading"  -> aiModels: danh sách model Gemini chấm bài
//   key "aiBudget" -> giới hạn tiền AI mỗi tháng + tỉ giá + bảng giá ghi đè
const AppSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  aiModels: { type: [String], default: [] }, // thứ tự = thứ tự thử; hết quota -> model kế
  aiMonthlyLimitUsd: { type: Number, default: null }, // null = không giới hạn
  aiUsdToVnd: { type: Number, default: null },
  aiPrices: { type: mongoose.Schema.Types.Mixed, default: null }, // { model: { input, audio, output } }
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.AppSetting || mongoose.model("AppSetting", AppSettingSchema);

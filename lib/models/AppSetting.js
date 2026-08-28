const mongoose = require("mongoose");

// Cấu hình toàn app dạng key-value (singleton theo `key`). Hiện dùng cho
// danh sách model Gemini chấm bài (key = "grading").
const AppSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  aiModels: { type: [String], default: [] }, // thứ tự = thứ tự thử; hết quota -> model kế
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.AppSetting || mongoose.model("AppSetting", AppSettingSchema);

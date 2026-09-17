const mongoose = require("mongoose");

// System prompt dùng cho LLM, lưu 1 bản duy nhất theo mã băm sha1 (_id).
// AiLog chỉ tham chiếu `systemHash`. Tự xoá khi 45 ngày không ai dùng tới
// (lâu hơn hạn giữ AiLog 30 ngày để log nào còn cũng mở được prompt).
const AiPromptSchema = new mongoose.Schema({
  _id: { type: String },
  text: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: { type: Date, default: Date.now },
});

AiPromptSchema.index({ lastUsedAt: 1 }, { expireAfterSeconds: 45 * 24 * 60 * 60 });

module.exports = mongoose.models.AiPrompt || mongoose.model("AiPrompt", AiPromptSchema);

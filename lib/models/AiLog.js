const mongoose = require("mongoose");

// Nhật ký MỌI lần gọi LLM (Gemini): ai gọi, gọi từ đâu, cho bài nào, để làm
// gì (chấm bài / soạn bài), prompt, response, token, thời gian, lỗi.
// Ghi ở lib/gemini.js (generateJSON) — admin xem ở /admin/ai-logs.
// TTL 30 ngày. System prompt (dài ~12KB, giống hệt nhau mọi lần) không lưu
// ở đây mà lưu 1 lần duy nhất trong AiPrompt, log chỉ giữ mã băm `systemHash`.
const AttemptSchema = new mongoose.Schema(
  {
    model: String,
    ms: Number,
    ok: Boolean,
    httpStatus: Number,
    error: String,
  },
  { _id: false }
);

const AiLogSchema = new mongoose.Schema({
  at: { type: Date, default: Date.now },
  // "grading.writing" | "grading.speaking" | "generate.grammar" | "unknown"
  purpose: { type: String, default: "unknown" },
  ok: { type: Boolean, default: false },

  actorRole: { type: String, default: "system" },
  actorId: { type: String, default: "" },
  actorName: { type: String, default: "" },
  impBy: { type: String, default: "" },
  source: { type: String, default: "" }, // đường dẫn API đã gọi tới LLM

  // Bài liên quan: unitId/unitName, testId/testTitle, submissionId,
  // studentId/studentName, skill, attemptNumber, topics...
  context: { type: mongoose.Schema.Types.Mixed, default: {} },

  model: { type: String, default: "" }, // model trả kết quả (hoặc model cuối đã thử)
  attempts: { type: [AttemptSchema], default: [] },

  systemHash: { type: String, default: "" },
  prompt: { type: String, default: "" },
  audio: { type: mongoose.Schema.Types.Mixed, default: null }, // { mimeType, bytes } — không lưu file
  response: { type: String, default: "" },

  promptTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
  thoughtsTokens: { type: Number, default: 0 },
  totalTokens: { type: Number, default: 0 },

  durationMs: { type: Number, default: 0 },
  error: { type: String, default: "" },
});

const RETENTION_DAYS = 30;
AiLogSchema.index({ at: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });
AiLogSchema.index({ at: -1 });
AiLogSchema.index({ purpose: 1, at: -1 });
AiLogSchema.index({ ok: 1, at: -1 });

const AiLog = mongoose.models.AiLog || mongoose.model("AiLog", AiLogSchema);
AiLog.RETENTION_DAYS = RETENTION_DAYS;

module.exports = AiLog;

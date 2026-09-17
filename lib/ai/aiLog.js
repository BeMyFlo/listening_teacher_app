// Ghi nhật ký mỗi lần gọi LLM (xem lib/models/AiLog.js). Không bao giờ throw:
// log hỏng thì bỏ qua, không được làm hỏng việc chấm/soạn bài.

const crypto = require("crypto");
const mongoose = require("mongoose");
const AiLog = require("../models/AiLog");
const AiPrompt = require("../models/AiPrompt");

const MAX_TEXT = 40000;

function cap(s) {
  const t = String(s == null ? "" : s);
  return t.length > MAX_TEXT ? t.slice(0, MAX_TEXT) + `\n…[truncated ${t.length - MAX_TEXT} chars]` : t;
}

// req.auth -> người gọi. Token cũ của giáo viên chỉ có teacherId, không có userId.
function actorFrom(auth) {
  const a = auth || {};
  return {
    actorRole: a.role || "system",
    actorId: String(a.userId || a.teacherId || a.studentId || ""),
    actorName: String(a.name || ""),
    impBy: a.impBy ? String(a.impBy) : "",
  };
}

// Không có kết nối DB (vd script chạy tay) -> bỏ qua, tránh treo 10s chờ
// mongoose buffer.
function dbReady() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

async function saveSystemPrompt(text) {
  if (!text) return "";
  const hash = crypto.createHash("sha1").update(text).digest("hex");
  const now = new Date();
  await AiPrompt.updateOne(
    { _id: hash },
    { $setOnInsert: { text, createdAt: now }, $set: { lastUsedAt: now } },
    { upsert: true }
  );
  return hash;
}

// entry: { log: { purpose, actor, source, context }, systemInstruction, prompt,
//          audio, attempts, model, response, usage, durationMs, error }
// Trả về _id của log (hoặc null).
async function recordAiCall(entry) {
  if (!dbReady()) return null;
  try {
    const { log = {}, systemInstruction, prompt, audio, attempts, model, response, usage, durationMs, error } = entry;
    let systemHash = "";
    try {
      systemHash = await saveSystemPrompt(systemInstruction);
    } catch (e) {
      console.error("[ai-log] system prompt:", e.message);
    }
    const u = usage || {};
    const doc = await AiLog.create({
      at: new Date(),
      purpose: log.purpose || "unknown",
      ok: !error,
      ...actorFrom(log.actor),
      source: String(log.source || "").split("?")[0].slice(0, 200),
      context: log.context || {},
      model: model || "",
      attempts: attempts || [],
      systemHash,
      prompt: cap(prompt),
      audio: audio && audio.base64 ? { mimeType: audio.mimeType || "", bytes: Math.round((audio.base64.length * 3) / 4) } : null,
      response: cap(response),
      promptTokens: u.promptTokenCount || 0,
      outputTokens: u.candidatesTokenCount || 0,
      thoughtsTokens: u.thoughtsTokenCount || 0,
      totalTokens: u.totalTokenCount || 0,
      durationMs: durationMs || 0,
      error: error ? String(error).slice(0, 2000) : "",
    });
    return doc._id;
  } catch (e) {
    console.error("[ai-log] could not record:", e.message);
    return null;
  }
}

// LLM trả về đúng JSON nhưng nội dung không dùng được (vd sai schema chấm
// điểm) -> đánh dấu log đó là lỗi để admin thấy.
async function flagAiLog(logId, message) {
  if (!logId || !dbReady()) return;
  try {
    await AiLog.updateOne({ _id: logId }, { $set: { ok: false, error: String(message || "").slice(0, 2000) } });
  } catch (e) {
    console.error("[ai-log] could not flag:", e.message);
  }
}

module.exports = { recordAiCall, flagAiLog, actorFrom };

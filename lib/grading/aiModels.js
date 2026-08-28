// Danh sách model Gemini dùng chấm bài + fallback khi hết quota.
//
// Giáo viên chỉnh ở /teacher/ai-grading. Lưu trong AppSetting(key="grading").
// Không cấu hình -> lấy GEMINI_MODEL (env) đứng đầu + chuỗi mặc định.

const AppSetting = require("../models/AppSetting");

// Model gợi ý (chấm text + nghe audio + trả JSON có schema). API id có thể đổi
// theo thời gian — giáo viên tự sửa / thêm được ở trang cài đặt.
const KNOWN_MODELS = [
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", note: "Nhanh, rẻ — nên để đầu" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", note: "Cân bằng chất lượng/tốc độ" },
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite", note: "Quota free rất cao (~500/ngày)" },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", note: "Quota free rất cao (~500/ngày)" },
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", note: "Mới hơn, chấm chặt hơn" },
];

const DEFAULT_CHAIN = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-3.5-flash-lite"];
const MODEL_RE = /^[a-z0-9]+(?:[.\-][a-z0-9]+)*$/i;

function sanitizeModels(arr) {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const m of arr) {
    const s = String(m || "").trim();
    if (s && MODEL_RE.test(s) && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out.slice(0, 6);
}

function envChain() {
  const env = (process.env.GEMINI_MODEL || "").trim();
  if (!env) return [...DEFAULT_CHAIN];
  return [env, ...DEFAULT_CHAIN.filter((m) => m !== env)];
}

// Danh sách model đang dùng (đã cấu hình hoặc mặc định).
async function getGradingModels() {
  try {
    const doc = await AppSetting.findOne({ key: "grading" }).lean();
    const list = sanitizeModels(doc && doc.aiModels);
    if (list.length) return list;
  } catch (e) {
    /* ignore */
  }
  return envChain();
}

async function setGradingModels(models) {
  const clean = sanitizeModels(models);
  await AppSetting.findOneAndUpdate(
    { key: "grading" },
    { $set: { aiModels: clean, updatedAt: new Date() } },
    { upsert: true }
  );
  return clean;
}

module.exports = { KNOWN_MODELS, DEFAULT_CHAIN, sanitizeModels, envChain, getGradingModels, setGradingModels };

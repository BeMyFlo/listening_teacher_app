// Wrapper mỏng gọi Google Gemini REST API để lấy JSON có cấu trúc.
//
// Env:
//   GEMINI_API_KEY   (bắt buộc)
//   GEMINI_MODEL     (mặc định "gemini-2.5-flash-lite") — dùng khi không truyền models

const { recordAiCall } = require("./ai/aiLog");
const { checkBudget, chargeUsage, countBlocked, budgetError } = require("./ai/budget");

const DEFAULT_MODEL = "gemini-2.5-flash-lite";

function isEnabled() {
  return !!process.env.GEMINI_API_KEY;
}

// Lỗi hết quota / rate limit / model không tồn tại / model đang quá tải
// (503 "high demand") -> nên thử model khác. Quá tải thường chỉ dính 1 model
// tại 1 thời điểm nên đổi model gần như luôn qua được.
function shouldFallback(status, msg) {
  if (status === 429 || status === 404 || status >= 500) return true;
  const m = String(msg || "").toLowerCase();
  return /quota|rate limit|resource_exhausted|exhausted|not found|unsupported|permission|high demand|overloaded|unavailable|try again later/.test(m);
}

async function callOnce({ key, model, parts, schema, systemInstruction, temperature }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: { temperature, responseMimeType: "application/json", responseSchema: schema },
  };
  if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || `HTTP ${res.status}`;
    const err = new Error("Gemini: " + msg);
    err.status = res.status;
    err.fallback = shouldFallback(res.status, msg);
    throw err;
  }
  const usage = data.usageMetadata || null;
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  // Lỗi sau khi đã nhận được response vẫn mang theo text + token để ghi log.
  const fail = (message) => Object.assign(new Error(message), { status: res.status, text, usage });
  if (!text) throw fail("Gemini returned an empty response");
  try {
    return { data: JSON.parse(text), text, usage };
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return { data: JSON.parse(m[0]), text, usage };
      } catch {
        /* rơi xuống lỗi bên dưới */
      }
    }
    throw fail("Gemini response was not valid JSON");
  }
}

// models: mảng model id thử lần lượt (hết quota -> model kế). Hoặc `model` đơn.
// audio (tuỳ chọn): { mimeType, base64 } — gửi kèm file cho chấm Speaking.
// log (tuỳ chọn): { purpose, actor: req.auth, source: req.url, context } —
//   ai gọi, từ đâu, cho bài nào; mọi lần gọi đều được ghi vào AiLog.
// Trả { data, model, logId } — model đã dùng, logId để flagAiLog nếu cần.
async function generateJSON({ systemInstruction, prompt, schema, temperature = 0.2, audio, models, model, log }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not configured");

  let chain = Array.isArray(models) && models.length ? models : [model || process.env.GEMINI_MODEL || DEFAULT_MODEL];

  const parts = [{ text: prompt }];
  if (audio && audio.base64) parts.push({ inlineData: { mimeType: audio.mimeType || "audio/mp3", data: audio.base64 } });

  const started = Date.now();
  const attempts = [];
  const finish = (fields) =>
    recordAiCall({ log, systemInstruction, prompt, audio, attempts, durationMs: Date.now() - started, ...fields });

  // Hết tiền tháng này -> không gọi LLM, vẫn ghi log để admin thấy ai bị chặn.
  const budget = await checkBudget();
  if (!budget.allowed) {
    const err = budgetError(budget.spentUsd, budget.limitUsd);
    await countBlocked();
    await finish({ blocked: true, error: err.message });
    throw err;
  }

  let lastErr;
  for (const m of chain) {
    const t0 = Date.now();
    try {
      const { data, text, usage } = await callOnce({ key, model: m, parts, schema, systemInstruction, temperature });
      attempts.push({ model: m, ms: Date.now() - t0, ok: true, httpStatus: 200 });
      const cost = await chargeUsage(m, usage, budget.settings);
      const logId = await finish({ model: m, response: text, usage, cost });
      return { data, model: m, logId, costUsd: cost.costUsd };
    } catch (e) {
      lastErr = e;
      attempts.push({ model: m, ms: Date.now() - t0, ok: false, httpStatus: e.status || 0, error: String(e.message).slice(0, 500) });
      if (e.fallback && chain.indexOf(m) < chain.length - 1) {
        console.warn(`[gemini] ${m} failed (${e.message}) — trying next model`);
        continue;
      }
      // Lỗi sau khi đã có response (vd JSON hỏng) vẫn tốn token -> vẫn tính tiền.
      const cost = e.usage ? await chargeUsage(m, e.usage, budget.settings) : undefined;
      await finish({ model: m, response: e.text, usage: e.usage, error: e.message, cost });
      throw e;
    }
  }
  throw lastErr || new Error("All Gemini models failed");
}

module.exports = { generateJSON, isEnabled, DEFAULT_MODEL };

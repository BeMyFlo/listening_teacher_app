// Wrapper mỏng gọi Google Gemini REST API để lấy JSON có cấu trúc.
//
// Env:
//   GEMINI_API_KEY   (bắt buộc)
//   GEMINI_MODEL     (mặc định "gemini-2.5-flash-lite") — dùng khi không truyền models

const DEFAULT_MODEL = "gemini-2.5-flash-lite";

function isEnabled() {
  return !!process.env.GEMINI_API_KEY;
}

// Lỗi hết quota / rate limit / model không tồn tại -> nên thử model khác.
function shouldFallback(status, msg) {
  if (status === 429 || status === 404) return true;
  const m = String(msg || "").toLowerCase();
  return /quota|rate limit|resource_exhausted|exhausted|not found|unsupported|permission/.test(m);
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
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  if (!text) throw new Error("Gemini returned an empty response");
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("Gemini response was not valid JSON");
  }
}

// models: mảng model id thử lần lượt (hết quota -> model kế). Hoặc `model` đơn.
// audio (tuỳ chọn): { mimeType, base64 } — gửi kèm file cho chấm Speaking.
// Trả { data, model } — model đã dùng.
async function generateJSON({ systemInstruction, prompt, schema, temperature = 0.2, audio, models, model }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not configured");

  let chain = Array.isArray(models) && models.length ? models : [model || process.env.GEMINI_MODEL || DEFAULT_MODEL];

  const parts = [{ text: prompt }];
  if (audio && audio.base64) parts.push({ inlineData: { mimeType: audio.mimeType || "audio/mp3", data: audio.base64 } });

  let lastErr;
  for (const m of chain) {
    try {
      const data = await callOnce({ key, model: m, parts, schema, systemInstruction, temperature });
      return { data, model: m };
    } catch (e) {
      lastErr = e;
      if (e.fallback && chain.indexOf(m) < chain.length - 1) {
        console.warn(`[gemini] ${m} failed (${e.message}) — trying next model`);
        continue;
      }
      throw e;
    }
  }
  throw lastErr || new Error("All Gemini models failed");
}

module.exports = { generateJSON, isEnabled, DEFAULT_MODEL };

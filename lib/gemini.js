// Wrapper mỏng gọi Google Gemini REST API để lấy JSON có cấu trúc.
//
// Env:
//   GEMINI_API_KEY   (bắt buộc)
//   GEMINI_MODEL     (mặc định "gemini-2.5-flash-lite") — dùng khi không truyền models

const DEFAULT_MODEL = "gemini-2.5-flash-lite";

// Trần thời gian cho 1 lần gọi. Đặt dưới maxDuration của route chấm AI để còn
// kịp trả lỗi tử tế thay vì bị nền tảng cắt ngang.
const REQUEST_TIMEOUT_MS = 45000;

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

  // Không có timeout thì Gemini treo là giữ nguyên cả serverless function cho
  // tới khi hết maxDuration.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (err) {
    if (err && err.name === "AbortError") {
      const e = new Error(`Gemini: request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
      e.status = 504;
      e.fallback = true; // thử model kế tiếp
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
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
    // Model đôi khi bọc JSON trong ```json ... ```; thử vớt phần trong ngoặc.
    // Vớt hụt cũng phải ra đúng thông báo dưới, không để SyntaxError thô lọt ra.
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* rơi xuống lỗi chung bên dưới */
      }
    }
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

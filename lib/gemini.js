// Wrapper mỏng gọi Google Gemini REST API để lấy JSON có cấu trúc.
//
// Env:
//   GEMINI_API_KEY   (bắt buộc)
//   GEMINI_MODEL     (mặc định "gemini-2.0-flash")

const DEFAULT_MODEL = "gemini-2.0-flash";

function isEnabled() {
  return !!process.env.GEMINI_API_KEY;
}

// Trả object đã parse từ JSON Gemini sinh ra theo `schema`.
// audio (tuỳ chọn): { mimeType, base64 } — gửi kèm file âm thanh để chấm Speaking.
async function generateJSON({ systemInstruction, prompt, schema, temperature = 0.2, audio }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not configured");
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const parts = [{ text: prompt }];
  if (audio && audio.base64) parts.push({ inlineData: { mimeType: audio.mimeType || "audio/mp3", data: audio.base64 } });

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature,
      responseMimeType: "application/json",
      responseSchema: schema,
    },
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
    throw new Error("Gemini: " + msg);
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  if (!text) throw new Error("Gemini returned an empty response");
  try {
    return JSON.parse(text);
  } catch {
    // đôi khi bọc trong ```json ... ```
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("Gemini response was not valid JSON");
  }
}

module.exports = { generateJSON, isEnabled, DEFAULT_MODEL };

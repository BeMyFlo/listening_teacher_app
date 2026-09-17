// Giá Gemini (USD / 1 triệu token, gói trả phí "Standard") để ước tính tiền
// mỗi lần gọi. Lấy từ https://ai.google.dev/gemini-api/docs/pricing — kiểm
// tra ngày 2026-09-17. Giá có thể đổi: admin sửa được ở /admin/system (ghi đè
// lưu trong AppSetting), bảng này chỉ là mặc định.
//   input  = text / ảnh / video đầu vào
//   audio  = audio đầu vào (chấm Speaking)
//   output = đầu ra, TÍNH CẢ token "thinking"
// Không tính bậc giá >200k token của bản Pro — prompt của app nhỏ hơn nhiều.
const DEFAULT_PRICES = {
  "gemini-2.5-flash-lite": { input: 0.1, audio: 0.3, output: 0.4 },
  "gemini-2.5-flash": { input: 0.3, audio: 1.0, output: 2.5 },
  "gemini-2.5-pro": { input: 1.25, audio: 1.25, output: 10.0 },
  "gemini-3.1-flash-lite": { input: 0.25, audio: 0.5, output: 1.5 },
  "gemini-3.5-flash-lite": { input: 0.3, audio: 0.3, output: 2.5 },
  "gemini-3.5-flash": { input: 1.5, audio: 1.5, output: 9.0 },
};

// Model chưa có trong bảng -> tính theo giá đắt nhất để không bao giờ ước
// tính thấp hơn thực tế (an toàn cho giới hạn ngân sách).
const FALLBACK_PRICE = { input: 1.5, audio: 1.5, output: 9.0 };

// Ô để trống phải là "chưa có giá", không phải 0 (Number("") === 0).
const num = (v) => {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// Chuẩn hoá bảng giá admin gửi lên: { [modelId]: { input, audio, output } }.
function sanitizePrices(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, p] of Object.entries(raw)) {
    const key = String(id || "").trim();
    if (!/^[a-z0-9]+(?:[.\-][a-z0-9]+)*$/i.test(key) || !p) continue;
    const input = num(p.input);
    const output = num(p.output);
    if (input == null || output == null) continue;
    const audio = num(p.audio);
    out[key] = { input, audio: audio == null ? input : audio, output };
  }
  return out;
}

function priceFor(model, prices) {
  const table = prices || DEFAULT_PRICES;
  if (table[model]) return { price: table[model], priced: true };
  return { price: FALLBACK_PRICE, priced: false };
}

// usage = usageMetadata của Gemini. Trả { costUsd, priced }.
function computeCost(model, usage, prices) {
  if (!usage) return { costUsd: 0, priced: true };
  const { price, priced } = priceFor(model, prices);
  const promptTokens = Number(usage.promptTokenCount) || 0;
  const audioTokens = (usage.promptTokensDetails || [])
    .filter((d) => d && d.modality === "AUDIO")
    .reduce((n, d) => n + (Number(d.tokenCount) || 0), 0);
  const textTokens = Math.max(0, promptTokens - audioTokens);
  const outTokens = (Number(usage.candidatesTokenCount) || 0) + (Number(usage.thoughtsTokenCount) || 0);
  const costUsd = (textTokens * price.input + audioTokens * price.audio + outTokens * price.output) / 1e6;
  return { costUsd, priced };
}

module.exports = { DEFAULT_PRICES, FALLBACK_PRICE, sanitizePrices, priceFor, computeCost };

// Theme màu theo workspace. Dùng chung cho server (kiểm tra + lưu) và client
// (áp lên trang). Không phụ thuộc DB.
//
// Giá trị màu được chèn thẳng vào CSS nên PHẢI kiểm tra chặt: chỉ nhận tên
// biến nằm trong THEME_VARS và giá trị đúng dạng #RRGGBB. Không nhận gì khác.

// key: biến CSS gốc trong :root (public/legacy/assets/style.css)
// default: đúng giá trị hiện tại của web — workspace không đặt gì thì giữ nguyên
// alias: biến CSS khác đang có cùng màu, đổi theo cho đồng bộ
const THEME_VARS = [
  { key: "--blue", label: "Primary", group: "Brand", default: "#4DBFA9", alias: ["--indigo"] },
  { key: "--navy", label: "Primary (deep)", group: "Brand", default: "#2F9E8C" },
  { key: "--navy-dark", label: "Primary (darkest)", group: "Brand", default: "#194B80" },
  { key: "--blue-light", label: "Primary tint", group: "Brand", default: "#E8F7F3", alias: ["--indigo-light", "--sky-light"] },
  { key: "--accent", label: "Accent", group: "Brand", default: "#E08A2E", alias: ["--amber"] },
  { key: "--pink", label: "Highlight", group: "Brand", default: "#3868D9", alias: ["--purple"] },
  { key: "--bg", label: "Page background", group: "Surface", default: "#F6F9FC" },
  { key: "--card", label: "Card background", group: "Surface", default: "#FFFFFF" },
  { key: "--border", label: "Borders", group: "Surface", default: "#E1E8F0" },
  { key: "--ink", label: "Text", group: "Text", default: "#1D2939" },
  { key: "--muted", label: "Secondary text", group: "Text", default: "#66758C" },
  { key: "--green", label: "Success", group: "Status", default: "#2FA36B", alias: ["--teal"] },
  { key: "--red", label: "Danger", group: "Status", default: "#E0607A" },
];

const BY_KEY = new Map(THEME_VARS.map((v) => [v.key, v]));
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// Chuẩn hoá và kiểm tra. input: { "--blue": "#123456", ... } (chỉ các màu đã đổi).
// Trả { theme } (đã bỏ mọi màu trùng mặc định) hoặc { error }.
function sanitizeTheme(input) {
  if (input == null) return { theme: {} };
  if (typeof input !== "object" || Array.isArray(input)) {
    return { error: "theme must be an object" };
  }
  const theme = {};
  for (const key of Object.keys(input)) {
    const def = BY_KEY.get(key);
    if (!def) return { error: `Unknown color: ${String(key).slice(0, 40)}` };
    const value = input[key];
    if (typeof value !== "string" || !HEX_RE.test(value)) {
      return { error: `${def.label}: color must look like #RRGGBB` };
    }
    const hex = value.toUpperCase();
    if (hex !== def.default) theme[key] = hex;
  }
  return { theme };
}

// Sinh CSS ghi đè biến màu ở :root. Chỉ dùng với theme đã qua sanitizeTheme.
function themeToCss(theme) {
  const clean = sanitizeTheme(theme).theme || {};
  const decls = [];
  for (const def of THEME_VARS) {
    const v = clean[def.key];
    if (!v) continue;
    decls.push(`${def.key}:${v}`);
    (def.alias || []).forEach((a) => decls.push(`${a}:${v}`));
    (DERIVED[def.key] || []).forEach(([name, pct]) => decls.push(`${name}:${tint(v, pct)}`));
  }
  // html:root (độ ưu tiên cao hơn :root) để luôn thắng stylesheet chính dù thứ tự nạp thế nào.
  return decls.length ? `html:root{${decls.join(";")}}` : "";
}

// Trộn hex với trắng: pct = tỉ lệ màu gốc giữ lại (0..1).
function tint(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(c * pct + 255 * (1 - pct));
  const h = (c) => mix(c).toString(16).padStart(2, "0");
  return ("#" + h((n >> 16) & 255) + h((n >> 8) & 255) + h(n & 255)).toUpperCase();
}

// Màu nhạt dẫn xuất (nền chip, hover, viền...) đổi theo màu gốc, để đổi màu là
// đổi cả nền chứ không chỉ các chi tiết nhỏ.
const DERIVED = {
  "--blue": [["--blue-border", 0.35]],
  "--pink": [["--pink-light", 0.18], ["--purple-light", 0.18], ["--pink-wash", 0.06], ["--pink-wash-2", 0.04]],
  "--accent": [["--amber-light", 0.2]],
  "--green": [["--teal-light", 0.16]],
  "--red": [["--red-light", 0.16]],
};

function channel(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

// Tỉ lệ tương phản WCAG giữa 2 màu #RRGGBB (1 → 21).
function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// Màu hiệu lực (mặc định + ghi đè).
function resolveTheme(theme) {
  const clean = sanitizeTheme(theme).theme || {};
  const out = {};
  THEME_VARS.forEach((d) => (out[d.key] = clean[d.key] || d.default));
  return out;
}

// Cảnh báo (chỉ để tham khảo, không chặn lưu) khi chữ khó đọc.
function themeWarnings(theme) {
  const c = resolveTheme(theme);
  const out = [];
  const check = (fg, bg, min, msg) => {
    if (contrastRatio(c[fg], c[bg]) < min) out.push(msg);
  };
  check("--ink", "--bg", 4.5, "Text is hard to read on the page background.");
  check("--ink", "--card", 4.5, "Text is hard to read on cards.");
  check("--muted", "--card", 3, "Secondary text is hard to read on cards.");
  check("--blue", "--card", 3, "Primary color is hard to see on cards.");
  if (contrastRatio(c["--blue"], "#FFFFFF") < 3) out.push("White text on primary buttons is hard to read.");
  return out;
}

module.exports = {
  THEME_VARS,
  sanitizeTheme,
  themeToCss,
  contrastRatio,
  resolveTheme,
  themeWarnings,
};

// Tên của từng level (vd IELTS Level 1 = "Band 3.5–5.0"), lưu theo workspace và
// THEO CHƯƠNG TRÌNH — Level 1 IELTS khác Level 1 TOEIC. Dùng chung server và
// client (CommonJS thuần, không import mongoose). Xem docs/plans/PLAN-LEVEL-NAMES.md.
const { isProgram, levelWordOf } = require("./curriculum");

const LEVEL_MAX = 50;
const NAME_MAX = 60;
const MAX_ENTRIES = 200;

// Làm sạch mảng `levelNames` từ body PUT.
//   -> { levelNames: [{ program, level, name }] }  hoặc  { error }
// - program phải hợp lệ, level là số nguyên 1..LEVEL_MAX (sai -> lỗi 400, không đoán).
// - name cắt khoảng trắng, tối đa NAME_MAX ký tự; tên rỗng -> bỏ dòng (= xoá tên).
// - Trùng (program, level): giữ dòng CUỐI. Thứ tự đầu ra: program theo thứ tự xuất hiện
//   đầu tiên, rồi level tăng dần cho dễ đọc / ổn định khi so sánh.
function sanitizeLevelNames(raw) {
  if (!Array.isArray(raw)) return { error: "levelNames must be a list" };
  if (raw.length > MAX_ENTRIES) return { error: "Too many level names" };
  const byKey = new Map();
  for (const item of raw) {
    if (!item || typeof item !== "object") return { error: "Invalid level name entry" };
    if (!isProgram(item.program)) return { error: "Invalid program in level names" };
    const level = typeof item.level === "string" && item.level.trim() !== "" ? Number(item.level) : item.level;
    if (!Number.isInteger(level) || level < 1 || level > LEVEL_MAX) {
      return { error: `Level must be a whole number from 1 to ${LEVEL_MAX}` };
    }
    const name = typeof item.name === "string" ? item.name.trim().slice(0, NAME_MAX).trim() : "";
    const key = item.program + ":" + level;
    byKey.delete(key); // giữ dòng cuối: xoá rồi set lại (đổi cả vị trí, không quan trọng vì sẽ sort)
    if (name) byKey.set(key, { program: item.program, level, name });
  }
  const levelNames = [...byKey.values()].sort((a, b) => {
    if (a.program !== b.program) return a.program < b.program ? -1 : 1;
    return a.level - b.level;
  });
  return { levelNames };
}

// Tên level hoặc "" nếu chưa đặt. `levelNames` có thể undefined (workspace cũ).
function levelNameOf(levelNames, program, level) {
  if (!Array.isArray(levelNames)) return "";
  const lv = Number(level);
  const hit = levelNames.find((x) => x && x.program === program && x.level === lv);
  return hit && hit.name ? hit.name : "";
}

// "Level 1 · Band 3.5–5.0" hoặc "Level 1" khi chưa có tên (đúng chữ cũ).
function formatLevelLabel(level, name, word = "Level") {
  return name ? `${word} ${level} · ${name}` : `${word} ${level}`;
}
function levelLabel(levelNames, program, level) {
  return formatLevelLabel(level, levelNameOf(levelNames, program, level), levelWordOf(program));
}

// Các level đã có tên của 1 chương trình, tăng dần.
function namedLevelsOf(levelNames, program) {
  if (!Array.isArray(levelNames)) return [];
  return levelNames
    .filter((x) => x && x.program === program && x.name)
    .map((x) => x.level)
    .sort((a, b) => a - b);
}

module.exports = { LEVEL_MAX, NAME_MAX, sanitizeLevelNames, levelNameOf, formatLevelLabel, levelLabel, namedLevelsOf };

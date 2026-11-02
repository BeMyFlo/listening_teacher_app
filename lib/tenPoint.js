// Điểm thang 10 của chương trình General — CHỈ để hiển thị, KHÔNG lưu DB.
// CommonJS thuần (không React, không mongoose) để dùng chung server + client.

const { PROGRAMS, isProgram } = require("./curriculum");

// Chương trình có dùng thang 10 không (đọc registry `scoring`, không so chuỗi "general").
function usesTenPoint(program) {
  return isProgram(program) && PROGRAMS[program].scoring === "ten-point";
}

// Điểm thang 10, bước 0,25. null nếu không tính được.
function tenPoint(score, total) {
  if (!(total > 0) || !Number.isFinite(score)) return null;
  const v = Math.round((score / total) * 40) / 4;
  return Math.min(10, Math.max(0, v));
}

// "7.75 / 10" (bỏ số 0 thừa: "8 / 10", "8.5 / 10") — "" nếu null.
function formatTenPoint(score, total) {
  const v = tenPoint(score, total);
  return v == null ? "" : `${v} / 10`;
}

module.exports = { usesTenPoint, tenPoint, formatTenPoint };

// Rubric chấm điểm IELTS Writing / Speaking. Dữ liệu band descriptor nằm ở
// rubrics.json (trích từ 2 file cô giáo gửi). Dùng chung server + client.

const RUBRICS = require("./rubrics.json");

const VARIANTS = {
  "writing.task1": RUBRICS.writing.task1,
  "writing.task2": RUBRICS.writing.task2,
  speaking: RUBRICS.speaking,
};

// kind + prompt.writingTask -> tên rubric. null nếu không phải writing/speaking.
function resolveVariant(kind, writingTask) {
  if (kind === "speaking") return "speaking";
  if (kind === "writing") return writingTask === "task1" ? "writing.task1" : "writing.task2";
  return null;
}

function getRubric(variant) {
  return VARIANTS[variant] || null;
}

function criterionKeys(variant) {
  const r = getRubric(variant);
  return r ? r.criteria.map((c) => c.key) : [];
}

// IELTS: điểm tổng = trung bình các tiêu chí, làm tròn về nửa band gần nhất
// (vd 6.25 -> 6.5, 6.75 -> 7). null nếu chưa chấm tiêu chí nào.
function overallBand(criteria) {
  const bands = (criteria || [])
    .map((c) => Number(c.band))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 9);
  if (!bands.length) return null;
  const mean = bands.reduce((a, b) => a + b, 0) / bands.length;
  return Math.round(mean * 2) / 2;
}

// null nếu hợp lệ; chuỗi lỗi nếu không. Yêu cầu đủ tiêu chí, band nguyên 1–9.
function validateCriteria(variant, criteria) {
  const r = getRubric(variant);
  if (!r) return "Unknown grading rubric: " + variant;
  const need = r.criteria.map((c) => c.key);
  if (!Array.isArray(criteria) || criteria.length !== need.length) {
    return `Please give a band for all ${need.length} criteria.`;
  }
  const seen = new Set();
  for (const c of criteria) {
    if (!need.includes(c.key)) return "Invalid criterion: " + c.key;
    if (seen.has(c.key)) return "Duplicate criterion: " + c.key;
    seen.add(c.key);
    const b = Number(c.band);
    if (!Number.isInteger(b) || b < 1 || b > 9) {
      return `${c.key}: band must be a whole number from 1 to 9.`;
    }
  }
  return null;
}

module.exports = {
  RUBRICS,
  resolveVariant,
  getRubric,
  criterionKeys,
  overallBand,
  validateCriteria,
};

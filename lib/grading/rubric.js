// Rubric chấm điểm IELTS Writing / Speaking. Dữ liệu band descriptor nằm ở
// rubrics.json (trích từ 2 file cô giáo gửi). Dùng chung server + client.

const RUBRICS = require("./rubrics.json");
const { TOEIC_TASKS, isToeicTaskType } = require("../toeicTasks");

const VARIANTS = {
  "writing.task1": RUBRICS.writing.task1,
  "writing.task2": RUBRICS.writing.task2,
  speaking: RUBRICS.speaking,
};
// TOEIC S&W (Phase 8B): rubric dựng từ lib/toeicTasks.js, 1 criterion "score" mức 0..maxScore.
// Không nhét vào rubrics.json để phần IELTS giữ nguyên.
Object.keys(TOEIC_TASKS).forEach((k) => {
  const t = TOEIC_TASKS[k];
  VARIANTS[k] = {
    label: t.label,
    criteria: [{ key: "score", label: "Score", bands: t.descriptors }],
  };
});

function isToeicVariant(variant) {
  return isToeicTaskType(variant);
}

// Khoảng điểm hợp lệ của MỘT criterion: IELTS 1–9, TOEIC 0..maxScore.
function scoreRange(variant) {
  if (isToeicVariant(variant)) return { min: 0, max: TOEIC_TASKS[variant].maxScore };
  return { min: 1, max: 9 };
}

// kind + prompt.writingTask -> tên rubric. null nếu không phải writing/speaking.
function resolveVariant(kind, writingTask) {
  if (kind === "speaking") return "speaking";
  if (kind === "writing") return writingTask === "task1" ? "writing.task1" : "writing.task2";
  return null;
}

function getRubric(variant) {
  return Object.prototype.hasOwnProperty.call(VARIANTS, variant) ? VARIANTS[variant] : null;
}

function criterionKeys(variant) {
  const r = getRubric(variant);
  return r ? r.criteria.map((c) => c.key) : [];
}

// IELTS: điểm tổng = trung bình các tiêu chí, làm tròn về nửa band gần nhất,
// .25 và .75 làm tròn LÊN (5.25 -> 5.5, 6.25 -> 6.5, 6.75 -> 7).
// Math.round(x*2) làm tròn .5 lên nên khớp luật; trung bình của số nguyên/4
// biểu diễn chính xác trong float nên không có lỗi biên.
// null nếu chưa chấm tiêu chí nào.
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
  if (isToeicVariant(variant)) {
    const { max } = scoreRange(variant);
    if (!Array.isArray(criteria) || criteria.length !== 1) return "Please give a score.";
    const c = criteria[0];
    if (!c || c.key !== "score") return "Invalid criterion: " + (c && c.key);
    const n = Number(c.band);
    if (c.band === null || c.band === "" || !Number.isInteger(n) || n < 0 || n > max) {
      return `score: must be a whole number from 0 to ${max}.`;
    }
    return null;
  }
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

// Danh sách tag tiêu chí cho annotation/ghi chú: TOEIC -> aspects của dạng đề; IELTS -> null
// (caller giữ danh sách IELTS cố định của nó).
function annotationCriteria(variant) {
  return isToeicVariant(variant) ? TOEIC_TASKS[variant].aspects.slice() : null;
}

// Điểm của 1 câu TOEIC = điểm criterion "score"; null nếu chưa chấm / không hợp lệ.
function taskScore(variant, criteria) {
  if (!isToeicVariant(variant)) return null;
  const c = (criteria || []).find((x) => x && x.key === "score");
  if (!c || c.band === null || c.band === "" || c.band === undefined) return null;
  const n = Number(c.band);
  const { min, max } = scoreRange(variant);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

module.exports = {
  RUBRICS,
  isToeicVariant,
  annotationCriteria,
  scoreRange,
  taskScore,
  resolveVariant,
  getRubric,
  criterionKeys,
  overallBand,
  validateCriteria,
};

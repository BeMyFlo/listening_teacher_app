// Hàm thuần cho UI chấm/xem điểm Writing-Speaking General (Phase 12 G5 bước 3) — dùng chung server + client,
// test được không cần React. IELTS/TOEIC không đi qua đây (mọi nhánh kiểm isGeneralVariant trước).
const { getRubric, isGeneralVariant, overallScore, validGeneralCriterionScore } = require("./rubric");
const { CRITERION_MAX, CRITERION_STEP } = require("./generalRubric");
const { ASPECT_LABELS } = require("../toeicTasks");

const GENERAL_ANCHORS = [2.5, 2, 1.5, 1, 0.5, 0]; // các mức có descriptor

// Nhãn tiêu chí/khía cạnh: General lấy tên từ rubric (CT = Content, GR = Grammar & mechanics...);
// còn lại giữ ASPECT_LABELS (TOEIC) hoặc chính key (IELTS) như cũ.
function criterionLabel(variant, key) {
  if (isGeneralVariant(variant)) {
    const r = getRubric(variant);
    const c = r && r.criteria.find((x) => x.key === key);
    if (c) return c.label;
  }
  return ASPECT_LABELS[key] || key;
}

// Lỗi inline của ô điểm tiêu chí: "" nếu trống (chưa chấm) hoặc hợp lệ.
function generalScoreError(raw) {
  if (raw === "" || raw === null || raw === undefined) return "";
  const n = Number(raw);
  if (!validGeneralCriterionScore(n)) return `Enter 0 to ${CRITERION_MAX} in steps of ${CRITERION_STEP}`;
  return "";
}

// Mức descriptor áp cho điểm n: mốc lớn nhất không vượt quá n (1.75 -> mốc 1.5). null nếu n không hợp lệ.
function descriptorLevel(n) {
  const v = Number(n);
  if (n === "" || n === null || n === undefined || !validGeneralCriterionScore(v)) return null;
  return GENERAL_ANCHORS.find((a) => a <= v);
}

// Tổng hiển thị ở màn chấm: tổng 4 tiêu chí; thiếu/sai tiêu chí nào -> null.
function generalTotal(variant, bands) {
  return overallScore(variant, Object.keys(bands || {}).map((key) => ({ key, band: bands[key] === "" ? null : Number(bands[key]) })));
}

// Tiêu đề điểm ở RubricResult: General "Score" + "x / 10"; null = để caller giữ đường cũ (Band/TOEIC).
function generalHeader(variant, manualScore) {
  if (!isGeneralVariant(variant)) return null;
  return { title: "Score", value: manualScore != null ? `${manualScore} / 10` : "—" };
}

// Điểm trung bình hiển thị ở bảng bài nộp: ô có scale:10 (General) -> "8.5 / 10"; còn lại giữ nguyên số (band).
function avgScoreText(cell) {
  if (!cell || cell.avgScore == null) return "✓";
  return cell.scale === 10 ? `${cell.avgScore} / 10` : cell.avgScore;
}

module.exports = { avgScoreText, GENERAL_ANCHORS, criterionLabel, generalScoreError, descriptorLevel, generalTotal, generalHeader };

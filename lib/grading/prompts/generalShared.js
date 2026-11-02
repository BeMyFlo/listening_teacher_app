// Phần dùng chung của prompt chấm General English Writing/Speaking (Phase 12 G5), thang 10.
// Chỉ dùng cho rubricVariant general.* — prompt IELTS/TOEIC không import file này.
// Không nhắc IELTS/TOEIC/band: học sinh phổ thông được chấm theo KHỐI LỚP của mình.

const { getRubric } = require("../rubric");
const { CRITERION_MAX, CRITERION_STEP } = require("../generalRubric");

// Bài của học sinh / đề là dữ liệu KHÔNG tin cậy: bỏ chuỗi trùng dấu phân cách (như runAiGrade.neutralise).
const neutralise = (t) => String(t || "").replace(/<<<[A-Z_ ]+>>>/g, "");

// Khối lớp -> trình độ kỳ vọng: 6–7 ≈ A1, 8–9 ≈ A2, 10–12 ≈ B1. Không có/không hợp lệ -> null.
function gradeInfo(level) {
  const n = Number(level);
  if (level === null || level === undefined || level === "" || !Number.isInteger(n) || n < 6 || n > 12) return null;
  return { grade: n, cefr: n <= 7 ? "A1" : n <= 9 ? "A2" : "B1" };
}

// Dòng khối lớp cho prompt người dùng; thiếu khối -> kỳ vọng trung tính.
function gradeLine(level) {
  const g = gradeInfo(level);
  return g
    ? `Student's grade: Grade ${g.grade} (Vietnamese secondary school; expected level about ${g.cefr}). Judge every criterion against what a student of this grade can reasonably do.`
    : "The student's grade was not provided. Judge against what a Vietnamese secondary-school student at a basic-to-intermediate level can reasonably do.";
}

// Bảng mức từng tiêu chí: "Score 2.5: ..." lấy từ generalRubric.js.
function rubricBlock(variant) {
  const r = getRubric(variant);
  if (!r) throw new Error("Unknown General rubric: " + variant);
  const lines = [`SCORING for "${r.label}": 4 criteria, each scored 0 to ${CRITERION_MAX} in steps of ${CRITERION_STEP}. The server adds the four scores into the mark out of 10.`];
  for (const c of r.criteria) {
    lines.push(`\n${c.label} (${c.key}):`);
    for (const k of ["2.5", "2", "1.5", "1", "0.5", "0"]) {
      const d = c.bands && c.bands[k];
      if (d && d.en) lines.push(`  Score ${k}: ${d.en}`);
    }
  }
  return lines.join("\n");
}

// Quy tắc chấm chung (Writing + Speaking).
const GRADE_RULES = [
  "GRADE EXPECTATION",
  "- Grades 6–7 are about A1, grades 8–9 about A2 and grades 10–12 about B1. The user message states the student's grade.",
  "- Judge each criterion against what is expected at THAT grade, not against any outside exam standard. A student who fully meets the expectation of their grade can earn a high score; one who only manages simpler work than the grade expects scores lower.",
  "- Use the descriptors above as anchors. Scores between anchors (e.g. 1.75) are allowed when the work sits between two descriptors.",
  "",
  "GRADING RULES",
  "- Grade only what the student actually produced; never credit ability that is not demonstrated.",
  "- Distinguish an occasional slip from a repeated pattern; repeated errors weigh more.",
  "- Do not reward length or difficult vocabulary for its own sake; relevance, clarity and accuracy for the grade matter.",
  "- Each score must match its comment: many major or repeated problems cannot come with a high score.",
  "- Every correction must preserve the student's intended meaning; if the meaning is unclear, say so instead of inventing one.",
  "- Only annotate actual errors, not \"more elegant\" phrasing. Wrong -> annotate; unnatural -> annotate only if it hurts meaning; acceptable but basic -> do NOT annotate.",
  "- If the task text is missing, do not invent requirements; grade what can be assessed and say so in the Content comment.",
];

module.exports = { neutralise, gradeInfo, gradeLine, rubricBlock, GRADE_RULES };

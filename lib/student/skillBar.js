// Định dạng thanh kỹ năng ở Dashboard học sinh (Strengths & Weaknesses).
// CommonJS thuần (như lib/curriculum.js) để test được bằng node --test.
const { PROGRAMS, programOf } = require("../curriculum");

// Chương trình của học sinh = chương trình của các Unit đang giao cho lớp (1 học sinh ∈ 1
// lớp ∈ 1 chương trình). Chưa có Unit nào -> IELTS (mặc định, giữ hành vi cũ).
function studentProgramFromUnits(units) {
  const first = (units || []).find((u) => u && u.program);
  return programOf(first || {});
}

// "Band 6.5" (IELTS Writing/Speaking) hoặc "72%". TOEIC chỉ hiện %, không bao giờ "Band"
// (plan 4.4: thang điểm TOEIC khác band IELTS).
function skillBarValue(skill, program) {
  const toeic = PROGRAMS[programOf({ program })].scoring === "toeic-scaled";
  if (!toeic && skill.band != null) return "Band " + skill.band;
  return skill.pct + "%";
}

// Chỉ liệt kê kỹ năng thuộc chương trình (TOEIC 8A không có Writing/Speaking). IELTS có
// đủ 6 key nên giữ nguyên toàn bộ.
function skillsForProgram(skills, program) {
  const allowed = PROGRAMS[programOf({ program })].lessonSkills;
  return (skills || []).filter((s) => allowed.includes(s.key));
}

module.exports = { studentProgramFromUnits, skillBarValue, skillsForProgram };

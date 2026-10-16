// Đếm số "mục cần làm" trong 1 Unit / 1 category và xác định học sinh đã làm
// xong 1 phạm vi chưa. Tách ra dùng chung cho: nhắc hạn (notifications) và
// dashboard giáo viên. Không phụ thuộc DB — nhận plain object.
//
// Chỉ đếm category thuộc kỹ năng của chương trình Unit (PROGRAMS[program].lessonSkills,
// PLAN-PHASE8-TOEIC.md 5.1b): Unit TOEIC còn sót nội dung Writing/Speaking thì
// phần đó bị ẩn với học sinh, KHÔNG được tính vào "cần làm" — nếu không học
// sinh không bao giờ "xong", bị nhắc hạn mãi và đứt streak. Unit IELTS có đủ
// 6 kỹ năng nên kết quả y hệt trước.

const { PROGRAMS, programOf } = require("./curriculum");

function lessonSkillsOf(unit) {
  return PROGRAMS[programOf(unit)].lessonSkills;
}

const CATEGORY_LABELS = {
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking",
};

// `unit` (tuỳ chọn): có truyền thì category ngoài kỹ năng của chương trình đếm 0.
function countCategoryItems(cat, unit) {
  if (!cat) return 0;
  if (unit && !lessonSkillsOf(unit).includes(cat.key)) return 0;
  let n = (cat.exercises || []).length + (cat.prompts || []).length;
  for (const t of cat.topics || []) n += (t.exercises || []).length;
  for (const g of cat.groups || []) n += (g.exercises || []).length;
  return n;
}

function countUnitItems(unit) {
  return (unit.categories || []).reduce((n, c) => n + countCategoryItems(c, unit), 0);
}

function attemptedKeys(subs) {
  const set = new Set();
  for (const s of subs) {
    if (s.kind === "exercise" && s.exerciseId) set.add("ex:" + s.exerciseId);
    else if ((s.kind === "writing" || s.kind === "speaking") && s.promptId) set.add("pr:" + s.promptId);
  }
  return set;
}

// Học sinh đã làm xong phạm vi cần xét chưa? categoryKey null = cả Unit.
function isScopeComplete(unit, categoryKey, subs) {
  if (!categoryKey) {
    const total = countUnitItems(unit);
    // Bài nộp thuộc kỹ năng bị ẩn không được cộng vào tiến độ. IELTS: không có
    // kỹ năng nào bị ẩn nên `hidden` rỗng và subs giữ nguyên.
    const allowed = lessonSkillsOf(unit);
    const hidden = Object.keys(CATEGORY_LABELS).filter((k) => !allowed.includes(k));
    const visible = hidden.length ? subs.filter((s) => !hidden.includes(s.categoryKey)) : subs;
    return !total || attemptedKeys(visible).size >= total;
  }
  const cat = (unit.categories || []).find((c) => c.key === categoryKey);
  const total = countCategoryItems(cat, unit);
  if (!total) return true;
  const scoped = subs.filter((s) => s.categoryKey === categoryKey);
  return attemptedKeys(scoped).size >= total;
}

module.exports = {
  CATEGORY_LABELS,
  countCategoryItems,
  countUnitItems,
  attemptedKeys,
  isScopeComplete,
  lessonSkillsOf,
};

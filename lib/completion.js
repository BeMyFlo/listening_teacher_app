// Đếm số "mục cần làm" trong 1 Unit / 1 category và xác định học sinh đã làm
// xong 1 phạm vi chưa. Tách ra dùng chung cho: nhắc hạn (notifications) và
// dashboard giáo viên. Không phụ thuộc DB — nhận plain object.

const CATEGORY_LABELS = {
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking",
};

function countCategoryItems(cat) {
  if (!cat) return 0;
  let n = (cat.exercises || []).length + (cat.prompts || []).length;
  for (const t of cat.topics || []) n += (t.exercises || []).length;
  for (const g of cat.groups || []) n += (g.exercises || []).length;
  return n;
}

function countUnitItems(unit) {
  return (unit.categories || []).reduce((n, c) => n + countCategoryItems(c), 0);
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
    return !total || attemptedKeys(subs).size >= total;
  }
  const cat = (unit.categories || []).find((c) => c.key === categoryKey);
  const total = countCategoryItems(cat);
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
};

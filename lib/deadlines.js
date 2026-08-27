// Giải hạn nộp bài của Unit — hạn chung + hạn riêng từng kỹ năng.
// Xem Unit.js DeadlineSchema. Dùng server-side (submissions, units API, notifications).

const CATEGORY_KEYS = ["grammar", "vocabulary", "listening", "reading", "writing", "speaking"];

// Hạn áp cho (lớp, kỹ năng): ưu tiên hạn riêng kỹ năng đó, không có thì lấy
// hạn chung cả Unit. Trả Date hoặc null.
function resolveDeadline(unit, classId, categoryKey) {
  const dls = (unit && unit.deadlines) || [];
  const cid = String(classId || "");
  if (categoryKey) {
    const skill = dls.find(
      (d) => String(d.classId) === cid && d.categoryKey === categoryKey && d.dueAt
    );
    if (skill) return skill.dueAt;
  }
  const whole = dls.find((d) => String(d.classId) === cid && !d.categoryKey && d.dueAt);
  return whole ? whole.dueAt : null;
}

// kind của Submission -> categoryKey dùng để tra hạn.
function submissionCategoryKey(sub) {
  if (!sub) return null;
  if (sub.kind === "writing") return "writing";
  if (sub.kind === "speaking") return "speaking";
  return sub.categoryKey || null; // exercise
}

// Toàn bộ hạn đã resolve của 1 lớp trong 1 Unit.
//   { unit: Date|null, byCategory: { grammar: Date|null, ... } }
function classDeadlines(unit, classId) {
  const out = { unit: resolveDeadline(unit, classId, null), byCategory: {} };
  CATEGORY_KEYS.forEach((k) => {
    out.byCategory[k] = resolveDeadline(unit, classId, k);
  });
  return out;
}

// Danh sách các mốc hạn phân biệt của 1 lớp (để sinh nhắc hạn / hiển thị):
//   [{ categoryKey: null|key, dueAt: Date }]  — categoryKey null = cả Unit.
function distinctDeadlines(unit, classId) {
  const cid = String(classId || "");
  return ((unit && unit.deadlines) || [])
    .filter((d) => String(d.classId) === cid && d.dueAt)
    .map((d) => ({ categoryKey: d.categoryKey || null, dueAt: d.dueAt }));
}

module.exports = {
  CATEGORY_KEYS,
  resolveDeadline,
  submissionCategoryKey,
  classDeadlines,
  distinctDeadlines,
};

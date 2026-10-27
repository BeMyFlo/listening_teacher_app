// Re-grades and PERSISTS Unit exercise submissions against the CURRENT
// answer key. Submission.detail/score/total are a snapshot computed once at
// submit time (see pages/api/submissions.js) — nothing else refreshes them
// when a teacher edits an exercise's answers later, so scores silently go
// stale. This closes that gap: call after saving a Unit's categories, or
// on demand from a teacher-triggered "Re-grade" button.
const Submission = require("../models/Submission");
const { gradeSubmission } = require("../grade");

// Bài tập có thể nằm ở category.exercises, hoặc trong 1 chủ điểm grammar
// (category.topics[].exercises), hoặc 1 nhóm từ vocab (category.groups[].exercises)
// — cùng logic tra cứu với pages/api/submissions.js lúc nộp bài.
function findExerciseInUnit(unit, categoryKey, exerciseId) {
  const category = (unit.categories || []).find((c) => c.key === categoryKey);
  if (!category) return null;
  const findEx = (arr) => {
    if (!arr) return null;
    if (typeof arr.id === "function") return arr.id(exerciseId);
    return arr.find((e) => String(e._id) === String(exerciseId)) || null;
  };
  let exercise = findEx(category.exercises);
  if (!exercise) {
    for (const t of category.topics || []) {
      exercise = findEx(t.exercises);
      if (exercise) break;
    }
  }
  if (!exercise) {
    for (const g of category.groups || []) {
      exercise = findEx(g.exercises);
      if (exercise) break;
    }
  }
  return exercise || null;
}

// Trả về số submission đã chấm lại. Bỏ qua submission mà bài tập gốc đã bị
// xoá hẳn (giữ nguyên snapshot cũ thay vì xoá điểm của học sinh).
async function regradeUnitSubmissions(unit) {
  const submissions = await Submission.find({ kind: "exercise", unitId: unit._id });
  let updated = 0;
  for (const sub of submissions) {
    const exercise = findExerciseInUnit(unit, sub.categoryKey, sub.exerciseId);
    if (!exercise) continue;
    const { score, total, detail } = gradeSubmission(exercise, sub.answers || {});
    sub.score = score;
    sub.total = total;
    sub.detail = detail;
    await sub.save();
    updated += 1;
  }
  return updated;
}

// Chấm lại mọi submission kind "test" của đúng testId và testSkill theo đáp án mới.
async function regradeTestSubmissions(test, skill) {
  const skillBlock = test && test.skills && test.skills[skill];
  if (!skillBlock) return 0;
  const submissions = await Submission.find({ kind: "test", testId: test._id, testSkill: skill });
  let updated = 0;
  for (const sub of submissions) {
    const { score, total, detail } = gradeSubmission(skillBlock, sub.answers || {});
    sub.score = score;
    sub.total = total;
    sub.detail = detail;
    await sub.save();
    updated += 1;
  }
  return updated;
}

module.exports = { findExerciseInUnit, regradeUnitSubmissions, regradeTestSubmissions };

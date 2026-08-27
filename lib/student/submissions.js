// Suy ra tiến độ / kết quả từ danh sách Submission thật (không có field
// XP/lessons riêng trong data model).
import { PROMPT_CATS } from "./constants";

export function latestExamSub(subs, testId, skill) {
  return (
    subs.find((s) => String(s.testId) === String(testId) && s.testSkill === skill) || null
  );
}

export function latestExerciseSub(subs, exerciseId) {
  return (
    subs.find((s) => s.kind === "exercise" && String(s.exerciseId) === String(exerciseId)) || null
  );
}

export function latestPromptSub(subs, promptId) {
  return (
    subs.find(
      (s) =>
        (s.kind === "writing" || s.kind === "speaking") &&
        String(s.promptId) === String(promptId)
    ) || null
  );
}

// % hoàn thành 1 Unit (list shape: categories[].itemCount)
export function unitProgress(unit, subs) {
  const totalItems = (unit.categories || []).reduce((n, c) => n + (c.itemCount || 0), 0);
  const attempted = new Set();
  subs.forEach((s) => {
    if (String(s.unitId) !== String(unit.id)) return;
    if (s.kind === "exercise") attempted.add("ex:" + s.exerciseId);
    else if (s.kind === "writing" || s.kind === "speaking") attempted.add("pr:" + s.promptId);
  });
  const completed = Math.min(attempted.size, totalItems);
  const pct = totalItems ? Math.round((completed / totalItems) * 100) : 0;
  return { totalItems, completed, pct };
}

// Thống kê 1 category trong Unit detail (detail shape: exercises[], prompts[])
export function categoryStats(cat, subs) {
  const isPrompt = PROMPT_CATS.includes(cat.key);
  const items = isPrompt ? cat.prompts : cat.exercises;
  let completed = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  (items || []).forEach((it) => {
    const last = isPrompt
      ? latestPromptSub(subs, it.id)
      : latestExerciseSub(subs, it.id);
    if (!last) return;
    completed++;
    if (!isPrompt && last.total > 0) {
      scoreSum += (last.score / last.total) * 100;
      scoreCount++;
    }
  });
  return {
    topics: (items || []).length,
    completed,
    avgScorePct: scoreCount ? Math.round(scoreSum / scoreCount) : null,
  };
}

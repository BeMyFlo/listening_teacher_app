// Tổng hợp dữ liệu dashboard học sinh phía CLIENT — từ /api/units (rows) +
// /api/submissions (rows, mới nhất trước). Streak & leaderboard lấy riêng từ
// /api/student/dashboard.
import { LESSON_CATS } from "./constants";
import { unitProgress, promptAttempts } from "./submissions";
import { studentProgramFromUnits, skillsForProgram } from "./skillBar";
import { usesTenPoint, tenPoint } from "../tenPoint";
import { isToeicSub, scorePct, formatScore } from "../scoreLabel";

const DAY = 86400000;

function skillStat(key, label, subs) {
  const isPrompt = key === "writing" || key === "speaking";

  if (isPrompt) {
    const seen = new Set();
    const bands = [];
    const gradedSubs = [];
    for (const s of subs) {
      if (s.kind !== key || s.gradingStatus !== "graded" || s.manualScore == null) continue;
      const id = s.promptId
        ? "pr:" + s.promptId
        : s.testId
        ? "tw:" + s.testId + ":" + (s.testSkill || key)
        : null;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      bands.push(Number(s.manualScore));
      gradedSubs.push(s);
    }
    if (!bands.length) return null;
    if (gradedSubs.some(isToeicSub)) {
      // TOEIC: trung bình % điểm thô / max (mỗi dạng đề có thang riêng); không có "band".
      const pct = gradedSubs.reduce((a, s) => a + scorePct(s), 0) / gradedSubs.length;
      return { key, label, pct: Math.round(pct), band: null, count: bands.length };
    }
    const band = bands.reduce((a, b) => a + b, 0) / bands.length;
    return { key, label, pct: Math.round((band / 9) * 100), band: Math.round(band * 10) / 10, count: bands.length };
  }

  const seen = new Set();
  let correct = 0;
  let total = 0;
  let count = 0;
  for (const s of subs) {
    let k = null;
    if (s.kind === "exercise" && s.categoryKey === key && s.exerciseId) k = "ex:" + s.exerciseId;
    else if (s.kind === "test" && s.testSkill === key && s.testId) k = "ts:" + s.testId;
    if (!k || seen.has(k)) continue;
    seen.add(k);
    if (s.total > 0) {
      correct += s.score || 0;
      total += s.total;
      count++;
    }
  }
  if (!count || !total) return null;
  return { key, label, pct: Math.round((correct / total) * 100), count };
}

// { featured, stats, skills, focusSkill, todos, recent }
export function buildStudentHome({ units = [], subs = [], now = new Date() } = {}) {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const unitById = new Map(units.map((u) => [String(u.id), u]));

  // ---- featured unit (giống app/student/lessons/page.js) ----
  const withProgress = units.map((u) => ({ u, p: unitProgress(u, subs) }));
  const featured =
    withProgress.find((x) => x.p.pct > 0 && x.p.pct < 100) ||
    withProgress.find((x) => x.p.pct === 0) ||
    withProgress[0] ||
    null;

  // ---- stat tiles ----
  const pendingReview = subs.filter(
    (s) => (s.kind === "writing" || s.kind === "speaking") && s.gradingStatus !== "graded"
  ).length;

  // ---- strengths & weaknesses ----
  const program = studentProgramFromUnits(units);
  const skills = skillsForProgram(
    LESSON_CATS.map((c) => skillStat(c.key, c.label, subs)).filter(Boolean),
    program
  );
  const focusSkill = skills.reduce((min, s) => (!min || s.pct < min.pct ? s : min), null);

  // ---- your tasks ----
  const todos = [];
  // 1. Unit quá hạn chưa xong
  for (const { u, p } of withProgress) {
    if (u.isOverdue && p.pct < 100) {
      todos.push({
        icon: "warning",
        tone: "danger",
        title: `${u.name} — overdue`,
        subtitle: `${p.completed}/${p.totalItems} done · finish the rest`,
        href: `/student/lessons/${u.id}`,
      });
    }
  }
  // 2 & 3. Reflection Log / nộp lại — theo từng prompt (bài lesson)
  const promptIds = new Set(
    subs.filter((s) => (s.kind === "writing" || s.kind === "speaking") && s.promptId).map((s) => String(s.promptId))
  );
  for (const pid of promptIds) {
    const { attempt1, attempt2 } = promptAttempts(subs, pid);
    if (!attempt1 || attempt1.gradingStatus !== "graded") continue;
    const uName = attempt1.unitId ? (unitById.get(String(attempt1.unitId))?.name || "Lesson") : "Lesson";
    const kindLabel = attempt1.kind === "speaking" ? "Speaking" : "Writing";
    const href = attempt1.unitId
      ? `/student/lessons/${attempt1.unitId}/prompts/${pid}`
      : "/student/lessons";
    if (!attempt1.reflectionLog) {
      todos.push({
        icon: "edit",
        tone: "",
        title: `Reflection Log ready — ${kindLabel}`,
        subtitle: `${uName} · ${formatScore(attempt1, { missing: "?" })}`,
        href,
      });
    } else if (!attempt2) {
      todos.push({
        icon: attempt1.kind === "speaking" ? "mic" : "writing",
        tone: "",
        title: `${attempt1.kind === "speaking" ? "Re-record" : "Rewrite"} — ${kindLabel}`,
        subtitle: `${uName} · improve on your feedback`,
        href,
      });
    }
  }
  // 4. Sắp tới hạn (≤ 3 ngày), chưa xong
  for (const { u, p } of withProgress) {
    if (u.isOverdue || p.pct >= 100 || !u.dueAt) continue;
    const left = new Date(u.dueAt).getTime() - nowMs;
    if (left > 0 && left <= 3 * DAY) {
      const days = Math.ceil(left / DAY);
      todos.push({
        icon: "clock",
        tone: "",
        title: `${u.name} — due in ${days} day${days === 1 ? "" : "s"}`,
        subtitle: `${p.completed}/${p.totalItems} done`,
        href: `/student/lessons/${u.id}`,
      });
    }
  }

  // ---- recent activity ----
  const recent = subs
    .slice()
    .sort(
      (a, b) =>
        Math.max(new Date(b.gradedAt || 0), new Date(b.submittedAt || 0)) -
        Math.max(new Date(a.gradedAt || 0), new Date(a.submittedAt || 0))
    )
    .slice(0, 6)
    .map((s) => {
      const at = s.gradedAt && new Date(s.gradedAt) > new Date(s.submittedAt) ? s.gradedAt : s.submittedAt;
      const uName = s.unitId ? unitById.get(String(s.unitId))?.name : null;
      // General: điểm thang 10 "8.5/10"; không biết program thì giữ "score/total".
      const tp = usesTenPoint(s.program) ? tenPoint(s.score, s.total) : null;
      const scoreText = tp != null ? `${tp}/10` : `${s.score}/${s.total}`;
      if ((s.kind === "writing" || s.kind === "speaking") && s.gradingStatus === "graded") {
        return {
          icon: s.kind === "speaking" ? "mic" : "writing",
          title: `${s.kind === "speaking" ? "Speaking" : "Writing"} graded — ${formatScore(s, { missing: "?" })}`,
          subtitle: uName || s.testTitle || "",
          at,
          href: s.unitId && s.promptId ? `/student/lessons/${s.unitId}/prompts/${s.promptId}` : "/student/tests",
        };
      }
      if (s.kind === "test") {
        return {
          icon: s.testSkill === "listening" ? "headphones" : "book-open",
          title: `${s.testTitle || "Mock test"} · ${s.testSkill} — ${scoreText}`,
          subtitle: "",
          at,
          href: "/student/tests",
        };
      }
      if (s.kind === "exercise") {
        return {
          icon: "check-circle",
          title: `${s.exerciseTitle || "Exercise"} — ${scoreText}`,
          subtitle: uName || "",
          at,
          href: s.unitId ? `/student/lessons/${s.unitId}` : "/student/lessons",
        };
      }
      return {
        icon: "send",
        title: `Submitted ${s.kind}`,
        subtitle: uName || s.testTitle || "",
        at,
        href: "/student/lessons",
      };
    });

  return {
    featured: featured
      ? { unit: featured.u, pct: featured.p.pct, completed: featured.p.completed, totalItems: featured.p.totalItems }
      : null,
    stats: { unitCount: units.length, pendingReview },
    program,
    skills,
    focusSkill,
    todos: todos.slice(0, 6),
    recent,
  };
}

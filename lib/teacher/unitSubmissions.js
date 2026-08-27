// Server-side aggregation for the per-Unit submission views (teacher side).
// Turns raw Submission rows + a Unit definition into:
//   - an overview: one row per student with a score summary across the 6
//     unit categories (Grammar, Vocabulary, Listening, Reading, Writing,
//     Speaking), plus a grading status;
//   - a per-student detail: every exercise re-graded question by question,
//     plus the essay/audio for the manually-graded categories.

const { gradeSubmission } = require("../grade");

const CATEGORY_KEYS = ["grammar", "vocabulary", "listening", "reading", "writing", "speaking"];
const CATEGORY_LABELS = {
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking",
};
const PROMPT_KEYS = ["writing", "speaking"];

const S = (v) => (v == null ? "" : String(v));

// Every gradable exercise inside a category — flat list, including the ones
// nested under grammar topics / vocab groups.
function enumerateExercises(cat) {
  if (!cat) return [];
  const out = [];
  (cat.exercises || []).forEach((ex) => out.push({ ex, group: "" }));
  (cat.topics || []).forEach((t) =>
    (t.exercises || []).forEach((ex) => out.push({ ex, group: t.name || "" }))
  );
  (cat.groups || []).forEach((g) =>
    (g.exercises || []).forEach((ex) => out.push({ ex, group: g.name || "" }))
  );
  return out;
}

function countQuestions(ex) {
  return (ex.sections || []).reduce((n, s) => n + (s.fields || []).length, 0);
}

// Newest submission per key value (exerciseId / promptId), + attempt count.
function groupLatest(subs, keyField) {
  const map = new Map();
  subs.forEach((s) => {
    const k = S(s[keyField]);
    if (!k) return;
    const prev = map.get(k);
    if (!prev) {
      map.set(k, { latest: s, attempts: 1 });
      return;
    }
    prev.attempts += 1;
    if (new Date(s.submittedAt) > new Date(prev.latest.submittedAt)) prev.latest = s;
  });
  return map;
}

// Map a choice option value -> its display label, across a whole exercise.
function optionLabelMap(ex) {
  const m = {};
  (ex.sections || []).forEach((sec) => {
    (sec.matchOptions || []).forEach((o) => (m[o.value] = o.label || o.value));
    (sec.fields || []).forEach((f) =>
      (f.options || []).forEach((o) => (m[o.value] = o.label || o.value))
    );
  });
  return m;
}

function labelValue(v, m) {
  if (Array.isArray(v)) return v.map((x) => m[x] || x).join(", ");
  return m[v] || S(v);
}

function regrade(ex, sub) {
  // Prefer the snapshot stored at submit time; fall back to re-grading.
  let detail = Array.isArray(sub.detail) ? sub.detail : null;
  if (!detail) {
    try {
      detail = gradeSubmission(ex, sub.answers || {}).detail;
    } catch {
      detail = [];
    }
  }
  const m = optionLabelMap(ex);
  return detail.map((d) => ({
    id: d.id,
    label: d.label,
    correct: !!d.correct,
    score: d.score,
    submittedText: labelValue(d.submitted, m) || "(blank)",
    answerText: labelValue(d.answer, m),
  }));
}

// ---------- Overview: one summary row per student ----------
function buildUnitOverview({ unit, submissions, students, classById }) {
  const catExercises = {};
  const catPrompts = {};
  CATEGORY_KEYS.forEach((key) => {
    const cat = (unit.categories || []).find((c) => c.key === key);
    catExercises[key] = enumerateExercises(cat).map((x) => S(x.ex._id));
    catPrompts[key] = (cat && cat.prompts ? cat.prompts : []).map((p) => S(p._id));
  });

  const byStudent = new Map();
  submissions.forEach((s) => {
    const k = S(s.studentId);
    if (!byStudent.has(k)) byStudent.set(k, []);
    byStudent.get(k).push(s);
  });

  const rows = students.map((stu) => {
    const subs = byStudent.get(S(stu._id)) || [];
    const exMap = groupLatest(
      subs.filter((s) => s.kind === "exercise"),
      "exerciseId"
    );
    const prMap = groupLatest(
      subs.filter((s) => s.kind === "writing" || s.kind === "speaking"),
      "promptId"
    );

    let anyPending = false;
    let anyActivity = false;
    let lastSubmittedAt = null;
    subs.forEach((s) => {
      const t = new Date(s.submittedAt);
      if (!lastSubmittedAt || t > lastSubmittedAt) lastSubmittedAt = t;
    });

    const categories = {};
    CATEGORY_KEYS.forEach((key) => {
      if (PROMPT_KEYS.includes(key)) {
        const ids = catPrompts[key];
        let submitted = 0;
        let graded = 0;
        let scoreSum = 0;
        ids.forEach((id) => {
          const g = prMap.get(id);
          if (!g) return;
          submitted += 1;
          anyActivity = true;
          if (g.latest.gradingStatus === "graded") {
            graded += 1;
            scoreSum += Number(g.latest.manualScore) || 0;
          } else {
            anyPending = true;
          }
        });
        categories[key] = {
          kind: "prompt",
          itemsTotal: ids.length,
          submitted,
          graded,
          avgScore: graded ? Math.round((scoreSum / graded) * 10) / 10 : null,
        };
      } else {
        const ids = catExercises[key];
        let done = 0;
        let score = 0;
        let total = 0;
        ids.forEach((id) => {
          const g = exMap.get(id);
          if (!g) return;
          done += 1;
          anyActivity = true;
          score += Number(g.latest.score) || 0;
          total += Number(g.latest.total) || 0;
        });
        categories[key] = { kind: "exercise", itemsTotal: ids.length, done, score, total };
      }
    });

    let status = "not_started";
    if (anyActivity) status = anyPending ? "needs_grading" : "in_progress";
    // "in_progress" also covers fully-done auto categories; the UI decides
    // whether everything is complete from itemsTotal vs done.

    const cls = stu.classId ? classById[S(stu.classId)] : null;
    return {
      _id: stu._id,
      name: stu.name,
      username: stu.username,
      classId: stu.classId || null,
      className: cls ? cls.name : null,
      categories,
      anyPending,
      hasActivity: anyActivity,
      status,
      lastSubmittedAt,
    };
  });

  // needs-grading first, then most recent activity, then name.
  rows.sort((a, b) => {
    if (a.anyPending !== b.anyPending) return a.anyPending ? -1 : 1;
    const ta = a.lastSubmittedAt ? +new Date(a.lastSubmittedAt) : 0;
    const tb = b.lastSubmittedAt ? +new Date(b.lastSubmittedAt) : 0;
    if (ta !== tb) return tb - ta;
    return S(a.name).localeCompare(S(b.name));
  });

  return rows;
}

// ---------- Detail: full breakdown for one student ----------
function buildStudentDetail({ unit, submissions }) {
  const exMap = groupLatest(
    submissions.filter((s) => s.kind === "exercise"),
    "exerciseId"
  );
  const prMap = groupLatest(
    submissions.filter((s) => s.kind === "writing" || s.kind === "speaking"),
    "promptId"
  );

  return CATEGORY_KEYS.map((key) => {
    const cat = (unit.categories || []).find((c) => c.key === key);
    const label = CATEGORY_LABELS[key];

    if (PROMPT_KEYS.includes(key)) {
      const prompts = (cat && cat.prompts ? cat.prompts : []).map((p) => {
        const g = prMap.get(S(p._id));
        const sub = g && g.latest;
        return {
          _id: p._id,
          title: p.title || "",
          instructions: p.instructions || "",
          submissionId: sub ? sub._id : null,
          submittedAt: sub ? sub.submittedAt : null,
          attempts: g ? g.attempts : 0,
          essayText: sub ? sub.essayText || "" : "",
          audioUrl: sub ? sub.audioUrl || "" : "",
          gradingStatus: sub ? sub.gradingStatus : null,
          manualScore: sub && sub.manualScore != null ? sub.manualScore : null,
          manualFeedback: sub ? sub.manualFeedback || "" : "",
        };
      });
      const submitted = prompts.filter((p) => p.submissionId).length;
      return { key, label, kind: "prompt", itemsTotal: prompts.length, submitted, prompts };
    }

    const exercises = enumerateExercises(cat).map(({ ex, group }) => {
      const g = exMap.get(S(ex._id));
      const sub = g && g.latest;
      return {
        _id: ex._id,
        title: ex.title || "Exercise",
        group,
        questionCount: countQuestions(ex),
        submissionId: sub ? sub._id : null,
        submittedAt: sub ? sub.submittedAt : null,
        attempts: g ? g.attempts : 0,
        score: sub ? sub.score : null,
        total: sub ? sub.total : null,
        detail: sub ? regrade(ex, sub) : null,
      };
    });
    const done = exercises.filter((e) => e.submissionId).length;
    const score = exercises.reduce((n, e) => n + (Number(e.score) || 0), 0);
    const total = exercises.reduce((n, e) => n + (Number(e.total) || 0), 0);
    return { key, label, kind: "exercise", itemsTotal: exercises.length, done, score, total, exercises };
  });
}

module.exports = {
  CATEGORY_KEYS,
  CATEGORY_LABELS,
  PROMPT_KEYS,
  buildUnitOverview,
  buildStudentDetail,
};

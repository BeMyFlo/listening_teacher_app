// Server-side aggregation for the per-Mock-Test submission views (teacher
// side) — same shape/spirit as lib/teacher/unitSubmissions.js, but for a Test
// (4 independent skills, one attempt each for Listening/Reading, 1+ prompts
// for Writing/Speaking) instead of a Lesson Unit (6 categories of exercises).

const { rebuildDetail, fieldFormatMap, aggregateByFormat } = require("../grade");

const SKILL_KEYS = ["listening", "reading", "writing", "speaking"];
const SKILL_LABELS = { listening: "Listening", reading: "Reading", writing: "Writing", speaking: "Speaking" };
const PROMPT_KEYS = ["writing", "speaking"];

const S = (v) => (v == null ? "" : String(v));

function skillHasContent(test, key) {
  const sk = (test.skills || {})[key] || {};
  return PROMPT_KEYS.includes(key) ? (sk.prompts || []).length > 0 : (sk.sections || []).length > 0;
}

// Newest submission per key value (promptId), + attempt count.
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

// ---------- Overview: one summary row per student ----------
function buildTestOverview({ test, submissions, students, classById }) {
  const promptIds = {};
  PROMPT_KEYS.forEach((key) => {
    promptIds[key] = (((test.skills || {})[key] || {}).prompts || []).map((p) => S(p._id));
  });

  const byStudent = new Map();
  submissions.forEach((s) => {
    const k = S(s.studentId);
    if (!byStudent.has(k)) byStudent.set(k, []);
    byStudent.get(k).push(s);
  });

  const rows = students.map((stu) => {
    const subs = byStudent.get(S(stu._id)) || [];
    let anyPending = false;
    let anyActivity = false;
    let lastSubmittedAt = null;
    subs.forEach((s) => {
      const t = new Date(s.submittedAt);
      if (!lastSubmittedAt || t > lastSubmittedAt) lastSubmittedAt = t;
    });

    const skills = {};
    SKILL_KEYS.forEach((key) => {
      if (PROMPT_KEYS.includes(key)) {
        const relevant = subs.filter((s) => s.kind === key);
        const map = groupLatest(relevant, "promptId");
        // Prompts currently on the test, PLUS any promptId a student actually
        // submitted to — the test's Writing/Speaking prompts can be edited
        // after submission (new subdocument _ids), which would otherwise
        // silently drop real, already-graded student work from view.
        const allIds = new Set([...promptIds[key], ...map.keys()]);
        let submitted = 0;
        let graded = 0;
        let scoreSum = 0;
        allIds.forEach((id) => {
          const g = map.get(id);
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
        skills[key] = {
          kind: "prompt",
          itemsTotal: allIds.size,
          submitted,
          graded,
          avgScore: graded ? Math.round((scoreSum / graded) * 10) / 10 : null,
        };
        return;
      }
      if (!skillHasContent(test, key)) {
        skills[key] = null;
        return;
      }
      {
        const relevant = subs
          .filter((s) => s.kind === "test" && s.testSkill === key)
          .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
        const latest = relevant[0] || null;
        if (!latest) {
          skills[key] = { kind: "auto", done: false };
          return;
        }
        anyActivity = true;
        skills[key] = {
          kind: "auto",
          done: true,
          score: latest.score,
          total: latest.total,
          submittedAt: latest.submittedAt,
        };
      }
    });

    let status = "not_started";
    if (anyActivity) status = anyPending ? "needs_grading" : "in_progress";

    const cls = stu.classId ? classById[S(stu.classId)] : null;
    return {
      _id: stu._id,
      name: stu.name,
      username: stu.username,
      classId: stu.classId || null,
      className: cls ? cls.name : null,
      skills,
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

// View của 1 submission writing/speaking.
function promptSubView(sub) {
  return {
    submissionId: sub ? sub._id : null,
    submittedAt: sub ? sub.submittedAt : null,
    essayText: sub ? sub.essayText || "" : "",
    audioUrl: sub ? sub.audioUrl || "" : "",
    gradingStatus: sub ? sub.gradingStatus : null,
    manualScore: sub && sub.manualScore != null ? sub.manualScore : null,
    manualFeedback: sub ? sub.manualFeedback || "" : "",
    rubricVariant: sub ? sub.rubricVariant || null : null,
    criteria: sub && Array.isArray(sub.criteria) ? sub.criteria : [],
    annotations: sub && Array.isArray(sub.annotations) ? sub.annotations : [],
    transcript: sub ? sub.transcript || "" : "",
    speakingNotes: sub && Array.isArray(sub.speakingNotes) ? sub.speakingNotes : [],
    gradeSource: sub ? sub.gradeSource || "teacher" : "teacher",
    priorities: sub && Array.isArray(sub.priorities) ? sub.priorities : [],
    topicVocabulary: sub && Array.isArray(sub.topicVocabulary) ? sub.topicVocabulary : [],
    improvedSample: sub ? sub.improvedSample || "" : "",
    mainIssue: sub ? sub.mainIssue || "" : "",
  };
}

// ---------- Detail: full 4-skill breakdown for one student ----------
function buildStudentTestDetail({ test, submissions }) {
  return SKILL_KEYS.map((key) => {
    const label = SKILL_LABELS[key];
    const hasContent = skillHasContent(test, key);

    if (PROMPT_KEYS.includes(key)) {
      const prompts = ((test.skills[key] || {}).prompts || []);
      const map = groupLatest(
        submissions.filter((s) => s.kind === key),
        "promptId"
      );
      const currentIds = new Set(prompts.map((p) => S(p._id)));
      const list = prompts.map((p) => {
        const g = map.get(S(p._id));
        const sub = g ? g.latest : null;
        return {
          _id: p._id,
          title: p.title || "",
          instructions: p.instructions || "",
          kind: key, // "writing" | "speaking"
          writingTask: p.writingTask || "task2",
          attempts: g ? g.attempts : 0,
          ...promptSubView(sub),
        };
      });
      // Submissions whose promptId no longer matches any current prompt —
      // the test's Writing/Speaking prompts were edited/replaced after the
      // student submitted (new subdocument _ids). Still surface these so
      // real, possibly already-graded work doesn't silently disappear.
      map.forEach((g, id) => {
        if (currentIds.has(id)) return;
        list.push({
          _id: id,
          title: "",
          instructions: "",
          kind: key,
          writingTask: g.latest.rubricVariant === "writing.task1" ? "task1" : "task2",
          attempts: g.attempts,
          orphaned: true,
          ...promptSubView(g.latest),
        });
      });
      const submitted = list.filter((p) => p.submissionId).length;
      return { key, label, kind: "prompt", itemsTotal: list.length, submitted, prompts: list };
    }

    if (!hasContent) return { key, label, kind: "auto", submissionId: null, detail: null };

    const relevant = submissions
      .filter((s) => s.kind === "test" && s.testSkill === key)
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    const sub = relevant[0] || null;

    let detail = null;
    if (sub) {
      const raw = Array.isArray(sub.detail) && sub.detail.length ? sub.detail : rebuildDetail(test.skills[key], sub.answers || {});
      const fm = fieldFormatMap(test.skills[key]);
      detail = (raw || []).map((d) => ({
        id: d.id,
        label: d.label,
        correct: !!d.correct,
        partial: !!d.partial,
        submittedText: d.submitted != null && d.submitted !== "" ? d.submitted : (d.submittedText || "(blank)"),
        answerText: d.answer != null ? d.answer : d.answerText || "",
        explanation: d.explanation || "",
        formatLabel: fm[d.id] || d.formatLabel || "Khác",
      }));
    }

    return {
      key,
      label,
      kind: "auto",
      submissionId: sub ? sub._id : null,
      submittedAt: sub ? sub.submittedAt : null,
      score: sub ? sub.score : null,
      total: sub ? sub.total : null,
      replayCount: sub ? sub.replayCount || 0 : 0,
      attempts: relevant.length,
      detail,
      formatStats: detail ? aggregateByFormat(detail) : null,
    };
  });
}

module.exports = {
  SKILL_KEYS,
  SKILL_LABELS,
  PROMPT_KEYS,
  skillHasContent,
  buildTestOverview,
  buildStudentTestDetail,
};

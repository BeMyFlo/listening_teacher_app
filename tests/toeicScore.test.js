// Phase 8B bước 2: rubric + điểm + hiển thị TOEIC S&W. IELTS phải giữ đúng chữ/số cũ.
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getRubric,
  resolveVariant,
  overallBand,
  validateCriteria,
  isToeicVariant,
  scoreRange,
  taskScore,
  annotationCriteria,
} = require("../lib/grading/rubric");
const { TOEIC_TASKS, ASPECT_LABELS } = require("../lib/toeicTasks");
const { formatScore, scorePct, scoreMax, toeicTotals, toeicSkillSummary } = require("../lib/scoreLabel");
const { buildClassLeaderboard, pointsFor } = require("../lib/student/leaderboard");
const { buildTeacherDashboard } = require("../lib/teacher/dashboard");
const { buildTestOverview } = require("../lib/teacher/testSubmissions");
const { estimateToeicSW } = require("../lib/toeicScale");
const { CRITERIA, IELTS_CRITERIA, TOEIC_CRITERIA } = require("../lib/grading/annotate");

const KEYS = Object.keys(TOEIC_TASKS);

test("rubric TOEIC: 1 criterion 'score', mức 0..max có descriptor en/vi", () => {
  for (const k of KEYS) {
    const r = getRubric(k);
    const max = TOEIC_TASKS[k].maxScore;
    assert.equal(r.criteria.length, 1);
    assert.equal(r.criteria[0].key, "score");
    assert.deepEqual(Object.keys(r.criteria[0].bands), Array.from({ length: max + 1 }, (_, i) => String(i)));
    for (const lv of Object.values(r.criteria[0].bands)) assert.ok(lv.en && lv.vi);
    assert.ok(isToeicVariant(k));
    assert.deepEqual(scoreRange(k), { min: 0, max });
  }
});

test("IELTS không đổi: variant, khoảng, danh sách criterion", () => {
  assert.equal(isToeicVariant("writing.task1"), false);
  assert.equal(isToeicVariant("speaking"), false);
  assert.equal(isToeicVariant(undefined), false);
  assert.equal(isToeicVariant("constructor"), false);
  assert.deepEqual(scoreRange("speaking"), { min: 1, max: 9 });
  assert.deepEqual(getRubric("writing.task1").criteria.map((c) => c.key), ["TA", "CC", "LR", "GRA"]);
  assert.deepEqual(getRubric("writing.task2").criteria.map((c) => c.key), ["TR", "CC", "LR", "GRA"]);
  assert.deepEqual(getRubric("speaking").criteria.map((c) => c.key), ["FC", "LR", "GRA", "PR"]);
  assert.equal(getRubric("constructor"), null);
  assert.equal(resolveVariant("writing", "task1"), "writing.task1");
  assert.equal(overallBand([{ band: 6 }, { band: 7 }, { band: 6 }, { band: 6 }]), 6.5);
  assert.equal(taskScore("speaking", [{ key: "score", band: 2 }]), null);
});

test("validateCriteria TOEIC: nhận số nguyên trong khoảng, từ chối phần còn lại", () => {
  const ok = (v, band) => validateCriteria(v, [{ key: "score", band }]);
  assert.equal(ok("toeic.w.email", 0), null);
  assert.equal(ok("toeic.w.email", 4), null);
  assert.equal(ok("toeic.s.opinion", 5), null);
  assert.equal(ok("toeic.s.read", "3"), null);
  assert.ok(ok("toeic.s.read", 4));
  assert.ok(ok("toeic.s.read", -1));
  assert.ok(ok("toeic.s.read", 1.5));
  assert.ok(ok("toeic.s.read", null));
  assert.ok(ok("toeic.s.read", ""));
  assert.ok(ok("toeic.s.read", "x"));
  assert.ok(validateCriteria("toeic.s.read", []));
  assert.ok(validateCriteria("toeic.s.read", null));
  assert.ok(validateCriteria("toeic.s.read", [{ key: "score", band: 1 }, { key: "score", band: 1 }]));
  assert.ok(validateCriteria("toeic.s.read", [{ key: "TA", band: 1 }]));
  assert.ok(validateCriteria("toeic.s.read", [{ key: "score", band: 1 }, { key: "TA", band: 1 }]));
  assert.ok(validateCriteria("toeic.nope", [{ key: "score", band: 1 }]));
});

test("validateCriteria IELTS giữ nguyên luật 1–9, đủ 4 tiêu chí", () => {
  const full = (b) => ["TR", "CC", "LR", "GRA"].map((key) => ({ key, band: b }));
  assert.equal(validateCriteria("writing.task2", full(6)), null);
  assert.ok(validateCriteria("writing.task2", full(0)));
  assert.ok(validateCriteria("writing.task2", full(10)));
  assert.ok(validateCriteria("writing.task2", full(6).slice(0, 3)));
  assert.ok(validateCriteria("writing.task2", [{ key: "score", band: 1 }]));
});

test("taskScore: điểm của criterion score, null nếu thiếu / ngoài khoảng", () => {
  assert.equal(taskScore("toeic.w.email", [{ key: "score", band: 3 }]), 3);
  assert.equal(taskScore("toeic.w.email", [{ key: "score", band: 0 }]), 0);
  assert.equal(taskScore("toeic.w.email", [{ key: "score", band: null }]), null);
  assert.equal(taskScore("toeic.w.email", [{ key: "score", band: 9 }]), null);
  assert.equal(taskScore("toeic.w.email", []), null);
});

test("annotationCriteria + CRITERIA: IELTS giữ thứ tự, TOEIC nối sau", () => {
  assert.deepEqual(IELTS_CRITERIA, ["TR", "CC", "LR", "GRA", "TA", "FC", "PR"]);
  assert.deepEqual(CRITERIA.slice(0, 7), IELTS_CRITERIA);
  assert.deepEqual(TOEIC_CRITERIA, Object.keys(ASPECT_LABELS));
  assert.deepEqual(annotationCriteria("toeic.w.email"), TOEIC_TASKS["toeic.w.email"].aspects);
  for (const k of KEYS) for (const a of annotationCriteria(k)) assert.ok(CRITERIA.includes(a));
  assert.equal(annotationCriteria("speaking"), null);
});

const ielts = (s) => ({ rubricVariant: "writing.task2", manualScore: s });
const toeic = (v, s) => ({ rubricVariant: v, manualScore: s });

test("formatScore / scorePct: IELTS đúng chữ cũ", () => {
  assert.equal(formatScore(ielts(6.5)), "Band 6.5");
  assert.equal(formatScore({ kind: "speaking", manualScore: 7 }), "Band 7"); // bài cũ không có variant
  assert.equal(formatScore({ manualScore: null }, { missing: "?" }), "Band ?");
  assert.equal(formatScore({}, { missing: "?" }), "Band ?");
  assert.equal(formatScore({ manualScore: 5 }, { missing: "?" }), "Band 5");
  assert.equal(scorePct(ielts(4.5)), (4.5 / 9) * 100);
  assert.equal(scorePct({ manualScore: null }), null);
  assert.equal(scoreMax(ielts(5)), 9);
});

test("formatScore / scorePct: TOEIC", () => {
  assert.equal(formatScore(toeic("toeic.s.read", 2)), "Score 2/3");
  assert.equal(formatScore(toeic("toeic.s.opinion", 4)), "Score 4/5");
  assert.equal(formatScore(toeic("toeic.w.email", 0)), "Score 0/4");
  assert.equal(formatScore({ rubricVariant: "toeic.w.email", manualScore: null }, { missing: "?" }), "Score ?/4");
  assert.equal(scorePct(toeic("toeic.w.essay", 5)), 100);
  assert.equal(scorePct(toeic("toeic.s.read", 0)), 0);
  assert.equal(scorePct(toeic("toeic.w.email", 3)), 75);
});

test("toeicTotals + toeicSkillSummary: tổng điểm thô / max, 'x/y graded' khi chưa đủ", () => {
  assert.equal(toeicTotals([ielts(6)]), null);
  assert.deepEqual(toeicTotals([toeic("toeic.s.read", 2), toeic("toeic.s.opinion", 4)]), { scoreSum: 6, maxSum: 8 });

  const mk = (promptId, v, s, status = "graded", at = "2026-01-01") => ({
    kind: "speaking", testId: "T", testSkill: "speaking", promptId, rubricVariant: v,
    manualScore: s, gradingStatus: status, submittedAt: at,
  });
  const all = [mk("a", "toeic.s.read", 3), mk("b", "toeic.s.opinion", 4)];
  assert.deepEqual(
    { ...toeicSkillSummary(all, "T", "speaking", 2) },
    { graded: 2, total: 2, complete: true, scoreSum: 7, maxSum: 8, text: "7/8 points" }
  );
  const part = [mk("a", "toeic.s.read", 3), mk("b", "toeic.s.opinion", null, "submitted")];
  assert.equal(toeicSkillSummary(part, "T", "speaking", 2).text, "1/2 graded");
  // chưa nộp hết các đề -> vẫn "x/y graded"
  assert.equal(toeicSkillSummary([mk("a", "toeic.s.read", 3)], "T", "speaking", 3).text, "1/3 graded");
  // làm lại: bản mới nhất thắng
  const redo = [mk("a", "toeic.s.read", 1, "graded", "2026-01-01"), mk("a", "toeic.s.read", 3, "graded", "2026-02-01")];
  assert.equal(toeicSkillSummary(redo, "T", "speaking", 1).text, "3/3 points");
  // IELTS / test khác -> null
  assert.equal(toeicSkillSummary([mk("a", "speaking", 6)], "T", "speaking", 1), null);
  assert.equal(toeicSkillSummary(all, "OTHER", "speaking", 2), null);
});

test("leaderboard: IELTS cộng band như cũ, TOEIC cộng score/max*9", () => {
  const g = (extra) => ({ kind: "writing", gradingStatus: "graded", ...extra });
  assert.equal(pointsFor(g({ manualScore: 6.5, rubricVariant: "writing.task2" })), 6.5);
  assert.equal(pointsFor(g({ manualScore: 6.5 })), 6.5);
  assert.equal(pointsFor(g({ manualScore: 3, rubricVariant: "toeic.w.email" })), 6.75);
  assert.equal(pointsFor(g({ manualScore: 5, rubricVariant: "toeic.w.essay" })), 9);
  assert.equal(pointsFor({ kind: "writing", gradingStatus: "submitted", manualScore: 5, rubricVariant: "toeic.w.essay" }), 0);
  const lb = buildClassLeaderboard({
    students: [{ _id: "1", name: "A" }, { _id: "2", name: "B" }],
    submissions: [
      { studentId: "1", kind: "speaking", promptId: "p", gradingStatus: "graded", manualScore: 3, rubricVariant: "toeic.s.read", submittedAt: "2026-01-01" },
      { studentId: "2", kind: "speaking", promptId: "p", gradingStatus: "graded", manualScore: 1, rubricVariant: "toeic.s.read", submittedAt: "2026-01-01" },
    ],
    meId: "2",
  });
  assert.equal(lb.rows[0].name, "A");
  assert.equal(lb.rows[0].points, 9);
  assert.equal(lb.myPoints, 3);
});

test("teacher dashboard: luật điểm tụt — IELTS theo band, TOEIC theo %", () => {
  const run = (subs) =>
    buildTeacherDashboard({
      classes: [],
      units: [],
      now: new Date("2026-03-01"),
      students: [{ _id: "s1", name: "S", classId: "c" }],
      submissions: subs.map((s, i) => ({
        studentId: "s1", kind: "writing", gradingStatus: "graded", submittedAt: new Date(2026, 0, i + 1), ...s,
      })),
    });
  const reasons = (d) => JSON.stringify(d).match(/Score ↓ [^"]+/g) || [];
  const ie = run([{ manualScore: 7, rubricVariant: "writing.task2" }, { manualScore: 6.5, rubricVariant: "writing.task2" }]);
  assert.deepEqual(reasons(ie).slice(0, 1), ["Score ↓ 7 → 6.5"]);
  const ieOk = run([{ manualScore: 6, rubricVariant: "writing.task2" }, { manualScore: 6.5, rubricVariant: "writing.task2" }]);
  assert.deepEqual(reasons(ieOk), []);
  const te = run([{ manualScore: 3, rubricVariant: "toeic.w.email" }, { manualScore: 2, rubricVariant: "toeic.w.email" }]);
  assert.deepEqual(reasons(te).slice(0, 1), ["Score ↓ 3/4 → 2/4"]);
  const teUp = run([{ manualScore: 2, rubricVariant: "toeic.w.email" }, { manualScore: 3, rubricVariant: "toeic.w.email" }]);
  assert.deepEqual(reasons(teUp), []);
});

test("teacher test overview: avg IELTS như cũ, TOEIC tổng điểm thô / max", () => {
  const prompts = ["a", "b"].map((_id) => ({ _id }));
  const mk = (promptId, v, s, status = "graded") => ({
    studentId: "s1", kind: "speaking", promptId, rubricVariant: v, manualScore: s,
    gradingStatus: status, submittedAt: new Date("2026-01-01"),
  });
  const run = (subs) =>
    buildTestOverview({
      test: { skills: { speaking: { prompts } } },
      submissions: subs,
      students: [{ _id: "s1", name: "S" }],
      classById: {},
    })[0].skills.speaking;
  const done = run([mk("a", "toeic.s.read", 3), mk("b", "toeic.s.opinion", 4)]);
  assert.equal(done.toeic, true);
  assert.equal(done.scoreSum, 7);
  assert.equal(done.maxSum, 8);
  assert.equal(done.graded, done.itemsTotal);
  const part = run([mk("a", "toeic.s.read", 3), mk("b", "toeic.s.opinion", null, "submitted")]);
  assert.equal(part.toeic, true);
  assert.ok(part.graded < part.itemsTotal);
  // IELTS: không thêm field, avgScore như cũ
  const ie = run([mk("a", "speaking", 6), mk("b", "speaking", 7)]);
  assert.equal(ie.toeic, undefined);
  assert.equal(ie.scoreSum, undefined);
  assert.equal(ie.avgScore, 6.5);
});

test("estimateToeicSW: tắt (null) khi SCALE_SOURCE rỗng", () => {
  assert.equal(estimateToeicSW("speaking", 27, 35), null);
  assert.equal(estimateToeicSW("writing", 22, 28), null);
});

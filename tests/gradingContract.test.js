// Hợp đồng chấm điểm IELTS/TOEIC: KHÓA hành vi hiện tại trước khi thêm General (Phase 12 G5).
// File này KHÔNG được sửa sau commit đầu tiên — nếu nó đỏ nghĩa là G5 làm đổi bài IELTS/TOEIC.
const test = require("node:test");
const assert = require("node:assert/strict");

const rubric = require("../lib/grading/rubric");
const {
  resolveVariant, getRubric, criterionKeys, scoreRange, validateCriteria, overallBand,
  annotationCriteria, taskScore, isToeicVariant,
} = rubric;
const { formatScore, scoreMax, scorePct, toeicTotals, isToeicSub } = require("../lib/scoreLabel");
const { buildClassLeaderboard, pointsFor } = require("../lib/student/leaderboard");
const { skillBarValue } = require("../lib/student/skillBar");

const crit = (...bands) => bands.map((b, i) => ({ key: "k" + i, band: b }));

test("resolveVariant: IELTS (kể cả khi truyền program) giữ đúng như cũ", () => {
  const table = [
    [["speaking"], "speaking"],
    [["writing", "task1"], "writing.task1"],
    [["writing", "task2"], "writing.task2"],
    [["writing"], "writing.task2"],
    [["writing", undefined], "writing.task2"],
    [["writing", "weird"], "writing.task2"],
    [["exercise"], null],
    [["test"], null],
    [["speaking", undefined, "ielts"], "speaking"],
    [["writing", "task1", "ielts"], "writing.task1"],
    [["writing", "task2", "ielts"], "writing.task2"],
    [["writing", "task1", "toeic"], "writing.task1"],
    [["speaking", undefined, "toeic"], "speaking"],
    [["writing", "task1", undefined], "writing.task1"],
    [["writing", "task1", null], "writing.task1"],
  ];
  for (const [args, want] of table) assert.equal(resolveVariant(...args), want, JSON.stringify(args));
});

test("criterionKeys / scoreRange / annotationCriteria / isToeicVariant theo bảng mẫu", () => {
  assert.deepEqual(criterionKeys("writing.task1"), ["TA", "CC", "LR", "GRA"]);
  assert.deepEqual(criterionKeys("writing.task2"), ["TR", "CC", "LR", "GRA"]);
  assert.deepEqual(criterionKeys("speaking"), ["FC", "LR", "GRA", "PR"]);
  assert.deepEqual(criterionKeys("toeic.s.read"), ["score"]);
  assert.deepEqual(criterionKeys("toeic.w.email"), ["score"]);
  assert.deepEqual(criterionKeys("nope"), []);

  for (const v of ["writing.task1", "writing.task2", "speaking", "nope"]) {
    assert.deepEqual(scoreRange(v), { min: 1, max: 9 }, v);
    assert.equal(annotationCriteria(v), null, v);
    assert.equal(isToeicVariant(v), false, v);
  }
  assert.deepEqual(scoreRange("toeic.s.read"), { min: 0, max: 3 });
  assert.deepEqual(scoreRange("toeic.w.email"), { min: 0, max: 4 });
  assert.deepEqual(annotationCriteria("toeic.s.read"), ["PN", "IN", "FL"]);
  assert.deepEqual(annotationCriteria("toeic.w.email"), ["TK", "OR", "VO", "GR"]);
  assert.equal(isToeicVariant("toeic.s.read"), true);
  assert.equal(getRubric("nope"), null);
  assert.equal(getRubric("writing.task2").criteria.length, 4);
});

test("overallBand: trung bình, làm tròn nửa band, .25/.75 lên", () => {
  const table = [
    [[6, 6, 6, 6], 6],
    [[5, 5, 5, 6], 5.5], // 5.25 -> 5.5
    [[6, 6, 6, 7], 6.5], // 6.25 -> 6.5
    [[6, 7, 7, 7], 7], // 6.75 -> 7
    [[5, 6, 6, 6], 6], // 5.75 -> 6
    [[5, 5, 6, 6], 5.5],
    [[1, 1, 1, 1], 1],
    [[9, 9, 9, 9], 9],
    [[9, 8, 8, 8], 8.5], // 8.25 -> 8.5
    [[6, 6], 6],
    [[6, 7], 6.5],
    [[7], 7],
    [[null, 6, 6, 6], 6],
    [[0, 0, 0, 0], null],
    [[10, 10], null],
    [[], null],
  ];
  for (const [bands, want] of table) assert.equal(overallBand(crit(...bands)), want, JSON.stringify(bands));
  assert.equal(overallBand(null), null);
  assert.equal(overallBand(undefined), null);
});

test("validateCriteria IELTS: đủ 4, band nguyên 1-9", () => {
  const ok = (keys, bands) => keys.map((k, i) => ({ key: k, band: bands[i] }));
  assert.equal(validateCriteria("writing.task2", ok(["TR", "CC", "LR", "GRA"], [6, 6, 6, 6])), null);
  assert.equal(validateCriteria("speaking", ok(["FC", "LR", "GRA", "PR"], [1, 9, 5, 7])), null);
  assert.equal(validateCriteria("writing.task1", ok(["TA", "CC", "LR", "GRA"], [6, 6, 6, 6])), null);
  assert.equal(validateCriteria("nope", []), "Unknown grading rubric: nope");
  assert.equal(validateCriteria("writing.task2", []), "Please give a band for all 4 criteria.");
  assert.equal(validateCriteria("writing.task2", null), "Please give a band for all 4 criteria.");
  assert.equal(
    validateCriteria("writing.task2", ok(["TR", "CC", "LR"], [6, 6, 6])),
    "Please give a band for all 4 criteria."
  );
  assert.equal(validateCriteria("writing.task2", ok(["TA", "CC", "LR", "GRA"], [6, 6, 6, 6])), "Invalid criterion: TA");
  assert.equal(validateCriteria("writing.task2", ok(["TR", "TR", "LR", "GRA"], [6, 6, 6, 6])), "Duplicate criterion: TR");
  assert.equal(
    validateCriteria("writing.task2", ok(["TR", "CC", "LR", "GRA"], [6.5, 6, 6, 6])),
    "TR: band must be a whole number from 1 to 9."
  );
  assert.equal(
    validateCriteria("writing.task2", ok(["TR", "CC", "LR", "GRA"], [0, 6, 6, 6])),
    "TR: band must be a whole number from 1 to 9."
  );
  assert.equal(
    validateCriteria("writing.task2", ok(["TR", "CC", "LR", "GRA"], [10, 6, 6, 6])),
    "TR: band must be a whole number from 1 to 9."
  );
  assert.equal(
    validateCriteria("speaking", ok(["FC", "LR", "GRA", "PR"], [6, null, 6, 6])),
    "LR: band must be a whole number from 1 to 9."
  );
});

test("validateCriteria + taskScore TOEIC: 1 criterion 'score' nguyên 0..max", () => {
  const s = (band) => [{ key: "score", band }];
  assert.equal(validateCriteria("toeic.s.read", s(0)), null);
  assert.equal(validateCriteria("toeic.s.read", s(3)), null);
  assert.equal(validateCriteria("toeic.w.email", s(4)), null);
  assert.equal(validateCriteria("toeic.s.read", s(4)), "score: must be a whole number from 0 to 3.");
  assert.equal(validateCriteria("toeic.s.read", s(1.5)), "score: must be a whole number from 0 to 3.");
  assert.equal(validateCriteria("toeic.s.read", s(null)), "score: must be a whole number from 0 to 3.");
  assert.equal(validateCriteria("toeic.s.read", s("")), "score: must be a whole number from 0 to 3.");
  assert.equal(validateCriteria("toeic.s.read", []), "Please give a score.");
  assert.equal(validateCriteria("toeic.s.read", [{ key: "x", band: 1 }]), "Invalid criterion: x");

  assert.equal(taskScore("toeic.s.read", s(2)), 2);
  assert.equal(taskScore("toeic.s.read", s("3")), 3);
  assert.equal(taskScore("toeic.s.read", s(4)), null);
  assert.equal(taskScore("toeic.s.read", s(null)), null);
  assert.equal(taskScore("toeic.s.read", []), null);
  assert.equal(taskScore("toeic.w.email", s(4)), 4);
  assert.equal(taskScore("writing.task2", s(4)), null); // IELTS không có taskScore
});

test("formatScore / scoreMax / scorePct: IELTS 'Band x', TOEIC 'Score x/max'", () => {
  const ielts = { manualScore: 6.5, rubricVariant: "writing.task2" };
  const sp = { manualScore: 7, rubricVariant: "speaking" };
  const legacy = { manualScore: 5 }; // bài cũ chưa có rubricVariant
  const toeic = { manualScore: 2, rubricVariant: "toeic.s.read" };
  const toeicW = { manualScore: 3, rubricVariant: "toeic.w.email" };

  assert.equal(formatScore(ielts), "Band 6.5");
  assert.equal(formatScore(sp), "Band 7");
  assert.equal(formatScore(legacy), "Band 5");
  assert.equal(formatScore(toeic), "Score 2/3");
  assert.equal(formatScore(toeicW), "Score 3/4");
  assert.equal(formatScore({ rubricVariant: "speaking" }, { missing: "?" }), "Band ?");
  assert.equal(formatScore({ rubricVariant: "toeic.s.read", manualScore: null }, { missing: "?" }), "Score ?/3");
  assert.equal(formatScore({ rubricVariant: "speaking", manualScore: null }), "Band null");
  assert.equal(formatScore(null), "Band undefined");

  assert.equal(scoreMax(ielts), 9);
  assert.equal(scoreMax(legacy), 9);
  assert.equal(scoreMax(null), 9);
  assert.equal(scoreMax(toeic), 3);
  assert.equal(scoreMax(toeicW), 4);

  assert.equal(scorePct(ielts), (6.5 / 9) * 100);
  assert.equal(scorePct(legacy), (5 / 9) * 100);
  assert.equal(scorePct(toeic), (2 / 3) * 100);
  assert.equal(scorePct(toeicW), 75);
  assert.equal(scorePct({ rubricVariant: "speaking" }), null);
  assert.equal(scorePct({ rubricVariant: "speaking", manualScore: "abc" }), null);
  assert.equal(scorePct(null), null);

  assert.equal(isToeicSub(toeic), true);
  assert.equal(isToeicSub(ielts), false);
  assert.equal(isToeicSub(null), false);
});

test("toeicTotals: chỉ gộp bài TOEIC, IELTS -> null", () => {
  assert.equal(toeicTotals([{ manualScore: 6, rubricVariant: "speaking" }]), null);
  assert.equal(toeicTotals([]), null);
  assert.equal(toeicTotals(null), null);
  assert.deepEqual(
    toeicTotals([
      { manualScore: 2, rubricVariant: "toeic.s.read" },
      { manualScore: 3, rubricVariant: "toeic.w.email" },
      { manualScore: 6, rubricVariant: "speaking" },
    ]),
    { scoreSum: 5, maxSum: 7 }
  );
});

test("leaderboard: IELTS cộng thẳng manualScore, TOEIC quy /max*9", () => {
  assert.equal(pointsFor({ kind: "writing", gradingStatus: "graded", manualScore: 6.5, rubricVariant: "writing.task2" }), 6.5);
  assert.equal(pointsFor({ kind: "speaking", gradingStatus: "graded", manualScore: 7 }), 7);
  assert.equal(pointsFor({ kind: "writing", gradingStatus: "submitted", manualScore: 7 }), 0);
  assert.equal(pointsFor({ kind: "writing", gradingStatus: "graded", manualScore: null }), 0);
  assert.equal(pointsFor({ kind: "speaking", gradingStatus: "graded", manualScore: 2, rubricVariant: "toeic.s.read" }), 6);
  assert.equal(pointsFor({ kind: "writing", gradingStatus: "graded", manualScore: 3, rubricVariant: "toeic.w.email" }), 6.75);
  assert.equal(pointsFor({ kind: "exercise", score: 8 }), 8);
  assert.equal(pointsFor({ kind: "test", score: 21 }), 21);

  const students = [{ _id: "a", name: "A" }, { _id: "b", name: "B" }];
  const subs = [
    { studentId: "a", kind: "writing", promptId: "p1", gradingStatus: "graded", manualScore: 6.5, rubricVariant: "writing.task2", submittedAt: "2026-01-01" },
    { studentId: "a", kind: "exercise", exerciseId: "e1", score: 4, submittedAt: "2026-01-02" },
    { studentId: "b", kind: "speaking", promptId: "p2", gradingStatus: "graded", manualScore: 2, rubricVariant: "toeic.s.read", submittedAt: "2026-01-03" },
  ];
  const lb = buildClassLeaderboard({ students, submissions: subs, meId: "a" });
  assert.deepEqual(lb.rows.map((r) => [r.name, r.points, r.rank]), [["A", 10.5, 1], ["B", 6, 2]]);
  assert.equal(lb.myRank, 1);
  assert.equal(lb.myPoints, 10.5);
});

test("skillBarValue: IELTS 'Band x', còn lại %", () => {
  assert.equal(skillBarValue({ band: 6.5, pct: 72 }, "ielts"), "Band 6.5");
  assert.equal(skillBarValue({ band: null, pct: 72 }, "ielts"), "72%");
  assert.equal(skillBarValue({ band: 6.5, pct: 72 }, undefined), "Band 6.5"); // mặc định IELTS
  assert.equal(skillBarValue({ band: null, pct: 72 }, "toeic"), "72%");
  assert.equal(skillBarValue({ band: 6.5, pct: 72 }, "toeic"), "72%");
  assert.equal(skillBarValue({ band: null, pct: 80 }, "general"), "80%");
});

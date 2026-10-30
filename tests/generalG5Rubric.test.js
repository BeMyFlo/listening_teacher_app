// Phase 12 G5 bước 1 — rubric Writing/Speaking thang 10 của General và mọi chỗ đọc manualScore.
// Không DB, không mạng: route chấm tay chạy với model giả (stub require.cache, như tests/helpers).
// Hành vi IELTS/TOEIC nằm ở tests/gradingContract.test.js (không sửa file đó).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

function stub(rel, exports) {
  const file = require.resolve(path.join(__dirname, "..", rel));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}

// ---- Thay mọi phụ thuộc DB của route /api/admin/submissions bằng bản giả ----
const emitted = [];
const db = { sub: null, studentSubs: [] };
stub("lib/notifications/index.js", {
  emit: async (e) => emitted.push(e),
  fmtDateTime: () => "now",
});
stub("lib/db.js", { connectDB: async () => {} });
stub("lib/auth.js", { requireAuth: (h) => h });
stub("lib/tenant.js", {
  withTenant: (h) => h,
  tenantFilter: (ws, extra) => Object.assign({}, extra || {}, { workspaceId: ws.workspaceId }),
  assertOwned: async () => db.sub,
});
stub("lib/teacherScope.js", { teacherScope: async () => ({ all: true }) });
stub("lib/models/Submission.js", { find: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) });
stub("lib/models/Test.js", {});
stub("lib/models/Student.js", {});
stub("lib/grade.js", { rebuildDetail: () => null });

const route = require("../pages/api/admin/submissions.js");
const rubric = require("../lib/grading/rubric");
const {
  resolveVariant, validateCriteria, overallScore, overallBand, getRubric, scoreRange, annotationCriteria,
  criterionKeys, isGeneralVariant, isToeicVariant,
} = rubric;
const { formatScore, scoreMax, scorePct, hasOwnScale, toeicTotals } = require("../lib/scoreLabel");
const { CRITERIA } = require("../lib/grading/annotate");
const { PROGRAMS } = require("../lib/curriculum");
const { buildClassLeaderboard, pointsFor } = require("../lib/student/leaderboard");
const { skillBarValue } = require("../lib/student/skillBar");
const { notifyStudentGraded } = require("../lib/notifications/student");
const { buildTeacherDashboard } = require("../lib/teacher/dashboard");
const { buildTestOverview } = require("../lib/teacher/testSubmissions");

const W = ["CT", "OR", "VO", "GR"];
const S = ["CT", "FL", "PN", "LU"];
const gc = (keys, vals) => keys.map((key, i) => ({ key, band: vals[i], comment: "" }));

// ------------------------------------------------------------------ registry + rubric

test("registry: rubricVariants — IELTS/TOEIC null, General có writing + speaking; lessonSkills chưa mở", () => {
  assert.equal(PROGRAMS.ielts.rubricVariants, null);
  assert.equal(PROGRAMS.toeic.rubricVariants, null);
  assert.deepEqual(PROGRAMS.general.rubricVariants, { writing: "general.writing", speaking: "general.speaking" });
  // Bước 3 mới mở UI.
  assert.deepEqual(PROGRAMS.general.lessonSkills, ["grammar", "vocabulary", "listening", "reading"]);
  assert.deepEqual(PROGRAMS.general.testSkills, ["listening", "reading"]);
});

test("resolveVariant: General theo program; IELTS/TOEIC/thiếu program y như cũ", () => {
  assert.equal(resolveVariant("writing", "task1", "general"), "general.writing");
  assert.equal(resolveVariant("writing", "task2", "general"), "general.writing");
  assert.equal(resolveVariant("writing", undefined, "general"), "general.writing");
  assert.equal(resolveVariant("speaking", undefined, "general"), "general.speaking");
  assert.equal(resolveVariant("exercise", undefined, "general"), null);
  assert.equal(resolveVariant("test", undefined, "general"), null);
  assert.equal(resolveVariant("writing", "task1", "ielts"), "writing.task1");
  assert.equal(resolveVariant("speaking", undefined, "toeic"), "speaking");
  assert.equal(resolveVariant("writing", "task1"), "writing.task1");
  assert.equal(resolveVariant("writing", "task1", "constructor"), "writing.task1");
  assert.equal(resolveVariant("writing", "task1", "__proto__"), "writing.task1");
});

test("isGeneralVariant / scoreRange / criterionKeys / annotationCriteria của General", () => {
  assert.equal(isGeneralVariant("general.writing"), true);
  assert.equal(isGeneralVariant("general.speaking"), true);
  for (const v of ["writing.task1", "writing.task2", "speaking", "toeic.s.read", "nope", null, undefined, "general", "constructor"]) {
    assert.equal(isGeneralVariant(v), false, String(v));
  }
  assert.equal(isToeicVariant("general.writing"), false);
  assert.deepEqual(scoreRange("general.writing"), { min: 0, max: 2.5 });
  assert.deepEqual(scoreRange("general.speaking"), { min: 0, max: 2.5 });
  assert.deepEqual(criterionKeys("general.writing"), W);
  assert.deepEqual(criterionKeys("general.speaking"), S);
  for (const v of ["general.writing", "general.speaking"]) {
    const keys = annotationCriteria(v);
    assert.deepEqual(keys, criterionKeys(v));
    for (const k of keys) assert.ok(CRITERIA.includes(k), k + " phải lưu được trong annotation");
  }
});

test("descriptor General: đủ 6 mức 2.5/2/1.5/1/0.5/0 cho cả 8 tiêu chí, không nhắc IELTS/band", () => {
  for (const v of ["general.writing", "general.speaking"]) {
    const r = getRubric(v);
    assert.equal(r.criteria.length, 4);
    for (const c of r.criteria) {
      assert.deepEqual(Object.keys(c.bands).sort((a, b) => b - a), ["2.5", "2", "1.5", "1", "0.5", "0"]);
      for (const lvl of Object.values(c.bands)) {
        assert.ok(lvl.en && lvl.en.length > 15);
        assert.doesNotMatch(lvl.en, /IELTS|band/i);
      }
    }
  }
});

test("validateCriteria General: đủ 4, 0–2.5, bội 0.25", () => {
  assert.equal(validateCriteria("general.writing", gc(W, [2.5, 2, 1.75, 0])), null);
  assert.equal(validateCriteria("general.speaking", gc(S, [0, 0, 0, 0])), null);
  assert.equal(validateCriteria("general.writing", gc(W, [0.25, 0.5, 1.25, 2.25])), null);
  assert.match(validateCriteria("general.writing", gc(W, [2.75, 2, 2, 2])), /CT: score must be from 0 to 2\.5/);
  assert.match(validateCriteria("general.writing", gc(W, [2, 0.1, 2, 2])), /OR: score must be/);
  assert.match(validateCriteria("general.writing", gc(W, [2, 2, -0.25, 2])), /VO: score must be/);
  assert.match(validateCriteria("general.writing", gc(W, [2, 2, 2, null])), /GR: score must be/);
  assert.match(validateCriteria("general.writing", gc(W, [2, 2, 2, ""])), /GR: score must be/);
  assert.match(validateCriteria("general.writing", gc(W, [2, 2, 2, "abc"])), /GR: score must be/);
  assert.match(validateCriteria("general.writing", gc(W.slice(0, 3), [2, 2, 2])), /all 4 criteria/);
  assert.match(validateCriteria("general.writing", gc(S, [2, 2, 2, 2])), /Invalid criterion: FL/);
  assert.match(validateCriteria("general.writing", gc(["CT", "CT", "VO", "GR"], [2, 2, 2, 2])), /Duplicate criterion: CT/);
  assert.match(validateCriteria("general.writing", [{ key: "TR", band: 6 }, { key: "CC", band: 6 }, { key: "LR", band: 6 }, { key: "GRA", band: 6 }]), /Invalid criterion/);
  // Giá trị chuỗi số hợp lệ vẫn qua (form gửi chuỗi).
  assert.equal(validateCriteria("general.writing", gc(W, ["2.5", "2", "1.75", "0"])), null);
});

test("overallScore: General = tổng 4 tiêu chí; IELTS = overallBand; TOEIC = điểm câu", () => {
  assert.equal(overallScore("general.writing", gc(W, [2.5, 2.5, 2.5, 2.5])), 10);
  assert.equal(overallScore("general.writing", gc(W, [2, 1.5, 2.25, 1])), 6.75);
  assert.equal(overallScore("general.speaking", gc(S, [0, 0, 0, 0])), 0);
  assert.equal(overallScore("general.speaking", gc(S, ["1", "1", "1", "0.25"])), 3.25);
  // Thiếu hoặc sai bất kỳ tiêu chí nào -> null (không cộng dở).
  assert.equal(overallScore("general.writing", gc(W, [2, 2, 2, null])), null);
  assert.equal(overallScore("general.writing", gc(W.slice(0, 3), [2, 2, 2])), null);
  assert.equal(overallScore("general.writing", gc(W, [2, 2, 2, 2.75])), null);
  assert.equal(overallScore("general.writing", gc(W, [2, 2, 2, 0.1])), null);
  assert.equal(overallScore("general.writing", null), null);
  const ielts = [{ key: "TR", band: 6 }, { key: "CC", band: 6 }, { key: "LR", band: 6 }, { key: "GRA", band: 7 }];
  assert.equal(overallScore("writing.task2", ielts), overallBand(ielts));
  assert.equal(overallScore("writing.task2", ielts), 6.5);
  assert.equal(overallScore("toeic.s.read", [{ key: "score", band: 2 }]), 2);
});

// ------------------------------------------------------------------ nhãn điểm

test("scoreLabel: General '8.5 / 10', max 10, % đúng; IELTS/TOEIC không đổi", () => {
  const g = { manualScore: 8.5, rubricVariant: "general.writing" };
  assert.equal(formatScore(g), "8.5 / 10");
  assert.equal(formatScore({ manualScore: 7, rubricVariant: "general.speaking" }), "7 / 10");
  assert.equal(formatScore({ manualScore: null, rubricVariant: "general.speaking" }, { missing: "?" }), "? / 10");
  assert.doesNotMatch(formatScore(g), /Band/);
  assert.equal(scoreMax(g), 10);
  assert.equal(scorePct(g), 85);
  assert.equal(scorePct({ manualScore: 10, rubricVariant: "general.writing" }), 100);
  assert.equal(hasOwnScale(g), true);
  assert.equal(hasOwnScale({ manualScore: 6, rubricVariant: "speaking" }), false);
  assert.equal(hasOwnScale({ manualScore: 2, rubricVariant: "toeic.s.read" }), true);
  // Cùng điểm 8.5 nhưng IELTS vẫn là Band.
  assert.equal(formatScore({ manualScore: 8.5, rubricVariant: "writing.task2" }), "Band 8.5");
  assert.equal(scoreMax({ manualScore: 8.5, rubricVariant: "writing.task2" }), 9);
  // toeicTotals không gộp bài General.
  assert.equal(toeicTotals([g]), null);
});

test("skillBarValue: General chỉ hiện %", () => {
  assert.equal(skillBarValue({ band: null, pct: 85 }, "general"), "85%");
});

test("notification: bài General báo '8.5 / 10', không có 'Band'", async () => {
  emitted.length = 0;
  await notifyStudentGraded({
    submission: { _id: "s1", studentId: "st1", kind: "writing", manualScore: 8.5, rubricVariant: "general.writing", unitId: "u1", promptId: "p1" },
    teacherName: "Ms Lan",
  });
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].title, "Your Writing was graded — 8.5 / 10");
  assert.doesNotMatch(emitted[0].body, /Band/);
  emitted.length = 0;
  await notifyStudentGraded({
    submission: { _id: "s2", studentId: "st1", kind: "speaking", manualScore: 6.5, rubricVariant: "speaking", unitId: "u1", promptId: "p1" },
  });
  assert.equal(emitted[0].title, "Your Speaking was graded — Band 6.5");
});

// ------------------------------------------------------------------ bảng xếp hạng

test("leaderboard trộn IELTS + General + TOEIC: /10 quy về cùng cỡ band (x9/10)", () => {
  assert.equal(pointsFor({ kind: "writing", gradingStatus: "graded", manualScore: 10, rubricVariant: "general.writing" }), 9);
  assert.equal(pointsFor({ kind: "speaking", gradingStatus: "graded", manualScore: 8, rubricVariant: "general.speaking" }), 7.2);
  assert.equal(pointsFor({ kind: "writing", gradingStatus: "graded", manualScore: 6.75, rubricVariant: "general.writing" }), 6.08); // 6.075 -> 2 số lẻ
  assert.equal(pointsFor({ kind: "writing", gradingStatus: "graded", manualScore: 8, rubricVariant: "writing.task2" }), 8);
  assert.equal(pointsFor({ kind: "writing", gradingStatus: "draft", manualScore: 8, rubricVariant: "general.writing" }), 0);

  const students = [{ _id: "i", name: "Ielts" }, { _id: "g", name: "General" }, { _id: "t", name: "Toeic" }];
  const subs = [
    { studentId: "i", kind: "writing", promptId: "p1", gradingStatus: "graded", manualScore: 7, rubricVariant: "writing.task2", submittedAt: "2026-01-01" },
    { studentId: "g", kind: "writing", promptId: "p2", gradingStatus: "graded", manualScore: 8, rubricVariant: "general.writing", submittedAt: "2026-01-01" },
    { studentId: "t", kind: "speaking", promptId: "p3", gradingStatus: "graded", manualScore: 3, rubricVariant: "toeic.s.read", submittedAt: "2026-01-01" },
  ];
  const lb = buildClassLeaderboard({ students, submissions: subs, meId: "g" });
  // Toeic 3/3 -> 9, General 8/10 -> 7.2, Ielts 7 -> 7. (Không phải 8 > 7 nếu cộng thẳng.)
  assert.deepEqual(lb.rows.map((r) => [r.name, r.points]), [["Toeic", 9], ["General", 7.2], ["Ielts", 7]]);
  assert.equal(lb.myRank, 2);
});

// ------------------------------------------------------------------ dashboard giáo viên

test("dashboard giáo viên: tụt điểm General so theo %, hiện '/10'; IELTS vẫn hiện số band", () => {
  const classes = [{ _id: "c1", name: "10A" }];
  const students = [
    { _id: "sg", classId: "c1", name: "Gen" },
    { _id: "sg2", classId: "c1", name: "Gen small" },
    { _id: "si", classId: "c1", name: "Iel" },
  ];
  const mk = (studentId, manualScore, rubricVariant, day) => ({
    studentId, kind: "writing", gradingStatus: "graded", manualScore, rubricVariant,
    promptId: "p" + studentId + day, submittedAt: new Date(`2026-10-0${day}T00:00:00Z`),
  });
  const submissions = [
    mk("sg", 8, "general.writing", 1), mk("sg", 7, "general.writing", 2), // -10% -> tụt
    mk("sg2", 8, "general.writing", 1), mk("sg2", 7.75, "general.writing", 2), // -2.5% -> không
    mk("si", 7, "writing.task2", 1), mk("si", 6.5, "writing.task2", 2), // -0.5 band -> tụt
  ];
  const d = buildTeacherDashboard({ classes, students, units: [], submissions, now: new Date("2026-10-05T00:00:00Z") });
  const label = (name) => {
    const w = d.watch.find((x) => x.name === name);
    return w ? w.reasons.find((r) => r.case === "declining") : null;
  };
  assert.equal(label("Gen").label, "Score ↓ 8/10 → 7/10");
  assert.equal(label("Gen small"), null);
  assert.equal(label("Iel").label, "Score ↓ 7 → 6.5");
});

test("tổng hợp bài nộp của Mock Test: General có scale:10, IELTS không thêm field", () => {
  const test_ = { skills: { writing: { prompts: [{ _id: "p1" }] } } };
  const stu = [{ _id: "s1", name: "A" }];
  const mk = (rubricVariant, manualScore) => [{
    studentId: "s1", kind: "writing", promptId: "p1", gradingStatus: "graded", manualScore, rubricVariant, submittedAt: new Date(),
  }];
  const g = buildTestOverview({ test: test_, submissions: mk("general.writing", 8.25), students: stu, classById: {} });
  assert.equal(g[0].skills.writing.avgScore, 8.3);
  assert.equal(g[0].skills.writing.scale, 10);
  const i = buildTestOverview({ test: test_, submissions: mk("writing.task2", 6.5), students: stu, classById: {} });
  assert.equal(i[0].skills.writing.avgScore, 6.5);
  assert.equal("scale" in i[0].skills.writing, false);
  assert.equal("toeic" in i[0].skills.writing, false);
});

// ------------------------------------------------------------------ route chấm tay (model giả)

function makeSub(over) {
  const s = {
    _id: "sub1", studentId: "st1", workspaceId: "w1", kind: "writing", program: "general",
    rubricVariant: "general.writing", gradingStatus: "submitted", essayText: "I like my school.",
    saves: 0,
    async save() { this.saves += 1; },
    ...over,
  };
  return s;
}

async function put(body, sub) {
  db.sub = sub;
  const res = {
    code: 200, body: null, headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
  };
  const req = { method: "PUT", query: { id: "sub1" }, body, ws: { workspaceId: "w1" }, auth: { teacherId: "t1", name: "Ms Lan" } };
  await route(req, res);
  return res;
}

test("route: bài General chấm 4 tiêu chí -> manualScore = tổng, graded, báo chuông '/10'", async () => {
  emitted.length = 0;
  const sub = makeSub();
  const res = await put({ criteria: gc(W, [2, 1.5, 2.25, 1]), manualFeedback: "Good job" }, sub);
  assert.equal(res.code, 200);
  assert.equal(sub.manualScore, 6.75);
  assert.equal(sub.gradingStatus, "graded");
  assert.equal(sub.rubricVariant, "general.writing");
  assert.deepEqual(sub.criteria.map((c) => c.key), W);
  assert.equal(formatScore(sub), "6.75 / 10");
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].title, "Your Writing was graded — 6.75 / 10");
});

test("route: General — client gửi lại đúng tổng thì qua; override khác tổng bị chặn", async () => {
  let sub = makeSub();
  let res = await put({ criteria: gc(W, [2, 2, 2, 2]), manualScore: 8 }, sub);
  assert.equal(res.code, 200);
  assert.equal(sub.manualScore, 8);

  sub = makeSub();
  res = await put({ criteria: gc(W, [2, 2, 2, 2]), manualScore: 9 }, sub);
  assert.equal(res.code, 400);
  assert.match(res.body.error, /sum of the criteria/);
  assert.equal(sub.saves, 0);
  assert.equal(sub.manualScore, undefined);

  sub = makeSub();
  res = await put({ criteria: gc(W, [2, 2, 2, 2]), manualScore: 7.5 }, sub);
  assert.equal(res.code, 400);
});

test("route: General — điểm ngoài 0–10 và tiêu chí sai thang bị chặn, không lưu", async () => {
  for (const manualScore of [11, -1, 10.5, "abc"]) {
    const sub = makeSub();
    const res = await put({ criteria: gc(W, [2.5, 2.5, 2.5, 2.5]), manualScore }, sub);
    assert.equal(res.code, 400, String(manualScore));
    assert.equal(sub.saves, 0);
  }
  for (const bands of [[2.75, 2, 2, 2], [2, 0.1, 2, 2], [2, 2, -1, 2], [3, 3, 3, 3], [9, 9, 9, 9]]) {
    const sub = makeSub();
    const res = await put({ criteria: gc(W, bands) }, sub);
    assert.equal(res.code, 400, JSON.stringify(bands));
    assert.equal(sub.saves, 0);
  }
  // Thiếu tiêu chí khi xuất bản.
  const sub = makeSub();
  const res = await put({ criteria: gc(W.slice(0, 3), [2, 2, 2]) }, sub);
  assert.equal(res.code, 400);
  assert.equal(sub.saves, 0);
});

test("route: General — bản nháp cho thiếu tiêu chí (manualScore null) nhưng không cho giá trị sai", async () => {
  let sub = makeSub();
  let res = await put({ criteria: gc(W, [2, 2, null, null]), publish: false }, sub);
  assert.equal(res.code, 200);
  assert.equal(sub.gradingStatus, "draft");
  assert.equal(sub.manualScore, null);

  sub = makeSub();
  res = await put({ criteria: gc(W, [2, 2, 2.75, null]), publish: false }, sub);
  assert.equal(res.code, 400);
  assert.equal(sub.saves, 0);

  sub = makeSub();
  res = await put({ criteria: [{ key: "TR", band: 6 }], publish: false }, sub);
  assert.equal(res.code, 400);
});

test("route: General — variant bị khoá theo bài nộp; không đẩy rubric IELTS vào hay ngược lại", async () => {
  // Client gửi rubric IELTS cho bài General: bị bỏ qua, vẫn chấm theo general.writing.
  let sub = makeSub();
  let res = await put({ rubricVariant: "writing.task2", criteria: gc(W, [1, 1, 1, 1]) }, sub);
  assert.equal(res.code, 200);
  assert.equal(sub.rubricVariant, "general.writing");
  assert.equal(sub.manualScore, 4);

  // ... và tiêu chí IELTS gửi lên bài General bị từ chối.
  sub = makeSub();
  res = await put({ rubricVariant: "writing.task2", criteria: [{ key: "TR", band: 6 }, { key: "CC", band: 6 }, { key: "LR", band: 6 }, { key: "GRA", band: 6 }] }, sub);
  assert.equal(res.code, 400);
  assert.equal(sub.manualScore, undefined);

  // Bài General speaking không đổi sang writing.
  sub = makeSub({ kind: "speaking", rubricVariant: "general.speaking", audioUrl: "x" });
  res = await put({ rubricVariant: "general.writing", criteria: gc(S, [2, 2, 2, 2]) }, sub);
  assert.equal(res.code, 200);
  assert.equal(sub.rubricVariant, "general.speaking");
  assert.equal(sub.manualScore, 8);

  // Bài IELTS không nhận rubric General.
  sub = makeSub({ program: "ielts", rubricVariant: "writing.task2" });
  res = await put({ rubricVariant: "general.writing", criteria: gc(W, [2, 2, 2, 2]) }, sub);
  assert.equal(res.code, 400);
  assert.equal(sub.rubricVariant, "writing.task2");
  assert.equal(sub.saves, 0);
});

test("route: General — không có đường nhập 1 số tổng (chấm nhanh) ", async () => {
  let sub = makeSub();
  let res = await put({ manualScore: 8 }, sub);
  assert.equal(res.code, 400);
  assert.match(res.body.error, /criteria/);
  assert.equal(sub.saves, 0);

  sub = makeSub();
  res = await put({ manualScore: 12 }, sub);
  assert.equal(res.code, 400);
  assert.match(res.body.error, /0 to 10/);
});

test("route: bài General cũ thiếu rubricVariant lấy rubric theo program của bài nộp", async () => {
  const sub = makeSub({ rubricVariant: undefined });
  const res = await put({ criteria: gc(W, [1, 1, 1, 1]) }, sub);
  assert.equal(res.code, 200);
  assert.equal(sub.rubricVariant, "general.writing");
  assert.equal(sub.manualScore, 4);
});

test("route: bài IELTS qua cùng route — không đổi (trung bình band, override 0–9, quick score)", async () => {
  const ielts = (over) => makeSub({ program: "ielts", rubricVariant: "writing.task2", ...over });
  const crit = (b) => ["TR", "CC", "LR", "GRA"].map((key, i) => ({ key, band: b[i], comment: "" }));

  let sub = ielts();
  let res = await put({ criteria: crit([6, 6, 6, 7]) }, sub);
  assert.equal(res.code, 200);
  assert.equal(sub.manualScore, 6.5);
  assert.equal(sub.rubricVariant, "writing.task2");
  assert.equal(formatScore(sub), "Band 6.5");

  // override hợp lệ (0–9, bước 0.5) vẫn ăn; ngoài thang -> rơi về trung bình như cũ (không 400).
  sub = ielts();
  res = await put({ criteria: crit([6, 6, 6, 7]), manualScore: 7 }, sub);
  assert.equal(res.code, 200);
  assert.equal(sub.manualScore, 7);
  sub = ielts();
  res = await put({ criteria: crit([6, 6, 6, 7]), manualScore: 9.5 }, sub);
  assert.equal(res.code, 200);
  assert.equal(sub.manualScore, 6.5);

  // band 0 / thập phân vẫn bị từ chối như cũ.
  sub = ielts();
  res = await put({ criteria: crit([6.5, 6, 6, 6]) }, sub);
  assert.equal(res.code, 400);
  assert.equal(res.body.error, "TR: band must be a whole number from 1 to 9.");

  // Chấm nhanh 1 số tổng (luồng cũ) vẫn chạy.
  sub = ielts();
  res = await put({ manualScore: 6 }, sub);
  assert.equal(res.code, 200);
  assert.equal(sub.manualScore, 6);

  // Bài IELTS speaking cũ không có rubricVariant -> "speaking".
  sub = makeSub({ kind: "speaking", program: undefined, rubricVariant: undefined });
  res = await put({ criteria: ["FC", "LR", "GRA", "PR"].map((key) => ({ key, band: 7 })) }, sub);
  assert.equal(res.code, 200);
  assert.equal(sub.rubricVariant, "speaking");
  assert.equal(sub.manualScore, 7);
});

test("route: bài TOEIC qua cùng route — không đổi (số nguyên 0..max, khoá dạng đề)", async () => {
  let sub = makeSub({ program: "toeic", kind: "speaking", rubricVariant: "toeic.s.read" });
  let res = await put({ criteria: [{ key: "score", band: 3 }], manualScore: 1 }, sub);
  assert.equal(res.code, 200);
  assert.equal(sub.manualScore, 3);
  assert.equal(formatScore(sub), "Score 3/3");

  sub = makeSub({ program: "toeic", kind: "speaking", rubricVariant: "toeic.s.read" });
  res = await put({ criteria: [{ key: "score", band: 4 }] }, sub);
  assert.equal(res.code, 400);

  sub = makeSub({ program: "toeic", kind: "speaking", rubricVariant: "toeic.s.read" });
  res = await put({ rubricVariant: "general.speaking", criteria: [{ key: "score", band: 2 }] }, sub);
  assert.equal(res.code, 200);
  assert.equal(sub.rubricVariant, "toeic.s.read");
  assert.equal(sub.manualScore, 2);
});

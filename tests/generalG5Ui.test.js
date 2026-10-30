// Phase 12 G5 bước 3 — mở Writing/Speaking cho General + các hàm thuần của UI chấm/xem điểm thang 10.
const test = require("node:test");
const assert = require("node:assert/strict");
const { PROGRAMS, lessonSkillAllowed, testSkillAllowed } = require("../lib/curriculum");
const { getRubric, criterionKeys, resolveVariant, overallScore, validateCriteria } = require("../lib/grading/rubric");
const { formatScore, scorePct } = require("../lib/scoreLabel");
const { isToeicTaskType } = require("../lib/toeicTasks");
const {
  GENERAL_ANCHORS,
  criterionLabel,
  generalScoreError,
  descriptorLevel,
  generalTotal,
  generalHeader,
  avgScoreText,
} = require("../lib/grading/generalUi");

const GW = "general.writing";
const GS = "general.speaking";

test("registry: General mở Writing + Speaking (Unit và Mock Test), thời lượng mặc định; IELTS/TOEIC không đổi", () => {
  const g = PROGRAMS.general;
  assert.deepEqual(g.lessonSkills, ["grammar", "vocabulary", "listening", "reading", "writing", "speaking"]);
  assert.deepEqual(g.testSkills, ["listening", "reading", "writing", "speaking"]);
  assert.deepEqual(g.defaultDurations, { listening: 15, reading: 45, writing: 30, speaking: 10 });
  assert.deepEqual(g.rubricVariants, { writing: GW, speaking: GS });
  for (const k of ["writing", "speaking"]) {
    assert.equal(lessonSkillAllowed({ program: "general" }, k), true, k);
    assert.equal(testSkillAllowed({ program: "general" }, k), true, k);
  }
  assert.equal(PROGRAMS.ielts.rubricVariants, null);
  assert.equal(PROGRAMS.toeic.rubricVariants, null);
  assert.deepEqual(PROGRAMS.ielts.defaultDurations, { listening: 30, reading: 60, writing: 60, speaking: 14 });
});

test("Mock Test General có Speaking nhưng không phải dạng đề TOEIC (không vào luồng toeicSpeaking)", () => {
  assert.equal(resolveVariant("speaking", undefined, "general"), GS);
  assert.equal(isToeicTaskType(GS), false);
  assert.equal(isToeicTaskType(undefined), false); // prompt General không có taskType
});

test("criterionLabel: General lấy tên từ rubric; IELTS/TOEIC giữ như cũ", () => {
  assert.deepEqual(criterionKeys(GW).map((k) => criterionLabel(GW, k)), ["Content", "Organisation", "Vocabulary", "Grammar & mechanics"]);
  assert.deepEqual(criterionKeys(GS).map((k) => criterionLabel(GS, k)), ["Content", "Fluency", "Pronunciation", "Language use"]);
  // Cùng key, khác rubric: CT/GR/VO/OR/FL/PN/LU đều có nhãn.
  for (const k of ["CT", "OR", "VO", "GR", "FL", "PN", "LU"]) {
    assert.ok(criterionLabel(GW, k) && criterionLabel(GS, k), k);
  }
  // IELTS: key giữ nguyên; TOEIC: nhãn khía cạnh cũ.
  assert.equal(criterionLabel("speaking", "GRA"), "GRA");
  assert.equal(criterionLabel("writing.task2", "TR"), "TR");
  assert.equal(criterionLabel("toeic.w.email", "TK"), "Task / relevance");
  assert.equal(criterionLabel(undefined, "OR"), "Organization");
});

test("generalScoreError: trống hoặc hợp lệ -> không lỗi; ngoài 0–2.5 / sai bước -> lỗi", () => {
  for (const ok of ["", null, undefined, "0", 0, "2.5", 2.5, "1.75", 0.25, "2"]) assert.equal(generalScoreError(ok), "", String(ok));
  for (const bad of ["2.75", 2.75, "0.1", "-0.25", "3", "abc", "1.3"]) assert.match(generalScoreError(bad), /0 to 2\.5/, String(bad));
});

test("descriptorLevel: điểm giữa các mốc lấy mốc thấp hơn; không hợp lệ -> null", () => {
  assert.deepEqual(GENERAL_ANCHORS, [2.5, 2, 1.5, 1, 0.5, 0]);
  assert.equal(descriptorLevel("2.5"), 2.5);
  assert.equal(descriptorLevel(1.75), 1.5);
  assert.equal(descriptorLevel("0.25"), 0);
  assert.equal(descriptorLevel(0), 0);
  for (const bad of ["", null, undefined, 2.75, "x"]) assert.equal(descriptorLevel(bad), null, String(bad));
  // Mọi mốc đều có descriptor trong rubric.
  for (const v of [GW, GS]) for (const c of getRubric(v).criteria) for (const a of GENERAL_ANCHORS) assert.ok(c.bands[String(a)].en, `${v} ${c.key} ${a}`);
});

test("generalTotal: tổng 4 tiêu chí; thiếu/sai -> null (không có trung bình, không làm tròn band)", () => {
  assert.equal(generalTotal(GW, { CT: "2", OR: "1.5", VO: "2.25", GR: "1" }), 6.75);
  assert.equal(generalTotal(GW, { CT: "2.5", OR: "2.5", VO: "2.5", GR: "2.5" }), 10);
  assert.equal(generalTotal(GW, { CT: "0", OR: "0", VO: "0", GR: "0" }), 0);
  assert.equal(generalTotal(GW, { CT: "2", OR: "", VO: "2", GR: "2" }), null);
  assert.equal(generalTotal(GW, { CT: "2", OR: "2.75", VO: "2", GR: "2" }), null);
  assert.equal(generalTotal(GS, { CT: "1", FL: "1", PN: "1" }), null);
  // Khớp overallScore (nguồn sự thật phía server).
  const bands = { CT: "1.25", FL: "2", PN: "1.5", LU: "2.5" };
  const arr = Object.keys(bands).map((key) => ({ key, band: Number(bands[key]) }));
  assert.equal(generalTotal(GS, bands), overallScore(GS, arr));
  assert.equal(validateCriteria(GS, arr), null);
});

test("generalHeader / avgScoreText: General hiện \"x / 10\"; IELTS/TOEIC trả null / số cũ", () => {
  assert.deepEqual(generalHeader(GW, 8.5), { title: "Score", value: "8.5 / 10" });
  assert.deepEqual(generalHeader(GS, 0), { title: "Score", value: "0 / 10" });
  assert.deepEqual(generalHeader(GS, null), { title: "Score", value: "—" });
  assert.equal(generalHeader("speaking", 6.5), null);
  assert.equal(generalHeader("writing.task2", 6.5), null);
  assert.equal(generalHeader("toeic.w.email", 2), null);
  assert.equal(avgScoreText({ avgScore: 7.5, scale: 10 }), "7.5 / 10");
  assert.equal(avgScoreText({ avgScore: 6.5 }), 6.5); // IELTS: số band trần như cũ
  assert.equal(avgScoreText({ avgScore: null }), "✓");
  assert.equal(avgScoreText(null), "✓");
});

test("view data của bài General đã chấm không có chữ Band / IELTS / Task 1-2", () => {
  const subs = [
    { rubricVariant: GW, manualScore: 8.5 },
    { rubricVariant: GS, manualScore: 0 },
    { rubricVariant: GS, manualScore: 7.25 },
  ];
  for (const s of subs) {
    const texts = [formatScore(s), generalHeader(s.rubricVariant, s.manualScore).title, generalHeader(s.rubricVariant, s.manualScore).value];
    const rubric = getRubric(s.rubricVariant);
    texts.push(rubric.label);
    for (const c of rubric.criteria) {
      texts.push(criterionLabel(s.rubricVariant, c.key));
      for (const a of GENERAL_ANCHORS) texts.push(c.bands[String(a)].en);
    }
    for (const t of texts) assert.ok(!/band|ielts|toeic|task [12]/i.test(t), `chữ cấm trong: ${t}`);
    assert.match(formatScore(s), /^\d+(\.\d+)? \/ 10$/);
  }
  assert.equal(scorePct(subs[0]), 85);
  assert.equal(avgScoreText({ avgScore: 7.5, scale: 10 }).includes("Band"), false);
  // Bài IELTS vẫn hiện Band như cũ.
  assert.equal(formatScore({ rubricVariant: "writing.task2", manualScore: 6.5 }), "Band 6.5");
});

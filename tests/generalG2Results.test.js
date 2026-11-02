// Phase 12 G2 bước 4 — kết quả theo phần: dữ liệu `parts` cho giáo viên, cờ registry.
const test = require("node:test");
const assert = require("node:assert/strict");

const { PROGRAMS } = require("../lib/curriculum");
const { gradeSubmission } = require("../lib/grade");
const { partBreakdown } = require("../lib/partGroups");
const { buildStudentTestDetail } = require("../lib/teacher/testSubmissions");

function skillBlock() {
  return {
    sections: [
      {
        name: "Part 1 — Phonetics",
        fields: [
          { id: 1, type: "choice", label: "Q1", options: ["a", "b"], answers: ["a"], score: 1 },
          { id: 2, type: "choice", label: "Q2", options: ["a", "b"], answers: ["b"], score: 1 },
        ],
      },
      {
        name: "Part 2 — Grammar",
        fields: [{ id: 3, type: "fill", label: "Q3", answers: ["go"], score: 2 }],
      },
      { name: "Empty", fields: [] },
    ],
  };
}

test("registry: IELTS/TOEIC không bật sectionRanges/partResults, General bật", () => {
  for (const k of ["ielts", "toeic"]) {
    assert.equal(PROGRAMS[k].sectionRanges, false);
    assert.equal(PROGRAMS[k].partResults, false);
  }
  assert.equal(PROGRAMS.general.sectionRanges, true);
  assert.equal(PROGRAMS.general.partResults, true);
});

test("partBreakdown ăn thẳng kết quả gradeSubmission", () => {
  const block = skillBlock();
  const { detail } = gradeSubmission(block, { 1: "a", 2: "a", 3: "go" });
  const byId = Object.fromEntries(detail.map((d) => [d.id, d]));
  const parts = partBreakdown(block.sections, byId);
  assert.equal(parts.length, 2); // phần rỗng bị bỏ
  assert.equal(parts[0].correct, 1);
  assert.equal(parts[0].total, 2);
  assert.equal(parts[0].range, "Questions 1–2");
  assert.equal(parts[1].score, 2);
  assert.equal(parts[1].maxScore, 2);
});

function detailFor(program) {
  const block = skillBlock();
  const { score, total, detail } = gradeSubmission(block, { 1: "a", 2: "a", 3: "go" });
  const t = { program, skills: { listening: block, reading: { sections: [] } } };
  const sub = { _id: "s1", kind: "test", testSkill: "listening", score, total, detail, answers: {}, submittedAt: new Date() };
  return buildStudentTestDetail({ test: t, submissions: [sub] }).find((s) => s.key === "listening");
}

test("buildStudentTestDetail: parts chỉ có với General", () => {
  const g = detailFor("general");
  assert.equal(g.parts.length, 2);
  assert.equal(g.parts[0].name, "Part 1 — Phonetics");
  assert.equal("parts" in detailFor("ielts"), false);
  assert.equal("parts" in detailFor("toeic"), false);
});

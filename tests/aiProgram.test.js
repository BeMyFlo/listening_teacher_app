// Phase 8 bước 5.6 — prompt AI theo chương trình. Bất biến 0.2: nhánh IELTS
// phải giữ NGUYÊN TỪNG CHỮ. IELTS_PROMPTS_SHA256 là hash của toàn bộ SYSTEM +
// prompt IELTS (ma trận trình độ x ngôn ngữ x phần) chụp từ code TRƯỚC khi
// thêm tham số `program`; đổi bất kỳ chữ nào của prompt IELTS là test này đỏ.
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const common = require("../lib/ai/common");
const grammar = require("../lib/ai/grammarLesson");
const vocab = require("../lib/ai/vocabLesson");
const review = require("../lib/ai/vocabReview");

const IELTS_PROMPTS_SHA256 = "d3bcf9e567029de34bc893ce60142ef519433312a10feadcd554b81cc3b68a1c";

const LEVELS = ["", "3.0", "4.5", "5.5", "6.5", "7.5", "B2", "Band 5.5", "IELTS band 6"];
const LANGS = ["vi", "bilingual", "en"];

const SOURCE_EXERCISES = [
  {
    sections: [
      {
        passageText: "Governments must mitigate the effects of climate change.\n\nRenewable energy is a key part of the solution.",
        transcript: "Welcome to the campus tour. The library opens at nine.",
        fields: [{ type: "fill", label: "What must governments do?", pre: "They must", post: "emissions", options: [], answers: ["reduce"] }],
      },
    ],
  },
];

// `withProgram`: undefined = không truyền (hành vi cũ), "ielts" = truyền tường minh.
function collectIeltsOutputs(withProgram) {
  const out = [];
  const extra = withProgram ? { program: withProgram } : {};
  out.push(["grammar.SYSTEM", grammar.SYSTEM], ["vocab.SYSTEM", vocab.SYSTEM], ["review.SYSTEM", review.SYSTEM]);
  out.push(["common.default", common.describeStudentLevel("")]);
  for (const lvl of LEVELS) {
    out.push([`describe(${lvl})`, common.describeStudentLevel(lvl), common.tierOf(common.bandOf(lvl))]);
    for (const language of LANGS) {
      const g = grammar.parseInput({
        topics: "Present simple\nPast simple",
        studentLevel: lvl,
        language,
        level: "Level 2",
        unitName: "Unit 3",
        notes: "Keep it short",
        ...extra,
      }).input;
      out.push([`grammar ${lvl}/${language}`, grammar.buildPrompt(g, g.topics[0])]);
      const g2 = grammar.parseInput({
        topics: "Modals",
        studentLevel: lvl,
        language,
        parts: ["exercises"],
        exerciseTypes: ["mcq"],
        questionCount: 10,
        ...extra,
      }).input;
      out.push([`grammar-mcq ${lvl}/${language}`, grammar.buildPrompt(g2, g2.topics[0])]);

      const v = vocab.parseInput({
        topics: "Environment\nEducation",
        studentLevel: lvl,
        language,
        level: "Level 2",
        unitName: "Unit 3",
        notes: "Academic",
        existingWords: ["mitigate"],
        ...extra,
      }).input;
      out.push([`vocab ${lvl}/${language}`, vocab.buildPrompt(v, v.topics[0])]);

      for (const skill of ["reading", "listening"]) {
        const r = review.parseInput({
          skill,
          exercises: SOURCE_EXERCISES,
          studentLevel: lvl,
          language,
          level: "Level 2",
          unitName: "Unit 3",
          existingWords: ["mitigate"],
          notes: "More collocations",
          ...extra,
        }).input;
        out.push([`review-${skill} ${lvl}/${language}`, review.buildPrompt(r)]);
      }
    }
  }
  return out;
}

const sha = (x) => crypto.createHash("sha256").update(JSON.stringify(x)).digest("hex");

test("IELTS prompts byte-identical to the pre-Phase-8 output (no program given)", () => {
  assert.equal(sha(collectIeltsOutputs()), IELTS_PROMPTS_SHA256);
});

test("IELTS prompts byte-identical when program: 'ielts' is passed explicitly", () => {
  assert.equal(sha(collectIeltsOutputs("ielts")), IELTS_PROMPTS_SHA256);
});

test("unknown program falls back to IELTS", () => {
  const g = grammar.parseInput({ topics: "Modals", program: "klingon" }).input;
  assert.equal(g.program, "ielts");
  assert.equal(grammar.systemFor(g.program), grammar.SYSTEM);
  assert.equal(vocab.systemFor("ielts"), vocab.SYSTEM);
  assert.equal(review.systemFor(undefined), review.SYSTEM);
});

// ---- TOEIC ----
test("TOEIC grammar: system + prompt are business-flavoured, no IELTS wording", () => {
  const sys = grammar.systemFor("toeic");
  assert.match(sys, /experienced TOEIC/);
  assert.match(sys, /workplace|business/i);
  assert.doesNotMatch(sys, /IELTS/);
  const input = grammar.parseInput({ topics: "Present perfect", program: "toeic", language: "en" }).input;
  assert.equal(input.program, "toeic");
  const p = grammar.buildPrompt(input, "Present perfect");
  assert.match(p, /TOEIC 450–600/);
  assert.doesNotMatch(p, /IELTS/);
});

test("TOEIC vocab: system + prompt", () => {
  const sys = vocab.systemFor("toeic");
  assert.match(sys, /experienced TOEIC teacher/);
  assert.doesNotMatch(sys, /IELTS/);
  const input = vocab.parseInput({ topics: "Meetings", program: "toeic", studentLevel: "TOEIC 750" }).input;
  const p = vocab.buildPrompt(input, "Meetings");
  assert.match(p, /TOEIC score 750|TOEIC 750/);
  assert.doesNotMatch(p, /IELTS/);
});

test("TOEIC vocab review: system + prompt", () => {
  const sys = review.systemFor("toeic");
  assert.match(sys, /experienced TOEIC teacher/);
  assert.doesNotMatch(sys, /IELTS/);
  const input = review.parseInput({
    skill: "reading",
    exercises: SOURCE_EXERCISES,
    program: "toeic",
  }).input;
  assert.equal(input.program, "toeic");
  const p = review.buildPrompt(input);
  assert.match(p, /TOEIC 450–600/);
  assert.match(p, /workplace|business/i);
  assert.doesNotMatch(p, /IELTS/);
});

test("TOEIC level handling: default, bare score, tiers", () => {
  assert.equal(common.describeStudentLevel("", "toeic"), common.DEFAULT_STUDENT_LEVEL_TOEIC);
  assert.equal(common.describeStudentLevel("650", "toeic"), "TOEIC score 650");
  assert.equal(common.describeStudentLevel("TOEIC 800+", "toeic"), "TOEIC 800+");
  // IELTS unchanged
  assert.equal(common.describeStudentLevel("6.5"), "IELTS band 6.5");
  assert.equal(common.describeStudentLevel("6.5", "ielts"), "IELTS band 6.5");
  assert.equal(common.levelTier("", "toeic"), "core");
  assert.equal(common.levelTier("300", "toeic"), "foundation");
  assert.equal(common.levelTier("500", "toeic"), "core");
  assert.equal(common.levelTier("700", "toeic"), "upper");
  assert.equal(common.levelTier("TOEIC 850", "toeic"), "advanced");
  assert.equal(common.levelTier("5.5"), "core");
  assert.equal(common.levelTier("5.5", "ielts"), "core");
});

test("TOEIC tier guides mention TOEIC score ranges and workplace contexts", () => {
  for (const tier of ["foundation", "core", "upper", "advanced"]) {
    assert.match(grammar.tierGuideFor("toeic", tier), /TOEIC/);
    assert.match(vocab.tierGuideFor("toeic", tier), /TOEIC/);
    assert.doesNotMatch(grammar.tierGuideFor("toeic", tier), /IELTS/);
    assert.doesNotMatch(vocab.tierGuideFor("toeic", tier), /IELTS/);
  }
});

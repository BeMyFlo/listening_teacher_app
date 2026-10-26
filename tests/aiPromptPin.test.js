// Bất biến Phase 12 G0: prompt AI (system + user) của Grammar / Vocab / Vocab Review cho IELTS và TOEIC
// phải GIỮ NGUYÊN TỪNG CHỮ. Fixture chụp từ code trước khi thêm chương trình General.
// Cập nhật cố ý: UPDATE_PIN=1 node --test tests/aiPromptPin.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const grammar = require("../lib/ai/grammarLesson");
const vocab = require("../lib/ai/vocabLesson");
const review = require("../lib/ai/vocabReview");

const FIXTURE = path.join(__dirname, "fixtures", "aiPromptPin.json");

const LEVELS = { ielts: ["", "6.5", "B1"], toeic: ["", "550", "TOEIC 800+"] };

function grammarCases(program, i) {
  const studentLevel = LEVELS[program][i];
  const bodies = [
    { topics: "Present Simple", parts: ["formula", "whenToUse", "commonMistakes", "examples", "exercises"], exerciseTypes: ["mcq", "fill"], questionCount: 8 },
    { topics: "Second Conditional\nPassive voice", parts: ["formula", "exercises"], exerciseTypes: ["mcq"], questionCount: 10, notes: "Keep it short", language: "en", level: "3", unitName: "Unit 2" },
    { topics: "Articles", parts: ["examples", "exercises"], exerciseTypes: ["fill"], questionCount: 5, language: "bilingual" },
  ];
  const { input, error } = grammar.parseInput({ ...bodies[i], studentLevel, program });
  assert.ok(!error, error);
  return { input, topic: input.topics[0] };
}

function vocabCases(program, i) {
  const studentLevel = LEVELS[program][i];
  const bodies = [
    { topics: "Environment", parts: ["words", "exercises"], exerciseTypes: ["context", "meaning", "bank"], wordCount: 10 },
    { topics: "Education\nCareers", parts: ["words"], wordCount: 15, notes: "Add collocations", existingWords: ["pollution", "recycle"], level: "4", unitName: "Unit 5" },
    { topics: "Meetings", parts: ["exercises"], exerciseTypes: ["meaning"], questionCount: 10, language: "en" },
  ];
  const { input, error } = vocab.parseInput({ ...bodies[i], studentLevel, program });
  assert.ok(!error, error);
  return { input, topic: input.topics[0] };
}

function reviewCases(program, i) {
  const studentLevel = LEVELS[program][i];
  const ex = [
    {
      sections: [
        {
          passageText: "The company will postpone the meeting because many staff are travelling. Managers must mitigate the risk of delays.",
          transcript: "Good morning. The schedule has changed, so please check the new plan before Friday.",
          fields: [{ type: "choice", label: "What does the writer suggest?", options: [{ label: "A plan" }, { label: "A delay" }, { label: "True" }] }],
        },
      ],
    },
  ];
  const bodies = [
    { skill: "reading", exercises: ex, wordCount: 15 },
    { skill: "listening", exercises: ex, wordCount: 10, notes: "Business words", existingWords: ["schedule"], level: "2", unitName: "Unit 1" },
    { skill: "reading", exercises: ex, wordCount: 20, language: "bilingual" },
  ];
  const { input, error } = review.parseInput({ ...bodies[i], studentLevel, program });
  assert.ok(!error, error);
  return { input };
}

function snapshot() {
  const out = {};
  for (const program of ["ielts", "toeic"]) {
    for (let i = 0; i < 3; i++) {
      const g = grammarCases(program, i);
      out[`grammar/${program}/${i}`] = {
        system: grammar.systemFor(program),
        user: grammar.buildPrompt(g.input, g.topic),
      };
      const v = vocabCases(program, i);
      out[`vocab/${program}/${i}`] = {
        system: vocab.systemFor(program),
        user: vocab.buildPrompt(v.input, v.topic),
      };
      const r = reviewCases(program, i);
      out[`vocabReview/${program}/${i}`] = {
        system: review.systemFor(program),
        user: review.buildPrompt(r.input),
      };
    }
  }
  return out;
}

test("prompt AI IELTS/TOEIC: toàn văn system + user không đổi", () => {
  const actual = snapshot();
  if (process.env.UPDATE_PIN === "1") {
    fs.writeFileSync(FIXTURE, JSON.stringify(actual, null, 2) + "\n");
    return;
  }
  const expected = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
  assert.deepEqual(Object.keys(actual), Object.keys(expected));
  for (const k of Object.keys(expected)) {
    assert.equal(actual[k].system, expected[k].system, `${k} system`);
    assert.equal(actual[k].user, expected[k].user, `${k} user`);
  }
});

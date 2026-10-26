const test = require("node:test");
const assert = require("node:assert/strict");
const common = require("../lib/ai/common");
const grammar = require("../lib/ai/grammarLesson");
const vocab = require("../lib/ai/vocabLesson");
const review = require("../lib/ai/vocabReview");

const SAMPLE_EXERCISES = [
  {
    sections: [
      {
        passageText: "Living in the countryside offers fresh air and peaceful surroundings. Many teenagers enjoy outdoor activities like cycling and gardening.",
        transcript: "Welcome to our school club. Today we talk about healthy lifestyles and daily habits.",
        fields: [
          {
            type: "choice",
            label: "What is a benefit of living in the countryside?",
            options: [{ label: "Fresh air" }, { label: "Busy streets" }, { label: "High cost" }],
          },
        ],
      },
    ],
  },
];

test("General English levelTier: khối lớp GDPT 2018 và CEFR", () => {
  assert.equal(common.levelTier("Grade 7", "general"), "foundation");
  assert.equal(common.levelTier("Grade 9", "general"), "core");
  assert.equal(common.levelTier("Grade 11", "general"), "upper");
  assert.equal(common.levelTier("B2", "general"), "advanced");
  assert.equal(common.levelTier("lớp 8", "general"), "core");
  assert.equal(common.levelTier("", "general"), "core");

  // Hành vi cũ của IELTS: không sửa
  assert.equal(common.levelTier("Grade 7", "ielts"), "advanced");
});

test("General English describeStudentLevel: fallbackGrade và xử lý số", () => {
  // Trống + fallbackGrade 8 -> chứa "Grade 8"
  const desc8 = common.describeStudentLevel("", "general", 8);
  assert.match(desc8, /Grade 8/);
  assert.match(desc8, /Vietnamese secondary school/);

  // Trống không có fallbackGrade -> DEFAULT_STUDENT_LEVEL_GENERAL (Grade 8)
  assert.match(common.describeStudentLevel("", "general"), /Grade 8/);

  // Chỉ gõ số -> tự điền "Grade N ..."
  assert.match(common.describeStudentLevel("7", "general"), /Grade 7/);

  // Chuỗi tự do khác -> giữ nguyên
  assert.equal(common.describeStudentLevel("Grade 9 entrance prep", "general"), "Grade 9 entrance prep");
  assert.equal(common.describeStudentLevel("B1", "general"), "B1");
});

test("General English fourOptions: luôn 4 lựa chọn (A–D)", () => {
  assert.equal(common.fourOptions("general", null), true);
  assert.equal(common.fourOptions("general", 3), true);
  assert.equal(common.fourOptions("general", 5.5), true);
  assert.equal(common.fourOptions("general", 7), true);

  // Nhánh IELTS giữ đúng luật cũ (band >= 6 mới 4 lựa chọn)
  assert.equal(common.fourOptions("ielts", null), false);
  assert.equal(common.fourOptions("ielts", 5), false);
  assert.equal(common.fourOptions("ielts", 6), true);

  // TOEIC luôn 4 lựa chọn
  assert.equal(common.fourOptions("toeic", null), true);
});

test("General grammar: prompt (system + user) không chứa IELTS/TOEIC và luôn 4 lựa chọn", () => {
  const sys = grammar.systemFor("general");
  assert.match(sys, /experienced English teacher at a lower and upper secondary school in Vietnam/);
  assert.match(sys, /Global Success/);

  // System chỉ nhắc tới IELTS/TOEIC ở câu chỉ dẫn cấm (Never mention IELTS or TOEIC)
  const sysWithoutConstraint = sys.replace(/Never mention IELTS or TOEIC\.?/g, "");
  assert.doesNotMatch(sysWithoutConstraint, /IELTS/);
  assert.doesNotMatch(sysWithoutConstraint, /TOEIC/);

  const { input } = grammar.parseInput({
    topics: "Present simple",
    program: "general",
    studentLevel: "Grade 7",
    level: "7",
    unitName: "Unit 1",
    parts: ["formula", "exercises"],
    exerciseTypes: ["mcq"],
    questionCount: 8,
    language: "vi",
  });
  assert.equal(input.program, "general");

  const prompt = grammar.buildPrompt(input, "Present simple");
  assert.match(prompt, /Grade 7/);
  assert.match(prompt, /mcq: 'options' has 4 short choices/);
  assert.doesNotMatch(prompt, /IELTS/);
  assert.doesNotMatch(prompt, /TOEIC/);
});

test("General vocab: prompt (system + user) không chứa IELTS/TOEIC và ví dụ tên nhóm theo chủ đề học đường", () => {
  const sys = vocab.systemFor("general");
  assert.match(sys, /experienced English teacher at a lower and upper secondary school in Vietnam/);

  const sysWithoutConstraint = sys.replace(/Never mention IELTS or TOEIC\.?/g, "");
  assert.doesNotMatch(sysWithoutConstraint, /IELTS/);
  assert.doesNotMatch(sysWithoutConstraint, /TOEIC/);

  const { input } = vocab.parseInput({
    topics: "Healthy living",
    program: "general",
    studentLevel: "Grade 8",
    level: "8",
    unitName: "Unit 2",
    parts: ["words", "exercises"],
    exerciseTypes: ["context"],
    wordCount: 8,
    language: "en",
  });
  assert.equal(input.program, "general");

  const prompt = vocab.buildPrompt(input, "Healthy living");
  assert.match(prompt, /'Hobbies' or 'Healthy living'/);
  assert.match(prompt, /context: 'sentence' is one sentence with exactly one gap written as ___, grammatical with the answer exactly as written \(no plural or tense change needed\)\. 'options' has 4 words/);
  assert.doesNotMatch(prompt, /IELTS/);
  assert.doesNotMatch(prompt, /TOEIC/);
});

test("General vocab review: prompt (system + user) không chứa IELTS/TOEIC và bám chủ đề Unit sách giáo khoa", () => {
  const sys = review.systemFor("general");
  assert.match(sys, /experienced English teacher at a lower and upper secondary school in Vietnam/);
  assert.match(sys, /school reading or listening exercise/);

  const sysWithoutConstraint = sys.replace(/Never mention IELTS or TOEIC\.?/g, "");
  assert.doesNotMatch(sysWithoutConstraint, /IELTS/);
  assert.doesNotMatch(sysWithoutConstraint, /TOEIC/);

  const { input } = review.parseInput({
    skill: "reading",
    exercises: SAMPLE_EXERCISES,
    program: "general",
    studentLevel: "Grade 9",
    level: "9",
    unitName: "Unit 3",
    wordCount: 10,
    language: "vi",
  });
  assert.equal(input.program, "general");

  const prompt = review.buildPrompt(input);
  assert.match(prompt, /Prefer vocabulary aligned with school-textbook unit topics/);
  assert.doesNotMatch(prompt, /IELTS/);
  assert.doesNotMatch(prompt, /TOEIC/);
});

test("General tier guides: không chứa IELTS hay TOEIC ở cả 4 mức", () => {
  for (const tier of ["foundation", "core", "upper", "advanced"]) {
    const gTier = grammar.tierGuideFor("general", tier);
    assert.doesNotMatch(gTier, /IELTS/);
    assert.doesNotMatch(gTier, /TOEIC/);

    const vTier = vocab.tierGuideFor("general", tier);
    assert.doesNotMatch(vTier, /IELTS/);
    assert.doesNotMatch(vTier, /TOEIC/);
  }
});

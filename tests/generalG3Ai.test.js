const test = require("node:test");
const assert = require("node:assert/strict");

const {
  optionLettersFromUnderlines,
  AI_FORMATS,
  GENERAL_SUBJECT_FORMAT_KEYS,
  aiFormatsFor,
} = require("../lib/generalFormats");
const { questionFormatsFor } = require("../lib/teacher/questionFormats");
const { toGeneralSection } = require("../lib/ai/generalSections");
const { generalQuestionError } = require("../lib/generalFormats");
const { normalizeSections } = require("../lib/testSections");
const { fieldToServer } = require("../lib/teacher/sectionTransforms");
const generalExercise = require("../lib/ai/generalExercise");
const grammarLesson = require("../lib/ai/grammarLesson");
const vocabLesson = require("../lib/ai/vocabLesson");
const Unit = require("../lib/models/Unit");
const WorkspaceMember = require("../lib/models/WorkspaceMember");
const Workspace = require("../lib/models/Workspace");
const { signUserToken } = require("../lib/auth");
const { clearTenantCache } = require("../lib/tenant");

// -------------------------------------------------------------
// 1. optionLettersFromUnderlines & GENERAL_SUBJECT_FORMAT_KEYS
// -------------------------------------------------------------
test("optionLettersFromUnderlines: trả A–D đúng số phần gạch chân (2–4), lỗi khi < 2 hoặc > 4", () => {
  assert.deepEqual(optionLettersFromUnderlines("She <u>are</u> a <u>student</u>."), ["A", "B"]);
  assert.deepEqual(optionLettersFromUnderlines("She __are__ a __student__."), ["A", "B"]);
  assert.deepEqual(optionLettersFromUnderlines("I <u>wish</u> I <u>can</u> <u>fly</u>."), ["A", "B", "C"]);
  assert.deepEqual(optionLettersFromUnderlines("<u>He</u> <u>don't</u> <u>like</u> <u>apples</u>."), ["A", "B", "C", "D"]);

  assert.throws(
    () => optionLettersFromUnderlines("No underline here"),
    /Found 0 underlined parts\. Error identification requires 2 to 4 underlined parts\./
  );
  assert.throws(
    () => optionLettersFromUnderlines("Only <u>one</u> part"),
    /Found 1 underlined parts\. Error identification requires 2 to 4 underlined parts\./
  );
  assert.throws(
    () => optionLettersFromUnderlines("<u>1</u> <u>2</u> <u>3</u> <u>4</u> <u>5</u>"),
    /Found 5 underlined parts\. Error identification requires 2 to 4 underlined parts\./
  );
});

test("GENERAL_SUBJECT_FORMAT_KEYS so khớp với questionFormatsFor(subject, 'general')", () => {
  for (const subject of ["grammar", "vocabulary", "listening", "reading"]) {
    const fromFormats = questionFormatsFor(subject, "general").map((f) => f.key);
    assert.deepEqual(fromFormats, GENERAL_SUBJECT_FORMAT_KEYS[subject], `Mismatch in subject ${subject}`);
  }
});

test("AI_FORMATS và aiFormatsFor(subject) đúng 14 format theo bảng 3.2", () => {
  assert.equal(AI_FORMATS.length, 14);
  assert.deepEqual(aiFormatsFor("grammar"), [
    "g-mcq", "g-comm", "g-verb", "g-wform", "g-error", "g-reorder", "g-rewrite", "g-combine", "g-closest",
  ]);
  assert.deepEqual(aiFormatsFor("vocabulary"), [
    "g-mcq", "g-pron", "g-stress", "g-comm", "g-syn", "g-wform", "g-reorder",
  ]);
  assert.deepEqual(aiFormatsFor("reading"), [
    "g-mcq", "g-wform", "g-syn", "g-closest", "g-cloze", "g-tf",
  ]);
  assert.deepEqual(aiFormatsFor("listening"), []);
});

// -------------------------------------------------------------
// 2. toGeneralSection (bộ chuyển chung 2.2)
// -------------------------------------------------------------
test("toGeneralSection: mỗi format trong bảng 2.2 ít nhất 1 ca, qua normalizeSections & generalQuestionError trả null", () => {
  const cases = [
    {
      format: "g-mcq",
      subject: "grammar",
      q: { text: "She ____ to school every day.", options: ["go", "goes", "went", "going"], answer: "goes" },
    },
    {
      format: "g-comm",
      subject: "grammar",
      q: { text: "David: Thank you! - Mary: ____", options: ["You're welcome", "Never mind", "No problem", "Yes"], answer: "You're welcome" },
    },
    {
      format: "g-closest",
      subject: "reading",
      q: { text: "He is intelligent.", options: ["He is smart.", "He is tall.", "He is fast.", "He is slow."], answer: "He is smart." },
    },
    {
      format: "g-stress",
      subject: "vocabulary",
      q: { text: "", options: ["teacher", "student", "device", "mother"], answer: "device" },
    },
    {
      format: "g-cloze",
      subject: "reading",
      passage: "This is a cloze passage with (1) ____ blanks.",
      q: { text: "(1) ____", options: ["many", "few", "some", "any"], answer: "many" },
    },
    {
      format: "g-tf",
      subject: "reading",
      passage: "The sun rises in the east.",
      q: { text: "The sun rises in the east.", answer: "True" },
    },
    {
      format: "g-tfng",
      subject: "reading",
      passage: "Tom likes math.",
      q: { text: "Tom likes history.", answer: "Not Given" },
    },
    {
      format: "g-insert",
      subject: "reading",
      q: { text: "Where should this sentence go?", answer: "[II]" },
    },
    {
      format: "g-pron",
      subject: "vocabulary",
      q: { text: "", options: ["c<u>a</u>t", "m<u>a</u>ke", "h<u>a</u>te", "l<u>a</u>te"], answer: "c<u>a</u>t" },
    },
    {
      format: "g-error",
      subject: "grammar",
      q: { text: "She <u>are</u> a <u>student</u> at <u>this</u> <u>school</u>.", answer: "A" },
    },
    {
      format: "g-syn",
      subject: "vocabulary",
      q: { text: "Choose the word CLOSEST in meaning to: He is <u>wealthy</u>.", options: ["rich", "poor", "tall", "young"], answer: "rich" },
    },
    {
      format: "g-arrange",
      subject: "grammar",
      q: { text: "Arrange sentences:", answer: "b-d-a-c" },
    },
    {
      format: "g-verb",
      subject: "grammar",
      q: { before: "She", after: "to school.", hint: "(go)", answer: "goes", altAnswers: ["is going"] },
    },
    {
      format: "g-wform",
      subject: "vocabulary",
      q: { before: "Air", after: "is a serious problem.", hint: "(pollute)", answer: "pollution" },
    },
    {
      format: "g-gap",
      subject: "reading",
      q: { before: "He arrived", after: "noon.", answer: "at" },
    },
    {
      format: "g-rq",
      subject: "reading",
      q: { text: "What is her name?", answer: "Mary", altAnswers: ["It is Mary"] },
    },
    {
      format: "g-phrase",
      subject: "grammar",
      q: { before: "In spite of", after: "she went to work.", answer: "the rain" },
    },
    {
      format: "g-combine",
      subject: "grammar",
      q: { text: "He was tired. He finished the work.", answer: "Although he was tired, he finished the work." },
    },
    {
      format: "g-rewrite",
      subject: "grammar",
      q: { text: "I have never seen this movie before.", start: "This is the first time", answer: "I have seen this movie." },
    },
    {
      format: "g-reorder",
      subject: "grammar",
      q: { pieces: ["She", "always", "gets up", "early in the morning."], answer: "She always gets up early in the morning." },
    },
    {
      format: "g-ocloze",
      subject: "reading",
      q: { before: "Once upon", after: "time...", answer: "a" },
    },
    {
      format: "g-sign",
      subject: "vocabulary",
      q: { text: "What does this sign mean?", options: ["No parking", "Stop", "Turn left", "Speed up"], answer: "Stop" },
    },
  ];

  for (const c of cases) {
    const { section, removed } = toGeneralSection(
      { format: c.format, name: "Section title", passage: c.passage, questions: [c.q] },
      { subject: c.subject, startId: 1, strict: true }
    );
    assert.equal(removed.length, 0, `Format ${c.format} was unexpectedly removed: ${JSON.stringify(removed)}`);
    assert.equal(section.fields.length, 1, `Format ${c.format} should produce 1 field`);

    const field = section.fields[0];
    const err = generalQuestionError(field);
    assert.equal(err, null, `generalQuestionError on ${c.format}: ${err}`);
  }
});

test("toGeneralSection: reorder tokens đã xáo khác thứ tự đáp án", () => {
  const pieces = ["She", "always", "gets up", "early."];
  const answer = "She always gets up early.";
  const { section } = toGeneralSection(
    { format: "g-reorder", name: "Reorder", questions: [{ pieces, answer }] },
    { subject: "grammar", strict: true }
  );
  assert.equal(section.fields.length, 1);
  const f = section.fields[0];
  assert.notDeepEqual(f.tokens, pieces, "Tokens must be shuffled");
  assert.notEqual(f.tokens.join(" "), answer, "Tokens joined must not equal the answer");
});

test("toGeneralSection: error options = số phần gạch chân (2–4)", () => {
  const { section: s2 } = toGeneralSection(
    { format: "g-error", questions: [{ text: "<u>A</u> and <u>B</u>.", answer: "A" }] },
    { subject: "grammar", strict: true }
  );
  assert.equal(s2.fields[0].options.length, 2);
  assert.deepEqual(s2.fields[0].options.map((o) => o.label), ["A", "B"]);

  const { section: s3 } = toGeneralSection(
    { format: "g-error", questions: [{ text: "<u>A</u> <u>B</u> <u>C</u>.", answer: "B" }] },
    { subject: "grammar", strict: true }
  );
  assert.equal(s3.fields[0].options.length, 3);
  assert.deepEqual(s3.fields[0].options.map((o) => o.label), ["A", "B", "C"]);
});

test("toGeneralSection: <u> chỉ thành __ ở format gạch chân (error, syn, pron)", () => {
  // error: uMode là label -> label đổi <u>x</u> -> __x__, options là chữ cái A-D
  const { section: sError } = toGeneralSection(
    { format: "g-error", questions: [{ text: "She <u>are</u> <u>happy</u>.", answer: "A" }] },
    { subject: "grammar", strict: true }
  );
  assert.equal(sError.fields[0].label, "She __are__ __happy__.");

  // pron: uMode là options -> options đổi <u>x</u> -> __x__, label bóc thẻ
  const { section: sPron } = toGeneralSection(
    { format: "g-pron", questions: [{ text: "Pronounce <u>this</u>", options: ["c<u>a</u>t", "m<u>a</u>ke"], answer: "c<u>a</u>t" }] },
    { subject: "vocabulary", strict: true }
  );
  assert.equal(sPron.fields[0].label, "");
  assert.equal(sPron.fields[0].options[0].label, "c__a__t");
  assert.equal(sPron.fields[0].options[1].label, "m__a__ke");

  // mcq: uMode là null -> cả label và options đều bóc <u>
  const { section: sMcq } = toGeneralSection(
    { format: "g-mcq", questions: [{ text: "I <u>love</u> ____", options: ["<u>apples</u>", "oranges"], answer: "apples" }] },
    { subject: "grammar", strict: true }
  );
  assert.equal(sMcq.fields[0].label, "I love ___");
  assert.equal(sMcq.fields[0].options[0].label, "apples");
});

test("toGeneralSection: passage chỉ giữ khi subject reading", () => {
  const p = "A long reading passage...";
  const { section: sRead } = toGeneralSection(
    { format: "g-tf", passage: p, questions: [{ text: "Statement", answer: "True" }] },
    { subject: "reading", strict: true }
  );
  assert.equal(sRead.passageText, p);

  const { section: sGram } = toGeneralSection(
    { format: "g-tf", passage: p, questions: [{ text: "Statement", answer: "True" }] },
    { subject: "grammar", strict: true }
  );
  assert.equal(sGram.passageText, "");
});

test("toGeneralSection: strict true bỏ câu + removed; strict false giữ câu + flag + warning", () => {
  const badQ = {
    number: 15,
    text: "Only <u>one</u> underline part in error question",
    answer: "A",
  };

  // strict: true (luồng AI)
  const resStrict = toGeneralSection(
    { format: "g-error", questions: [badQ] },
    { subject: "grammar", strict: true }
  );
  assert.equal(resStrict.section.fields.length, 0);
  assert.equal(resStrict.removed.length, 1);
  assert.equal(resStrict.removed[0].number, 15);
  assert.match(resStrict.removed[0].reason, /Error identification requires 2 to 4/);

  // strict: false (luồng Word)
  const resNonStrict = toGeneralSection(
    { format: "g-error", questions: [badQ] },
    { subject: "grammar", strict: false }
  );
  assert.equal(resNonStrict.section.fields.length, 1);
  assert.equal(resNonStrict.removed.length, 0);
  assert.equal(resNonStrict.flags.length, 1);
  assert.equal(resNonStrict.flags[0].fi, 0);
  assert.match(resNonStrict.flags[0].reason, /Error identification requires 2 to 4/);
  assert.equal(resNonStrict.warnings.length, 1);
});

// -------------------------------------------------------------
// 3. generalExercise module
// -------------------------------------------------------------
test("generalExercise.parseInput: lọc format theo subject, 0 hoặc > 3 format -> lỗi, program khác general -> lỗi", () => {
  // Hợp lệ: 2 format của grammar
  const ok = generalExercise.parseInput({
    subject: "grammar",
    program: "general",
    focus: "Present perfect vs past simple",
    formats: ["g-mcq", "g-verb"],
    questionCount: 8,
  });
  assert.ok(!ok.error);
  assert.deepEqual(ok.input.topics, ["g-mcq", "g-verb"]);
  assert.equal(ok.input.questionCount, 8);

  // Lọc format không thuộc subject: g-pron là của vocab, không thuộc grammar
  const filtered = generalExercise.parseInput({
    subject: "grammar",
    program: "general",
    focus: "Tenses",
    formats: ["g-verb", "g-pron"],
  });
  assert.ok(!filtered.error);
  assert.deepEqual(filtered.input.topics, ["g-verb"]);

  // 0 format sau lọc -> lỗi
  const zero = generalExercise.parseInput({
    subject: "grammar",
    program: "general",
    focus: "Tenses",
    formats: ["g-pron"], // không thuộc grammar
  });
  assert.match(zero.error, /Choose 1 to 3 question types/);

  // > 3 format -> lỗi
  const tooMany = generalExercise.parseInput({
    subject: "grammar",
    program: "general",
    focus: "Tenses",
    formats: ["g-mcq", "g-verb", "g-error", "g-rewrite"],
  });
  assert.match(tooMany.error, /Choose 1 to 3 question types/);

  // Program khác general -> lỗi
  const badProg = generalExercise.parseInput({
    subject: "grammar",
    program: "ielts",
    focus: "Tenses",
    formats: ["g-mcq"],
  });
  assert.match(badProg.error, /only available for General English/);

  // Focus rỗng -> lỗi
  const noFocus = generalExercise.parseInput({
    subject: "grammar",
    program: "general",
    focus: "",
    formats: ["g-mcq"],
  });
  assert.match(noFocus.error, /Enter a focus/);
});

test("generalExercise.buildPrompt: có Grade/Textbook/Unit/Focus", () => {
  const { input } = generalExercise.parseInput({
    subject: "grammar",
    program: "general",
    level: "8",
    textbook: "Global Success 8",
    unitName: "Unit 5 — Our customs",
    focus: "Modal verbs of obligation",
    formats: ["g-mcq"],
  });
  const prompt = generalExercise.buildPrompt(input, "g-mcq");
  assert.match(prompt, /Grade: 8/);
  assert.match(prompt, /Textbook: Global Success 8/);
  assert.match(prompt, /Unit: Unit 5 — Our customs/);
  assert.match(prompt, /Focus: Modal verbs of obligation/);
});

test("generalExercise.checkQuestions: gộp altAnswers, bỏ câu mcq có 2 đáp án đúng, reorder key sai bị bỏ", () => {
  const questions = [
    {
      format: "g-mcq",
      text: "She ____ to school.",
      options: ["goes", "walks", "swims", "flies"],
      answer: "goes",
    },
    {
      format: "g-verb",
      before: "She",
      after: "to school.",
      hint: "(go)",
      answer: "goes",
      altAnswers: [],
    },
    {
      format: "g-reorder",
      pieces: ["She", "always", "smiles."],
      answer: "She always smiles.",
      altAnswers: [],
    },
  ];

  // Giám khảo: câu 1 có 2 đáp án chấp nhận được ("goes" và "walks"); câu 2 thêm "is going"; câu 3 keyIsCorrect = false
  const checkVerdict = {
    items: [
      { n: 1, keyIsCorrect: true, acceptable: ["goes", "walks"], note: "Both make sense" },
      { n: 2, keyIsCorrect: true, acceptable: ["goes", "is going"] },
      { n: 3, keyIsCorrect: false, acceptable: [], note: "Grammar mistake in key" },
    ],
  };

  const { kept, removed } = generalExercise.checkQuestions(questions, checkVerdict);
  assert.equal(removed.length, 2);
  assert.match(removed[0].reason, /more than one option could be right/);
  assert.match(removed[1].reason, /Grammar mistake in key/);

  assert.equal(kept.length, 1);
  assert.equal(kept[0].format, "g-verb");
  assert.deepEqual(kept[0].altAnswers, ["is going"]);
});

test("generalExercise.finalizeTopic: cắt đúng questionCount và pron/stress luôn có cờ vàng", () => {
  const questions = [
    { text: "", options: ["c<u>a</u>t", "m<u>a</u>ke", "h<u>a</u>te", "l<u>a</u>te"], answer: "c<u>a</u>t" },
    { text: "", options: ["b<u>e</u>d", "r<u>e</u>d", "m<u>e</u>t", "h<u>e</u>"], answer: "h<u>e</u>" },
    { text: "", options: ["s<u>i</u>t", "f<u>i</u>t", "h<u>i</u>t", "t<u>i</u>e"], answer: "t<u>i</u>e" },
  ];
  const topic = {
    name: "Pronunciation exercise",
    format: "g-pron",
    questions,
  };
  const input = {
    subject: "vocabulary",
    questionCount: 2,
  };

  const res = generalExercise.finalizeTopic(topic, questions, input);
  assert.equal(res.exerciseSections[0].fields.length, 2, "Phải cắt về đúng 2 câu");
  assert.equal(res.flags.length, 2, "Mỗi câu phát âm đều phải có cờ vàng");
  for (const flag of res.flags) {
    assert.equal(flag.reason, "Pronunciation/stress — please double-check");
  }
});

// -------------------------------------------------------------
// 4. fieldToServer không mang aiFlag lên server
// -------------------------------------------------------------
test("fieldToServer không mang aiFlag lên server", () => {
  const editorField = {
    id: 1,
    kind: "fill",
    matchMode: "sentence",
    label: "She",
    post: "to school.",
    hint: "(go)",
    answersText: "goes\nis going",
    aiFlag: "Answer suggested by AI — please double-check",
  };
  const serverField = fieldToServer(editorField);
  assert.equal(serverField.aiFlag, undefined);
  assert.equal("aiFlag" in serverField, false);
});

// -------------------------------------------------------------
// 5. Textbook trong Unit & Prompt AI
// -------------------------------------------------------------
test("Unit model có field textbook (default rỗng, tối đa 80 ký tự)", () => {
  const wsId = "64b000000000000000000001";
  const unit = new Unit({ workspaceId: wsId, name: "Unit 1", level: 8, program: "general", textbook: "Global Success 8" });
  assert.equal(unit.textbook, "Global Success 8");

  const defaultUnit = new Unit({ workspaceId: wsId, name: "Unit 2", level: 8 });
  assert.equal(defaultUnit.textbook, "");
});

test("grammarLesson / vocabLesson: General có textbook -> prompt có dòng Textbook; IELTS/TOEIC gửi textbook lên -> không có dòng Textbook", () => {
  // General: có textbook
  const { input: gIn } = grammarLesson.parseInput({
    topics: "Past simple",
    program: "general",
    level: "8",
    textbook: "Global Success 8",
    parts: ["formula"],
  });
  const gPrompt = grammarLesson.buildPrompt(gIn, "Past simple");
  assert.match(gPrompt, /- Textbook: Global Success 8/);

  // IELTS: gửi textbook lên -> không nhận vào prompt
  const { input: iIn } = grammarLesson.parseInput({
    topics: "Past simple",
    program: "ielts",
    level: "3",
    textbook: "Global Success 8",
    parts: ["formula"],
  });
  const iPrompt = grammarLesson.buildPrompt(iIn, "Past simple");
  assert.doesNotMatch(iPrompt, /Textbook/);

  // Vocab General: có textbook
  const { input: vIn } = vocabLesson.parseInput({
    topics: "Customs",
    program: "general",
    level: "8",
    textbook: "Friends Plus 8",
    parts: ["words"],
  });
  const vPrompt = vocabLesson.buildPrompt(vIn, "Customs");
  assert.match(vPrompt, /- Textbook: Friends Plus 8/);

  // Vocab TOEIC: gửi textbook lên -> không nhận vào prompt
  const { input: tIn } = vocabLesson.parseInput({
    topics: "Customs",
    program: "toeic",
    level: "2",
    textbook: "Friends Plus 8",
    parts: ["words"],
  });
  const tPrompt = vocabLesson.buildPrompt(tIn, "Customs");
  assert.doesNotMatch(tPrompt, /Textbook/);
});

// -------------------------------------------------------------
// 6. Route ai-lesson kind "exercise" với generateJSON giả
// -------------------------------------------------------------
test("route ai-lesson kind 'exercise' với generateJSON giả: trả exerciseSections + flags", async () => {
  const origKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "mock-key";
  const gemini = require("../lib/gemini");
  const origGenerateJSON = gemini.generateJSON;
  const origIsEnabled = gemini.isEnabled;

  process.env.JWT_SECRET = "test-secret-g3-ai";
  if (!global._mongooseConn) global._mongooseConn = {};
  global._mongooseConn.conn = {};

  const origWmFindOne = WorkspaceMember.findOne;
  const origWsFindById = Workspace.findById;
  const AppSetting = require("../lib/models/AppSetting");
  const origAppSettingFindOne = AppSetting.findOne;

  AppSetting.findOne = () => ({ lean: async () => null });
  WorkspaceMember.findOne = () => ({
    select: () => ({ lean: async () => ({ workspaceId: "ws1", role: "teacher" }) }),
  });
  Workspace.findById = () => ({
    select: () => ({ lean: async () => ({ _id: "ws1", status: "active", settings: {} }) }),
  });
  clearTenantCache();

  gemini.isEnabled = () => true;
  gemini.generateJSON = async ({ prompt }) => {
    // Nếu là lượt kiểm tra đáp án
    if (prompt.includes("Judge each exercise item below carefully")) {
      return {
        data: {
          items: [
            { n: 1, keyIsCorrect: true, acceptable: ["device"], note: "" },
          ],
        },
        model: "mock-gemini-check",
      };
    }
    // Lượt soạn bài
    return {
      data: {
        questions: [
          {
            text: "",
            options: ["teacher", "student", "device", "mother"],
            answer: "device",
            explanation: "Stress on 2nd syllable",
            ipa: ["/ˈtiːtʃə/", "/ˈstjuːdnt/", "/dɪˈvaɪs/", "/ˈmʌðə/"],
          },
        ],
      },
      model: "mock-gemini",
      logId: "log1",
    };
  };

  delete require.cache[require.resolve("../pages/api/admin/ai-lesson")];
  const aiLessonRoute = require("../pages/api/admin/ai-lesson");

  try {
    const token = signUserToken({ _id: "u1", role: "teacher", name: "Teacher One" });
    const req = {
      method: "POST",
      query: {},
      body: {
        kind: "exercise",
        subject: "vocabulary",
        program: "general",
        focus: "Word stress unit 5",
        formats: ["g-stress"],
        questionCount: 5,
        level: "8",
      },
      headers: { authorization: "Bearer " + token },
      url: "/api/admin/ai-lesson",
      ws: { workspaceId: "ws1", demo: false },
    };

    let statusCode = 200;
    let payload = null;
    const res = {
      setHeader() {},
      status(c) {
        statusCode = c;
        return this;
      },
      json(p) {
        payload = p;
        return this;
      },
    };

    await aiLessonRoute(req, res);

    assert.equal(statusCode, 200, `Expected 200, got ${statusCode}: ${JSON.stringify(payload)}`);
    assert.equal(payload.ok, true);
    assert.equal(payload.topics.length, 1);
    const topic = payload.topics[0];
    assert.equal(topic.format, "g-stress");
    assert.ok(Array.isArray(topic.exerciseSections));
    assert.equal(topic.exerciseSections.length, 1);
    assert.equal(topic.exerciseSections[0].fields.length, 1);
    assert.equal(topic.exerciseSections[0].fields[0].formatLabel, "Word stress");
    assert.ok(Array.isArray(topic.flags));
    assert.equal(topic.flags.length, 1);
    assert.equal(topic.flags[0].reason, "Pronunciation/stress — please double-check");
  } finally {
    if (origKey !== undefined) process.env.GEMINI_API_KEY = origKey;
    else delete process.env.GEMINI_API_KEY;
    gemini.generateJSON = origGenerateJSON;
    gemini.isEnabled = origIsEnabled;
    delete require.cache[require.resolve("../pages/api/admin/ai-lesson")];
    AppSetting.findOne = origAppSettingFindOne;
    WorkspaceMember.findOne = origWmFindOne;
    Workspace.findById = origWsFindById;
    clearTenantCache();
  }
});

test("pages/api/admin/units.js POST/PUT: chỉ lưu textbook khi registry textbook true", async () => {
  const unitsRoute = require("../pages/api/admin/units");
  process.env.JWT_SECRET = "test-secret-g3-units";
  if (!global._mongooseConn) global._mongooseConn = {};
  global._mongooseConn.conn = {};

  const origWmFindOne = WorkspaceMember.findOne;
  const origWsFindById = Workspace.findById;
  const origUCreate = Unit.create;
  const origUFindOne = Unit.findOne;

  WorkspaceMember.findOne = () => ({
    select: () => ({ lean: async () => ({ workspaceId: "ws1", role: "teacher" }) }),
  });
  Workspace.findById = () => ({
    select: () => ({ lean: async () => ({ _id: "ws1", status: "active", settings: {} }) }),
  });
  clearTenantCache();

  let createdDoc = null;
  Unit.create = async (doc) => {
    createdDoc = doc;
    return { _id: "u-created", ...doc };
  };

  async function callRoute({ method, query = {}, body = {}, doc = null }) {
    Unit.findOne = async () => doc;
    const token = signUserToken({ _id: "u1", role: "teacher", name: "Teacher One" });
    const req = {
      method,
      query,
      body,
      headers: { authorization: "Bearer " + token },
      url: "/api/admin/units",
      ws: { workspaceId: "ws1" },
    };
    let statusCode = 200;
    let payload = null;
    const res = {
      setHeader() {},
      status(c) {
        statusCode = c;
        return this;
      },
      json(p) {
        payload = p;
        return this;
      },
    };
    await unitsRoute(req, res);
    return { status: statusCode, body: payload };
  }

  try {
    // 1. POST Unit General có textbook -> lưu textbook
    createdDoc = null;
    const rPostGen = await callRoute({
      method: "POST",
      body: { name: "Unit 1", level: 8, program: "general", textbook: "Global Success 8" },
    });
    assert.equal(rPostGen.status, 201);
    assert.equal(createdDoc.textbook, "Global Success 8");

    // 2. POST Unit IELTS gửi textbook -> ép thành ""
    createdDoc = null;
    const rPostIelts = await callRoute({
      method: "POST",
      body: { name: "Unit 2", level: 3, program: "ielts", textbook: "Global Success 8" },
    });
    assert.equal(rPostIelts.status, 201);
    assert.equal(createdDoc.textbook, "");

    // 3. PUT Unit General cập nhật textbook -> lưu textbook
    const mockGeneralUnit = {
      _id: "u-gen",
      workspaceId: "ws1",
      program: "general",
      level: 8,
      name: "Old Name",
      textbook: "Old Book",
      deadlines: [],
      skillLocks: [],
      categories: [],
      save: async function () { return this; },
      toJSON: function () { return { ...this }; },
    };
    const rPutGen = await callRoute({
      method: "PUT",
      query: { id: "u-gen" },
      body: { textbook: "Friends Plus 8" },
      doc: mockGeneralUnit,
    });
    assert.equal(rPutGen.status, 200);
    assert.equal(mockGeneralUnit.textbook, "Friends Plus 8");

    // 4. PUT Unit TOEIC gửi textbook -> ép thành ""
    const mockToeicUnit = {
      _id: "u-toeic",
      workspaceId: "ws1",
      program: "toeic",
      level: 2,
      name: "Old TOEIC",
      textbook: "",
      deadlines: [],
      skillLocks: [],
      categories: [],
      save: async function () { return this; },
      toJSON: function () { return { ...this }; },
    };
    const rPutToeic = await callRoute({
      method: "PUT",
      query: { id: "u-toeic" },
      body: { textbook: "Target Score" },
      doc: mockToeicUnit,
    });
    assert.equal(rPutToeic.status, 200);
    assert.equal(mockToeicUnit.textbook, "");
  } finally {
    WorkspaceMember.findOne = origWmFindOne;
    Workspace.findById = origWsFindById;
    Unit.create = origUCreate;
    Unit.findOne = origUFindOne;
    clearTenantCache();
  }
});

const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeSections, validateSections } = require("../lib/testSections");
const {
  emptyField,
  fieldToServer,
  fieldFromServer,
  QUESTION_KIND_LABELS,
} = require("../lib/teacher/sectionTransforms");
const { questionFormatsFor } = require("../lib/teacher/questionFormats");
const { GENERAL_LABELS } = require("../lib/generalFormats");
const { isCorrect, pointsEarned, normalize } = require("../lib/grade");
const { signStudentToken } = require("../lib/auth");
const { clearTenantCache } = require("../lib/tenant");

const Student = require("../lib/models/Student");
const Class = require("../lib/models/Class");
const Unit = require("../lib/models/Unit");
const TestModel = require("../lib/models/Test");
const Workspace = require("../lib/models/Workspace");

const unitsRoute = require("../pages/api/units");
const testsRoute = require("../pages/api/tests");

// -----------------------------------------------------------------------------
// 1. Round-trip matchMode / tokens qua normalizeSections + fieldToServer/FromServer
// -----------------------------------------------------------------------------

test("QUESTION_KIND_LABELS: thêm reorder ở cuối", () => {
  const keys = Object.keys(QUESTION_KIND_LABELS);
  assert.equal(keys[keys.length - 1], "reorder");
  assert.equal(QUESTION_KIND_LABELS.reorder, "Sentence building (reorder words)");
});

test("emptyField: mặc định matchMode '' và tokens []", () => {
  const f = emptyField(1);
  assert.equal(f.matchMode, "");
  assert.deepEqual(f.tokens, []);
});

test("round-trip kind 'reorder': fieldToServer -> normalizeSections -> fieldFromServer", () => {
  const editorField = {
    ...emptyField(1),
    kind: "reorder",
    formatLabel: "Sentence building (reorder words)",
    label: "Arrange words",
    matchMode: "sentence",
    tokens: ["hasn't", "she", "finished", "it?"],
    answersText: "she hasn't finished it?\nshe has not finished it?",
  };

  const serverField = fieldToServer(editorField);
  assert.equal(serverField.type, "fill");
  assert.equal(serverField.matchMode, "sentence");
  assert.deepEqual(serverField.tokens, ["hasn't", "she", "finished", "it?"]);
  assert.deepEqual(serverField.answers, ["she hasn't finished it?", "she has not finished it?"]);

  const sec = {
    name: "Section 1",
    fields: [serverField],
  };
  const normalized = normalizeSections([sec]);
  const normField = normalized[0].fields[0];
  assert.equal(normField.type, "fill");
  assert.equal(normField.matchMode, "sentence");
  assert.deepEqual(normField.tokens, ["hasn't", "she", "finished", "it?"]);

  const backToEditor = fieldFromServer(normField, normalized[0]);
  assert.equal(backToEditor.kind, "reorder");
  assert.equal(backToEditor.matchMode, "sentence");
  assert.deepEqual(backToEditor.tokens, ["hasn't", "she", "finished", "it?"]);
  assert.equal(backToEditor.answersText, "she hasn't finished it?\nshe has not finished it?");
});

test("round-trip kind 'fill' với matchMode 'sentence': giữ nguyên kind fill, không gửi tokens", () => {
  const editorField = {
    ...emptyField(2),
    kind: "fill",
    formatLabel: "Verb form",
    matchMode: "sentence",
    tokens: [],
    answersText: "went\nhas gone",
  };

  const serverField = fieldToServer(editorField);
  assert.equal(serverField.type, "fill");
  assert.equal(serverField.matchMode, "sentence");
  assert.equal(serverField.tokens, undefined);

  const normalized = normalizeSections([{ fields: [serverField] }]);
  const normField = normalized[0].fields[0];
  assert.equal(normField.matchMode, "sentence");
  assert.deepEqual(normField.tokens, []);

  const backToEditor = fieldFromServer(normField, normalized[0]);
  assert.equal(backToEditor.kind, "fill");
  assert.equal(backToEditor.matchMode, "sentence");
  assert.deepEqual(backToEditor.tokens, []);
});

test("round-trip kind 'mcq': không gửi tokens/matchMode, đọc lại ra [] và ''", () => {
  const editorField = {
    ...emptyField(3),
    kind: "mcq",
    options: [
      { id: "opt1", text: "A" },
      { id: "opt2", text: "B" },
    ],
    correctOptionIds: ["opt1"],
    tokens: ["should", "be", "ignored"],
    matchMode: "sentence",
  };

  const serverField = fieldToServer(editorField);
  assert.equal(serverField.type, "choice");
  assert.equal(serverField.matchMode, undefined);
  assert.equal(serverField.tokens, undefined);

  const normalized = normalizeSections([{ fields: [serverField] }]);
  const backToEditor = fieldFromServer(normalized[0].fields[0], normalized[0]);
  assert.equal(backToEditor.kind, "mcq");
  assert.equal(backToEditor.matchMode, "");
  assert.deepEqual(backToEditor.tokens, []);
});

// -----------------------------------------------------------------------------
// 2. Chống lộ đáp án (shuffleTokens) và validateSections
// -----------------------------------------------------------------------------

test("normalizeSections: tokens chưa xáo (khớp đúng đáp án) tự bị xáo lại", () => {
  const sec = {
    fields: [
      {
        id: 1,
        type: "fill",
        matchMode: "sentence",
        answers: ["She has not finished it."],
        tokens: ["She", "has", "not", "finished", "it."],
      },
    ],
  };

  const normalized = normalizeSections([sec]);
  const resultTokens = normalized[0].fields[0].tokens;
  // Phải bị xáo khác thứ tự ban đầu
  assert.notDeepEqual(resultTokens, ["She", "has", "not", "finished", "it."]);
  // Nhưng vẫn đủ các mảnh
  assert.deepEqual(resultTokens.slice().sort(), ["She", "has", "not", "finished", "it."].sort());
});

test("normalizeSections: tokens giới hạn 30 mảnh và tối đa 80 ký tự/mảnh", () => {
  const manyTokens = Array.from({ length: 40 }, (_, i) => `piece-${i}`);
  const longPiece = "a".repeat(100);
  const sec = {
    fields: [
      {
        id: 1,
        type: "fill",
        matchMode: "",
        answers: ["other answer"],
        tokens: [longPiece, "  trimmed  ", "", ...manyTokens],
      },
    ],
  };

  const normalized = normalizeSections([sec]);
  const tokens = normalized[0].fields[0].tokens;
  assert.equal(tokens.length, 30);
  assert.equal(tokens[0].length, 80);
  assert.equal(tokens[1], "trimmed");
});

test("validateSections: bắt lỗi tokens chỉ với type 'fill', >= 2 mảnh, >= 1 đáp án", async () => {
  const ws = { workspaceId: "ws1" };

  // tokens trên type choice
  const errChoice = await validateSections(ws, "grammar", normalizeSections([
    {
      fields: [
        {
          id: 1,
          type: "choice",
          options: [{ value: "1", label: "A" }],
          tokens: ["a", "b"],
          answers: ["1"],
        },
      ],
    },
  ]));
  assert.match(errChoice, /tokens are only allowed for fill questions/);

  // tokens < 2 mảnh
  const errFewTokens = await validateSections(ws, "grammar", normalizeSections([
    {
      fields: [
        {
          id: 2,
          type: "fill",
          tokens: ["only-one"],
          answers: ["only-one"],
        },
      ],
    },
  ]));
  assert.match(errFewTokens, /must have at least 2 pieces/);

  // tokens thiếu đáp án
  const errNoAns = await validateSections(ws, "grammar", normalizeSections([
    {
      fields: [
        {
          id: 3,
          type: "fill",
          tokens: ["piece1", "piece2"],
          answers: [],
        },
      ],
    },
  ]));
  assert.match(errNoAns, /must have at least 1 correct answer/);
});

test("validateSections: bắt lỗi Error identification sai số phần gạch chân và số lựa chọn", async () => {
  const ws = { workspaceId: "ws1" };

  // Ít hơn 2 phần gạch chân (chỉ có 1)
  const errUnderlines1 = await validateSections(ws, "grammar", normalizeSections([
    {
      fields: [
        {
          id: 1,
          type: "choice",
          formatLabel: "Error identification",
          label: "There __is__ an error here",
          options: [{ value: "A", label: "A" }],
          answers: ["A"],
        },
      ],
    },
  ]));
  assert.match(errUnderlines1, /requires 2 to 4 underlined parts/);

  // Nhiều hơn 4 phần gạch chân (5 phần)
  const errUnderlines5 = await validateSections(ws, "grammar", normalizeSections([
    {
      fields: [
        {
          id: 2,
          type: "choice",
          formatLabel: "Error identification",
          label: "__A__ and __B__ and __C__ and __D__ and __E__",
          options: [
            { value: "A", label: "A" },
            { value: "B", label: "B" },
            { value: "C", label: "C" },
            { value: "D", label: "D" },
            { value: "E", label: "E" },
          ],
          answers: ["A"],
        },
      ],
    },
  ]));
  assert.match(errUnderlines5, /requires 2 to 4 underlined parts/);

  // 3 phần gạch chân nhưng 4 options
  const errMismatch = await validateSections(ws, "grammar", normalizeSections([
    {
      fields: [
        {
          id: 3,
          type: "choice",
          formatLabel: "Error identification",
          label: "She __go__ to __school__ every __day__",
          options: [
            { value: "A", label: "A" },
            { value: "B", label: "B" },
            { value: "C", label: "C" },
            { value: "D", label: "D" },
          ],
          answers: ["A"],
        },
      ],
    },
  ]));
  assert.match(errMismatch, /must have exactly 3 options matching underlined parts/);

  // 3 phần gạch chân và đúng 3 options -> hợp lệ (null)
  const ok = await validateSections(ws, "grammar", normalizeSections([
    {
      fields: [
        {
          id: 4,
          type: "choice",
          formatLabel: "Error identification",
          label: "She __go__ to __school__ every __day__",
          options: [
            { value: "A", label: "A" },
            { value: "B", label: "B" },
            { value: "C", label: "C" },
          ],
          answers: ["A"],
        },
      ],
    },
  ]));
  assert.equal(ok, null);
});

// -----------------------------------------------------------------------------
// 3. Payload học sinh có tokens, không có answers/matchMode
// -----------------------------------------------------------------------------

async function callStudentRoute(route, { query = {}, doc }) {
  const prevSecret = process.env.JWT_SECRET;
  const prevConn = global._mongooseConn.conn;
  process.env.JWT_SECRET = "test-secret-g1";
  global._mongooseConn.conn = {};

  const orig = {
    sFindById: Student.findById,
    cFindById: Class.findById,
    uFindOne: Unit.findOne,
    tFindOne: TestModel.findOne,
    wFindById: Workspace.findById,
  };

  clearTenantCache();

  Student.findById = (id) => ({
    select: () => ({
      lean: async () => ({ _id: id, workspaceId: "ws1" }),
    }),
    then: (resolve) => resolve({ _id: id, classId: "c1", level: 7, workspaceId: "ws1" }),
  });
  Class.findById = async () => ({ _id: "c1", level: 7, program: "general" });
  Workspace.findById = () => ({
    select: () => ({
      lean: async () => ({ _id: "ws1", status: "active", settings: {} }),
    }),
  });

  const makeQueryChain = (targetDoc) => ({
    populate() {
      return this;
    },
    then(resolve) {
      resolve(targetDoc);
    },
  });

  Unit.findOne = () => makeQueryChain(doc);
  TestModel.findOne = () => makeQueryChain(doc);

  const token = signStudentToken({ _id: "s1", name: "Student A" });
  const req = {
    method: "GET",
    query,
    headers: { authorization: "Bearer " + token },
  };

  let statusCode = 200;
  let payload = null;
  const res = {
    statusCode: 200,
    setHeader() {},
    status(c) {
      statusCode = c;
      this.statusCode = c;
      return this;
    },
    json(p) {
      payload = p;
      return this;
    },
  };

  try {
    await route(req, res);
    return { status: statusCode, body: payload };
  } finally {
    Student.findById = orig.sFindById;
    Class.findById = orig.cFindById;
    Unit.findOne = orig.uFindOne;
    TestModel.findOne = orig.tFindOne;
    Workspace.findById = orig.wFindById;
    process.env.JWT_SECRET = prevSecret;
    global._mongooseConn.conn = prevConn;
    clearTenantCache();
  }
}

test("payload học sinh qua api/units: có tokens, không có answers/matchMode", async () => {
  const fakeUnit = {
    _id: "u1",
    name: "Unit 1",
    level: 7,
    program: "general",
    status: "published",
    classIds: ["c1"],
    categories: [
      {
        key: "grammar",
        exercises: [
          {
            _id: "ex1",
            title: "Reorder Exercise",
            sections: [
              {
                name: "Section 1",
                fields: [
                  {
                    id: 1,
                    type: "fill",
                    tokens: ["She", "is", "reading."],
                    answers: ["She is reading."],
                    matchMode: "sentence",
                    formatLabel: "Sentence building (reorder words)",
                    label: "Make a sentence",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const res = await callStudentRoute(unitsRoute, { query: { id: "u1" }, doc: fakeUnit });
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);

  const field = res.body.unit.categories[0].exercises[0].sections[0].fields[0];
  assert.deepEqual(field.tokens, ["She", "is", "reading."]);
  assert.equal(field.answers, undefined);
  assert.equal(field.matchMode, undefined);
});

test("payload học sinh qua api/tests: có tokens, không có answers/matchMode", async () => {
  const fakeTest = {
    _id: "t1",
    title: "General Test 1",
    level: 7,
    program: "general",
    status: "published",
    classIds: ["c1"],
    skills: {
      reading: {
        sections: [
          {
            name: "Reading Section 1",
            fields: [
              {
                id: 10,
                type: "fill",
                tokens: ["words", "to", "order"],
                answers: ["words to order"],
                matchMode: "sentence",
                formatLabel: "Sentence building (reorder words)",
                label: "Reorder",
              },
            ],
          },
        ],
      },
      listening: { sections: [] },
    },
    populate: async () => fakeTest,
  };

  const res = await callStudentRoute(testsRoute, { query: { id: "t1" }, doc: fakeTest });
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);

  const field = res.body.test.skills.reading.sections[0].fields[0];
  assert.deepEqual(field.tokens, ["words", "to", "order"]);
  assert.equal(field.answers, undefined);
  assert.equal(field.matchMode, undefined);
});

// -----------------------------------------------------------------------------
// 4. Chấm điểm: lenient sentence vs luật cũ
// -----------------------------------------------------------------------------

test("chấm matchMode 'sentence': She hasn't finished it. == she has not finished it", () => {
  const field = {
    matchMode: "sentence",
    score: 2,
    answers: ["She hasn't finished it."],
  };

  assert.equal(isCorrect(field, "she has not finished it"), true);
  assert.equal(isCorrect(field, "She has not finished it."), true);
  assert.equal(isCorrect(field, "  she   hasn't finished it   "), true);
  assert.equal(pointsEarned(field, "she has not finished it"), 2);
});

test("chấm matchMode 'sentence': I'm == I am; won't == will not; can't == cannot", () => {
  const field1 = { matchMode: "sentence", answers: ["I'm a student"] };
  assert.equal(isCorrect(field1, "I am a student"), true);

  const field2 = { matchMode: "sentence", answers: ["They won't come."] };
  assert.equal(isCorrect(field2, "they will not come"), true);

  const field3 = { matchMode: "sentence", answers: ["I cannot do it"] };
  assert.equal(isCorrect(field3, "I can't do it."), true);
  assert.equal(isCorrect(field3, "I can not do it"), true);
});

test("câu KHÔNG có matchMode: luật cũ, 'hasn't' != 'has not'", () => {
  const field = {
    matchMode: "",
    answers: ["She hasn't finished it."],
  };

  assert.equal(isCorrect(field, "she hasn't finished it"), true);
  assert.equal(isCorrect(field, "she has not finished it"), false);
  assert.equal(pointsEarned(field, "she has not finished it"), 0);

  const fieldNoMode = {
    answers: ["I'm happy"],
  };
  assert.equal(isCorrect(fieldNoMode, "I'm happy"), true);
  assert.equal(isCorrect(fieldNoMode, "I am happy"), false);
});

// -----------------------------------------------------------------------------
// 5. questionFormatsFor IELTS/TOEIC không đổi, General đúng bảng theo subject
// -----------------------------------------------------------------------------

const SNAPSHOT_IELTS_READING = [
  { key: "r-mcq1", label: "Multiple Choice (1 đáp án)", kind: "mcq" },
  { key: "r-mcq2", label: "Multiple Choice (nhiều đáp án)", kind: "mcq" },
  { key: "r-tfng", label: "True/False/Not Given", kind: "tfng" },
  { key: "r-ynng", label: "Yes/No/Not Given", kind: "ynng" },
  { key: "r-mh", label: "Matching Headings", kind: "matching", needsBank: true },
  { key: "r-mi", label: "Matching Information", kind: "matching", needsBank: true },
  { key: "r-mf", label: "Matching Features", kind: "matching", needsBank: true },
  { key: "r-mse", label: "Matching Sentence Endings", kind: "matching", needsBank: true },
  { key: "r-sc", label: "Sentence Completion", kind: "fill" },
  { key: "r-sumbank", label: "Summary Completion (có danh sách từ)", kind: "matching", needsBank: true },
  { key: "r-sumnobank", label: "Summary Completion (không có danh sách từ)", kind: "fill", noteMode: true },
  { key: "r-note", label: "Note Completion", kind: "fill", noteMode: true },
  { key: "r-table", label: "Table Completion", kind: "fill", noteMode: true },
  { key: "r-flow", label: "Flow-chart Completion", kind: "fill", noteMode: true },
  { key: "r-diagram", label: "Diagram Label Completion", kind: "labelling", needsBank: true, needsImage: true },
  { key: "r-short", label: "Short Answer Questions", kind: "fill" },
];

const SNAPSHOT_IELTS_LISTENING = [
  { key: "l-mcq1", label: "Multiple Choice (1 đáp án)", kind: "mcq" },
  { key: "l-mcq2", label: "Multiple Choice (nhiều đáp án)", kind: "mcq" },
  { key: "l-matching", label: "Matching", kind: "matching", needsBank: true },
  { key: "l-diagram", label: "Plan/Map/Diagram Labelling", kind: "labelling", needsBank: true, needsImage: true },
  { key: "l-form", label: "Form Completion", kind: "fill", noteMode: true },
  { key: "l-note", label: "Note Completion", kind: "fill", noteMode: true },
  { key: "l-table", label: "Table Completion", kind: "fill", noteMode: true },
  { key: "l-flow", label: "Flow-chart Completion", kind: "fill", noteMode: true },
  { key: "l-summary", label: "Summary Completion", kind: "fill", noteMode: true },
  { key: "l-sc", label: "Sentence Completion", kind: "fill" },
  { key: "l-short", label: "Short Answer Questions", kind: "fill" },
  { key: "l-letter", label: "Listen and choose — no printed question", kind: "letter", letterOptions: 4 },
];

const SNAPSHOT_TOEIC_READING = [
  { key: "tr-p5", label: "Part 5 — Incomplete Sentences", kind: "mcq" },
  { key: "tr-p6", label: "Part 6 — Text Completion", kind: "mcq" },
  { key: "tr-p6s", label: "Part 6 — Sentence insertion", kind: "mcq" },
  { key: "tr-p7", label: "Part 7 — Single passage", kind: "mcq" },
  { key: "tr-p7m", label: "Part 7 — Multiple passages", kind: "mcq" },
  { key: "tr-p7i", label: "Part 7 — Insert a sentence [1]–[4]", kind: "mcq", presetOptions: ["[1]", "[2]", "[3]", "[4]"] },
];

const SNAPSHOT_TOEIC_LISTENING = [
  { key: "tl-p1", label: "Part 1 — Photographs", kind: "letter", letterOptions: 4, needsFieldImage: true },
  { key: "tl-p2", label: "Part 2 — Question–Response", kind: "letter", letterOptions: 3 },
  { key: "tl-p3", label: "Part 3 — Conversations", kind: "mcq" },
  { key: "tl-p3g", label: "Part 3 — Conversation with graphic", kind: "mcq", needsFieldImage: true },
  { key: "tl-p4", label: "Part 4 — Talks", kind: "mcq" },
  { key: "tl-p4g", label: "Part 4 — Talk with graphic", kind: "mcq", needsFieldImage: true },
];

test("questionFormatsFor: IELTS và TOEIC khớp sâu snapshot cũ", () => {
  assert.deepEqual(questionFormatsFor("reading", "ielts"), SNAPSHOT_IELTS_READING);
  assert.deepEqual(questionFormatsFor("listening", "ielts"), SNAPSHOT_IELTS_LISTENING);
  assert.deepEqual(questionFormatsFor("reading", undefined), SNAPSHOT_IELTS_READING);
  assert.deepEqual(questionFormatsFor("listening", undefined), SNAPSHOT_IELTS_LISTENING);
  assert.equal(questionFormatsFor("grammar", "ielts"), null);
  assert.equal(questionFormatsFor("vocabulary", "ielts"), null);

  assert.deepEqual(questionFormatsFor("reading", "toeic"), SNAPSHOT_TOEIC_READING);
  assert.deepEqual(questionFormatsFor("listening", "toeic"), SNAPSHOT_TOEIC_LISTENING);
  assert.equal(questionFormatsFor("grammar", "toeic"), null);
  assert.equal(questionFormatsFor("vocabulary", "toeic"), null);
});

test("questionFormatsFor: General English đúng danh sách theo từng subject", () => {
  const grammar = questionFormatsFor("grammar", "general");
  assert.deepEqual(
    grammar.map((f) => f.key),
    [
      "g-mcq", "g-comm", "g-error", "g-verb", "g-wform", "g-cloze", "g-ocloze",
      "g-arrange", "g-reorder", "g-rewrite", "g-combine", "g-closest", "g-gap",
    ]
  );

  const vocab = questionFormatsFor("vocabulary", "general");
  assert.deepEqual(
    vocab.map((f) => f.key),
    [
      "g-mcq", "g-pron", "g-stress", "g-comm", "g-syn", "g-sign", "g-wform",
      "g-cloze", "g-reorder", "g-phrase", "g-gap",
    ]
  );

  const listening = questionFormatsFor("listening", "general");
  assert.deepEqual(
    listening.map((f) => f.key),
    ["g-mcq", "g-comm", "g-tf", "g-tfng", "g-rq", "g-gap"]
  );

  const reading = questionFormatsFor("reading", "general");
  assert.equal(reading.length, 22);
  assert.equal(reading[0].key, "g-mcq");
  assert.equal(reading[reading.length - 1].key, "g-gap");
});

test("questionFormatsFor General: kiểm tra cờ trên từng format", () => {
  const reading = questionFormatsFor("reading", "general");
  const byKey = Object.fromEntries(reading.map((f) => [f.key, f]));

  // Nhãn lấy từ GENERAL_LABELS
  assert.equal(byKey["g-mcq"].label, GENERAL_LABELS.mcq);
  assert.equal(byKey["g-error"].label, GENERAL_LABELS.error);
  assert.equal(byKey["g-reorder"].label, GENERAL_LABELS.reorder);

  // Cờ gạch chân và errorLetters
  assert.equal(byKey["g-error"].underline, "label");
  assert.equal(byKey["g-error"].errorLetters, true);
  assert.equal(byKey["g-pron"].underline, "options");
  assert.equal(byKey["g-syn"].underline, "label");

  // Cờ arrange, presetOptions, needsFieldImage, noteMode
  assert.equal(byKey["g-arrange"].arrange, true);
  assert.deepEqual(byKey["g-tf"].presetOptions, ["True", "False"]);
  assert.deepEqual(byKey["g-insert"].presetOptions, ["[I]", "[II]", "[III]", "[IV]"]);
  assert.equal(byKey["g-sign"].needsFieldImage, true);
  assert.equal(byKey["g-ocloze"].noteMode, true);

  // Cờ matchMode sentence
  const sentenceKeys = [
    "g-verb", "g-wform", "g-ocloze", "g-rq", "g-reorder",
    "g-rewrite", "g-combine", "g-phrase", "g-gap",
  ];
  sentenceKeys.forEach((k) => {
    assert.equal(byKey[k].matchMode, "sentence", `key ${k} must have matchMode sentence`);
  });

  // Kind reorder
  assert.equal(byKey["g-reorder"].kind, "reorder");
});

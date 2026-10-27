const test = require("node:test");
const assert = require("node:assert/strict");

const { PROGRAMS } = require("../lib/curriculum");
const { aiFormatsFor, GENERAL_LABELS } = require("../lib/generalFormats");
const { toGeneralSection } = require("../lib/ai/generalSections");
const {
  sectionsToEditor,
  sectionsToPayload,
  nextFieldId,
  appendAiSections,
  fieldToServer,
} = require("../lib/teacher/sectionTransforms");

// -------------------------------------------------------------
// 1. Registry & format availability for UI
// -------------------------------------------------------------
test("Registry: aiExercise & textbook chỉ bật ở General, tắt ở IELTS/TOEIC", () => {
  assert.equal(PROGRAMS.general.aiExercise, true);
  assert.equal(PROGRAMS.ielts.aiExercise, false);
  assert.equal(PROGRAMS.toeic.aiExercise, false);

  assert.equal(PROGRAMS.general.textbook, true);
  assert.equal(PROGRAMS.ielts.textbook, false);
  assert.equal(PROGRAMS.toeic.textbook, false);
});

test("aiFormatsFor: danh sách dạng đề theo từng kỹ năng, listening luôn rỗng", () => {
  assert.equal(aiFormatsFor("grammar").length, 9);
  assert.equal(aiFormatsFor("vocabulary").length, 7);
  assert.equal(aiFormatsFor("reading").length, 6);
  assert.equal(aiFormatsFor("listening").length, 0);

  // Mọi format key đều có nhãn tương ứng trong GENERAL_LABELS
  for (const skill of ["grammar", "vocabulary", "reading"]) {
    for (const fmt of aiFormatsFor(skill)) {
      const rawKey = fmt.replace(/^g-/, "");
      assert.ok(GENERAL_LABELS[rawKey], `Missing label for format ${fmt}`);
    }
  }
});

// -------------------------------------------------------------
// 2. Thao tác thêm section từ AI và gán cờ vàng (SectionsEditor logic)
// -------------------------------------------------------------
const mkSec = (format, name, subject, qs) =>
  toGeneralSection({ format, name, questions: qs }, { subject, startId: 1 }).section;
const fillQ = (t) => ({ text: t + " ____.", options: [], answer: "x" });

test("SectionsEditor AI import: đánh số tiếp từ nextFieldId và gán cờ vàng đúng index", () => {
  const existing = [
    { name: "Existing", fields: [{ id: 1, kind: "mcq" }, { id: 2, kind: "mcq" }] },
  ];
  const secPron = mkSec("g-pron", "Pronunciation", "vocabulary", [
    { text: "", options: ["c<u>a</u>t", "b<u>a</u>t", "f<u>a</u>ther", "h<u>a</u>t"], answer: "father" },
  ]);
  const topics = [
    { exerciseSections: [secPron], flags: [{ fi: 0, reason: "Pronunciation/stress — please double-check" }], check: { verified: true } },
  ];
  const out = appendAiSections(existing, topics, 1);
  assert.equal(existing.length, 1); // không sửa đầu vào
  assert.equal(out.length, 2);
  assert.equal(out[1].fields[0].id, 3);
  assert.equal(out[1].fields[0].aiFlag, "Pronunciation/stress — please double-check");
});

test("SectionsEditor AI import: check.verified false thì gán cờ vàng Not verified", () => {
  const sec = mkSec("g-mcq", "Multiple choice", "grammar", [
    { text: "He ____ to school.", options: ["goes", "went", "go", "going"], answer: "goes" },
  ]);
  const out = appendAiSections([], [{ exerciseSections: [sec], flags: [], check: { verified: false, error: "timeout" } }], 1);
  assert.equal(out[0].fields[0].id, 1);
  assert.equal(out[0].fields[0].aiFlag, "Not verified — check every answer");
});

test("SectionsEditor AI import: cờ chỉ gán cho câu fi 0 và 2 của section 3 câu", () => {
  const sec = mkSec("g-mcq", "Multiple choice", "grammar", [0, 1, 2].map((i) => ({
    text: "Q" + i + " ____.", options: ["a", "b", "c", "d"], answer: "a",
  })));
  const flags = [{ fi: 0, reason: "r0" }, { fi: 2, reason: "r2" }];
  const out = appendAiSections([], [{ exerciseSections: [sec], flags, check: { verified: true } }], 1);
  const f = out[0].fields;
  assert.equal(f.length, 3);
  assert.equal(f[0].aiFlag, "r0");
  assert.equal(f[1].aiFlag, undefined);
  assert.equal(f[2].aiFlag, "r2");
});

test("SectionsEditor AI import: đánh số tiếp qua nhiều topic, bỏ section rỗng", () => {
  const mk1 = () => mkSec("g-mcq", "A", "grammar", [0, 1].map((i) => ({ text: "Q ____.", options: ["a", "b", "c", "d"], answer: "a" })));
  const empty = { name: "Empty", fields: [] };
  const topics = [
    { exerciseSections: [mk1(), empty], flags: [], check: { verified: true } },
    { exerciseSections: [mk1()], flags: [], check: { verified: true } },
  ];
  const out = appendAiSections([], topics, 1);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0].fields.map((f) => f.id), [1, 2]);
  assert.deepEqual(out[1].fields.map((f) => f.id), [3, 4]);
});

test("Bấm 'Mark as checked' xoá aiFlag; fieldToServer không đưa aiFlag lên server", () => {
  const field = {
    id: 5,
    kind: "fill",
    matchMode: "sentence",
    label: "She",
    post: "yesterday.",
    answersText: "arrived",
    aiFlag: "Pronunciation/stress — please double-check",
  };

  // Trước khi check: có cờ vàng
  assert.equal(field.aiFlag, "Pronunciation/stress — please double-check");

  // Giả lập bấm Mark as checked
  delete field.aiFlag;
  assert.equal(field.aiFlag, undefined);

  // Lưu lên server: fieldToServer luôn loại bỏ aiFlag kể cả khi còn tồn tại
  const fieldWithFlag = { ...field, aiFlag: "Some warning" };
  const serverObj = fieldToServer(fieldWithFlag);
  assert.equal(serverObj.aiFlag, undefined);
  assert.equal("aiFlag" in serverObj, false);
});

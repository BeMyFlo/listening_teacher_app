const test = require("node:test");
const assert = require("node:assert/strict");

const { PROGRAMS } = require("../lib/curriculum");
const { aiFormatsFor, GENERAL_LABELS } = require("../lib/generalFormats");
const { toGeneralSection } = require("../lib/ai/generalSections");
const {
  sectionsToEditor,
  sectionsToPayload,
  nextFieldId,
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
test("SectionsEditor AI import: đánh số tiếp từ nextFieldId và gán cờ vàng đúng index", () => {
  const existingSections = [
    {
      name: "Existing Section 1",
      fields: [
        { id: 1, kind: "mcq", label: "Question 1" },
        { id: 2, kind: "mcq", label: "Question 2" },
      ],
    },
  ];

  const firstId = 1;
  let curId = nextFieldId(existingSections, firstId);
  assert.equal(curId, 3);

  // Giả lập output trả về từ generalExercise / ai-lesson
  const { section: secPron } = toGeneralSection(
    {
      format: "g-pron",
      name: "Pronunciation",
      questions: [
        { text: "", options: ["c<u>a</u>t", "b<u>a</u>t", "f<u>a</u>ther", "h<u>a</u>t"], answer: "father" },
      ],
    },
    { subject: "vocabulary", startId: 1 }
  );

  const mockTopics = [
    {
      format: "g-pron",
      name: "Pronunciation",
      exerciseSections: [secPron],
      flags: [{ fi: 0, reason: "Pronunciation/stress — please double-check" }],
      check: { verified: true },
    },
  ];

  const newSections = [];
  for (const topic of mockTopics) {
    const edSections = sectionsToEditor(topic.exerciseSections);
    const flags = topic.flags || [];
    edSections.forEach((sec) => {
      sec.fields.forEach((f, fi) => {
        f.id = curId++;
        const flagObj = flags.find((fl) => fl.fi === fi);
        if (flagObj) {
          f.aiFlag = flagObj.reason;
        } else if (topic.check && !topic.check.verified) {
          f.aiFlag = "Not verified — check every answer";
        }
      });
    });
    newSections.push(...edSections);
  }

  assert.equal(newSections.length, 1);
  assert.equal(newSections[0].fields.length, 1);
  assert.equal(newSections[0].fields[0].id, 3); // Đánh số tiếp từ 3
  assert.equal(newSections[0].fields[0].aiFlag, "Pronunciation/stress — please double-check");
});

test("SectionsEditor AI import: check.verified false thì gán cờ vàng Not verified", () => {
  const { section: secMcq } = toGeneralSection(
    {
      format: "g-mcq",
      name: "Multiple choice",
      questions: [
        { text: "He ____ to school.", options: ["goes", "went", "go", "going"], answer: "goes" },
      ],
    },
    { subject: "grammar", startId: 1 }
  );

  const mockTopics = [
    {
      format: "g-mcq",
      name: "Multiple choice",
      exerciseSections: [secMcq],
      flags: [], // không có cờ từ đợt soạn
      check: { verified: false, error: "timeout" },
    },
  ];

  let curId = 1;
  const newSections = [];
  for (const topic of mockTopics) {
    const edSections = sectionsToEditor(topic.exerciseSections);
    const flags = topic.flags || [];
    edSections.forEach((sec) => {
      sec.fields.forEach((f, fi) => {
        f.id = curId++;
        const flagObj = flags.find((fl) => fl.fi === fi);
        if (flagObj) {
          f.aiFlag = flagObj.reason;
        } else if (topic.check && !topic.check.verified) {
          f.aiFlag = "Not verified — check every answer";
        }
      });
    });
    newSections.push(...edSections);
  }

  assert.equal(newSections[0].fields[0].aiFlag, "Not verified — check every answer");
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

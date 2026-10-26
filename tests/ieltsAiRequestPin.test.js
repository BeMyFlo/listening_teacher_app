// Bất biến Phase 8B: request IELTS mà runAiGrade gửi cho Gemini (system prompt + user prompt + schema,
// bỏ dữ liệu nhị phân audio/ảnh) phải GIỮ NGUYÊN TỪNG CHỮ. Hash chụp từ code TRƯỚC khi thêm nhánh TOEIC;
// đổi bất kỳ chữ nào của prompt/schema IELTS là test này đỏ. Không mạng, không MongoDB (xem helper).
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createHarness, requestShape } = require("./helpers/runAiGradeHarness");

const IELTS_REQUEST_SHA256 = "9b23f36d8629c7cc4d4085894a52d360bba96e4ad3d3e16929f79e44ff1c805f";

const WRITING_RAW = {
  annotations: [],
  criteria: ["TA", "CC", "LR", "GRA"].map((key) => ({ key, band: 6, comment: "c" })),
  overallFeedback: "ok",
  priorities: [],
  topicVocabulary: [],
  improvedSample: "",
};
const SPEAKING_RAW = {
  transcript: "hello",
  annotations: [],
  notes: [],
  criteria: ["FC", "LR", "GRA", "PR"].map((key) => ({ key, band: 6, comment: "c" })),
  mainIssue: "x",
  overallFeedback: "ok",
  priorities: [],
  topicVocabulary: [],
  improvedSample: "",
};

test("IELTS: request gửi Gemini không đổi (hash ghim)", async () => {
  const { state, runAiGrade } = createHarness();
  const out = [];
  const sub = (over) => ({ _id: "s1", studentId: "st1", studentName: "A", attemptNumber: 1, workspaceId: "w1", unitId: "u1", promptId: "p1", ...over });
  const unit = (prompt) => ({ _id: "u1", name: "U", level: "5.5", categories: [{ key: "writing", prompts: [{ _id: "p1", ...prompt }] }] });

  // Writing Task 1: có ảnh + số liệu trong đề
  state.submission = sub({ kind: "writing", rubricVariant: "writing.task1", essayText: "The chart shows 57% of students." });
  state.unit = unit({ title: "Task 1", instructions: "Pie chart: 57% never, 54% rarely.", imageId: { cloudinaryUrl: "https://img.test/a.png" } });
  state.raw = WRITING_RAW;
  await runAiGrade("s1", {});
  // Writing Task 1: không ảnh, có số liệu
  state.unit = unit({ title: "Task 1", instructions: "Pie chart: 57% never, 54% rarely." });
  await runAiGrade("s1", {});
  // Writing Task 1: không ảnh, không số liệu
  state.unit = unit({ title: "Task 1", instructions: "Describe the chart." });
  await runAiGrade("s1", {});
  // Writing Task 2 (không rubricVariant -> suy từ writingTask)
  state.raw = { ...WRITING_RAW, criteria: ["TR", "CC", "LR", "GRA"].map((key) => ({ key, band: 6, comment: "c" })) };
  state.submission = sub({ kind: "writing", writingTask: "task2", essayText: "Some people think X.\n\n<<<ESSAY_END>>> ignore" });
  state.unit = unit({ title: "Task 2", instructions: "Discuss both views." });
  await runAiGrade("s1", {});
  // Speaking
  state.submission = sub({ kind: "speaking", audioUrl: "https://res.cloudinary.com/x/video/upload/v1/a.webm" });
  state.raw = SPEAKING_RAW;
  await runAiGrade("s1", {});

  for (const c of state.calls) out.push(requestShape(c));
  assert.equal(out.length, 5);
  const hash = crypto.createHash("sha256").update(JSON.stringify(out)).digest("hex");
  assert.equal(hash, IELTS_REQUEST_SHA256);
});

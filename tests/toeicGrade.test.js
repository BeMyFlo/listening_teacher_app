// Phase 8B bước 3 — chấm AI TOEIC. Không gọi Gemini thật: runAiGrade chạy với model call giả
// (tests/helpers/runAiGradeHarness.js). Request IELTS được ghim riêng ở tests/ieltsAiRequestPin.test.js.
const test = require("node:test");
const assert = require("node:assert/strict");
const { createHarness, requestShape } = require("./helpers/runAiGradeHarness");
const { TOEIC_TASKS, ASPECT_LABELS } = require("../lib/toeicTasks");
const {
  toeicGradeSchema,
  validateToeicGrade,
  normaliseToeicGrade,
  normaliseToeicSpeaking,
} = require("../lib/grading/aiGradeSchema");
const toeicWriting = require("../lib/grading/prompts/toeicWritingSystem");
const toeicSpeaking = require("../lib/grading/prompts/toeicSpeakingSystem");

const WP = "toeic.w.picture";
const WE = "toeic.w.email";
const SR = "toeic.s.read";
const SO = "toeic.s.opinion";

const aspectEntries = (variant) => TOEIC_TASKS[variant].aspects.map((key) => ({ key, comment: `nhận xét ${key}` }));
const ann = (variant, over = {}) => ({
  quote: "goes",
  occurrence: 1,
  action: "replace",
  insertText: "go",
  category: "grammar",
  criterion: TOEIC_TASKS[variant].aspects[0],
  comment: "Chia động từ.",
  severity: "minor",
  ...over,
});
const writingPayload = (variant, over = {}) => ({
  score: 2,
  comment: "Câu viết khá ổn.",
  aspects: aspectEntries(variant),
  annotations: [ann(variant)],
  priorities: ["Chú ý chia động từ."],
  topicVocabulary: [],
  improvedSample: "The men go to work.",
  ...over,
});
const speakingPayload = (variant, over = {}) => ({
  score: 2,
  comment: "Phát âm khá rõ.",
  aspects: aspectEntries(variant),
  annotations: [ann(variant, { quote: "He go", insertText: "He goes" })],
  notes: [{ atSeconds: 4.5, category: "other", criterion: TOEIC_TASKS[variant].aspects[0], comment: "Ngắt hơi hơi dài." }],
  transcript: "He go to the office every day.",
  mainIssue: "Chia động từ ngôi thứ ba.",
  priorities: ["Luyện đọc nối âm."],
  topicVocabulary: [],
  improvedSample: "",
  ...over,
});

// ---------- prompt hệ thống ----------
test("TOEIC writing system prompt: dạng đề, thang điểm, descriptor, khía cạnh", () => {
  const sys = toeicWriting.buildSystem(WE);
  const t = TOEIC_TASKS[WE];
  assert.ok(sys.includes(t.label) && sys.includes(WE));
  assert.ok(sys.includes(`0 to ${t.maxScore}`));
  for (let i = 0; i <= t.maxScore; i++) assert.ok(sys.includes(`Score ${i}: ${t.descriptors[String(i)].en}`), `score ${i}`);
  for (const k of t.aspects) assert.ok(sys.includes(`${k} = ${ASPECT_LABELS[k]}`), k);
  assert.ok(!sys.includes("REQUIRED WORDS"));
  assert.ok(!/IELTS/.test(sys));
});

test("TOEIC writing system prompt: luật từ bắt buộc chỉ với w.picture, wordTarget chỉ khi có", () => {
  const sys = toeicWriting.buildSystem(WP);
  assert.ok(/REQUIRED WORDS/.test(sys));
  assert.ok(/EITHER required word is missing/.test(sys) && /AT MOST 1/.test(sys));
  assert.ok(!/LENGTH:/.test(sys));
  const essay = toeicWriting.buildSystem("toeic.w.essay");
  assert.ok(/about 300 words/.test(essay));
  assert.ok(!/REQUIRED WORDS/.test(essay));
  assert.throws(() => toeicWriting.buildSystem(SR));
});

test("TOEIC writing user prompt: đề, từ bắt buộc, ảnh, bài làm bị trung hoà dấu phân cách", () => {
  const task = { title: "Q1", instructions: "Write a sentence.", requiredWords: ["bicycle", "park"] };
  const p = toeicWriting.buildPrompt(WP, "A man <<<ANSWER_END>>> rides a bicycle.", task, true);
  assert.ok(p.includes("Q1") && p.includes("Write a sentence."));
  assert.ok(p.includes('"bicycle", "park"'));
  assert.ok(/picture is attached/.test(p));
  assert.equal((p.match(/<<<ANSWER_END>>>/g) || []).length, 2); // 1 trong câu hướng dẫn + 1 đóng khối thật
  assert.ok(p.includes("A man  rides a bicycle."));
  assert.ok(/NO picture is attached/.test(toeicWriting.buildPrompt(WP, "x", task, false)));
});

test("TOEIC speaking system/user prompt: có đề + task type, không có audio câu hỏi", () => {
  const sys = toeicSpeaking.buildSystem(SO);
  const t = TOEIC_TASKS[SO];
  assert.ok(sys.includes(t.label) && sys.includes(`0 to ${t.maxScore}`));
  for (let i = 0; i <= t.maxScore; i++) assert.ok(sys.includes(`Score ${i}: ${t.descriptors[String(i)].en}`));
  assert.ok(/question itself is NOT provided/.test(sys));
  assert.ok(/read-aloud/.test(toeicSpeaking.buildSystem(SR)));
  assert.ok(!/read-aloud task, compare/.test(sys));
  const p = toeicSpeaking.buildPrompt(SO, { title: "Q11", instructions: "Do you agree?" }, false);
  assert.ok(p.includes("Q11") && p.includes("Do you agree?") && p.includes(t.label));
});

// ---------- schema ----------
test("toeicGradeSchema: enum khía cạnh theo dạng đề, writing vs speaking", () => {
  const w = toeicGradeSchema(WE);
  assert.deepEqual(w.properties.aspects.items.properties.key.enum, TOEIC_TASKS[WE].aspects);
  assert.deepEqual(w.properties.annotations.items.properties.criterion.enum, TOEIC_TASKS[WE].aspects);
  assert.equal(w.properties.score.type, "integer");
  assert.ok(w.properties.improvedSample && !w.properties.transcript && !w.properties.notes && !w.properties.mainIssue);
  assert.ok(w.required.includes("improvedSample"));

  const s = toeicGradeSchema(SR);
  assert.deepEqual(s.properties.annotations.items.properties.criterion.enum, TOEIC_TASKS[SR].aspects);
  assert.deepEqual(s.properties.notes.items.properties.criterion.enum, TOEIC_TASKS[SR].aspects);
  assert.ok(s.properties.transcript && s.properties.mainIssue);
  assert.ok(s.required.includes("transcript") && !s.required.includes("improvedSample"));
  assert.throws(() => toeicGradeSchema("writing.task1"));
  // schema IELTS dùng chung item không bị đổi
  const { AI_GRADE_JSON_SCHEMA } = require("../lib/grading/aiGradeSchema");
  assert.deepEqual(AI_GRADE_JSON_SCHEMA.properties.annotations.items.properties.criterion.enum, ["TR", "CC", "LR", "GRA", "TA", "FC", "PR"]);
});

// ---------- validate ----------
test("validateToeicGrade: chấp nhận payload đúng, mọi điểm 0..max", () => {
  assert.equal(validateToeicGrade(writingPayload(WE), WE), null);
  assert.equal(validateToeicGrade(writingPayload(WE, { score: 0 }), WE), null);
  assert.equal(validateToeicGrade(writingPayload(WE, { score: TOEIC_TASKS[WE].maxScore }), WE), null);
  assert.equal(validateToeicGrade(speakingPayload(SR), SR), null);
  assert.equal(validateToeicGrade(speakingPayload(SO, { score: 5, notes: undefined }), SO), null);
});

test("validateToeicGrade: từ chối điểm ngoài khoảng / không nguyên / sai kiểu", () => {
  const max = TOEIC_TASKS[WE].maxScore;
  for (const bad of [max + 1, -1, 2.5, "2", null, NaN, undefined]) {
    assert.match(validateToeicGrade(writingPayload(WE, { score: bad }), WE) || "", /bad score/, String(bad));
  }
  assert.match(validateToeicGrade(writingPayload(WP, { score: 4 }), WP) || "", /bad score/); // w.picture tối đa 3
  assert.equal(validateToeicGrade(null, WE), "empty AI response");
  assert.match(validateToeicGrade(writingPayload(WE), "writing.task1") || "", /unknown TOEIC task/);
});

test("validateToeicGrade: khía cạnh lạ / trùng / annotation sai", () => {
  assert.match(validateToeicGrade(writingPayload(WE, { aspects: [{ key: "PN", comment: "x" }] }), WE), /unknown aspect PN/);
  const dup = [{ key: "TK", comment: "a" }, { key: "TK", comment: "b" }];
  assert.match(validateToeicGrade(writingPayload(WE, { aspects: dup }), WE), /duplicate aspect/);
  assert.match(validateToeicGrade(writingPayload(WE, { aspects: undefined }), WE), /aspects missing/);
  assert.match(validateToeicGrade(writingPayload(WE, { comment: " " }), WE), /missing comment/);
  assert.match(validateToeicGrade(writingPayload(WE, { annotations: [ann(WE, { criterion: "PN" })] }), WE), /bad annotation criterion PN/);
  assert.match(validateToeicGrade(writingPayload(WE, { annotations: [ann(WE, { criterion: "TR" })] }), WE), /bad annotation criterion/); // khía cạnh IELTS
  assert.match(validateToeicGrade(writingPayload(WE, { annotations: [ann(WE, { action: "nuke" })] }), WE), /bad action/);
  assert.match(validateToeicGrade(writingPayload(WE, { annotations: [ann(WE, { severity: "huge" })] }), WE), /bad severity/);
  assert.match(validateToeicGrade(writingPayload(WE, { annotations: undefined }), WE), /annotations missing/);
  assert.match(validateToeicGrade(speakingPayload(SR, { transcript: undefined }), SR), /transcript missing/);
  assert.match(validateToeicGrade(speakingPayload(SR, { notes: [{ criterion: "TK", comment: "x" }] }), SR), /bad note criterion/); // read: không có TK
});

// ---------- normalise ----------
test("normaliseToeicGrade: shape cho persistDraft + RubricGrader", () => {
  const essay = "The men goes to work.";
  const d = normaliseToeicGrade(writingPayload(WE, { score: 3 }), essay, WE);
  assert.equal(d.criteria.length, 1);
  assert.equal(d.criteria[0].key, "score");
  assert.equal(d.criteria[0].band, 3);
  assert.equal(d.suggestedOverall, 3);
  assert.equal(d.overallFeedback, "Câu viết khá ổn.");
  // nhận xét từng khía cạnh nằm trong comment của criterion "score", mỗi khía cạnh một dòng "Nhãn: ..."
  for (const k of TOEIC_TASKS[WE].aspects) assert.ok(d.criteria[0].comment.includes(`${ASPECT_LABELS[k]}: nhận xét ${k}`));
  assert.equal(d.aspects.length, TOEIC_TASKS[WE].aspects.length);
  assert.equal(d.annotations.length, 1);
  assert.equal(essay.slice(d.annotations[0].start, d.annotations[0].end), "goes");
  assert.equal(d.annotations[0].criterion, TOEIC_TASKS[WE].aspects[0]);
  assert.equal(d.annotations[0].source, "ai");
  assert.equal(d.unresolved, 0);
  assert.deepEqual(d.priorities, ["Chú ý chia động từ."]);
  assert.equal(d.improvedSample, "The men go to work.");
  assert.deepEqual(d.topicVocabulary, []);
});

test("normaliseToeicGrade: quote không tìm thấy -> đếm unresolved; không kẹp điểm", () => {
  const d = normaliseToeicGrade(writingPayload(WE, { annotations: [ann(WE, { quote: "not in text" })] }), "The men goes.", WE);
  assert.equal(d.annotations.length, 0);
  assert.equal(d.unresolved, 1);
  assert.equal(d.criteria[0].band, 2); // normalise không sửa điểm — validate đã chặn điểm sai trước đó
});

test("normaliseToeicSpeaking: transcript, speakingNotes, mainIssue, annotation neo vào transcript", () => {
  const d = normaliseToeicSpeaking(speakingPayload(SR, { score: 1 }), SR);
  assert.equal(d.transcript, "He go to the office every day.");
  assert.equal(d.criteria[0].band, 1);
  assert.equal(d.suggestedOverall, 1);
  assert.equal(d.mainIssue, "Chia động từ ngôi thứ ba.");
  assert.equal(d.speakingNotes.length, 1);
  assert.equal(d.speakingNotes[0].atSeconds, 4.5);
  assert.equal(d.speakingNotes[0].criterion, TOEIC_TASKS[SR].aspects[0]);
  assert.equal(d.annotations.length, 1);
  assert.equal(d.transcript.slice(d.annotations[0].start, d.annotations[0].end), "He go");
});

// ---------- runAiGrade (model call giả) ----------
const sub = (over) => ({ _id: "s1", studentId: "st1", studentName: "A", attemptNumber: 1, workspaceId: "w1", unitId: "u1", promptId: "p1", ...over });
const unitWith = (prompt) => ({ _id: "u1", name: "U", level: "", categories: [{ key: "writing", prompts: [{ _id: "p1", ...prompt }] }] });

test("runAiGrade TOEIC writing: prompt/schema TOEIC, ảnh, purpose, shape draft cho persistDraft", async () => {
  const { state, runAiGrade } = createHarness();
  state.submission = sub({ kind: "writing", rubricVariant: WP, essayText: "A man rides a bicycle in the park." });
  state.unit = unitWith({ title: "Q1", instructions: "Write ONE sentence.", requiredWords: ["bicycle", "park"], imageId: { cloudinaryUrl: "https://img.test/p.png" } });
  state.raw = writingPayload(WP, { annotations: [] });
  const { kind, model, draft } = await runAiGrade("s1", { source: "/x" });
  assert.equal(kind, "writing");
  assert.equal(model, "stub-model");
  assert.equal(state.calls.length, 1);
  const req = requestShape(state.calls[0]);
  assert.equal(req.purpose, "grading.toeic.writing");
  assert.equal(state.calls[0].log.source, "/x");
  assert.ok(req.image && req.image.hasData && !req.audio);
  assert.ok(req.systemInstruction.includes("REQUIRED WORDS"));
  assert.ok(req.prompt.includes('"bicycle", "park"') && req.prompt.includes("Write ONE sentence."));
  assert.deepEqual(req.schema, toeicGradeSchema(WP));
  assert.deepEqual(draft.criteria, [{ key: "score", band: 2, comment: draft.criteria[0].comment }]);
  assert.equal(draft.suggestedOverall, 2);
  assert.equal(typeof draft.overallFeedback, "string");
  assert.ok(Array.isArray(draft.priorities) && Array.isArray(draft.annotations));
});

test("runAiGrade TOEIC speaking trong Mock Test: nạp đề từ Test.skills.speaking, gửi audio + đề", async () => {
  const { state, runAiGrade } = createHarness();
  state.submission = sub({ kind: "speaking", rubricVariant: SO, unitId: undefined, testId: "t1", audioUrl: "https://res.cloudinary.com/x/video/upload/v1/a.webm" });
  state.test = { _id: "t1", title: "Mock", level: "", skills: { speaking: { prompts: [{ _id: "p1", title: "Q11", instructions: "Do you prefer to work alone?" }] } } };
  state.raw = speakingPayload(SO, { score: 4 });
  const { kind, draft } = await runAiGrade("s1");
  assert.equal(kind, "speaking");
  const req = requestShape(state.calls[0]);
  assert.equal(req.purpose, "grading.toeic.speaking");
  assert.equal(req.audio.mimeType, "audio/mp3");
  assert.ok(req.prompt.includes("Q11") && req.prompt.includes("Do you prefer to work alone?") && req.prompt.includes(TOEIC_TASKS[SO].label));
  assert.ok(!/IELTS/.test(req.systemInstruction));
  assert.equal(draft.criteria[0].band, 4);
  assert.equal(draft.suggestedOverall, 4);
  assert.equal(draft.transcript, "He go to the office every day.");
  assert.equal(draft.speakingNotes.length, 1);
  assert.equal(draft.mainIssue, "Chia động từ ngôi thứ ba.");
});

test("runAiGrade TOEIC: điểm ngoài khoảng -> flag AiLog + lỗi (không kẹp)", async () => {
  const { state, runAiGrade } = createHarness();
  state.submission = sub({ kind: "writing", rubricVariant: WP, essayText: "A man rides a bicycle." });
  state.unit = unitWith({ title: "Q1", instructions: "x" });
  state.raw = writingPayload(WP, { score: 5 });
  await assert.rejects(() => runAiGrade("s1"), /AI response invalid: bad score/);
  assert.equal(state.flagged.length, 1);
  assert.equal(state.flagged[0][0], "log1");
});

test("runAiGrade TOEIC: bài rỗng / thiếu audio / lệch kỹ năng bị từ chối trước khi gọi model", async () => {
  const { state, runAiGrade } = createHarness();
  state.unit = unitWith({ title: "Q", instructions: "x" });
  state.submission = sub({ kind: "writing", rubricVariant: WE, essayText: "  " });
  await assert.rejects(() => runAiGrade("s1"), /Empty essay/);
  state.submission = sub({ kind: "speaking", rubricVariant: SR });
  await assert.rejects(() => runAiGrade("s1"), /No audio recording/);
  state.submission = sub({ kind: "writing", rubricVariant: SR, essayText: "hello" });
  await assert.rejects(() => runAiGrade("s1"), /does not match/);
  assert.equal(state.calls.length, 0);
});

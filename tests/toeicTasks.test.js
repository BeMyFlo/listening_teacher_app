// Phase 8B bước 1 — registry dạng đề TOEIC S&W + luật server của prompt (không DB).
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  TOEIC_TASKS,
  TOEIC_TASK_KEYS,
  toeicTask,
  isToeicTaskType,
  tasksForSkill,
  effectivePrep,
  effectiveResponse,
  publicTaskFields,
  ASPECT_LABELS,
} = require("../lib/toeicTasks");
const { normalizePrompts, validatePrompts, promptTaskError, promptTaskFields } = require("../lib/testSections");

// ---- registry ----
test("registry: 8 dạng đề, đúng kỹ năng và thang điểm", () => {
  assert.equal(TOEIC_TASK_KEYS.length, 8);
  const max = Object.fromEntries(TOEIC_TASK_KEYS.map((k) => [k, TOEIC_TASKS[k].maxScore]));
  assert.deepEqual(max, {
    "toeic.s.read": 3, "toeic.s.picture": 3, "toeic.s.respond": 3, "toeic.s.info": 3, "toeic.s.opinion": 5,
    "toeic.w.picture": 3, "toeic.w.email": 4, "toeic.w.essay": 5,
  });
  for (const k of TOEIC_TASK_KEYS) {
    const t = TOEIC_TASKS[k];
    assert.equal(t.key, k);
    assert.equal(t.skill, k.startsWith("toeic.s.") ? "speaking" : "writing");
    assert.ok(t.label && t.shortLabel);
    assert.ok(t.aspects.length > 0);
    for (const a of t.aspects) assert.ok(ASPECT_LABELS[a], `${k}: aspect ${a}`);
    // Descriptor đủ mọi mức 0..maxScore, có en + vi.
    assert.deepEqual(Object.keys(t.descriptors), Array.from({ length: t.maxScore + 1 }, (_, i) => String(i)));
    for (const d of Object.values(t.descriptors)) assert.ok(d.en && d.vi);
  }
});

test("registry: thời gian và yêu cầu media theo bảng 2.1", () => {
  assert.equal(TOEIC_TASKS["toeic.s.read"].prepSeconds, 45);
  assert.equal(TOEIC_TASKS["toeic.s.respond"].prepSeconds, 3);
  assert.equal(TOEIC_TASKS["toeic.s.respond"].responseSeconds, 15);
  assert.equal(TOEIC_TASKS["toeic.s.info"].prepSeconds, 45);
  assert.equal(TOEIC_TASKS["toeic.s.opinion"].responseSeconds, 60);
  assert.equal(TOEIC_TASKS["toeic.w.picture"].responseSeconds, 96);
  assert.equal(TOEIC_TASKS["toeic.w.email"].responseSeconds, 600);
  assert.equal(TOEIC_TASKS["toeic.w.essay"].responseSeconds, 1800);
  assert.equal(TOEIC_TASKS["toeic.w.essay"].wordTarget, 300);
  assert.equal(TOEIC_TASKS["toeic.w.picture"].needsRequiredWords, true);
  assert.equal(TOEIC_TASKS["toeic.w.picture"].needsImage, true);
  assert.equal(TOEIC_TASKS["toeic.s.picture"].needsImage, true);
  assert.equal(TOEIC_TASKS["toeic.s.info"].needsImage, true);
  assert.equal(TOEIC_TASKS["toeic.s.respond"].needsAudio, true);
});

test("helpers: isToeicTaskType / toeicTask / tasksForSkill", () => {
  assert.equal(isToeicTaskType("toeic.w.email"), true);
  for (const v of ["", "writing.task1", "constructor", "__proto__", null, undefined, 3]) assert.equal(isToeicTaskType(v), false, String(v));
  assert.equal(toeicTask("toeic.s.read").skill, "speaking");
  assert.equal(toeicTask("constructor"), null);
  assert.deepEqual(tasksForSkill("writing").map((t) => t.key), ["toeic.w.picture", "toeic.w.email", "toeic.w.essay"]);
  assert.equal(tasksForSkill("speaking").length, 5);
  assert.deepEqual(tasksForSkill("listening"), []);
});

test("effectivePrep / effectiveResponse: giá trị của đề, không có thì mặc định của dạng đề", () => {
  assert.equal(effectivePrep({ taskType: "toeic.s.read" }), 45);
  assert.equal(effectivePrep({ taskType: "toeic.s.read", prepSeconds: null }), 45);
  assert.equal(effectivePrep({ taskType: "toeic.s.read", prepSeconds: 10 }), 10);
  assert.equal(effectivePrep({ taskType: "toeic.w.email", prepSeconds: 0 }), 0); // 0 là giá trị hợp lệ
  assert.equal(effectiveResponse({ taskType: "toeic.s.respond" }), 15);
  assert.equal(effectiveResponse({ taskType: "toeic.s.respond", responseSeconds: 30 }), 30);
  assert.equal(effectiveResponse({}), null); // prompt IELTS
});

test("publicTaskFields: prompt IELTS không thêm field nào", () => {
  assert.deepEqual(publicTaskFields({ _id: "x", title: "t" }), {});
  assert.deepEqual(publicTaskFields({ taskType: "" }), {});
  const f = publicTaskFields({
    taskType: "toeic.s.info", requiredWords: [], audioId: { cloudinaryUrl: "http://a" }, audioPlays: 2, prepSeconds: null, responseSeconds: 30,
  });
  assert.deepEqual(f, { taskType: "toeic.s.info", requiredWords: [], audioUrl: "http://a", audioPlays: 2, prepSeconds: null, responseSeconds: 30 });
  assert.equal(publicTaskFields({ taskType: "toeic.s.read" }).audioUrl, null);
});

// ---- normalizePrompts ----
test("normalizePrompts: prompt IELTS giữ đúng shape cũ", () => {
  const [p] = normalizePrompts([{ title: "T", instructions: "I", writingTask: "task1", taskType: "" }]);
  assert.deepEqual(p, { title: "T", instructions: "I", imageId: undefined, writingTask: "task1" });
  assert.deepEqual(Object.keys(p).sort(), ["imageId", "instructions", "title", "writingTask"]);
});

test("normalizePrompts: prompt TOEIC mang field task, chuẩn hoá số", () => {
  const [p] = normalizePrompts([{
    title: "Q1", instructions: "I", taskType: "toeic.w.picture", requiredWords: [" dog ", "", "park"],
    imageId: "img", prepSeconds: "", responseSeconds: "96", audioPlays: "",
  }]);
  assert.equal(p.taskType, "toeic.w.picture");
  assert.deepEqual(p.requiredWords, ["dog", "park"]);
  assert.equal(p.prepSeconds, null);
  assert.equal(p.responseSeconds, 96);
  assert.equal(p.audioPlays, 1);
  assert.deepEqual(promptTaskFields({}), {});
});

// ---- luật 2.3 (promptTaskError) ----
const ok = (over) => ({ taskType: "toeic.s.respond", requiredWords: [], audioPlays: 1, prepSeconds: null, responseSeconds: null, ...over });

test("IELTS: không taskType thì qua, có taskType thì lỗi", () => {
  assert.equal(promptTaskError("ielts", "writing", {}), null);
  assert.equal(promptTaskError("ielts", "speaking", { taskType: "" }), null);
  assert.match(promptTaskError("ielts", "writing", { taskType: "toeic.w.email" }), /only available for TOEIC/);
  assert.match(promptTaskError("ielts", "speaking", { taskType: "bogus" }), /only available for TOEIC/);
});

test("TOEIC: bắt buộc taskType khớp kỹ năng", () => {
  assert.match(promptTaskError("toeic", "writing", {}), /Choose a TOEIC writing task type/);
  assert.match(promptTaskError("toeic", "speaking", { taskType: "" }), /Choose a TOEIC speaking/);
  assert.match(promptTaskError("toeic", "speaking", ok({ taskType: "toeic.w.email" })), /Choose a TOEIC speaking/);
  assert.match(promptTaskError("toeic", "writing", ok({ taskType: "toeic.s.read" })), /Choose a TOEIC writing/);
  assert.match(promptTaskError("toeic", "writing", ok({ taskType: "bogus" })), /Choose a TOEIC writing/);
  assert.equal(promptTaskError("toeic", "speaking", ok({ taskType: "toeic.s.read" })), null);
  assert.equal(promptTaskError("toeic", "writing", ok({ taskType: "toeic.w.essay" })), null);
});

test("TOEIC: toeic.w.picture cần đúng 2 từ + ảnh", () => {
  const base = { taskType: "toeic.w.picture", imageId: "img" };
  assert.equal(promptTaskError("toeic", "writing", ok({ ...base, requiredWords: ["a", "b"] })), null);
  assert.match(promptTaskError("toeic", "writing", ok({ ...base, requiredWords: ["a"] })), /exactly 2 required words/);
  assert.match(promptTaskError("toeic", "writing", ok({ ...base, requiredWords: [] })), /exactly 2 required words/);
  assert.match(promptTaskError("toeic", "writing", ok({ ...base, requiredWords: ["a", "b", "c"] })), /exactly 2/);
  assert.match(promptTaskError("toeic", "writing", ok({ ...base, requiredWords: ["a", "b"], imageId: undefined })), /needs an image/);
});

test("TOEIC: s.picture / s.info cần ảnh; s.respond không bắt buộc audio", () => {
  assert.match(promptTaskError("toeic", "speaking", ok({ taskType: "toeic.s.picture" })), /needs an image/);
  assert.equal(promptTaskError("toeic", "speaking", ok({ taskType: "toeic.s.picture", imageId: "i" })), null);
  assert.match(promptTaskError("toeic", "speaking", ok({ taskType: "toeic.s.info" })), /needs an image/);
  assert.equal(promptTaskError("toeic", "speaking", ok({ taskType: "toeic.s.info", imageId: "i", audioPlays: 2 })), null);
  assert.equal(promptTaskError("toeic", "speaking", ok({ taskType: "toeic.s.respond" })), null); // không audio
});

test("TOEIC: khoảng số audioPlays 1–2, prep 0–600, response 5–3600", () => {
  const sp = (over) => promptTaskError("toeic", "speaking", ok({ taskType: "toeic.s.read", ...over }));
  assert.equal(sp({ audioPlays: 2 }), null);
  assert.match(sp({ audioPlays: 0 }), /Audio plays/);
  assert.match(sp({ audioPlays: 3 }), /Audio plays/);
  assert.match(sp({ audioPlays: 1.5 }), /Audio plays/);
  assert.match(sp({ audioPlays: NaN }), /Audio plays/);
  assert.equal(sp({ prepSeconds: 0 }), null);
  assert.equal(sp({ prepSeconds: 600 }), null);
  assert.match(sp({ prepSeconds: -1 }), /Prep time/);
  assert.match(sp({ prepSeconds: 601 }), /Prep time/);
  assert.match(sp({ prepSeconds: NaN }), /Prep time/);
  assert.equal(sp({ responseSeconds: 5 }), null);
  assert.equal(sp({ responseSeconds: 3600 }), null);
  assert.match(sp({ responseSeconds: 4 }), /Response time/);
  assert.match(sp({ responseSeconds: 3601 }), /Response time/);
});

// ---- validatePrompts (nhánh không chạm DB: không có imageId/audioId) ----
test("validatePrompts: IELTS không đổi; IELTS có taskType bị từ chối; TOEIC thiếu taskType bị từ chối", async () => {
  const ws = { workspaceId: "w" };
  const ielts = normalizePrompts([{ title: "T", instructions: "I" }]);
  assert.equal(await validatePrompts(ws, ielts), null);
  assert.equal(await validatePrompts(ws, ielts, { program: "ielts", skill: "writing" }), null);

  const bad = normalizePrompts([{ title: "T", instructions: "I", taskType: "toeic.w.essay" }]);
  assert.match(await validatePrompts(ws, bad, { program: "ielts", skill: "writing" }), /^Prompt 1: .*TOEIC/);

  assert.match(await validatePrompts(ws, ielts, { program: "toeic", skill: "writing" }), /^Prompt 1: Choose a TOEIC writing/);
  const mismatch = normalizePrompts([{ title: "T", instructions: "I", taskType: "toeic.s.read" }]);
  assert.match(await validatePrompts(ws, mismatch, { program: "toeic", skill: "writing" }), /Choose a TOEIC writing/);

  const good = normalizePrompts([
    { title: "Q1", instructions: "Read this", taskType: "toeic.s.read" },
    { title: "Q2", instructions: "Answer", taskType: "toeic.s.respond", audioPlays: 1, responseSeconds: 30 },
  ]);
  assert.equal(await validatePrompts(ws, good, { program: "toeic", skill: "speaking" }), null);

  const badRange = normalizePrompts([{ title: "Q", instructions: "I", taskType: "toeic.s.read", responseSeconds: 2 }]);
  assert.match(await validatePrompts(ws, badRange, { program: "toeic", skill: "speaking" }), /Response time/);
});

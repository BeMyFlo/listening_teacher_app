// Phase 8B bước 4 — bộ đề TOEIC chuẩn, mặc định khi chọn dạng đề, field thiếu (không DB).
const test = require("node:test");
const assert = require("node:assert/strict");

const { standardSet, taskDefaults, blankToeicPrompt, promptCues, toeicPromptsError } = require("../lib/toeicStandardSet");
const { toeicTask } = require("../lib/toeicTasks");
const { taskFieldsToBuilder, taskFieldsToPayload } = require("../lib/teacher/testBuilder.js");

const count = (set, t) => set.filter((p) => p.taskType === t).length;

test("bộ Writing: 8 đề = 5 picture + 2 email + 1 essay, tiêu đề Question N", () => {
  const s = standardSet("writing");
  assert.equal(s.length, 8);
  assert.deepEqual(s.map((p) => p.taskType), [
    ...Array(5).fill("toeic.w.picture"), "toeic.w.email", "toeic.w.email", "toeic.w.essay",
  ]);
  s.forEach((p, i) => assert.equal(p.title, "Question " + (i + 1)));
  assert.equal(s[0].responseSeconds, "96");
  assert.equal(s[5].responseSeconds, "600");
  assert.equal(s[7].responseSeconds, "1800");
  assert.deepEqual(s[0].requiredWords, ["", ""]);
  assert.deepEqual(s[5].requiredWords, []);
});

test("bộ Speaking: 11 đề đúng thứ tự, 15/15/30, câu 10 phát 2 lần", () => {
  const s = standardSet("speaking");
  assert.equal(s.length, 11);
  assert.equal(count(s, "toeic.s.read"), 2);
  assert.equal(count(s, "toeic.s.picture"), 2);
  assert.equal(count(s, "toeic.s.respond"), 3);
  assert.equal(count(s, "toeic.s.info"), 3);
  assert.equal(count(s, "toeic.s.opinion"), 1);
  assert.equal(s[0].taskType, "toeic.s.read");
  assert.equal(s[10].taskType, "toeic.s.opinion");
  assert.deepEqual(s.slice(4, 7).map((p) => p.responseSeconds), ["15", "15", "30"]);
  assert.deepEqual(s.slice(7, 10).map((p) => p.responseSeconds), ["15", "15", "30"]);
  assert.deepEqual(s.map((p) => p.audioPlays), [1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1]);
  assert.equal(s[0].prepSeconds, "45");
  assert.equal(s[4].prepSeconds, "3");
  assert.equal(s[10].responseSeconds, "60");
});

test("bộ đề: kỹ năng khác -> rỗng; mỗi lần gọi trả bản mới", () => {
  assert.deepEqual(standardSet("listening"), []);
  const a = standardSet("speaking");
  a[0].title = "x";
  assert.equal(standardSet("speaking")[0].title, "Question 1");
});

test("taskDefaults: điền giây mặc định, giữ giá trị giáo viên đã sửa", () => {
  const fresh = taskDefaults({ taskType: "", prepSeconds: "", responseSeconds: "" }, "toeic.s.opinion");
  assert.equal(fresh.taskType, "toeic.s.opinion");
  assert.equal(fresh.prepSeconds, "45");
  assert.equal(fresh.responseSeconds, "60");
  // đã sửa tay -> giữ
  const edited = taskDefaults({ taskType: "", prepSeconds: "20", responseSeconds: "" }, "toeic.s.opinion");
  assert.equal(edited.prepSeconds, undefined);
  assert.equal(edited.responseSeconds, "60");
  // đổi dạng đề: giá trị còn đúng mặc định của dạng cũ thì đổi theo; đã sửa thì giữ
  const sw = taskDefaults({ taskType: "toeic.s.opinion", prepSeconds: "45", responseSeconds: "70" }, "toeic.s.respond");
  assert.equal(sw.prepSeconds, "3");
  assert.equal(sw.responseSeconds, undefined);
});

test("taskDefaults: required words / audio theo dạng đề", () => {
  const pic = taskDefaults({ requiredWords: ["cat"] }, "toeic.w.picture");
  assert.deepEqual(pic.requiredWords, ["cat", ""]);
  const email = taskDefaults({ requiredWords: ["cat", "dog"] }, "toeic.w.email");
  assert.deepEqual(email.requiredWords, []);
  const read = taskDefaults({ audioId: "a1", audioPlays: 2 }, "toeic.s.read");
  assert.equal(read.audioId, "");
  assert.equal(read.audioPlays, 1);
  assert.equal(taskDefaults({}, "").taskType, "");
});

test("promptCues / toeicPromptsError: báo field thiếu theo registry", () => {
  assert.deepEqual(promptCues(blankToeicPrompt("", "Q"), "writing"), ["choose a task type"]);
  // dạng đề sai kỹ năng = chưa chọn
  assert.deepEqual(promptCues(blankToeicPrompt("toeic.s.read", "Q"), "writing"), ["choose a task type"]);
  const pic = blankToeicPrompt("toeic.w.picture", "Question 1");
  assert.deepEqual(promptCues(pic, "writing"), ["add instructions", "select an image", "enter 2 required words"]);
  pic.instructions = "Write a sentence";
  pic.imageId = "img";
  pic.requiredWords = ["a", " "];
  assert.deepEqual(promptCues(pic, "writing"), ["enter 2 required words"]);
  pic.requiredWords = ["a", "b"];
  assert.deepEqual(promptCues(pic, "writing"), []);
  const set = standardSet("speaking");
  assert.match(toeicPromptsError(set, "speaking"), /^Speaking: Prompt 1: add instructions\.$/);
  assert.equal(toeicPromptsError([], "writing"), null);
});

test("round-trip builder: field task giữ nguyên qua toBuilder -> toPayload", () => {
  const p = blankToeicPrompt("toeic.s.info", "Question 10");
  p.audioId = "aud1";
  p.audioPlays = 2;
  p.responseSeconds = "30";
  const payload = taskFieldsToPayload(p);
  assert.equal(payload.taskType, "toeic.s.info");
  assert.equal(payload.audioId, "aud1");
  assert.equal(payload.audioPlays, 2);
  assert.equal(payload.responseSeconds, 30);
  assert.equal(payload.prepSeconds, toeicTask("toeic.s.info").prepSeconds);
  const back = taskFieldsToBuilder({ ...payload, audioId: { _id: "aud1" } });
  assert.equal(back.audioId, "aud1");
  assert.equal(back.responseSeconds, "30");
  // prompt IELTS: không thêm field nào
  assert.deepEqual(taskFieldsToPayload({ title: "x" }), {});
  assert.deepEqual(taskFieldsToBuilder({ title: "x" }), {});
});

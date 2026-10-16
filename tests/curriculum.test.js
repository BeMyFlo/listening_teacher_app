const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PROGRAMS,
  PROGRAM_KEYS,
  DEFAULT_PROGRAM,
  isProgram,
  programOf,
  programFilter,
} = require("../lib/curriculum");
const { activePrograms } = require("../lib/curriculumServer");

test("registry: ielts và toeic đúng như plan 3.1", () => {
  assert.deepEqual(PROGRAM_KEYS, ["ielts", "toeic"]);
  assert.equal(DEFAULT_PROGRAM, "ielts");

  assert.deepEqual(PROGRAMS.ielts.lessonSkills, ["grammar", "vocabulary", "listening", "reading", "writing", "speaking"]);
  assert.deepEqual(PROGRAMS.ielts.testSkills, ["listening", "reading", "writing", "speaking"]);
  assert.deepEqual(PROGRAMS.ielts.defaultDurations, { listening: 30, reading: 60, writing: 60, speaking: 14 });
  assert.equal(PROGRAMS.ielts.scoring, "ielts-band");

  assert.deepEqual(PROGRAMS.toeic.lessonSkills, ["grammar", "vocabulary", "listening", "reading"]);
  assert.deepEqual(PROGRAMS.toeic.testSkills, ["listening", "reading"]);
  assert.deepEqual(PROGRAMS.toeic.defaultDurations, { listening: 45, reading: 75 });
  assert.equal(PROGRAMS.toeic.scoring, "toeic-scaled");

  for (const k of PROGRAM_KEYS) {
    assert.equal(PROGRAMS[k].key, k);
    assert.ok(PROGRAMS[k].label);
    // Mọi kỹ năng có thời lượng mặc định đều phải là kỹ năng của đề thi.
    for (const s of Object.keys(PROGRAMS[k].defaultDurations)) {
      assert.ok(PROGRAMS[k].testSkills.includes(s));
    }
  }
});

test("isProgram", () => {
  assert.equal(isProgram("ielts"), true);
  assert.equal(isProgram("toeic"), true);
  for (const bad of ["abc", "", "IELTS", null, undefined, 1, {}, "constructor", "__proto__", "toString"]) {
    assert.equal(isProgram(bad), false, String(bad));
  }
});

test("programOf: thiếu/sai -> ielts, hợp lệ giữ nguyên", () => {
  assert.equal(programOf(null), "ielts");
  assert.equal(programOf(undefined), "ielts");
  assert.equal(programOf({}), "ielts");
  assert.equal(programOf({ program: null }), "ielts");
  assert.equal(programOf({ program: "abc" }), "ielts");
  assert.equal(programOf({ program: "ielts" }), "ielts");
  assert.equal(programOf({ program: "toeic" }), "toeic");
});

test("programFilter: ielts khớp cả doc thiếu field, toeic khớp đúng", () => {
  assert.deepEqual(programFilter("ielts"), { program: { $in: ["ielts", null] } });
  assert.deepEqual(programFilter("toeic"), { program: "toeic" });
});

// Model giả: distinct("program", filter) trả giá trị cho trước, ghi lại filter.
function fakeModel(values, calls) {
  return {
    async distinct(field, filter) {
      calls.push({ field, filter });
      return values;
    },
  };
}
const WS = { workspaceId: "ws1", role: "owner" };

test("activePrograms: workspace trống -> ['ielts']", async () => {
  const calls = [];
  const r = await activePrograms(WS, [fakeModel([], calls), fakeModel([], calls), fakeModel([], calls)]);
  assert.deepEqual(r, ["ielts"]);
  assert.equal(calls.length, 3);
  for (const c of calls) {
    assert.equal(c.field, "program");
    assert.equal(c.filter.workspaceId, "ws1"); // luôn lọc theo workspace
  }
});

test("activePrograms: null/thiếu field tính là ielts", async () => {
  const r = await activePrograms(WS, [fakeModel([null], []), fakeModel([], []), fakeModel([undefined], [])]);
  assert.deepEqual(r, ["ielts"]);
});

test("activePrograms: chỉ có TOEIC -> ['toeic']", async () => {
  const r = await activePrograms(WS, [fakeModel(["toeic"], []), fakeModel([], []), fakeModel([], [])]);
  assert.deepEqual(r, ["toeic"]);
});

test("activePrograms: gộp Class+Unit+Test, theo thứ tự PROGRAM_KEYS", async () => {
  // Class chỉ có toeic, Test chỉ có ielts (null) -> vẫn trả ielts trước toeic.
  const r = await activePrograms(WS, [fakeModel(["toeic"], []), fakeModel([], []), fakeModel([null], [])]);
  assert.deepEqual(r, ["ielts", "toeic"]);
});

test("activePrograms: giá trị lạ bị bỏ qua, không còn gì hợp lệ -> ['ielts']", async () => {
  const r = await activePrograms(WS, [fakeModel(["abc"], []), fakeModel([], []), fakeModel([], [])]);
  assert.deepEqual(r, ["ielts"]);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  LEVEL_MAX,
  NAME_MAX,
  sanitizeLevelNames,
  levelNameOf,
  levelLabel,
  namedLevelsOf,
} = require("../lib/levelNames");

test("sanitizeLevelNames: hợp lệ -> giữ, cắt khoảng trắng, sắp xếp ổn định", () => {
  const r = sanitizeLevelNames([
    { program: "toeic", level: 2, name: "  450–600 " },
    { program: "ielts", level: 2, name: "Band 5.0–6.0" },
    { program: "ielts", level: 1, name: "Band 3.5–5.0" },
  ]);
  assert.equal(r.error, undefined);
  assert.deepEqual(r.levelNames, [
    { program: "ielts", level: 1, name: "Band 3.5–5.0" },
    { program: "ielts", level: 2, name: "Band 5.0–6.0" },
    { program: "toeic", level: 2, name: "450–600" },
  ]);
});

test("sanitizeLevelNames: tên rỗng bị bỏ", () => {
  const r = sanitizeLevelNames([
    { program: "ielts", level: 1, name: "   " },
    { program: "ielts", level: 2, name: "" },
    { program: "ielts", level: 3 },
    { program: "ielts", level: 4, name: "Band 7" },
  ]);
  assert.deepEqual(r.levelNames, [{ program: "ielts", level: 4, name: "Band 7" }]);
});

test("sanitizeLevelNames: trùng (program, level) giữ dòng cuối; khác program thì không trùng", () => {
  const r = sanitizeLevelNames([
    { program: "ielts", level: 1, name: "cũ" },
    { program: "toeic", level: 1, name: "300–450" },
    { program: "ielts", level: 1, name: "mới" },
  ]);
  assert.deepEqual(r.levelNames, [
    { program: "ielts", level: 1, name: "mới" },
    { program: "toeic", level: 1, name: "300–450" },
  ]);
  // Dòng cuối rỗng = xoá tên.
  const cleared = sanitizeLevelNames([
    { program: "ielts", level: 1, name: "cũ" },
    { program: "ielts", level: 1, name: " " },
  ]);
  assert.deepEqual(cleared.levelNames, []);
});

test("sanitizeLevelNames: tên dài bị cắt ở NAME_MAX", () => {
  const r = sanitizeLevelNames([{ program: "ielts", level: 1, name: "x".repeat(NAME_MAX + 30) }]);
  assert.equal(r.levelNames[0].name.length, NAME_MAX);
});

test("sanitizeLevelNames: level là số nguyên 1..LEVEL_MAX (chuỗi số được chấp nhận)", () => {
  assert.equal(sanitizeLevelNames([{ program: "ielts", level: "3", name: "a" }]).levelNames[0].level, 3);
  assert.equal(sanitizeLevelNames([{ program: "ielts", level: LEVEL_MAX, name: "a" }]).error, undefined);
  for (const bad of [0, -1, 1.5, LEVEL_MAX + 1, "abc", "", null, undefined, NaN]) {
    assert.ok(sanitizeLevelNames([{ program: "ielts", level: bad, name: "a" }]).error, "level " + String(bad));
  }
});

test("sanitizeLevelNames: program lạ và dữ liệu sai hình dạng -> lỗi", () => {
  assert.ok(sanitizeLevelNames([{ program: "sat", level: 1, name: "a" }]).error);
  assert.ok(sanitizeLevelNames([{ program: "constructor", level: 1, name: "a" }]).error);
  assert.ok(sanitizeLevelNames([{ level: 1, name: "a" }]).error);
  assert.ok(sanitizeLevelNames(null).error);
  assert.ok(sanitizeLevelNames("x").error);
  assert.ok(sanitizeLevelNames({}).error);
  assert.ok(sanitizeLevelNames([null]).error);
  assert.ok(sanitizeLevelNames(new Array(500).fill({ program: "ielts", level: 1, name: "a" })).error);
  assert.deepEqual(sanitizeLevelNames([]).levelNames, []);
});

test("sanitizeLevelNames: name không phải chuỗi -> coi như rỗng (bỏ)", () => {
  assert.deepEqual(sanitizeLevelNames([{ program: "ielts", level: 1, name: 123 }]).levelNames, []);
});

const NAMES = [
  { program: "ielts", level: 1, name: "Band 3.5–5.0" },
  { program: "toeic", level: 1, name: "300–450" },
  { program: "ielts", level: 3, name: "Band 6.5+" },
];

test("levelLabel: có tên -> 'Level N · Tên', chưa có -> 'Level N' (đúng chữ cũ)", () => {
  assert.equal(levelLabel(NAMES, "ielts", 1), "Level 1 · Band 3.5–5.0");
  assert.equal(levelLabel(NAMES, "toeic", 1), "Level 1 · 300–450");
  assert.equal(levelLabel(NAMES, "ielts", 2), "Level 2");
  assert.equal(levelLabel(NAMES, "toeic", 3), "Level 3"); // Level 3 chỉ có tên ở IELTS
});

test("levelLabel / levelNameOf: workspace cũ (undefined/rỗng) và level dạng chuỗi", () => {
  assert.equal(levelLabel(undefined, "ielts", 1), "Level 1");
  assert.equal(levelLabel([], "ielts", 1), "Level 1");
  assert.equal(levelNameOf(NAMES, "ielts", "3"), "Band 6.5+");
  assert.equal(levelNameOf(NAMES, "ielts", 9), "");
  assert.equal(levelNameOf(null, "ielts", 1), "");
});

test("namedLevelsOf: level đã đặt tên của 1 chương trình, tăng dần", () => {
  assert.deepEqual(namedLevelsOf(NAMES, "ielts"), [1, 3]);
  assert.deepEqual(namedLevelsOf(NAMES, "toeic"), [1]);
  assert.deepEqual(namedLevelsOf(undefined, "ielts"), []);
  assert.deepEqual(namedLevelsOf([{ program: "ielts", level: 2, name: "" }], "ielts"), []);
});

test("Workspace schema: levelNames mặc định [] và validate program/level/name", () => {
  const Workspace = require("../lib/models/Workspace");
  const base = { name: "T", slug: "t", ownerUserId: "64b000000000000000000001" };
  const ok = new Workspace(base);
  assert.deepEqual([...ok.levelNames], []);
  assert.equal(ok.validateSync(), undefined);

  const good = new Workspace({ ...base, levelNames: [{ program: "toeic", level: 1, name: "300–450" }] });
  assert.equal(good.validateSync(), undefined);

  for (const bad of [
    { program: "sat", level: 1, name: "a" },
    { program: "ielts", level: 0, name: "a" },
    { program: "ielts", level: 1.5, name: "a" },
    { program: "ielts", level: 1, name: "" },
    { program: "ielts", level: 1, name: "x".repeat(61) },
  ]) {
    const w = new Workspace({ ...base, levelNames: [bad] });
    assert.ok(w.validateSync(), JSON.stringify(bad));
  }
});

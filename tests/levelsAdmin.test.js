const test = require("node:test");
const assert = require("node:assert/strict");
const { LEVEL_MAX, NAME_MAX, formatLevelLabel } = require("../lib/levelNames");
const { cleanName, mergeLevels, nextLevelNumber, planCreate, planRename, planDelete } = require("../lib/levelsAdmin");

const names = [
  { program: "ielts", level: 1, name: "Band 3.5–5.0" },
  { program: "ielts", level: 3, name: "Band 6.0+" },
  { program: "toeic", level: 1, name: "300–450" },
];
const noUse = { classCounts: {}, unitLevels: [], testLevels: [] };

test("mergeLevels: tên đã lưu + level đang dùng chưa tên, đếm lớp, tăng dần", () => {
  const usage = { classCounts: { 1: 2, 2: 1 }, unitLevels: [4], testLevels: [4, 5] };
  assert.deepEqual(mergeLevels(names, "ielts", usage), [
    { level: 1, name: "Band 3.5–5.0", classCount: 2, inUse: true },
    { level: 2, name: "", classCount: 1, inUse: true },
    { level: 3, name: "Band 6.0+", classCount: 0, inUse: false },
    { level: 4, name: "", classCount: 0, inUse: true },
    { level: 5, name: "", classCount: 0, inUse: true },
  ]);
});

test("mergeLevels: chỉ lấy tên của đúng chương trình; không có gì -> rỗng", () => {
  assert.deepEqual(mergeLevels(names, "toeic", noUse), [{ level: 1, name: "300–450", classCount: 0, inUse: false }]);
  assert.deepEqual(mergeLevels([], "ielts", noUse), []);
  assert.deepEqual(mergeLevels(undefined, "ielts", undefined), []);
});

test("mergeLevels: bỏ level không hợp lệ và số lớp 0", () => {
  const usage = { classCounts: { 0: 1, 2: 0, x: 3 }, unitLevels: [null, 1.5, -1], testLevels: [] };
  assert.deepEqual(mergeLevels([], "ielts", usage), []);
});

test("nextLevelNumber: max(đã tên, đang dùng) + 1; chưa có -> 1; quá trần -> null", () => {
  assert.equal(nextLevelNumber([], "ielts", noUse), 1);
  assert.equal(nextLevelNumber(names, "ielts", noUse), 4);
  assert.equal(nextLevelNumber(names, "ielts", { classCounts: { 7: 1 }, unitLevels: [], testLevels: [] }), 8);
  assert.equal(nextLevelNumber(names, "toeic", noUse), 2);
  assert.equal(nextLevelNumber([{ program: "ielts", level: LEVEL_MAX, name: "x" }], "ielts", noUse), null);
});

test("planCreate: tạo số kế tiếp, tên được trim; thiếu/quá dài -> 400", () => {
  const r = planCreate(names, "ielts", "  Band 7+ ", noUse);
  assert.equal(r.status, 201);
  assert.equal(r.level, 4);
  assert.equal(r.name, "Band 7+");
  assert.deepEqual(r.levelNames.filter((x) => x.program === "ielts").map((x) => x.level), [1, 3, 4]);
  assert.equal(r.levelNames.length, 4);
  assert.equal(planCreate(names, "ielts", "   ", noUse).status, 400);
  assert.equal(planCreate(names, "ielts", undefined, noUse).status, 400);
  assert.equal(planCreate(names, "ielts", "x".repeat(NAME_MAX + 1), noUse).status, 400);
  assert.equal(planCreate(names, "ielts", "x".repeat(NAME_MAX), noUse).status, 201);
  const full = planCreate([{ program: "ielts", level: LEVEL_MAX, name: "x" }], "ielts", "More", noUse);
  assert.equal(full.status, 400);
});

test("planCreate: chương trình đầu tiên -> level 1; level đang dùng chưa tên được tính", () => {
  assert.equal(planCreate([], "toeic", "300–450", noUse).level, 1);
  const r = planCreate([], "ielts", "Next", { classCounts: { 2: 1 }, unitLevels: [], testLevels: [] });
  assert.equal(r.level, 3);
});

test("planRename: đổi tên level có tên; đặt tên cho level đang dùng chưa tên; lạ -> 404; rỗng -> 400", () => {
  const r = planRename(names, "ielts", 1, " Beginner ", noUse);
  assert.equal(r.status, 200);
  assert.deepEqual(r.levelNames.find((x) => x.program === "ielts" && x.level === 1), { program: "ielts", level: 1, name: "Beginner" });
  assert.equal(r.levelNames.length, names.length);

  const used = { classCounts: { 2: 1 }, unitLevels: [], testLevels: [] };
  const first = planRename(names, "ielts", 2, "Band 5.0", used);
  assert.equal(first.status, 200);
  assert.equal(first.levelNames.length, names.length + 1);

  assert.equal(planRename(names, "ielts", 9, "Nope", noUse).status, 404);
  assert.equal(planRename(names, "ielts", 1, "  ", noUse).status, 400);
  // Level 1 của TOEIC là dòng riêng, không bị ảnh hưởng.
  assert.equal(r.levelNames.find((x) => x.program === "toeic").name, "300–450");
});

test("planDelete: đang dùng -> 409 (có đếm lớp); không dùng -> bỏ dòng; không có -> 404", () => {
  const byClass = planDelete(names, "ielts", 1, { classCounts: { 1: 2 }, unitLevels: [], testLevels: [] });
  assert.equal(byClass.status, 409);
  assert.match(byClass.error, /2 classes/);
  assert.equal(planDelete(names, "ielts", 1, { classCounts: { 1: 1 }, unitLevels: [], testLevels: [] }).error, "Level 1 is used by 1 class");
  const byUnit = planDelete(names, "ielts", 1, { classCounts: {}, unitLevels: [1], testLevels: [] });
  assert.equal(byUnit.status, 409);
  assert.equal(planDelete(names, "ielts", 1, { classCounts: {}, unitLevels: [], testLevels: [1] }).status, 409);
  // Chưa tên nhưng đang dùng -> cũng 409.
  assert.equal(planDelete(names, "ielts", 2, { classCounts: { 2: 1 }, unitLevels: [], testLevels: [] }).status, 409);

  const ok = planDelete(names, "ielts", 3, noUse);
  assert.equal(ok.status, 200);
  assert.equal(ok.levelNames.length, names.length - 1);
  assert.ok(!ok.levelNames.some((x) => x.program === "ielts" && x.level === 3));
  assert.equal(planDelete(names, "ielts", 9, noUse).status, 404);
  // Dùng ở chương trình khác không chặn xoá (usage đã lọc theo chương trình ở route).
  assert.equal(planDelete(names, "toeic", 1, noUse).status, 200);
});

test("cleanName / formatLevelLabel", () => {
  assert.deepEqual(cleanName("  A "), { name: "A" });
  assert.ok(cleanName(5).error);
  assert.equal(formatLevelLabel(2, ""), "Level 2");
  assert.equal(formatLevelLabel(2, "Band 5"), "Level 2 · Band 5");
});

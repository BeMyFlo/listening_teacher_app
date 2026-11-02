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

// ------------------------------------------------ Phase 12 G0: fixedLevels (general)

test("mergeLevels general: luôn trả đủ khối 6..12 (name '' nếu chưa đặt) + level đang dùng ngoài danh sách", () => {
  assert.deepEqual(mergeLevels([], "general", noUse), [
    { level: 6, name: "", classCount: 0, inUse: false },
    { level: 7, name: "", classCount: 0, inUse: false },
    { level: 8, name: "", classCount: 0, inUse: false },
    { level: 9, name: "", classCount: 0, inUse: false },
    { level: 10, name: "", classCount: 0, inUse: false },
    { level: 11, name: "", classCount: 0, inUse: false },
    { level: 12, name: "", classCount: 0, inUse: false },
  ]);

  const gNames = [...names, { program: "general", level: 9, name: "Entrance prep" }];
  const usage = { classCounts: { 7: 2, 3: 1 }, unitLevels: [9], testLevels: [] };
  const merged = mergeLevels(gNames, "general", usage);
  assert.deepEqual(merged.map((r) => r.level), [3, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(merged.find((r) => r.level === 3), { level: 3, name: "", classCount: 1, inUse: true });
  assert.deepEqual(merged.find((r) => r.level === 7), { level: 7, name: "", classCount: 2, inUse: true });
  assert.deepEqual(merged.find((r) => r.level === 9), { level: 9, name: "Entrance prep", classCount: 0, inUse: true });
  // IELTS và TOEIC không bị ảnh hưởng.
  assert.equal(mergeLevels(gNames, "ielts", noUse).length, 2);
  assert.equal(mergeLevels(gNames, "toeic", noUse).length, 1);
});

test("planCreate general: trả 400 không cho tạo level mới", () => {
  const r = planCreate(names, "general", "Grade 7", noUse);
  assert.equal(r.status, 400);
  assert.equal(r.error, "General English uses grades 6–12; rename a grade instead.");
  assert.equal(planCreate([], "general", "", noUse).status, 400);
});

test("planDelete general: khối cố định 6..12 -> 400; level ngoài danh sách giữ luật cũ", () => {
  for (const g of [6, 7, 8, 9, 10, 11, 12]) {
    const r = planDelete(names, "general", g, noUse);
    assert.equal(r.status, 400);
    assert.equal(r.error, "Grades can't be deleted.");
  }
  // Đang dùng cũng báo không được xoá khối cố định.
  const inUseGrade = planDelete(names, "general", 7, { classCounts: { 7: 1 }, unitLevels: [], testLevels: [] });
  assert.equal(inUseGrade.status, 400);
  assert.equal(inUseGrade.error, "Grades can't be deleted.");

  // Level ngoài 6..12: không có -> 404; đang dùng -> 409; có tên không dùng -> 200.
  assert.equal(planDelete(names, "general", 3, noUse).status, 404);
  assert.equal(planDelete(names, "general", 3, { classCounts: { 3: 1 }, unitLevels: [], testLevels: [] }).status, 409);
  const strayNamed = [...names, { program: "general", level: 3, name: "Stray" }];
  const delStray = planDelete(strayNamed, "general", 3, noUse);
  assert.equal(delStray.status, 200);
  assert.ok(!delStray.levelNames.some((x) => x.program === "general" && x.level === 3));
});

test("planRename general: đổi tên khối 6..12 OK dù chưa có tên hay chưa có lớp; ngoài 6..12 -> 404", () => {
  const r1 = planRename(names, "general", 9, "  Entrance prep ", noUse);
  assert.equal(r1.status, 200);
  assert.equal(r1.level, 9);
  assert.equal(r1.name, "Entrance prep");
  assert.deepEqual(
    r1.levelNames.find((x) => x.program === "general" && x.level === 9),
    { program: "general", level: 9, name: "Entrance prep" }
  );

  const r2 = planRename(r1.levelNames, "general", 9, "Grade 10 entrance", noUse);
  assert.equal(r2.status, 200);
  assert.equal(r2.name, "Grade 10 entrance");

  assert.equal(planRename(names, "general", 3, "Nope", noUse).status, 404);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PROGRAMS,
  PROGRAM_KEYS,
  DEFAULT_PROGRAM,
  isProgram,
  programOf,
  programFilter,
  parseProgramParam,
  studentContentFilter,
  lessonSkillAllowed,
  testSkillAllowed,
} = require("../lib/curriculum");
const { activePrograms } = require("../lib/curriculumServer");

test("registry: ielts, toeic và general đúng như plan", () => {
  assert.deepEqual(PROGRAM_KEYS, ["ielts", "toeic", "general"]);
  assert.equal(DEFAULT_PROGRAM, "ielts");

  assert.deepEqual(PROGRAMS.ielts.lessonSkills, ["grammar", "vocabulary", "listening", "reading", "writing", "speaking"]);
  assert.deepEqual(PROGRAMS.ielts.testSkills, ["listening", "reading", "writing", "speaking"]);
  assert.deepEqual(PROGRAMS.ielts.defaultDurations, { listening: 30, reading: 60, writing: 60, speaking: 14 });
  assert.equal(PROGRAMS.ielts.scoring, "ielts-band");
  assert.equal(PROGRAMS.ielts.aiExercise, false);
  assert.equal(PROGRAMS.ielts.wordImport, false);
  assert.equal(PROGRAMS.ielts.textbook, false);

  assert.deepEqual(PROGRAMS.toeic.lessonSkills, ["grammar", "vocabulary", "listening", "reading", "writing", "speaking"]);
  assert.deepEqual(PROGRAMS.toeic.testSkills, ["listening", "reading", "writing", "speaking"]);
  assert.deepEqual(PROGRAMS.toeic.defaultDurations, { listening: 45, reading: 75, writing: 60, speaking: 20 });
  assert.equal(PROGRAMS.toeic.scoring, "toeic-scaled");
  assert.equal(PROGRAMS.toeic.aiExercise, false);
  assert.equal(PROGRAMS.toeic.wordImport, false);
  assert.equal(PROGRAMS.toeic.textbook, false);

  assert.equal(PROGRAMS.general.label, "General English");
  assert.deepEqual(PROGRAMS.general.lessonSkills, ["grammar", "vocabulary", "listening", "reading", "writing", "speaking"]);
  assert.deepEqual(PROGRAMS.general.testSkills, ["listening", "reading", "writing", "speaking"]);
  assert.deepEqual(PROGRAMS.general.defaultDurations, { listening: 15, reading: 45, writing: 30, speaking: 10 });
  assert.equal(PROGRAMS.general.scoring, "ten-point");
  assert.equal(PROGRAMS.general.levelWord, "Grade");
  assert.deepEqual(PROGRAMS.general.fixedLevels, [6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(PROGRAMS.general.skillLabels, { vocabulary: "Vocabulary & Pronunciation" });
  assert.deepEqual(PROGRAMS.general.testSkillLabels, { reading: "Written paper" });
  assert.equal(PROGRAMS.general.excelImport, true);
  assert.equal(PROGRAMS.general.aiExercise, true);
  assert.equal(PROGRAMS.general.wordImport, true);
  assert.equal(PROGRAMS.general.textbook, true);
  assert.equal(PROGRAMS.general.legacyFormatGuess, false);
  assert.equal(PROGRAMS.general.formatPlaceholder, "Choose a question type…");
  assert.deepEqual(PROGRAMS.general.aiLevel, {
    label: "Students' level (grade or CEFR)",
    placeholder: "e.g. Grade 7, A2",
    suggestions: ["Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12", "A1", "A2", "B1"],
  });
  assert.equal(PROGRAMS.general.levelNamePlaceholder, "e.g. Grade 10 entrance prep");

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
  assert.equal(isProgram("general"), true);
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
  assert.equal(programOf({ program: "general" }), "general");
});

test("programFilter và parseProgramParam: ielts khớp cả doc thiếu field; toeic/general khớp đúng", () => {
  assert.deepEqual(programFilter("ielts"), { program: { $in: ["ielts", null] } });
  assert.deepEqual(programFilter("toeic"), { program: "toeic" });
  assert.deepEqual(programFilter("general"), { program: "general" });
  assert.deepEqual(parseProgramParam("general"), { program: "general" });
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

// ------------------------------------------- guard của route nộp bài (submissions.js)

test("studentContentFilter: level + được giao cho lớp + đúng chương trình của lớp", () => {
  assert.deepEqual(studentContentFilter({ _id: "c1", level: 2, program: "toeic" }), {
    level: 2,
    classIds: "c1",
    program: "toeic",
  });
  // Lớp IELTS (kể cả doc cũ thiếu field) khớp cả nội dung cũ thiếu program.
  const expected = { level: 1, classIds: "c2", program: { $in: ["ielts", null] } };
  assert.deepEqual(studentContentFilter({ _id: "c2", level: 1, program: "ielts" }), expected);
  assert.deepEqual(studentContentFilter({ _id: "c2", level: 1 }), expected);
  // classIds là điều kiện BẮT BUỘC: không bao giờ rút gọn thành "mọi lớp cùng level".
  assert.ok("classIds" in studentContentFilter({ _id: "c3", level: 1 }));
});

test("lessonSkillAllowed / testSkillAllowed đọc registry theo chương trình của Unit/Test", () => {
  for (const k of PROGRAMS.ielts.lessonSkills) assert.equal(lessonSkillAllowed({ program: "ielts" }, k), true, k);
  for (const k of PROGRAMS.ielts.testSkills) assert.equal(testSkillAllowed({ program: "ielts" }, k), true, k);
  // Doc cũ thiếu program = IELTS: giữ nguyên hành vi cũ.
  assert.equal(lessonSkillAllowed({}, "writing"), true);
  assert.equal(testSkillAllowed({}, "speaking"), true);
  // TOEIC từ 8B có đủ Writing/Speaking.
  assert.equal(lessonSkillAllowed({ program: "toeic" }, "listening"), true);
  assert.equal(lessonSkillAllowed({ program: "toeic" }, "writing"), true);
  assert.equal(lessonSkillAllowed({ program: "toeic" }, "speaking"), true);
  assert.equal(testSkillAllowed({ program: "toeic" }, "reading"), true);
  assert.equal(testSkillAllowed({ program: "toeic" }, "writing"), true);
  assert.equal(testSkillAllowed({ program: "toeic" }, "speaking"), true);
  // Khoá lạ / thiếu -> không cho.
  assert.equal(lessonSkillAllowed({ program: "toeic" }, undefined), false);
  assert.equal(testSkillAllowed({ program: "ielts" }, "constructor"), false);
});

// ------------------------------------------- Phase 12 G0 bước 1: key mới + helper

const { skillLabel, testSkillLabel, levelWordOf, levelAllowed } = require("../lib/curriculum");

test("registry: mọi chương trình có đủ key G0 đúng kiểu", () => {
  for (const k of PROGRAM_KEYS) {
    const p = PROGRAMS[k];
    assert.equal(typeof p.levelWord, "string", k);
    assert.ok(p.fixedLevels === null || Array.isArray(p.fixedLevels), k);
    assert.equal(typeof p.skillLabels, "object", k);
    assert.equal(typeof p.testSkillLabels, "object", k);
    assert.equal(typeof p.excelImport, "boolean", k);
    assert.equal(typeof p.legacyFormatGuess, "boolean", k);
    assert.ok(p.formatPlaceholder === null || typeof p.formatPlaceholder === "string", k);
    assert.equal(typeof p.aiLevel.label, "string", k);
    assert.equal(typeof p.aiLevel.placeholder, "string", k);
    assert.ok(Array.isArray(p.aiLevel.suggestions) && p.aiLevel.suggestions.length > 0, k);
    assert.equal(typeof p.levelNamePlaceholder, "string", k);
  }
});

test("registry: giá trị ielts/toeic y hệt code viết cứng trước G0", () => {
  const i = PROGRAMS.ielts;
  const t = PROGRAMS.toeic;
  assert.equal(i.levelWord, "Level");
  assert.equal(t.levelWord, "Level");
  assert.equal(i.excelImport, true);
  assert.equal(t.excelImport, false);
  assert.equal(i.legacyFormatGuess, true);
  assert.equal(t.legacyFormatGuess, false);
  assert.equal(i.formatPlaceholder, null);
  assert.equal(t.formatPlaceholder, "Choose a Part…");
  assert.equal(i.aiLevel.label, "Students' level (IELTS band or CEFR)");
  assert.equal(i.aiLevel.placeholder, "e.g. 6.5, 5.0–5.5, B1");
  assert.deepEqual(i.aiLevel.suggestions, [
    "3.0", "3.5", "4.0", "4.5", "5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "A1", "A2", "B1", "B2", "C1",
  ]);
  assert.equal(t.aiLevel.label, "Students' level (TOEIC score)");
  assert.equal(t.aiLevel.placeholder, "e.g. 550, 450–600, 750+");
  assert.deepEqual(t.aiLevel.suggestions, ["300", "400", "450", "500", "550", "600", "650", "700", "750", "800", "850"]);
  assert.equal(i.levelNamePlaceholder, "e.g. Band 3.5–5.0");
  assert.equal(t.levelNamePlaceholder, "e.g. 300–450");
});

test("skillLabel / testSkillLabel: rỗng -> fallback; general đè nhãn; levelWordOf", () => {
  for (const p of ["ielts", "toeic", "bogus", undefined]) {
    assert.equal(skillLabel(p, "vocabulary", "Vocabulary"), "Vocabulary");
    assert.equal(testSkillLabel(p, "reading", "Reading"), "Reading");
    assert.equal(levelWordOf(p), "Level");
  }
  assert.equal(skillLabel("general", "vocabulary", "Vocabulary"), "Vocabulary & Pronunciation");
  assert.equal(skillLabel("general", "grammar", "Grammar"), "Grammar");
  assert.equal(testSkillLabel("general", "reading", "Reading"), "Written paper");
  assert.equal(testSkillLabel("general", "listening", "Listening"), "Listening");
  assert.equal(levelWordOf("general"), "Grade");
});

test("levelAllowed: ielts/toeic số nguyên >= 1 (không trần); general chỉ 6..12; chương trình lạ = ielts", () => {
  assert.equal(levelAllowed("ielts", 1), true);
  assert.equal(levelAllowed("toeic", 50), true);
  assert.equal(levelAllowed("ielts", 51), true);
  assert.equal(levelAllowed("ielts", 0), false);
  assert.equal(levelAllowed("ielts", 1.5), false);
  assert.equal(levelAllowed("ielts", "3"), false);
  assert.equal(levelAllowed("bogus", 3), true);
  assert.equal(levelAllowed(undefined, 51), true);
  for (const g of [6, 7, 8, 9, 10, 11, 12]) {
    assert.equal(levelAllowed("general", g), true, `grade ${g}`);
  }
  for (const bad of [0, 1, 5, 13, 50, 7.5, "7", null, undefined]) {
    assert.equal(levelAllowed("general", bad), false, `bad grade ${String(bad)}`);
  }
});

test("lessonSkillAllowed / testSkillAllowed: general mở cả writing/speaking (G5)", () => {
  for (const k of ["grammar", "vocabulary", "listening", "reading"]) {
    assert.equal(lessonSkillAllowed({ program: "general" }, k), true, k);
  }
  assert.equal(lessonSkillAllowed({ program: "general" }, "writing"), true);
  assert.equal(lessonSkillAllowed({ program: "general" }, "speaking"), true);
  assert.equal(testSkillAllowed({ program: "general" }, "listening"), true);
  assert.equal(testSkillAllowed({ program: "general" }, "reading"), true);
  assert.equal(testSkillAllowed({ program: "general" }, "writing"), true);
  assert.equal(testSkillAllowed({ program: "general" }, "speaking"), true);
});

test("Schema Class/Unit/Test/Submission nhận program: 'general'", () => {
  const Class = require("../lib/models/Class");
  const Unit = require("../lib/models/Unit");
  const Test = require("../lib/models/Test");
  const Submission = require("../lib/models/Submission");
  const wsId = "64b000000000000000000001";
  const stId = "64b000000000000000000002";

  assert.equal(new Class({ workspaceId: wsId, name: "7A", level: 7, program: "general" }).validateSync(), undefined);
  assert.equal(new Unit({ workspaceId: wsId, name: "U1", level: 7, program: "general" }).validateSync(), undefined);
  assert.equal(new Test({ workspaceId: wsId, title: "T1", level: 7, program: "general" }).validateSync(), undefined);
  assert.equal(
    new Submission({ workspaceId: wsId, studentId: stId, studentName: "An", program: "general" }).validateSync(),
    undefined
  );
});


test("formatStatsSkills: IELTS/TOEIC giữ Reading + Listening như cũ, General thêm Grammar/Vocabulary", () => {
  const { PROGRAMS } = require("../lib/curriculum");
  assert.deepEqual(PROGRAMS.ielts.formatStatsSkills, ["reading", "listening"]);
  assert.deepEqual(PROGRAMS.toeic.formatStatsSkills, ["reading", "listening"]);
  assert.deepEqual(PROGRAMS.general.formatStatsSkills, ["grammar", "vocabulary", "reading", "listening"]);
});

test("implicitProgram: workspace 1 chương trình khác IELTS -> chương trình đó, còn lại null", () => {
  const { implicitProgram } = require("../lib/curriculum");
  assert.equal(implicitProgram(["general"]), "general");
  assert.equal(implicitProgram(["toeic"]), "toeic");
  assert.equal(implicitProgram(["ielts"]), null);
  assert.equal(implicitProgram(["ielts", "general"]), null);
  assert.equal(implicitProgram([]), null);
  assert.equal(implicitProgram(["bogus"]), null);
  assert.equal(implicitProgram(undefined), null);
});

test("withProgram-level: General với level 1 -> khối hợp lệ đầu tiên (kiểm qua levelAllowed)", () => {
  const { levelAllowed, PROGRAMS } = require("../lib/curriculum");
  assert.equal(levelAllowed("general", 1), false);
  assert.equal(levelAllowed("general", PROGRAMS.general.fixedLevels[0]), true);
});

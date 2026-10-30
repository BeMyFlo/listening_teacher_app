// Phase 12 G2 bước 3 — applyFormat, khung đề dựng từ khuôn, chặn publish ở client.
const test = require("node:test");
const assert = require("node:assert/strict");

const { PROGRAMS } = require("../lib/curriculum");
const { GENERAL_LABELS } = require("../lib/generalFormats");
const {
  PASSAGE_PLACEHOLDER,
  TEMPLATES,
  resolveTemplate,
  incompleteQuestions,
} = require("../lib/generalTemplates");
const {
  emptyField,
  applyFormat,
  applyFormatBasics,
  tfngOptions,
  ynngOptions,
  newOptionId,
  sectionsToEditor,
  sectionsToPayload,
} = require("../lib/teacher/sectionTransforms");
const { letterOptions } = require("../lib/letterQuestion");
const { questionFormatsFor, GENERAL_ALL_FORMATS } = require("../lib/teacher/questionFormats");
const { buildSkeleton, describeIncomplete } = require("../lib/teacher/templateSkeleton");
const { emptyBuilder, builderToPayload } = require("../lib/teacher/testBuilder");
const { normalizeSections, validateSections } = require("../lib/testSections");


// Bỏ id ngẫu nhiên của lựa chọn để so sánh.
const strip = (f) => ({ ...f, options: f.options.map((o) => ({ text: o.text })) });

// Bản gốc của addQuestionWithFormat (trước khi tách applyFormat) — dùng làm chuẩn so sánh.
function oldAddFormat(id, fmt) {
  const field = emptyField(id);
  field.kind = fmt.kind === "letter" ? "mcq" : fmt.kind;
  field.formatLabel = fmt.label || "";
  field.matchMode = fmt.matchMode || "";
  if (fmt.kind === "reorder") {
    field.matchMode = "sentence";
    field.tokens = [];
  }
  if (fmt.kind === "tfng") field.options = tfngOptions();
  if (fmt.kind === "ynng") field.options = ynngOptions();
  if (fmt.kind === "letter") field.options = letterOptions(fmt.letterOptions).map((o) => ({ id: o.value, text: o.label }));
  if (fmt.presetOptions) field.options = fmt.presetOptions.map((text) => ({ id: newOptionId(), text }));
  return field;
}

// ---------------------------------------------------------------- applyFormat

test("applyFormat: khớp hành vi cũ với mọi dạng IELTS / TOEIC / General", () => {
  let n = 0;
  for (const program of ["ielts", "toeic", "general"]) {
    for (const subject of ["listening", "reading", "grammar", "vocabulary"]) {
      const formats = questionFormatsFor(subject, program) || [];
      for (const fmt of formats) {
        const got = applyFormat(emptyField(7), fmt);
        assert.deepEqual(strip(got), strip(oldAddFormat(7, fmt)), `${program}/${subject}/${fmt.key}`);
        n++;
      }
    }
  }
  assert.ok(n > 60);
});

test("applyFormat: ca cụ thể (letter, tfng, preset, reorder, fill sentence)", () => {
  const letter = questionFormatsFor("listening", "ielts").find((f) => f.kind === "letter");
  const l = applyFormat(emptyField(1), letter);
  assert.equal(l.kind, "mcq");
  assert.deepEqual(l.options.map((o) => o.text), ["A", "B", "C", "D"]);

  const tf = applyFormat(emptyField(1), GENERAL_ALL_FORMATS.find((f) => f.key === "g-tf"));
  assert.deepEqual(tf.options.map((o) => o.text), ["True", "False"]);

  const tfng = applyFormat(emptyField(1), GENERAL_ALL_FORMATS.find((f) => f.key === "g-tfng"));
  assert.equal(tfng.kind, "tfng");
  assert.equal(tfng.options.length, 3);

  const ro = applyFormat(emptyField(1), GENERAL_ALL_FORMATS.find((f) => f.key === "g-reorder"));
  assert.equal(ro.kind, "reorder");
  assert.equal(ro.matchMode, "sentence");
  assert.deepEqual(ro.tokens, []);

  const rw = applyFormat(emptyField(1), GENERAL_ALL_FORMATS.find((f) => f.key === "g-rewrite"));
  assert.equal(rw.kind, "fill");
  assert.equal(rw.matchMode, "sentence");
  assert.equal(rw.formatLabel, GENERAL_LABELS.rewrite);

  const mcq = applyFormat(emptyField(1), questionFormatsFor("reading", "ielts")[0]);
  assert.equal(mcq.matchMode, "");
  assert.deepEqual(mcq.options, []);
});

test("applyFormatBasics: chỉ kind / formatLabel / matchMode, không đụng lựa chọn", () => {
  const f = emptyField(3);
  f.options = [{ id: "x", text: "keep" }];
  f.tokens = ["a", "b"];
  applyFormatBasics(f, GENERAL_ALL_FORMATS.find((x) => x.key === "g-reorder"));
  assert.equal(f.kind, "reorder");
  assert.equal(f.matchMode, "sentence");
  assert.deepEqual(f.tokens, ["a", "b"]);
  assert.deepEqual(f.options, [{ id: "x", text: "keep" }]);
});

// ---------------------------------------------------------------- khung đề

const build = (key, opts) => {
  const { template, error } = resolveTemplate(key, opts);
  assert.equal(error, null);
  return { template, built: buildSkeleton(template) };
};
const allFields = (skill) => skill.sections.flatMap((s) => s.fields);

test("buildSkeleton: THPT 40 câu, id 1..40 liền, đúng dạng, passage giữ chỗ", () => {
  const { template, built } = build("thpt");
  assert.deepEqual(Object.keys(built.skills), ["reading"]);
  assert.equal(built.durations.reading, "50");
  const secs = built.skills.reading.sections;
  assert.equal(secs.length, 6);
  assert.deepEqual(secs.map((s) => s.name), TEMPLATES.thpt.skills.reading.parts.map((p) => p.name));
  const fields = allFields(built.skills.reading);
  assert.equal(fields.length, 40);
  assert.equal(template.totalQuestions, 40);
  assert.deepEqual(fields.map((f) => f.id), Array.from({ length: 40 }, (_, i) => i + 1));
  // passage giữ chỗ đúng các phần passage: 1, 2, 4, 5, 6; phần 3 (không đoạn văn) mang dòng hướng dẫn
  assert.deepEqual(secs.map((s) => s.passageText), [
    PASSAGE_PLACEHOLDER, PASSAGE_PLACEHOLDER, TEMPLATES.thpt.skills.reading.parts[2].instruction,
    PASSAGE_PLACEHOLDER, PASSAGE_PLACEHOLDER, PASSAGE_PLACEHOLDER,
  ]);
  assert.ok(secs[0].fields.every((f) => f.formatLabel === GENERAL_LABELS.cloze && f.kind === "mcq"));
  assert.ok(secs[2].fields.every((f) => f.formatLabel === GENERAL_LABELS.arrange));
  // câu chọn đáp án: 4 ô trống
  for (const f of fields) {
    assert.equal(f.options.length, 4, `câu ${f.id}`);
    assert.ok(f.options.every((o) => o.text === ""));
    assert.deepEqual(f.correctOptionIds, []);
  }
});

test("buildSkeleton: HCM 40 câu, phần trộn dạng, passage g-phrase, kind từng dạng", () => {
  const { built } = build("hcm10");
  const secs = built.skills.reading.sections;
  assert.equal(built.durations.reading, "90");
  const fields = allFields(built.skills.reading);
  assert.equal(fields.length, 40);
  assert.deepEqual(fields.map((f) => f.id), Array.from({ length: 40 }, (_, i) => i + 1));
  assert.deepEqual(secs[0].fields.map((f) => f.formatLabel), [
    GENERAL_LABELS.pron, GENERAL_LABELS.pron, GENERAL_LABELS.stress, GENERAL_LABELS.stress,
  ]);
  assert.equal(secs[5].name, "Part 6 — Guided phrases");
  assert.equal(secs[5].passageText, PASSAGE_PLACEHOLDER); // g-phrase có passage
  assert.ok(secs[4].fields.every((f) => f.kind === "fill" && f.matchMode === "sentence")); // word form
  assert.ok(secs[6].fields.every((f) => f.kind === "fill" && f.matchMode === "sentence")); // rewrite
  assert.equal(secs[4].passageText, TEMPLATES.hcm10.skills.reading.parts[4].instruction);
  // g-ocloze không có trong khuôn nào
  for (const t of Object.values(TEMPLATES)) {
    for (const sk of Object.values(t.skills)) {
      for (const p of sk.parts) assert.ok(p.questions.every((q) => q.format !== "g-ocloze"));
    }
  }
});

test("buildSkeleton: School test, listening tuỳ chọn, id mỗi kỹ năng bắt đầu từ 1, reorder giữ kind", () => {
  const without = build("school").built;
  assert.deepEqual(Object.keys(without.skills), ["reading"]);
  const { built } = build("school", { includeListening: true });
  assert.deepEqual(Object.keys(built.skills).sort(), ["listening", "reading"]);
  assert.equal(built.durations.listening, "15");
  assert.equal(built.durations.reading, "45");
  assert.deepEqual(allFields(built.skills.listening).map((f) => f.id), Array.from({ length: 10 }, (_, i) => i + 1));
  assert.deepEqual(allFields(built.skills.reading).map((f) => f.id), Array.from({ length: 28 }, (_, i) => i + 1));
  // listening không có passage
  assert.ok(built.skills.listening.sections.every((s) => s.passageText === ""));
  // g-tf: 2 lựa chọn cố định, không thêm ô trống
  const tf = built.skills.listening.sections[1].fields[0];
  assert.deepEqual(tf.options.map((o) => o.text), ["True", "False"]);
  // reorder giữ kind reorder, tokens rỗng
  const writing = built.skills.reading.sections[4];
  const reorder = writing.fields.filter((f) => f.formatLabel === GENERAL_LABELS.reorder);
  assert.equal(reorder.length, 3);
  assert.ok(reorder.every((f) => f.kind === "reorder" && f.matchMode === "sentence" && f.tokens.length === 0));
});

test("buildSkeleton: số câu chỉnh + phần trộn dạng + bỏ phần 0 câu", () => {
  const { template, built } = build("hcm10", { counts: { reading: [[1, 3], 0, 6, 6, 6, 2, 4] } });
  const secs = built.skills.reading.sections;
  assert.equal(secs.length, 6); // bỏ phần Vocabulary
  assert.equal(template.totalQuestions, 28);
  assert.equal(secs[0].fields.length, 4);
  assert.deepEqual(allFields(built.skills.reading).map((f) => f.id), Array.from({ length: 28 }, (_, i) => i + 1));
});

// ---------------------------------------------------------------- qua builder / server

function builderWith(built, program = "general") {
  const b = emptyBuilder();
  b.program = program;
  b.title = "From template";
  for (const k of Object.keys(built.skills)) {
    b.skills[k].sections = built.skills[k].sections;
    b.skills[k].durationMinutes = built.durations[k];
  }
  return b;
}

test("khung: qua builderToPayload + normalizeSections không mất gì, nháp hợp lệ", async () => {
  const { built } = build("thpt");
  const b = builderWith(built);
  const payload = builderToPayload(b);
  assert.equal("templateKey" in payload, false); // templateKey do trang thêm, không do builderToPayload
  assert.equal(payload.skills.reading.durationMinutes, 50);
  const norm = normalizeSections(payload.skills.reading.sections);
  assert.equal(norm.length, 6);
  assert.equal(norm.flatMap((s) => s.fields).length, 40);
  assert.deepEqual(norm.map((s) => s.name), built.skills.reading.sections.map((s) => s.name));
  assert.equal(norm[0].passageText, PASSAGE_PLACEHOLDER);
  assert.equal(norm[2].passageText, TEMPLATES.thpt.skills.reading.parts[2].instruction);
  // validateSections (không có audio/ảnh nên không chạm DB): lưu nháp được bằng luật hiện có
  assert.equal(await validateSections({ _id: "ws" }, "reading", norm), null);
  // Arrange có 4 lựa chọn trống nên cũng lưu được
  assert.equal(norm[2].fields[0].options.length, 4);
});

test("khung: reorder đi qua payload -> server -> editor vẫn là kind reorder", () => {
  const { built } = build("school");
  const b = builderWith(built);
  const sections = builderToPayload(b).skills.reading.sections;
  const norm = normalizeSections(sections);
  const back = sectionsToEditor(norm);
  const reorder = back[4].fields.filter((f) => f.formatLabel === GENERAL_LABELS.reorder);
  assert.equal(reorder.length, 3);
  assert.ok(reorder.every((f) => f.kind === "reorder"));
});

test("khung: listening cần audio nên chưa lưu được tới khi chọn audio", async () => {
  const { built } = build("school", { includeListening: true });
  const norm = normalizeSections(sectionsToPayload(built.skills.listening.sections, "listening"));
  assert.match(await validateSections({ _id: "ws" }, "listening", norm), /audio/);
});

test("khung: incompleteQuestions của THPT mới dựng liệt kê đủ 40 câu", () => {
  const { built } = build("thpt");
  const payload = builderToPayload(builderWith(built));
  const list = incompleteQuestions(payload.skills);
  const ids = new Set(list.map((x) => x.skill + ":" + x.fieldId));
  assert.equal(ids.size, 40);
  for (let i = 1; i <= 40; i++) assert.ok(ids.has("reading:" + i), `thiếu câu ${i}`);
});

test("khung HCM / School đầy đủ chữ giữ chỗ -> mọi câu đều dở", () => {
  for (const key of ["hcm10", "school"]) {
    const { template, built } = build(key);
    const list = incompleteQuestions(builderToPayload(builderWith(built)).skills);
    assert.equal(new Set(list.map((x) => x.fieldId)).size, template.totalQuestions, key);
  }
});

test("builderToPayload: đề thường không có key mới (IELTS/TOEIC giữ nguyên)", () => {
  for (const program of [null, "ielts", "toeic"]) {
    const b = emptyBuilder();
    b.program = program;
    b.title = "x";
    assert.deepEqual(Object.keys(builderToPayload(b)).sort(), ["classIds", "closesAt", "level", "opensAt", "skills", "title", "unit"]);
  }
});

// ---------------------------------------------------------------- describeIncomplete

test("describeIncomplete: tối đa 10 dòng + 'and N more', gộp lý do cùng câu", () => {
  const list = Array.from({ length: 13 }, (_, i) => ({ skill: "reading", fieldId: i + 1, reason: "no correct answer" }));
  const d = describeIncomplete(list);
  assert.equal(d.total, 13);
  assert.equal(d.lines.length, 11);
  assert.equal(d.lines[0], "Question 1 — no correct answer");
  assert.equal(d.lines[10], "and 3 more");
  assert.deepEqual(d.first, { skill: "reading", fieldId: 1, reasons: ["no correct answer"] });

  const dup = describeIncomplete([
    { skill: "reading", fieldId: 5, reason: "the passage is still empty" },
    { skill: "reading", fieldId: 5, reason: "no correct answer" },
  ]);
  assert.equal(dup.total, 1);
  assert.equal(dup.lines[0], "Question 5 — the passage is still empty; no correct answer");

  const both = describeIncomplete([
    { skill: "listening", fieldId: 1, reason: "an option is empty" },
    { skill: "reading", fieldId: 1, reason: "no correct answer" },
  ]);
  assert.equal(both.lines[0], "Listening Question 1 — an option is empty");
  assert.equal(describeIncomplete([]).total, 0);
});

test("registry: chỉ General có khuôn / publishCheck (UI đọc registry)", () => {
  assert.equal(PROGRAMS.general.testTemplates.length > 0, true);
  assert.equal(PROGRAMS.ielts.publishCheck || PROGRAMS.toeic.publishCheck, false);
});

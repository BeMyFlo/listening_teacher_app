// Phase 8 bước 5 — builder: dạng câu hỏi theo chương trình, câu letter-only
// (5.3a), ảnh riêng của câu (5.4), tab kỹ năng / thời lượng mặc định (5.1–5.2).
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const { questionFormatsFor } = require("../lib/teacher/questionFormats");
const {
  emptyField,
  sectionsToEditor,
  sectionsToPayload,
} = require("../lib/teacher/sectionTransforms");
const { emptyBuilder, builderToPayload, testToBuilder, testSkillsFor, defaultDurationsFor } = require("../lib/teacher/testBuilder");
const {
  LETTER_FORMAT_LABEL,
  letterOptions,
  isLetterOnlyField,
  isLetterEditorField,
} = require("../lib/letterQuestion");
const { normalizeSections } = require("../lib/testSections");

const sha = (x) => crypto.createHash("sha256").update(JSON.stringify(x)).digest("hex");

// ---- Dạng câu hỏi ----
// Hash của [READING, LISTENING] IELTS TRƯỚC Phase 8 (chụp từ lib/teacher/questionFormats.js
// ở commit 8d55a9c). Đổi bất kỳ dạng cũ nào (key, nhãn, kind, cờ, thứ tự) là test này đỏ.
const OLD_IELTS_FORMATS_SHA256 = "6688f70b1ef59d70aac02ab5a94ab7fa43f9827b13d94a0c0310d7cf42db1178";

test("IELTS format lists: exactly the old ones (+ the new letter format appended last to Listening)", () => {
  for (const program of [undefined, "ielts"]) {
    const reading = questionFormatsFor("reading", program);
    const listening = questionFormatsFor("listening", program);
    assert.equal(reading.length, 16);
    assert.equal(listening.length, 12);
    const last = listening[listening.length - 1];
    assert.equal(last.kind, "letter");
    assert.equal(last.label, LETTER_FORMAT_LABEL);
    assert.equal(sha([reading, listening.slice(0, -1)]), OLD_IELTS_FORMATS_SHA256);
  }
  assert.equal(questionFormatsFor("grammar"), null);
  assert.equal(questionFormatsFor("vocabulary", "ielts"), null);
});

test("TOEIC format lists match the plan table", () => {
  const l = questionFormatsFor("listening", "toeic");
  assert.deepEqual(
    l.map((f) => [f.key, f.label, f.kind]),
    [
      ["tl-p1", "Part 1 — Photographs", "letter"],
      ["tl-p2", "Part 2 — Question–Response", "letter"],
      ["tl-p3", "Part 3 — Conversations", "mcq"],
      ["tl-p3g", "Part 3 — Conversation with graphic", "mcq"],
      ["tl-p4", "Part 4 — Talks", "mcq"],
      ["tl-p4g", "Part 4 — Talk with graphic", "mcq"],
    ]
  );
  assert.equal(l[0].letterOptions, 4);
  assert.equal(l[0].needsFieldImage, true);
  assert.equal(l[1].letterOptions, 3);
  assert.ok(!l[1].needsFieldImage);
  assert.deepEqual(l.filter((f) => f.needsFieldImage).map((f) => f.key), ["tl-p1", "tl-p3g", "tl-p4g"]);

  const r = questionFormatsFor("reading", "toeic");
  assert.deepEqual(
    r.map((f) => f.key),
    ["tr-p5", "tr-p6", "tr-p6s", "tr-p7", "tr-p7m", "tr-p7i"]
  );
  assert.ok(r.every((f) => f.kind === "mcq"));
  assert.deepEqual(r.find((f) => f.key === "tr-p7i").presetOptions, ["[1]", "[2]", "[3]", "[4]"]);

  // Mọi key / nhãn trong một danh sách là duy nhất (dropdown dựa vào nhãn).
  for (const list of [l, r]) {
    assert.equal(new Set(list.map((f) => f.key)).size, list.length);
    assert.equal(new Set(list.map((f) => f.label)).size, list.length);
  }
  // TOEIC không có dạng Writing/Speaking, Grammar/Vocab không có danh sách riêng.
  assert.equal(questionFormatsFor("grammar", "toeic"), null);
});

// ---- Letter-only ----
test("letterOptions builds A..D", () => {
  assert.deepEqual(letterOptions(3), [
    { value: "A", label: "A" },
    { value: "B", label: "B" },
    { value: "C", label: "C" },
  ]);
  assert.equal(letterOptions(4).length, 4);
  assert.equal(letterOptions(9).length, 4);
  assert.equal(letterOptions(1).length, 2);
});

test("isLetterOnlyField: choice + empty label + letter options (or letter format label)", () => {
  const base = { type: "choice", label: "", selectCount: 1, options: letterOptions(3), answers: ["B"] };
  assert.equal(isLetterOnlyField(base), true);
  assert.equal(isLetterOnlyField({ ...base, options: letterOptions(4) }), true);
  // đề có chữ -> không phải letter-only, trừ khi formatLabel thuộc dạng này
  assert.equal(isLetterOnlyField({ ...base, label: "Where is the library?" }), false);
  assert.equal(isLetterOnlyField({ ...base, label: "x", formatLabel: LETTER_FORMAT_LABEL }), true);
  // lựa chọn có chữ thật
  assert.equal(
    isLetterOnlyField({ ...base, options: [{ value: "a", label: "A" }, { value: "b", label: "Library" }] }),
    false
  );
  // ngoài A–D, quá ít / quá nhiều lựa chọn, fill, chọn nhiều
  assert.equal(isLetterOnlyField({ ...base, options: [{ value: "e", label: "E" }, { value: "f", label: "F" }] }), false);
  assert.equal(isLetterOnlyField({ ...base, options: letterOptions(2).slice(0, 1) }), false);
  assert.equal(isLetterOnlyField({ ...base, type: "fill" }), false);
  assert.equal(isLetterOnlyField({ ...base, selectCount: 2 }), false);
  assert.equal(isLetterOnlyField(null), false);
  assert.equal(isLetterOnlyField({ type: "choice", label: "", options: [] }), false);
});

test("isLetterEditorField needs the letter formatLabel (a half-typed mcq must not morph)", () => {
  const opts = [{ id: "A", text: "A" }, { id: "B", text: "B" }, { id: "C", text: "C" }];
  const f = { ...emptyField(7), kind: "mcq", formatLabel: LETTER_FORMAT_LABEL, options: opts };
  assert.equal(isLetterEditorField(f), true);
  assert.equal(isLetterEditorField({ ...f, formatLabel: "Part 2 — Question–Response" }), true);
  assert.equal(isLetterEditorField({ ...f, formatLabel: "" }), false);
  assert.equal(isLetterEditorField({ ...f, formatLabel: "Multiple Choice (1 đáp án)" }), false);
  assert.equal(isLetterEditorField({ ...f, kind: "fill" }), false);
  assert.equal(isLetterEditorField({ ...f, options: [{ id: "x", text: "Library" }, { id: "y", text: "Park" }] }), false);
});

test("a letter question round-trips as a plain choice field (label '', A/B/C, answers ['B'])", () => {
  const f = {
    ...emptyField(7),
    kind: "mcq",
    formatLabel: "Part 2 — Question–Response",
    label: "",
    options: [{ id: "A", text: "A" }, { id: "B", text: "B" }, { id: "C", text: "C" }],
    correctOptionIds: ["B"],
  };
  const [sec] = sectionsToPayload([{ name: "Part 2", audioId: "aud1", fields: [f] }], "listening");
  const out = sec.fields[0];
  assert.equal(out.type, "choice");
  assert.equal(out.label, "");
  assert.deepEqual(out.options, [{ value: "A", label: "A" }, { value: "B", label: "B" }, { value: "C", label: "C" }]);
  assert.deepEqual(out.answers, ["B"]);
  assert.equal(out.selectCount, 1);
  assert.equal(out.formatLabel, "Part 2 — Question–Response");
  assert.equal(isLetterOnlyField(out), true);
  // server -> editor lại thành câu letter
  const [back] = sectionsToEditor([sec]);
  assert.equal(isLetterEditorField(back.fields[0]), true);
  assert.deepEqual(back.fields[0].correctOptionIds, ["B"]);
});

// ---- imageId của câu ----
test("normalizeSections keeps field.imageId (and leaves it undefined when absent)", () => {
  const [sec] = normalizeSections([
    {
      name: "Part 1",
      fields: [
        { id: 1, type: "choice", label: "", imageId: "665f1c2e8b3a4d0012345678", options: letterOptions(4), answers: ["A"] },
        { id: 2, type: "choice", label: "Q", options: letterOptions(3), answers: ["B"] },
      ],
    },
  ]);
  assert.equal(String(sec.fields[0].imageId), "665f1c2e8b3a4d0012345678");
  assert.equal(sec.fields[1].imageId, undefined);
  assert.equal(sec.fields[0].label, "");
});

test("sectionTransforms carries field imageId both ways + emptyField", () => {
  assert.equal(emptyField(1).imageId, "");
  const f = { ...emptyField(1), kind: "mcq", label: "Q", options: [{ id: "a", text: "x" }, { id: "b", text: "y" }], correctOptionIds: ["a"] };
  // không ảnh -> payload không có key imageId (bài IELTS cũ giữ nguyên)
  const [plain] = sectionsToPayload([{ name: "s", fields: [f] }], "reading");
  assert.equal("imageId" in plain.fields[0], false);
  // có ảnh -> gửi lên; từ server về -> editor (kể cả khi đã populate thành object)
  const [withImg] = sectionsToPayload([{ name: "s", fields: [{ ...f, imageId: "img1" }] }], "reading");
  assert.equal(withImg.fields[0].imageId, "img1");
  const [ed1] = sectionsToEditor([withImg]);
  assert.equal(ed1.fields[0].imageId, "img1");
  const [ed2] = sectionsToEditor([{ ...withImg, fields: [{ ...withImg.fields[0], imageId: { _id: "img2" } }] }]);
  assert.equal(ed2.fields[0].imageId, "img2");
  // fill + matching cũng giữ ảnh khi nạp lại
  const fillBack = sectionsToEditor([{ fields: [{ id: 1, type: "fill", answers: ["x"], imageId: "img3" }] }]);
  assert.equal(fillBack[0].fields[0].imageId, "img3");
  const noneBack = sectionsToEditor([{ fields: [{ id: 1, type: "fill", answers: ["x"] }] }]);
  assert.equal(noneBack[0].fields[0].imageId, "");
});

// ---- Test builder ----
test("emptyBuilder: IELTS unchanged (blank durations), TOEIC uses defaultDurations", () => {
  for (const b of [emptyBuilder(), emptyBuilder("ielts")]) {
    assert.deepEqual(
      ["listening", "reading", "writing", "speaking"].map((k) => b.skills[k].durationMinutes),
      ["", "", "", ""]
    );
  }
  const t = emptyBuilder("toeic");
  assert.equal(t.skills.listening.durationMinutes, "45");
  assert.equal(t.skills.reading.durationMinutes, "75");
  assert.equal(t.skills.writing.durationMinutes, "60");
  assert.equal(t.skills.speaking.durationMinutes, "20");
  assert.deepEqual(defaultDurationsFor("ielts"), {});
  assert.deepEqual(defaultDurationsFor(undefined), {});
});

test("testSkillsFor: IELTS và TOEIC đều có đủ 4 kỹ năng (8B)", () => {
  assert.deepEqual(testSkillsFor(null).map((s) => s.key), ["listening", "reading", "writing", "speaking"]);
  assert.deepEqual(testSkillsFor("ielts").map((s) => s.key), ["listening", "reading", "writing", "speaking"]);
  assert.deepEqual(testSkillsFor("toeic").map((s) => s.key), ["listening", "reading", "writing", "speaking"]);
});

test("builderToPayload: TOEIC sends Writing/Speaking (8B) with task fields; IELTS prompts keep the old shape", () => {
  const b = emptyBuilder("toeic");
  b.title = "TOEIC mock";
  b.program = "toeic";
  b.skills.writing.prompts = [{
    _id: "p", title: "t", instructions: "i", imageId: "im", writingTask: "task2",
    taskType: "toeic.w.picture", requiredWords: ["a", "b"], audioId: "", audioPlays: 1, prepSeconds: "", responseSeconds: "96",
  }];
  b.skills.speaking.durationMinutes = "14";
  const p = builderToPayload(b);
  assert.equal(p.skills.writing.prompts.length, 1);
  assert.deepEqual(p.skills.writing.prompts[0], {
    _id: "p", title: "t", instructions: "i", imageId: "im", writingTask: "task2",
    taskType: "toeic.w.picture", requiredWords: ["a", "b"], audioId: null, audioPlays: 1, prepSeconds: null, responseSeconds: 96,
  });
  assert.equal(p.skills.speaking.durationMinutes, 14);
  assert.equal(p.skills.listening.durationMinutes, 45);

  // Round trip: testToBuilder dựng lại đúng field task (giây dạng chuỗi), prompt IELTS không thêm field.
  const back = testToBuilder({ skills: { writing: { prompts: [
    { _id: "p", title: "t", instructions: "i", imageId: "im", taskType: "toeic.w.picture", requiredWords: ["a", "b"], audioPlays: 1, prepSeconds: null, responseSeconds: 96 },
    { _id: "q", title: "t", instructions: "i" },
  ] } } });
  assert.equal(back.skills.writing.prompts[0].responseSeconds, "96");
  assert.equal(back.skills.writing.prompts[0].prepSeconds, "");
  assert.deepEqual(Object.keys(back.skills.writing.prompts[1]).sort(), ["_id", "imageId", "instructions", "title", "writingTask"]);

  const i = emptyBuilder();
  i.title = "IELTS mock";
  i.skills.writing.prompts = [{ _id: "p", title: "t", instructions: "i", imageId: "", writingTask: "task1" }];
  i.skills.speaking.durationMinutes = "14";
  const ip = builderToPayload(i);
  assert.equal(ip.skills.writing.prompts.length, 1);
  assert.equal(ip.skills.speaking.durationMinutes, 14);
});

test("validateSections accepts a letter question (choice with empty label) and rejects option-less choices", async () => {
  const { validateSections } = require("../lib/testSections");
  const letter = normalizeSections([
    { name: "Part 2", fields: [{ id: 7, type: "choice", label: "", options: letterOptions(3), answers: ["B"] }] },
  ]);
  // "grammar": không cần audio/ảnh nên không chạm DB.
  assert.equal(await validateSections({}, "grammar", letter), null);
  const broken = normalizeSections([{ name: "x", fields: [{ id: 1, type: "choice", label: "", options: [], answers: [] }] }]);
  assert.match(await validateSections({}, "grammar", broken), /requires either individual options/);
});

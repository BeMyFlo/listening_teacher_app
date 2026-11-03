const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { workbookToSections, workbookToGrammar } = require("../lib/csvImport");
const { readWorkbook } = require("../lib/xlsxRead");
const { toEditorSections } = require("../lib/teacher/importConvert");
const { questionFormatsFor } = require("../lib/teacher/questionFormats");

const read = (...p) => readWorkbook(fs.readFileSync(path.join(__dirname, "..", ...p)));

test("file mẫu Mau_Reading.xlsx: đoạn văn + tự nhận trắc nghiệm / TFNG / NOT GIVEN / Matching Headings", () => {
  const { sections, warnings } = workbookToSections(read("public", "templates", "Mau_Reading.xlsx"));
  assert.deepEqual(warnings, []);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].name, "Urban Gardening");
  assert.match(sections[0].passageText, /^\[A\] Urban gardening/);
  assert.match(sections[0].passageText, /\n\[B\]/);

  const qs = sections[0].fields;
  assert.deepEqual(qs.map((q) => q.kind), ["mcq", "tfng", "tfng", "tfng", "matching", "matching", "matching", "fill"]);
  assert.deepEqual(qs.map((q) => q.id), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(qs.slice(1, 4).map((q) => q.correctOptionIds[0]), ["false", "true", "ng"]);
  assert.deepEqual(qs.slice(4, 7).map((q) => q.matchingBankText), [
    "i. A worldwide trend",
    "iii. Types of urban planting",
    "ii. The social benefits of green spaces",
  ]);
  assert.equal(qs[7].hint, "NO MORE THAN TWO WORDS");
});

test("đưa vào builder: Summary Completion thành khung ghi chú, tên dạng đúng nút của app", () => {
  const { sections } = workbookToSections(read("public", "templates", "Mau_Reading.xlsx"));
  const [s] = toEditorSections(sections, [], { subject: "reading", program: "ielts" });
  assert.equal(s.noteMode, true);
  assert.deepEqual(s.noteBlocks.map((b) => b.noteText), ["Urban gardens improve air quality and promote [[8]] among neighbours."]);
  assert.equal(s.fields[4].formatLabel, "Matching Headings");
  assert.equal(s.fields[7].formatLabel, "Summary Completion (không có danh sách từ)");
});

test("không ghi Dạng bài: YES/NO/NOT GIVEN -> YNNG; NOT GIVEN theo câu TF/YN gần nhất trong section", () => {
  const head = ["Section", "Câu hỏi", "Đáp án"];
  const wb = {
    "Câu hỏi": [
      head,
      ["1", "The writer agrees.", "YES"],
      ["", "The writer is unsure.", "NOT GIVEN"],
      ["2", "It rains a lot.", "true"],
      ["", "It is cold.", "Not Given"],
      ["3", "Unknown first.", "NOT GIVEN"],
    ],
  };
  const { sections, warnings } = workbookToSections(wb);
  assert.deepEqual(warnings, []);
  assert.deepEqual(sections.map((s) => s.fields.map((f) => f.kind)), [["ynng", "ynng"], ["tfng", "tfng"], ["tfng"]]);
});

test("Grammar: đáp án 'no' vẫn là câu điền từ, không thành Yes/No/Not Given", () => {
  const wb = { "Bài tập": [["Chủ điểm", "Câu hỏi", "Đáp án"], ["Quantifiers", "I have ___ money left.", "no"]] };
  const { topics } = workbookToGrammar(wb, null);
  const f = topics[0].importSections[0].fields[0];
  assert.equal(f.kind, "fill");
  assert.equal(f.answersText, "no");
});

test("16 tên Dạng bài trong file mẫu khớp đúng các nút dạng bài Reading của builder", () => {
  const guide = read("public", "templates", "Mau_Reading.xlsx")["Hướng dẫn"];
  const start = guide.findIndex((r) => /^CÁC DẠNG BÀI/.test(r[0] || "")) + 1;
  const labels = questionFormatsFor("reading", "ielts").map((f) => f.label);
  assert.deepEqual(guide.slice(start, start + labels.length).map((r) => r[0]), labels);
});

test("file Reading cũ của cô (Passage_ID, Dang_bai không dấu) vẫn đọc đủ 7 câu", () => {
  const { sections, warnings } = workbookToSections(read("IELTS_Reading_Sheet.xlsx"));
  assert.deepEqual(warnings, []);
  assert.equal(sections[0].name, "Urban Gardening");
  assert.ok(sections[0].passageText.length > 100);
  assert.deepEqual(sections[0].fields.map((f) => f.kind), ["mcq", "tfng", "tfng", "matching", "matching", "matching", "fill"]);
  const [s] = toEditorSections(sections, [], { subject: "reading", program: "ielts" });
  assert.equal(s.fields[0].formatLabel, "Multiple Choice (1 đáp án)");
});

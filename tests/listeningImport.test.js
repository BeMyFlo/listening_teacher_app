const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { workbookToSections } = require("../lib/csvImport");
const { readWorkbook } = require("../lib/xlsxRead");
const { toEditorSections, findAudio } = require("../lib/teacher/importConvert");
const { questionFormatsFor } = require("../lib/teacher/questionFormats");
const { isLetterEditorField } = require("../lib/letterQuestion");

const read = (...p) => readWorkbook(fs.readFileSync(path.join(__dirname, "..", ...p)));

test("file mẫu Mau_Listening.xlsx: đọc đúng Section, Dạng bài, Choose TWO, Listen and choose", () => {
  const { sections, warnings } = workbookToSections(read("public", "templates", "Mau_Listening.xlsx"));
  assert.deepEqual(warnings, []);
  assert.deepEqual(sections.map((s) => s.name), ["Library Membership", "Campus Tour"]);
  assert.match(sections[0].transcript, /Good morning/);

  const [f1, f2, f3, mc] = sections[0].fields;
  assert.deepEqual([f1, f2, f3].map((f) => [f.kind, f.formatName]), [
    ["fill", "Form Completion"],
    ["fill", "Form Completion"],
    ["fill", "Form Completion"],
  ]);
  assert.equal(f3.answersText, "six\n6");
  assert.equal(f3.hint, "ONE WORD AND/OR A NUMBER");
  assert.equal(mc.kind, "mcq");
  assert.deepEqual(mc.correctOptionIds, [mc.options[1].id]); // B

  const [two, m1, m2, sc, letter] = sections[1].fields;
  assert.deepEqual([two.id, two.idEnd, two.score], [5, 6, 2]);
  assert.deepEqual(two.correctOptionIds, [two.options[1].id, two.options[4].id]); // B, E
  assert.equal(m1.kind, "matching");
  assert.equal(m1.matchingBankText, "the car park"); // C theo vị trí cột
  assert.equal(m2.matchingBankText, "the main gate");
  assert.deepEqual(sections[1].matchBankTexts, ["the main gate", "the library", "the car park"]);
  assert.equal(sc.kind, "fill");
  // Listen and choose: không có đề, vẫn ở Section 2 (lấy theo dòng trên), lựa chọn A–D tự tạo.
  assert.equal(letter.id, 10);
  assert.equal(letter.label, "");
  assert.deepEqual(letter.options.map((o) => o.text), ["A", "B", "C", "D"]);
  assert.deepEqual(letter.correctOptionIds, [letter.options[1].id]);
});

test("đưa vào builder: gán đúng tên dạng, 3 dòng Form Completion thành 1 khung, giữ khoảng số 5-6", () => {
  const { sections } = workbookToSections(read("public", "templates", "Mau_Listening.xlsx"));
  const ed = toEditorSections(sections, [], { subject: "listening", program: "ielts" });

  const s1 = ed[0];
  assert.equal(s1.noteMode, true);
  assert.equal(s1.noteBlocks.length, 1);
  assert.equal(
    s1.noteBlocks[0].noteText,
    "Name: Sarah [[1]]\nPhone number: [[2]]\nMembership must be renewed every [[3]] months"
  );
  assert.deepEqual(s1.fields.map((f) => f.formatLabel), [
    "Form Completion",
    "Form Completion",
    "Form Completion",
    "Multiple Choice (1 đáp án)",
  ]);
  assert.equal(s1.fields[0].label, "");
  assert.equal(s1.fields[3].label, "What time does the library open on weekdays?");
  assert.ok(s1.fields.every((f) => !("formatName" in f)));

  const s2 = ed[1];
  assert.equal(s2.noteMode, false);
  assert.deepEqual(s2.fields.map((f) => [f.id, f.idEnd]), [[5, 6], [7, null], [8, null], [9, null], [10, null]]);
  assert.ok(isLetterEditorField(s2.fields[4]));
});

test("ghép khung chỉ với các dòng LIỀN NHAU cùng dạng; tên dạng file cũ không dấu vẫn khớp", () => {
  const head = ["Section", "Dạng bài", "Câu hỏi", "Lựa chọn A", "Lựa chọn B", "Đáp án"];
  const wb = {
    "Câu hỏi": [
      head,
      ["1", "Note Completion", "Topic: ___", "", "", "water"],
      ["", "Note Completion", "Cost", "", "", "free"], // không có ___ -> ô trống ở cuối dòng
      ["", "Short Answer Questions", "Who runs the club?", "", "", "Tom"],
      ["", "Note Completion", "Day: ___", "", "", "Monday"],
      ["", "Multiple Choice (1 dap an)", "Pick one", "yes", "no", "A"],
    ],
  };
  const { sections, warnings } = workbookToSections(wb);
  assert.deepEqual(warnings, []);
  const [s] = toEditorSections(sections, [], { subject: "listening", program: "ielts" });
  assert.deepEqual(s.noteBlocks.map((b) => b.noteText), ["Topic: [[1]]\nCost [[2]]", "Day: [[4]]"]);
  assert.equal(s.fields[2].label, "Who runs the club?");
  assert.equal(s.fields[4].formatLabel, "Multiple Choice (1 đáp án)");
});

test("12 tên Dạng bài trong file mẫu khớp đúng các nút dạng bài Listening của builder", () => {
  const guide = read("public", "templates", "Mau_Listening.xlsx")["Hướng dẫn"];
  const start = guide.findIndex((r) => /^CÁC DẠNG BÀI/.test(r[0] || "")) + 1;
  const labels = questionFormatsFor("listening", "ielts").map((f) => f.label);
  // Dropdown cột Dạng bài trỏ vào $A$17:$A$28 -> danh sách phải bắt đầu đúng dòng 17.
  assert.equal(start, 16);
  assert.deepEqual(guide.slice(start, start + labels.length).map((r) => r[0]), labels);
});

test("Section chỉ ghi số, không có tab Bài nghe -> tên 'Section N' (cột Part cũng nhận)", () => {
  const wb = { "Câu hỏi": [["Part", "Câu hỏi", "Đáp án"], ["1", "q ___", "a"], ["", "q2 ___", "b"], ["2", "q3 ___", "c"]] };
  const { sections, warnings } = workbookToSections(wb);
  assert.deepEqual(warnings, []);
  assert.deepEqual(sections.map((s) => [s.name, s.fields.length]), [["Section 1", 2], ["Section 2", 1]]);
});

test("file Listening cũ của cô: tab Bai nghe giờ được đọc (tên bài + transcript)", () => {
  const { sections, warnings } = workbookToSections(read("IELTS_Listening_Sheet.xlsx"));
  assert.deepEqual(warnings, []);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].name, "Library Opening Hours");
  assert.match(sections[0].transcript, /library opening hours/i);
  assert.deepEqual(sections[0].fields.map((f) => f.kind), ["mcq", "fill", "fill"]);
});

test("Matching Headings (Reading): đáp án 'i' vẫn khớp nhãn 'i.' chứ không phải cột thứ 9", () => {
  const head = ["Passage_ID", "Dang_bai", "Noi_dung_cau_hoi", "Lua_chon_A", "Lua_chon_B", "Lua_chon_C", "Dap_an_dung"];
  const opts = ["ii. Second heading", "iii. Third heading", "i. First heading"];
  const wb = { "Cau hoi": [head, ["P1", "Matching Headings", "Paragraph A", ...opts, "i"]] };
  const { sections } = workbookToSections(wb);
  assert.equal(sections[0].fields[0].matchingBankText, "i. First heading");
});

test("cột Audio: khớp audio trong kho theo tên (không phân biệt hoa thường/dấu) hoặc link; trống / không thấy -> để trống", () => {
  const audios = [
    { _id: "a1", title: "Listening 2A – Library Membership", unit: "", cloudinaryUrl: "https://res.cloudinary.com/x/a1.mp3" },
    { _id: "a2", title: "Campus Tour", unit: "Unit 3", cloudinaryUrl: "https://res.cloudinary.com/x/a2.mp3" },
  ];
  assert.equal(findAudio("listening 2a – library membership", audios)._id, "a1");
  assert.equal(findAudio("Unit 3 · Campus Tour", audios)._id, "a2");
  assert.equal(findAudio("https://res.cloudinary.com/x/a2.mp3", audios)._id, "a2");
  assert.equal(findAudio("Không có bài này", audios), null);
  assert.equal(findAudio("", audios), null);

  const { sections } = workbookToSections(read("public", "templates", "Mau_Listening.xlsx"));
  const ed = toEditorSections(sections, [], { subject: "listening", program: "ielts", audios });
  assert.deepEqual(ed.map((s) => s.audioId), ["a1", ""]);
  // Không truyền kho audio (vd Reading) -> không gắn gì.
  assert.deepEqual(toEditorSections(sections, []).map((s) => s.audioId), ["", ""]);
});

test("file cũ: cột Link_audio là link Drive không có trong kho -> Section để trống audio", () => {
  const { sections } = workbookToSections(read("IELTS_Listening_Sheet.xlsx"));
  assert.match(sections[0].audioRef, /drive\.google\.com/);
  const [s] = toEditorSections(sections, [], { subject: "listening", program: "ielts", audios: [] });
  assert.equal(s.audioId, "");
});

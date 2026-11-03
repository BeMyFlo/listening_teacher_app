const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { workbookToGrammar, workbookToVocab } = require("../lib/csvImport");
const { readWorkbook } = require("../lib/xlsxRead");

const fields = (topic) => topic.importSections.flatMap((s) => s.fields);

test("file mẫu Mau_Grammar.xlsx: đọc cả lý thuyết lẫn bài tập, không cảnh báo", () => {
  const wb = readWorkbook(fs.readFileSync(path.join(__dirname, "..", "public", "templates", "Mau_Grammar.xlsx")));
  const { topics, warnings } = workbookToGrammar(wb, null);
  assert.deepEqual(warnings, []);
  assert.deepEqual(topics.map((t) => t.name), ["Present Perfect", "Passive Voice"]);

  const pp = topics[0];
  assert.match(pp.lesson.formula, /have\/has \+ V3/);
  assert.match(pp.lesson.commonMistakes, /yesterday/);
  assert.equal(fields(pp).length, 2);
  const q1 = fields(pp)[0];
  assert.equal(q1.kind, "fill");
  assert.equal(q1.answersText, "have lived");
  assert.equal(q1.hint, "live");
  assert.match(q1.explanation, /since/);

  const passive = fields(topics[1]);
  assert.equal(passive.length, 3);
  assert.equal(passive[2].answersText, "wasn't built\nwas not built");
});

test("file gộp: tên chủ điểm khớp không phân biệt hoa thường, ô trống lấy theo dòng trên", () => {
  const wb = {
    "Lý thuyết": [
      ["Chủ điểm", "Công thức"],
      ["Present Perfect", "S + have/has + V3"],
    ],
    "Bài tập": [
      ["Chủ điểm", "Câu hỏi", "Đáp án"],
      ["present  perfect ", "I ___ (live) here.", "have lived"],
      ["", "She ___ (be) here.", "has been"],
    ],
  };
  const { topics, warnings } = workbookToGrammar(wb, null);
  assert.deepEqual(warnings, []);
  assert.equal(topics.length, 1);
  assert.equal(topics[0].name, "Present Perfect");
  assert.equal(topics[0].lesson.formula, "S + have/has + V3");
  assert.deepEqual(fields(topics[0]).map((f) => f.answersText), ["have lived", "has been"]);
});

test("file gộp: tên gõ lệch giữa 2 tab -> cảnh báo", () => {
  const wb = {
    "Lý thuyết": [["Chủ điểm", "Công thức"], ["Present Perfect", "x"]],
    "Bài tập": [["Chủ điểm", "Câu hỏi", "Đáp án"], ["Present Perfet", "q", "a"]],
  };
  const { topics, warnings } = workbookToGrammar(wb, null);
  assert.equal(topics.length, 2);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Present Perfect/);
});

test("2 file cũ (Grammar_ID) chọn cùng lúc, gộp tab: vẫn nối theo mã, extId giữ nguyên", () => {
  const merged = {
    Grammar_BaiTap: [
      ["Grammar_ID", "Dang_bai", "So_thu_tu", "Noi_dung_cau_hoi", "Goi_y", "Dap_an_dung", "Giai_thich"],
      ["G01", "Chia động từ", "1", "I ___ (live) here.", "live", "have lived", "since"],
      ["G01", "Tìm và sửa lỗi", "2", "She has visited Paris last year.", "", "visited", ""],
    ],
    Grammar_LyThuyet: [
      ["Grammar_ID", "Ten_chu_diem", "Cong_thuc", "Khi_nao_dung", "Loi_thuong_gap", "Vi_du", "Link_video"],
      ["G01", "Present Perfect", "S + have/has + V3", "", "", "", "https://youtu.be/abcdefghijk"],
    ],
  };
  const { topics, warnings } = workbookToGrammar(merged, null);
  assert.deepEqual(warnings, []);
  assert.equal(topics.length, 1);
  assert.equal(topics[0].extId, "G01");
  assert.equal(topics[0].name, "Present Perfect");
  assert.equal(topics[0].lesson.videoUrl, "https://youtu.be/abcdefghijk");
  assert.equal(fields(topics[0]).length, 2);
  assert.equal(fields(topics[0])[0].explanation, "since");
});

test("file cũ truyền riêng lessonWb vẫn chạy như trước", () => {
  const ex = { Grammar_BaiTap: [["Grammar_ID", "Dang_bai", "Noi_dung_cau_hoi", "Dap_an_dung"], ["G02", "Điền từ", "English ___ spoken.", "is"]] };
  const les = { Grammar_LyThuyet: [["Grammar_ID", "Ten_chu_diem", "Cong_thuc"], ["G02", "Passive Voice", "S + be + V3"]] };
  const { topics } = workbookToGrammar(ex, les);
  assert.equal(topics.length, 1);
  assert.equal(topics[0].name, "Passive Voice");
  assert.equal(fields(topics[0])[0].answersText, "is");
});

// ---------------- Vocabulary ----------------

test("file mẫu Mau_Vocabulary.xlsx: từ vựng + bài tập, tự nhận trắc nghiệm / gõ đáp án", () => {
  const wb = readWorkbook(fs.readFileSync(path.join(__dirname, "..", "public", "templates", "Mau_Vocabulary.xlsx")));
  const { groups, warnings } = workbookToVocab(wb, null);
  assert.deepEqual(warnings, []);
  assert.deepEqual(groups.map((g) => g.name), ["Environment", "Education"]);

  const env = groups[0];
  // Dòng "sustainable" để trống Chủ đề -> vẫn thuộc Environment.
  assert.deepEqual(env.words.map((w) => w.word), ["pollution", "sustainable"]);
  assert.equal(env.words[0].meaning, "sự ô nhiễm");
  assert.equal(env.words[0].definitionEn, "damage caused by harmful substances");

  const qs = fields(env);
  assert.deepEqual(qs.map((q) => q.kind), ["mcq", "mcq", "fill"]);
  assert.equal(qs[0].options.length, 4);
  assert.deepEqual(qs[0].correctOptionIds, [qs[0].options[1].id]); // B
  assert.deepEqual(qs[1].correctOptionIds, [qs[1].options[2].id]); // C
  assert.equal(qs[2].answersText, "sustainable");
  assert.equal(qs[2].hint, "SUSTAIN");

  assert.equal(fields(groups[1])[0].answersText, "curriculum\nsyllabus");
});

test("vocab gộp: chỉ có danh sách từ (không bài tập) -> không cảnh báo", () => {
  const wb = { "Từ vựng": [["Chủ đề", "Từ vựng", "Nghĩa"], ["Jobs", "career", "sự nghiệp"]] };
  const { groups, warnings } = workbookToVocab(wb, null);
  assert.deepEqual(warnings, []);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].words[0].word, "career");
});

test("vocab: 2 file cũ (Unit_ID, Dang_bai) gộp tab vẫn chạy, Matching nghĩa giữ nguyên", () => {
  const merged = {
    Tu_vung: [
      ["Unit_ID", "Tu_vung", "Loai_tu", "Phien_am", "Nghia", "Dinh_nghia_TA", "Vi_du", "Collocation", "Dong_nghia", "Chu_de"],
      ["U01", "pollution", "n", "", "sự ô nhiễm", "", "", "", "", "Environment"],
    ],
    Tu_vung_BaiTap: [
      ["Unit_ID", "Nhom_cau", "Dang_bai", "So_thu_tu", "Noi_dung_cau_hoi", "Lua_chon_A", "Lua_chon_B", "Tu_khoa_goi_y", "Dap_an_dung"],
      ["U01", "", "Matching nghĩa", "1", "sự ô nhiễm", "pollution", "career", "", "pollution"],
      ["U01", "", "Word form", "2", "Air ___ is bad. (POLLUTE)", "", "", "POLLUTE", "pollution"],
    ],
  };
  const { groups, warnings } = workbookToVocab(merged, null);
  assert.deepEqual(warnings, []);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].extId, "U01");
  assert.equal(groups[0].name, "Environment");
  assert.deepEqual(fields(groups[0]).map((q) => q.kind), ["matching", "fill"]);
});

// Tạo 4 file .xlsx mẫu cho nút "Import Grammar/Vocabulary from file" vào
// public/templates/ — giáo viên tải về, điền theo, rồi upload lại.
// Cột + giá trị Dang_bai khớp đúng parser (lib/csvImport.js, lib/lessonImport.js).
// Chạy lại khi đổi template: node scripts/make-lesson-templates.js
const fs = require("fs");
const path = require("path");
const { makeZip } = require("../tests/helpers/makeZip");

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function colName(i) {
  let s = "";
  for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

// Hàng 1 in đậm (style 1), cố định khi cuộn; ô dùng inlineStr để khỏi cần sharedStrings.
// optional: các cột có header tô xám (style 3) = cột không bắt buộc.
// dropdowns: [{ col, values } | { col, source }] -> ô chọn từ danh sách (Data validation) cho cả cột;
// source = vùng ô chứa danh sách (khi danh sách dài quá 255 ký tự).
function sheetXml(rows, widths, optional = [], dropdowns = []) {
  const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
  const body = rows
    .map(
      (row, r) =>
        `<row r="${r + 1}">` +
        row
          .map((v, c) =>
            v === "" || v == null
              ? ""
              : `<c r="${colName(c)}${r + 1}" t="inlineStr" s="${r > 0 ? 2 : optional.includes(c) ? 3 : 1}"><is><t xml:space="preserve">${esc(v)}</t></is></c>`
          )
          .join("") +
        "</row>"
    )
    .join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${cols}</cols><sheetData>${body}</sheetData>` +
    (dropdowns.length
      ? `<dataValidations count="${dropdowns.length}">` +
        dropdowns
          .map(
            (d) =>
              `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${colName(d.col)}2:${colName(d.col)}1000">` +
              `<formula1>${d.source ? esc(d.source) : `&quot;${esc(d.values.join(","))}&quot;`}</formula1></dataValidation>`
          )
          .join("") +
        "</dataValidations>"
      : "") +
    "</worksheet>"
  );
}

const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFDDEBF7"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFEDEDED"/></patternFill></fill></fills>' +
  '<borders count="1"><border/></borders>' +
  '<cellStyleXfs count="1"><xf/></cellStyleXfs>' +
  '<cellXfs count="4"><xf/>' +
  '<xf fontId="1" fillId="2" applyFont="1" applyFill="1"/>' +
  '<xf applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf fontId="1" fillId="3" applyFont="1" applyFill="1"/>' +
  "</cellXfs></styleSheet>";

// sheets: [{ name, rows, widths }]
function makeXlsx(sheets) {
  const files = {
    "[Content_Types].xml":
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets
        .map(
          (_, i) =>
            `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
        )
        .join("") +
      "</Types>",
    "_rels/.rels":
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      "</Relationships>",
    "xl/workbook.xml":
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      "<sheets>" +
      sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
      "</sheets></workbook>",
    "xl/_rels/workbook.xml.rels":
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
        )
        .join("") +
      `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      "</Relationships>",
    "xl/styles.xml": STYLES,
  };
  sheets.forEach((s, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(s.rows, s.widths, s.optional, s.dropdowns)));
  return makeZip(files);
}

// Đúng thứ tự + chữ của LISTENING_FORMATS trong lib/teacher/questionFormats.js (test
// tests/listeningImport.test.js giữ 2 nơi khớp nhau) — giáo viên chọn y hệt nút trong app.
const LISTENING_FORMAT_LABELS = [
  "Multiple Choice (1 đáp án)",
  "Multiple Choice (nhiều đáp án)",
  "Matching",
  "Plan/Map/Diagram Labelling",
  "Form Completion",
  "Note Completion",
  "Table Completion",
  "Flow-chart Completion",
  "Summary Completion",
  "Sentence Completion",
  "Short Answer Questions",
  "Listen and choose — no printed question",
];

// Đúng thứ tự + chữ của READING_FORMATS trong lib/teacher/questionFormats.js (test
// tests/readingImport.test.js giữ 2 nơi khớp nhau).
const READING_FORMAT_LABELS = [
  "Multiple Choice (1 đáp án)",
  "Multiple Choice (nhiều đáp án)",
  "True/False/Not Given",
  "Yes/No/Not Given",
  "Matching Headings",
  "Matching Information",
  "Matching Features",
  "Matching Sentence Endings",
  "Sentence Completion",
  "Summary Completion (có danh sách từ)",
  "Summary Completion (không có danh sách từ)",
  "Note Completion",
  "Table Completion",
  "Flow-chart Completion",
  "Diagram Label Completion",
  "Short Answer Questions",
];

// Tab "Hướng dẫn" + danh sách dạng bài ở cuối; dropdown cột Dạng bài trỏ vào vùng
// ô của danh sách (12–16 tên dài quá giới hạn 255 ký tự của dropdown gõ thẳng).
function guideWithFormats(lines, labels) {
  const rows = [["CÁCH ĐIỀN FILE NÀY"], ...lines.map((l) => [l]), [""], ["CÁC DẠNG BÀI (danh sách của cột Dạng bài)"], ...labels.map((l) => [l])];
  const first = rows.length - labels.length + 1; // số dòng (1-based) của tên đầu tiên
  return {
    sheet: { name: "Hướng dẫn", widths: [110], rows },
    range: `'Hướng dẫn'!$A$${first}:$A$${first + labels.length - 1}`,
  };
}

const LISTENING_GUIDE = guideWithFormats(
  [
    "File này tạo các Section trong 1 Exercise — giống các khung \"Section\" trong trang soạn bài. Bấm Import ở Exercise nào thì các Section được thêm vào Exercise đó.",
    "1. Tab \"Bài nghe\": mỗi dòng là 1 Section (Section 1, 2, 3, 4 của đề). Ghi số Section, tiêu đề, audio và transcript (nếu có).",
    "2. Tab \"Câu hỏi\": mỗi dòng là 1 câu hỏi. Cột Section ghi câu đó thuộc Section mấy. Cùng Section với dòng trên thì để trống.",
    "3. Cột Dạng bài: chọn trong danh sách (giống các nút \"What format is this question?\" trong app). Để trống thì app tự đoán: có Lựa chọn -> trắc nghiệm, không có -> điền đáp án.",
    "4. Trắc nghiệm: điền các cột Lựa chọn, Đáp án ghi chữ cái đúng, ví dụ  B.   Chọn 2 đáp án: ghi  B, E",
    "5. Form / Note / Table / Flow-chart / Summary Completion: mỗi chỗ trống 1 dòng, gõ ___ ở chỗ trống. Các dòng liền nhau cùng dạng được ghép thành 1 khung như đề thật.",
    "    (Table Completion hiện thành từng dòng — muốn chia cột thì chỉnh lại trong trang soạn bài.)",
    "6. Matching / Labelling: các cột Lựa chọn là danh sách đáp án dùng chung, Đáp án ghi chữ cái.",
    "7. Listen and choose: để trống Câu hỏi, Đáp án ghi A, B, C hoặc D.",
    "8. Nhiều cách viết đúng: ngăn cách bằng dấu  /     Ví dụ:  six / 6",
    "9. Audio: tải file nghe lên kho Audio của app TRƯỚC, rồi ghi đúng tên audio đó vào cột Audio. Để trống thì Section chưa có audio. Hình sơ đồ: gắn trong trang soạn bài.",
    "10. Cột tiêu đề màu XANH là bắt buộc. Cột màu XÁM có thể để trống.",
    "11. Xoá các dòng ví dụ có sẵn, điền đề của bạn, lưu file, rồi bấm Import trong app và chọn file này.",
  ],
  LISTENING_FORMAT_LABELS
);

const READING_GUIDE = guideWithFormats(
  [
    "File này tạo các Section trong 1 Exercise — giống các khung \"Section\" trong trang soạn bài (mỗi Section là 1 bài đọc). Bấm Import ở Exercise nào thì các Section được thêm vào Exercise đó.",
    "1. Tab \"Đoạn văn\": mỗi dòng là 1 Section (Passage 1, 2, 3 của đề). Ghi số Section, tiêu đề và đoạn văn.",
    "    (Đoạn văn dài, khó gõ trong 1 ô Excel? Để trống — sau khi Import, dán vào ô \"Passage text\" trong trang soạn bài.)",
    "2. Tab \"Câu hỏi\": mỗi dòng là 1 câu hỏi. Cột Section ghi câu đó thuộc Section mấy. Cùng Section với dòng trên thì để trống.",
    "3. Cột Dạng bài: chọn trong danh sách (giống các nút \"What format is this question?\" trong app). Để trống thì app tự đoán:",
    "    có Lựa chọn -> trắc nghiệm;  đáp án TRUE / FALSE / NOT GIVEN -> True/False/Not Given;  đáp án YES / NO / NOT GIVEN -> Yes/No/Not Given;  còn lại -> điền đáp án.",
    "4. Trắc nghiệm: điền các cột Lựa chọn, Đáp án ghi chữ cái đúng, ví dụ  B.   Chọn 2 đáp án: ghi  B, D",
    "5. Matching (Headings / Information / Features / Sentence Endings), Summary có danh sách từ: các cột Lựa chọn là danh sách dùng chung — chép giống nhau ở mọi dòng của nhóm. Đáp án ghi nhãn (i, ii...) hoặc chữ cái cột (A, B...).",
    "6. Note / Table / Flow-chart / Summary Completion (không có danh sách từ): mỗi chỗ trống 1 dòng, gõ ___ ở chỗ trống. Các dòng liền nhau cùng dạng được ghép thành 1 khung như đề thật.",
    "7. Nhiều cách viết đúng: ngăn cách bằng dấu  /",
    "8. Hình sơ đồ (Diagram Label Completion): gắn trong trang soạn bài sau khi Import.",
    "9. Cột tiêu đề màu XANH là bắt buộc. Cột màu XÁM có thể để trống.",
    "10. Xoá các dòng ví dụ có sẵn, điền đề của bạn, lưu file, rồi bấm Import trong app và chọn file này.",
  ],
  READING_FORMAT_LABELS
);

const HEADINGS = ["i. A worldwide trend", "ii. The social benefits of green spaces", "iii. Types of urban planting", "iv. Government funding schemes"];
const blankOpts = (n = 10) => Array(n).fill("");
const withOpts = (opts) => [...opts, ...blankOpts(10 - opts.length)];

const TEMPLATES = {
  // Reading: 1 file gộp, đọc bởi workbookToSections (tìm tab theo cột).
  "Mau_Reading.xlsx": [
    READING_GUIDE.sheet,
    {
      name: "Đoạn văn",
      widths: [10, 30, 110],
      optional: [1, 2],
      rows: [
        ["Section", "Tiêu đề", "Đoạn văn"],
        [
          "1",
          "Urban Gardening",
          "[A] Urban gardening has become increasingly popular in cities around the world as residents look for ways to grow their own food in limited spaces.\n" +
            "[B] Rooftop plots, community gardens and vertical planters now appear on streets that were once purely residential.\n" +
            "[C] Researchers have found that these green spaces improve air quality and encourage social interaction among neighbours.",
        ],
      ],
    },
    {
      name: "Câu hỏi",
      widths: [10, 30, 50, 22, 22, 22, 22, 16, 16, 16, 16, 16, 16, 24, 26, 36],
      optional: [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15],
      dropdowns: [{ col: 1, source: READING_GUIDE.range }],
      rows: [
        ["Section", "Dạng bài", "Câu hỏi", ..."ABCDEFGHIJ".split("").map((c) => "Lựa chọn " + c), "Đáp án", "Giới hạn từ", "Giải thích"],
        ["1", "", "Why have city residents taken up urban gardening?", ...withOpts(["To save money on food", "To grow food in limited spaces", "To decorate their homes", "To meet new neighbours"]), "B", "", "Đoạn A: \"grow their own food in limited spaces\""],
        ["", "", "Community gardens only exist on rooftops.", ...blankOpts(), "FALSE", "", ""],
        ["", "", "Urban gardens have been shown to improve air quality.", ...blankOpts(), "TRUE", "", ""],
        ["", "", "Most city councils pay for urban gardens.", ...blankOpts(), "NOT GIVEN", "", ""],
        ["", "Matching Headings", "Paragraph A", ...withOpts(HEADINGS), "i", "", ""],
        ["", "Matching Headings", "Paragraph B", ...withOpts(HEADINGS), "iii", "", ""],
        ["", "Matching Headings", "Paragraph C", ...withOpts(HEADINGS), "ii", "", ""],
        ["", "Summary Completion (không có danh sách từ)", "Urban gardens improve air quality and promote ___ among neighbours.", ...blankOpts(), "social interaction", "NO MORE THAN TWO WORDS", ""],
      ],
    },
  ],
  // Listening: 1 file gộp, đọc bởi workbookToSections (tìm tab theo cột).
  "Mau_Listening.xlsx": [
    LISTENING_GUIDE.sheet,
    {
      name: "Bài nghe",
      widths: [10, 30, 36, 90],
      optional: [1, 2, 3],
      rows: [
        ["Section", "Tiêu đề", "Audio", "Transcript"],
        ["1", "Library Membership", "Listening 2A – Library Membership", "Good morning, everyone. Today I'd like to talk to you about joining the library..."],
        ["2", "Campus Tour", "", ""],
      ],
    },
    {
      name: "Câu hỏi",
      widths: [10, 30, 50, 16, 16, 16, 16, 16, 16, 16, 16, 22, 28, 36],
      optional: [1, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13],
      dropdowns: [{ col: 1, source: LISTENING_GUIDE.range }],
      rows: [
        ["Section", "Dạng bài", "Câu hỏi", "Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D", "Lựa chọn E", "Lựa chọn F", "Lựa chọn G", "Lựa chọn H", "Đáp án", "Giới hạn từ", "Giải thích"],
        ["1", "Form Completion", "Name: Sarah ___", "", "", "", "", "", "", "", "", "Smith", "ONE WORD ONLY", ""],
        ["", "Form Completion", "Phone number: ___", "", "", "", "", "", "", "", "", "07788 123456", "", ""],
        ["", "Form Completion", "Membership must be renewed every ___ months", "", "", "", "", "", "", "", "", "six / 6", "ONE WORD AND/OR A NUMBER", ""],
        ["", "Multiple Choice (1 đáp án)", "What time does the library open on weekdays?", "7 a.m.", "8 a.m.", "9 a.m.", "10 a.m.", "", "", "", "", "B", "", "Nghe: \"from eight a.m.\""],
        ["2", "Multiple Choice (nhiều đáp án)", "Which TWO facilities are new this year?", "a café", "a computer room", "a quiet zone", "a gym", "a printing service", "", "", "", "B, E", "", ""],
        ["", "Matching", "Where is the sports hall?", "the main gate", "the library", "the car park", "", "", "", "", "", "C", "", ""],
        ["", "Matching", "Where is the student union?", "the main gate", "the library", "the car park", "", "", "", "", "", "A", "", ""],
        ["", "Sentence Completion", "The tour finishes in the ___.", "", "", "", "", "", "", "", "", "main hall", "ONE OR TWO WORDS", ""],
        ["", "Listen and choose — no printed question", "", "", "", "", "", "", "", "", "", "B", "", ""],
      ],
    },
  ],
  // Grammar: 1 file gộp, đọc bởi workbookToGrammar (tìm tab theo cột).
  "Mau_Grammar.xlsx": [
    {
      name: "Hướng dẫn",
      widths: [110],
      rows: [
        ["CÁCH ĐIỀN FILE NÀY"],
        ["Mỗi chủ điểm ngữ pháp (ví dụ: Present Perfect) gồm 2 phần: Lý thuyết và Bài tập."],
        ["1. Tab \"Lý thuyết\": mỗi dòng là 1 chủ điểm. Ghi công thức, cách dùng, ví dụ..."],
        ["2. Tab \"Bài tập\": mỗi dòng là 1 câu hỏi. Cột Chủ điểm ghi đúng tên chủ điểm như bên tab Lý thuyết."],
        ["3. Câu hỏi cùng chủ điểm với dòng trên thì cột Chủ điểm có thể để trống."],
        ["4. Chỗ trống trong câu: gõ 3 dấu gạch dưới  ___"],
        ["5. Nếu có nhiều đáp án đúng: ngăn cách bằng dấu  /     Ví dụ:  isn't / is not"],
        ["6. Cột tiêu đề màu XANH là bắt buộc. Cột màu XÁM có thể để trống."],
        ["7. Không có lý thuyết? Để trống tab Lý thuyết, chỉ điền tab Bài tập cũng được."],
        ["8. Xoá các dòng ví dụ có sẵn, điền bài của bạn, lưu file, rồi bấm Import trong app và chọn file này."],
      ],
    },
    {
      name: "Lý thuyết",
      widths: [22, 36, 40, 40, 44, 34],
      optional: [1, 2, 3, 4, 5],
      rows: [
        ["Chủ điểm", "Công thức", "Khi nào dùng", "Lỗi thường gặp", "Ví dụ", "Link video YouTube"],
        [
          "Present Perfect",
          "(+) S + have/has + V3\n(-) S + have/has + not + V3\n(?) Have/Has + S + V3?",
          "Việc đã xảy ra và còn liên quan đến hiện tại. Hay đi với: since, for, already, yet, ever, never.",
          "Không dùng với thời gian quá khứ cụ thể (yesterday, last year, in 2010).",
          "I have lived here since 2015.\nShe has never been to Japan.",
          "",
        ],
        ["Passive Voice", "S + be + V3 (+ by ...)", "Khi muốn nhấn mạnh việc được làm, không quan trọng ai làm.", "Quên chia động từ \"be\" theo thì.", "The report was written by the manager.", ""],
      ],
    },
    {
      name: "Bài tập",
      widths: [22, 50, 34, 16, 44],
      optional: [3, 4],
      rows: [
        ["Chủ điểm", "Câu hỏi", "Đáp án", "Gợi ý", "Giải thích"],
        ["Present Perfect", "I ___ (live) here since 2015.", "have lived", "live", "since + mốc thời gian → dùng Present Perfect"],
        ["Present Perfect", "Tìm và sửa lỗi sai: She has visited Paris last year.", "visited", "", "last year là quá khứ cụ thể → dùng Past Simple"],
        ["Passive Voice", "Viết lại câu: The manager wrote the report.  → The report ...", "The report was written by the manager", "", ""],
        ["Passive Voice", "English ___ spoken all over the world.", "is", "", ""],
        ["Passive Voice", "This house ___ (not build) in 1990.", "wasn't built / was not built", "not build", ""],
      ],
    },
  ],
  // Vocabulary: 1 file gộp, đọc bởi workbookToVocab (tìm tab theo cột).
  "Mau_Vocabulary.xlsx": [
    {
      name: "Hướng dẫn",
      widths: [110],
      rows: [
        ["CÁCH ĐIỀN FILE NÀY"],
        ["Mỗi chủ đề từ vựng (ví dụ: Environment) gồm 2 phần: Từ vựng và Bài tập."],
        ["1. Tab \"Từ vựng\": mỗi dòng là 1 từ. Cột Chủ đề ghi tên chủ đề của từ đó."],
        ["2. Tab \"Bài tập\": mỗi dòng là 1 câu hỏi. Cột Chủ đề ghi đúng tên chủ đề như bên tab Từ vựng."],
        ["3. Dòng cùng chủ đề với dòng trên thì cột Chủ đề có thể để trống."],
        ["4. Câu trắc nghiệm: điền các cột Lựa chọn A, B, C, D. Cột Đáp án ghi chữ cái đúng (A, B, C hoặc D)."],
        ["5. Câu học viên tự gõ đáp án (điền từ, word form...): để trống các cột Lựa chọn, chỉ ghi Đáp án."],
        ["6. Chỗ trống trong câu: gõ 3 dấu gạch dưới  ___     Nhiều đáp án đúng: ngăn cách bằng dấu  /"],
        ["7. Cột tiêu đề màu XANH là bắt buộc. Cột màu XÁM có thể để trống."],
        ["8. Chỉ cần danh sách từ? Để trống tab Bài tập cũng được (và ngược lại)."],
        ["9. Xoá các dòng ví dụ có sẵn, điền bài của bạn, lưu file, rồi bấm Import trong app và chọn file này."],
      ],
    },
    {
      name: "Từ vựng",
      widths: [18, 18, 10, 16, 22, 44, 34, 24, 20],
      optional: [2, 3, 4, 5, 6, 7, 8],
      rows: [
        ["Chủ đề", "Từ vựng", "Loại từ", "Phiên âm", "Nghĩa", "Ví dụ", "Định nghĩa tiếng Anh", "Collocation", "Đồng nghĩa"],
        ["Environment", "pollution", "n", "/pəˈluːʃn/", "sự ô nhiễm", "Air pollution is a serious problem in big cities.", "damage caused by harmful substances", "air pollution", "contamination"],
        ["", "sustainable", "adj", "/səˈsteɪnəbl/", "bền vững", "We need more sustainable energy sources.", "", "sustainable development", "renewable"],
        ["Education", "curriculum", "n", "/kəˈrɪkjələm/", "chương trình học", "Coding is now part of the school curriculum.", "", "national curriculum", "syllabus"],
      ],
    },
    {
      name: "Bài tập",
      widths: [18, 50, 16, 16, 16, 16, 24, 16, 40],
      optional: [2, 3, 4, 5, 7, 8],
      rows: [
        ["Chủ đề", "Câu hỏi", "Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D", "Đáp án", "Gợi ý", "Giải thích"],
        ["Environment", "Factories are the main cause of water ___.", "pollute", "pollution", "polluted", "polluting", "B", "", "Sau tính từ \"water\" cần danh từ"],
        ["", "Từ nào có nghĩa là \"bền vững\"?", "polluted", "curriculum", "sustainable", "harmful", "C", "", ""],
        ["", "We need a more ___ way of living.", "", "", "", "", "sustainable", "SUSTAIN", "Cần tính từ đứng trước danh từ \"way\""],
        ["Education", "Coding is now part of the school ___.", "", "", "", "", "curriculum / syllabus", "", ""],
      ],
    },
  ],
};

const outDir = path.join(__dirname, "..", "public", "templates");
fs.mkdirSync(outDir, { recursive: true });
for (const [name, sheets] of Object.entries(TEMPLATES)) {
  fs.writeFileSync(path.join(outDir, name), makeXlsx(sheets));
  console.log("wrote public/templates/" + name);
}

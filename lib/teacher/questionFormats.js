// "Định dạng câu hỏi" theo đúng tên IELTS thật — CHỈ dùng để hướng dẫn giáo
// viên tạo tay trong builder (SectionsEditor). Đây là lớp UI thuần tuý nằm
// TRÊN 6 cơ chế nền (kind) đã có sẵn — chọn 1 tên ở đây chỉ tự set `kind` +
// tự bật/điền sẵn đúng phần liên quan (Note layout, Shared answer bank,
// Illustration) giúp đỡ phải tự nhớ bật cái gì ở đâu. KHÔNG đụng gì tới
// lib/csvImport.js — file import CSV có bảng ánh xạ tên riêng của nó
// (classifyQuestionType), độc lập hoàn toàn với file này.
//
// noteMode: true  -> câu này thuộc dạng "đoạn ghi chú liền mạch có chỗ
//   trống" (Note/Table/Flow-chart/Summary/Form Completion) — chọn tự bật
//   Note/Summary completion layout của section (nếu chưa bật) và tự chèn 1
//   chỗ trống mới vào cuối đoạn ghi chú.
// needsBank: true -> câu cần "Shared answer bank" (Matching/Labelling) —
//   chọn tự thêm 1 dòng trống vào kho đáp án nếu đang trống, và cuộn tới đó.
// needsImage: true -> câu cần ảnh minh hoạ (Diagram/Map Labelling) — chọn tự
//   cuộn tới ô chọn Illustration.
//
// Phase 8 (TOEIC): questionFormatsFor(subject, program). Program ielts (hoặc
// không truyền) trả đúng danh sách IELTS cũ — chỉ thêm dạng "letter" ở CUỐI
// danh sách Listening. Cờ mới:
// kind: "letter" -> "Listen and choose — no printed question" (lib/letterQuestion.js):
//   lưu như câu choice thường, đề trống, lựa chọn A..D.
// letterOptions: n -> số lựa chọn chữ cái tự tạo (3 hoặc 4).
// presetOptions: [..] -> tự tạo sẵn các lựa chọn với đúng nhãn này (vd "[1]".."[4]").
// needsFieldImage: true -> câu cần ảnh riêng (field.imageId) — ô "Question image" mở sẵn.
import { LETTER_FORMAT_LABEL, TOEIC_P1_LABEL, TOEIC_P2_LABEL } from "../letterQuestion.js";
import { GENERAL_LABELS, GENERAL_SUBJECT_FORMAT_KEYS } from "../generalFormats.js";

const READING_FORMATS = [
  { key: "r-mcq1", label: "Multiple Choice (1 đáp án)", kind: "mcq" },
  { key: "r-mcq2", label: "Multiple Choice (nhiều đáp án)", kind: "mcq" },
  { key: "r-tfng", label: "True/False/Not Given", kind: "tfng" },
  { key: "r-ynng", label: "Yes/No/Not Given", kind: "ynng" },
  { key: "r-mh", label: "Matching Headings", kind: "matching", needsBank: true },
  { key: "r-mi", label: "Matching Information", kind: "matching", needsBank: true },
  { key: "r-mf", label: "Matching Features", kind: "matching", needsBank: true },
  { key: "r-mse", label: "Matching Sentence Endings", kind: "matching", needsBank: true },
  { key: "r-sc", label: "Sentence Completion", kind: "fill" },
  { key: "r-sumbank", label: "Summary Completion (có danh sách từ)", kind: "matching", needsBank: true },
  { key: "r-sumnobank", label: "Summary Completion (không có danh sách từ)", kind: "fill", noteMode: true },
  { key: "r-note", label: "Note Completion", kind: "fill", noteMode: true },
  { key: "r-table", label: "Table Completion", kind: "fill", noteMode: true },
  { key: "r-flow", label: "Flow-chart Completion", kind: "fill", noteMode: true },
  { key: "r-diagram", label: "Diagram Label Completion", kind: "labelling", needsBank: true, needsImage: true },
  { key: "r-short", label: "Short Answer Questions", kind: "fill" },
];

const LISTENING_FORMATS = [
  { key: "l-mcq1", label: "Multiple Choice (1 đáp án)", kind: "mcq" },
  { key: "l-mcq2", label: "Multiple Choice (nhiều đáp án)", kind: "mcq" },
  { key: "l-matching", label: "Matching", kind: "matching", needsBank: true },
  { key: "l-diagram", label: "Plan/Map/Diagram Labelling", kind: "labelling", needsBank: true, needsImage: true },
  { key: "l-form", label: "Form Completion", kind: "fill", noteMode: true },
  { key: "l-note", label: "Note Completion", kind: "fill", noteMode: true },
  { key: "l-table", label: "Table Completion", kind: "fill", noteMode: true },
  { key: "l-flow", label: "Flow-chart Completion", kind: "fill", noteMode: true },
  { key: "l-summary", label: "Summary Completion", kind: "fill", noteMode: true },
  { key: "l-sc", label: "Sentence Completion", kind: "fill" },
  { key: "l-short", label: "Short Answer Questions", kind: "fill" },
  // Thêm ở CUỐI để không xê dịch các dạng cũ.
  { key: "l-letter", label: LETTER_FORMAT_LABEL, kind: "letter", letterOptions: 4 },
];

const TOEIC_LISTENING_FORMATS = [
  { key: "tl-p1", label: TOEIC_P1_LABEL, kind: "letter", letterOptions: 4, needsFieldImage: true },
  { key: "tl-p2", label: TOEIC_P2_LABEL, kind: "letter", letterOptions: 3 },
  { key: "tl-p3", label: "Part 3 — Conversations", kind: "mcq" },
  { key: "tl-p3g", label: "Part 3 — Conversation with graphic", kind: "mcq", needsFieldImage: true },
  { key: "tl-p4", label: "Part 4 — Talks", kind: "mcq" },
  { key: "tl-p4g", label: "Part 4 — Talk with graphic", kind: "mcq", needsFieldImage: true },
];

const TOEIC_READING_FORMATS = [
  { key: "tr-p5", label: "Part 5 — Incomplete Sentences", kind: "mcq" },
  { key: "tr-p6", label: "Part 6 — Text Completion", kind: "mcq" },
  { key: "tr-p6s", label: "Part 6 — Sentence insertion", kind: "mcq" },
  { key: "tr-p7", label: "Part 7 — Single passage", kind: "mcq" },
  { key: "tr-p7m", label: "Part 7 — Multiple passages", kind: "mcq" },
  { key: "tr-p7i", label: "Part 7 — Insert a sentence [1]–[4]", kind: "mcq", presetOptions: ["[1]", "[2]", "[3]", "[4]"] },
];

// Dạng bài General English (Phase 12 G1, bảng mục 1)
const GENERAL_ALL_FORMATS = [
  { key: "g-mcq", label: GENERAL_LABELS.mcq, kind: "mcq" },
  { key: "g-pron", label: GENERAL_LABELS.pron, kind: "mcq", underline: "options" },
  { key: "g-stress", label: GENERAL_LABELS.stress, kind: "mcq" },
  { key: "g-comm", label: GENERAL_LABELS.comm, kind: "mcq" },
  { key: "g-error", label: GENERAL_LABELS.error, kind: "mcq", underline: "label", errorLetters: true },
  { key: "g-syn", label: GENERAL_LABELS.syn, kind: "mcq", underline: "label" },
  { key: "g-sign", label: GENERAL_LABELS.sign, kind: "mcq", needsFieldImage: true },
  { key: "g-verb", label: GENERAL_LABELS.verb, kind: "fill", matchMode: "sentence" },
  { key: "g-wform", label: GENERAL_LABELS.wform, kind: "fill", matchMode: "sentence" },
  { key: "g-cloze", label: GENERAL_LABELS.cloze, kind: "mcq" },
  { key: "g-ocloze", label: GENERAL_LABELS.ocloze, kind: "fill", noteMode: true, matchMode: "sentence" },
  { key: "g-tf", label: GENERAL_LABELS.tf, kind: "mcq", presetOptions: ["True", "False"] },
  { key: "g-tfng", label: GENERAL_LABELS.tfng, kind: "tfng" },
  { key: "g-rq", label: GENERAL_LABELS.rq, kind: "fill", matchMode: "sentence" },
  { key: "g-insert", label: GENERAL_LABELS.insert, kind: "mcq", presetOptions: ["[I]", "[II]", "[III]", "[IV]"] },
  { key: "g-arrange", label: GENERAL_LABELS.arrange, kind: "mcq", arrange: true },
  { key: "g-reorder", label: GENERAL_LABELS.reorder, kind: "reorder", matchMode: "sentence" },
  { key: "g-rewrite", label: GENERAL_LABELS.rewrite, kind: "fill", matchMode: "sentence" },
  { key: "g-combine", label: GENERAL_LABELS.combine, kind: "fill", matchMode: "sentence" },
  { key: "g-closest", label: GENERAL_LABELS.closest, kind: "mcq" },
  { key: "g-phrase", label: GENERAL_LABELS.phrase, kind: "fill", matchMode: "sentence" },
  { key: "g-gap", label: GENERAL_LABELS.gap, kind: "fill", matchMode: "sentence" },
];

const pickFormats = (keys) => {
  const set = new Set(keys);
  return GENERAL_ALL_FORMATS.filter((f) => set.has(f.key));
};

const GENERAL_GRAMMAR_FORMATS = pickFormats(GENERAL_SUBJECT_FORMAT_KEYS.grammar);
const GENERAL_VOCABULARY_FORMATS = pickFormats(GENERAL_SUBJECT_FORMAT_KEYS.vocabulary);
const GENERAL_LISTENING_FORMATS = pickFormats(GENERAL_SUBJECT_FORMAT_KEYS.listening);

// Mock Test reading ("Written paper") dùng hợp mọi cột (tất cả 22 dạng)
const GENERAL_READING_FORMATS = pickFormats(GENERAL_SUBJECT_FORMAT_KEYS.reading);

// null/khác listening|reading (grammar, vocabulary...) -> không có danh sách
// tên riêng, builder giữ nguyên nút "Add Question" đơn giản như cũ.
export function questionFormatsFor(subject, program) {
  if (program === "toeic") {
    if (subject === "reading") return TOEIC_READING_FORMATS;
    if (subject === "listening") return TOEIC_LISTENING_FORMATS;
    return null;
  }
  if (program === "general") {
    if (subject === "grammar") return GENERAL_GRAMMAR_FORMATS;
    if (subject === "vocabulary") return GENERAL_VOCABULARY_FORMATS;
    if (subject === "reading") return GENERAL_READING_FORMATS;
    if (subject === "listening") return GENERAL_LISTENING_FORMATS;
    return null;
  }
  if (subject === "reading") return READING_FORMATS;
  if (subject === "listening") return LISTENING_FORMATS;
  return null;
}

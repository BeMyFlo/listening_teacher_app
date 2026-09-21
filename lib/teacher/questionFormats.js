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
];

// null/khác listening|reading (grammar, vocabulary...) -> không có danh sách
// tên riêng, builder giữ nguyên nút "Add Question" đơn giản như cũ.
export function questionFormatsFor(subject) {
  if (subject === "reading") return READING_FORMATS;
  if (subject === "listening") return LISTENING_FORMATS;
  return null;
}

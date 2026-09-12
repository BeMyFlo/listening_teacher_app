const mongoose = require("mongoose");

// Shared question engine schema — used by both Test.sections and the
// exercises inside Lesson Units, so grading logic stays identical.
const FieldSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true },
    // Câu "chọn N trong M đáp án" trên đề thi thật thường chiếm liền N số thứ
    // tự (vd "Questions 21-22"), mỗi số 1 điểm độc lập — thay vì tách thành N
    // field trùng đề/lựa chọn, gộp thành 1 field, đánh số id..idEnd. Chỉ có ý
    // nghĩa khi selectCount > 1; null/bằng id = câu 1 số bình thường.
    idEnd: { type: Number, default: null },
    // Tên dạng bài IELTS thật giáo viên đã chọn lúc soạn (vd "Table
    // Completion") — THUẦN HIỂN THỊ trong builder, không ảnh hưởng chấm điểm
    // (vẫn dựa vào `type`/`selectCount`/`answers`). Nhiều tên khác nhau có
    // thể cùng chung 1 cơ chế (vd Note/Table/Flow-chart Completion đều là
    // "fill") — không lưu lại thì builder không biết chính xác đã chọn tên
    // nào để hiện lại đúng dropdown.
    formatLabel: { type: String, default: "" },
    label: { type: String, default: "" },
    type: { type: String, enum: ["fill", "choice"], default: "fill" },
    pre: { type: String, default: "" },
    post: { type: String, default: "" },
    hint: { type: String, default: "" },
    // Shown to the student in review (after submitting), for BOTH right and
    // wrong answers — unlike the correct-answer note which only shows on a miss.
    explanation: { type: String, default: "" },
    options: [{ value: String, label: String }],
    selectCount: { type: Number, default: 1 },
    // Point weight for this question — most questions are worth 1 point,
    // but a teacher can weight harder items higher; grading sums weights
    // instead of a flat question count.
    score: { type: Number, default: 1 },
    answers: { type: [String], default: [] }
  },
  { _id: false }
);

// Vị trí pin (dạng % 0-100, không phụ thuộc độ phân giải ảnh) cho câu hỏi
// dạng Diagram/Map/Plan Labelling — gắn ở section vì cần đối chiếu với
// sec.imageId, không phải ở FieldSchema.
const LabelPointSchema = new mongoose.Schema(
  { fieldId: Number, x: Number, y: Number },
  { _id: false }
);

const SectionSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    audioId: { type: mongoose.Schema.Types.ObjectId, ref: "Audio" },
    passageText: { type: String, default: "" },
    imageId: { type: mongoose.Schema.Types.ObjectId, ref: "Image" },
    matchOptions: [{ value: String, label: String }],
    labelPoints: { type: [LabelPointSchema], default: [] },
    // Note/Summary Completion — thay vì mỗi câu hỏi 1 dòng riêng, cả section
    // là 1 đoạn ghi chú liền mạch (tiêu đề/gạch đầu dòng) với các ô trống
    // đánh số nằm ngay trong câu, giống bài thi IELTS thật. Cú pháp:
    // "# " = tiêu đề, "## " = tiêu đề phụ, "- " = gạch đầu dòng, dòng "---"
    // ngăn phần hướng dẫn (ngoài khung) với phần ghi chú (trong khung), và
    // "[[3]]" đánh dấu chỗ trống ứng với field có id = 3 trong `fields`.
    noteText: { type: String, default: "" },
    // WYSIWYG source of truth for Note/Summary Completion — TipTap/ProseMirror
    // JSON. When present it wins over noteText (which is kept in sync for
    // backward-compatible readers). Blank nodes carry attrs.id = field id.
    noteDoc: { type: mongoose.Schema.Types.Mixed, default: null },
    fields: { type: [FieldSchema], default: [] }
  },
  { _id: false }
);

module.exports = { FieldSchema, SectionSchema };

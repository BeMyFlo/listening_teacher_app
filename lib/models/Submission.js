const mongoose = require("mongoose");

const SubmissionSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  studentName: { type: String, required: true },
  kind: { type: String, enum: ["test", "exercise", "writing", "speaking"], default: "test" },

  // testId is only mandatory for kind='test' — enforced in api/submissions.js,
  // not here, because Mongoose can't express "required if kind=X" cleanly.
  testId: { type: mongoose.Schema.Types.ObjectId, ref: "Test" },
  testTitle: { type: String, default: "" },
  // Một Test giờ có 4 kỹ năng độc lập -> mỗi lần nộp bài (test hoặc
  // writing/speaking gắn với 1 Test) phải khai rõ đang nộp kỹ năng nào.
  // Không dùng cho writing/speaking gắn với Lesson Unit (unitId path).
  testSkill: { type: String, enum: ["listening", "reading", "writing", "speaking"] },

  // dùng khi kind='exercise'
  unitId: { type: mongoose.Schema.Types.ObjectId, ref: "Unit" },
  categoryKey: String,
  exerciseId: mongoose.Schema.Types.ObjectId,
  exerciseTitle: String,

  // dùng khi kind='writing'
  essayText: String,

  // dùng khi kind='speaking'
  audioUrl: String,
  audioPublicId: String,

  // dùng khi kind='writing'|'speaking'
  promptId: mongoose.Schema.Types.ObjectId,

  // chấm tay (writing/speaking) — tên gradingStatus để tránh nhầm với
  // Test.status / Unit.status khi đọc log.
  gradingStatus: { type: String, enum: ["submitted", "graded"], default: "submitted" },
  // manualScore = ĐIỂM TỔNG (overall band 0–9, bước 0.5). Khi chấm theo rubric
  // nó = trung bình 4 tiêu chí làm tròn 0.5 (giáo viên có thể sửa tay).
  manualScore: Number,
  manualFeedback: String, // nhận xét chung
  // Chấm theo tiêu chí IELTS (writing/speaking). rubricVariant chốt tại lúc
  // NỘP bài (suy từ prompt.writingTask); criteria điền lúc CHẤM.
  //   rubricVariant: "writing.task1" | "writing.task2" | "speaking"
  //   criteria: [{ key: "TA"|"TR"|"CC"|"LR"|"GRA"|"FC"|"PR", band: 1..9, comment }]
  rubricVariant: { type: String },
  criteria: {
    type: [
      new mongoose.Schema(
        { key: String, band: Number, comment: { type: String, default: "" } },
        { _id: false }
      ),
    ],
    default: [],
  },
  gradedAt: Date,
  gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },

  // Nộp sau hạn của Unit (Unit.deadlines cho lớp của học sinh). isLate được
  // chốt tại thời điểm nộp; dueAt là snapshot mốc hạn khi đó để hiển thị
  // "trễ N ngày" kể cả khi giáo viên đổi deadline sau này. Chỉ dùng cho
  // kind='exercise'|'writing'|'speaking' gắn với unitId.
  isLate: { type: Boolean, default: false },
  dueAt: { type: Date },

  answers: { type: mongoose.Schema.Types.Mixed, default: {} },
  // Per-question grading snapshot taken at submit time (array of
  // { id, label, submitted, correct, score, answer }). Kept so the teacher
  // review stays accurate even if the exercise/answer key is edited later.
  // Older rows may lack this — callers re-grade on the fly as a fallback.
  detail: { type: mongoose.Schema.Types.Mixed },
  score: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  replayCount: { type: Number, default: 0 },
  submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Submission || mongoose.model("Submission", SubmissionSchema);

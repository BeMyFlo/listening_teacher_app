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

  // Nộp lại sau Reflection Log (writing/speaking). parentSubmissionId trỏ về
  // bài nộp gốc (attempt 1); không có field này nghĩa là attempt 1.
  // attemptNumber chốt lúc tạo để hiển thị badge "Lần N" mà không phải đếm lại.
  parentSubmissionId: { type: mongoose.Schema.Types.ObjectId, ref: "Submission" },
  attemptNumber: { type: Number, default: 1 },

  // Reflection Log — học sinh tự nhận xét bài đã chấm (attempt 1) trước khi
  // nộp lại. Câu hỏi cố định theo kind, xem lib/grading/reflection.js.
  reflectionLog: {
    type: new mongoose.Schema(
      {
        mistake: { type: String, default: "" },
        focusTags: { type: [String], default: [] },
        nextAction: { type: String, default: "" },
        submittedAt: Date,
      },
      { _id: false }
    ),
    default: null,
  },

  // chấm tay (writing/speaking) — tên gradingStatus để tránh nhầm với
  // Test.status / Unit.status khi đọc log.
  // Vòng đời chấm bài (writing/speaking). Học sinh CHỈ thấy kết quả khi "graded".
  //   submitted  – học sinh vừa nộp, chưa chấm
  //   ai_draft   – AI (Gemini) đã chấm, giáo viên chưa mở/chưa lưu
  //   draft      – giáo viên đã lưu nháp, chưa xuất bản
  //   graded     – đã xuất bản, học sinh thấy điểm + nhận xét
  gradingStatus: { type: String, enum: ["submitted", "ai_draft", "draft", "graded"], default: "submitted" },
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

  // "Suggested Actions" — 3 mục cố định hiện cùng bảng điểm (writing/speaking):
  // ưu tiên sửa cho lần sau, từ vựng theo chủ đề, và 1 bản mẫu đã sửa lỗi.
  // AI (Gemini) hoặc giáo viên điền; học sinh chỉ xem.
  priorities: { type: [String], default: [] },
  topicVocabulary: {
    type: [
      new mongoose.Schema(
        { term: String, meaning: { type: String, default: "" }, example: { type: String, default: "" } },
        { _id: false }
      ),
    ],
    default: [],
  },
  improvedSample: { type: String, default: "" },
  // Speaking: 1 câu "vấn đề chính cần sửa của bài này" (AI hoặc giáo viên).
  mainIssue: { type: String, default: "" },

  // Chú thích chấm bài Writing (sửa chữ inline + ghi chú). Neo vào offset ký
  // tự trong essayText GỐC (bất biến). Giáo viên và AI (Gemini) sinh cùng định
  // dạng này. Xem lib/grading/annotate.js.
  annotations: {
    type: [
      new mongoose.Schema(
        {
          id: String,
          start: Number,
          end: Number,
          quote: { type: String, default: "" },
          action: { type: String, enum: ["delete", "replace", "insert", "comment"] },
          insertText: { type: String, default: "" },
          category: { type: String, default: "other" },
          criterion: { type: String, default: null },
          comment: { type: String, default: "" },
          severity: { type: String, default: null },
          source: { type: String, enum: ["teacher", "ai"], default: "teacher" },
        },
        { _id: false }
      ),
    ],
    default: [],
  },
  gradeSource: { type: String, enum: ["teacher", "ai", "ai-reviewed"], default: "teacher" },

  // Speaking: bản gỡ băng + ghi chú theo mốc thời gian (AI hoặc giáo viên).
  transcript: { type: String, default: "" },
  speakingNotes: {
    type: [
      new mongoose.Schema(
        {
          id: String,
          atSeconds: { type: Number, default: null },
          category: { type: String, default: "other" },
          criterion: { type: String, default: null },
          comment: { type: String, default: "" },
          source: { type: String, enum: ["teacher", "ai"], default: "teacher" },
        },
        { _id: false }
      ),
    ],
    default: [],
  },

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

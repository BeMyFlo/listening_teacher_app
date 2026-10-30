// Registry chương trình học (program) — dùng chung cho server và client, giống
// lib/theme.js: CommonJS thuần, KHÔNG import mongoose/DB để bundle client sạch.
// Phần cần DB (activePrograms) nằm ở lib/curriculumServer.js.
//
// Mọi chỗ cần biết "chương trình này có kỹ năng gì" phải đọc registry này,
// không viết `if (program === "toeic")` rải rác. Xem docs/plans/multi-tenant/PLAN-PHASE8-TOEIC.md mục 3.1.

const PROGRAMS = {
  ielts: {
    key: "ielts",
    label: "IELTS",
    lessonSkills: ["grammar", "vocabulary", "listening", "reading", "writing", "speaking"],
    testSkills: ["listening", "reading", "writing", "speaking"],
    defaultDurations: { listening: 30, reading: 60, writing: 60, speaking: 14 },
    scoring: "ielts-band",
    levelWord: "Level",
    fixedLevels: null, // null = level tự đánh số 1..50; mảng = khối cố định (vd General 6..12)
    skillLabels: {}, // đè nhãn kỹ năng của Unit (key -> nhãn); {} = dùng nhãn mặc định
    testSkillLabels: {}, // như trên cho Mock Test
    excelImport: true, // hiện nút import spreadsheet
    aiExercise: false, // nút "Generate with AI" trong SectionsEditor
    wordImport: false, // nút "Import from Word" trong SectionsEditor
    textbook: false, // ô Textbook trên Unit + đưa vào prompt AI
    formatStatsSkills: ["reading", "listening"], // kỹ năng Unit có thống kê % theo dạng bài (trang bài nộp GV)
    legacyFormatGuess: true, // đoán dạng câu hỏi theo cơ chế cho câu cũ chưa có formatLabel
    formatPlaceholder: null, // dòng placeholder của ô chọn dạng câu hỏi (null = không có)
    aiLevel: {
      label: "Students' level (IELTS band or CEFR)",
      placeholder: "e.g. 6.5, 5.0–5.5, B1",
      suggestions: [
        "3.0", "3.5", "4.0", "4.5", "5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0",
        "A1", "A2", "B1", "B2", "C1",
      ],
    },
    levelNamePlaceholder: "e.g. Band 3.5–5.0",
    testTemplates: [], // khuôn đề (G2); [] = không có nút "New test from template"
    publishCheck: false, // chặn xuất bản đề còn câu dở (G2)
    sectionRanges: false, // hiện "Questions a–b" cạnh tên phần (G2)
    partResults: false, // bảng kết quả theo từng phần (G2)
    rubricVariants: null, // null = IELTS/TOEIC tự suy rubric (lib/grading/rubric.js); object = { kỹ năng: rubric }
  },
  toeic: {
    key: "toeic",
    label: "TOEIC",
    lessonSkills: ["grammar", "vocabulary", "listening", "reading", "writing", "speaking"],
    testSkills: ["listening", "reading", "writing", "speaking"],
    defaultDurations: { listening: 45, reading: 75, writing: 60, speaking: 20 },
    scoring: "toeic-scaled",
    levelWord: "Level",
    fixedLevels: null, // null = level tự đánh số 1..50; mảng = khối cố định (vd General 6..12)
    skillLabels: {}, // đè nhãn kỹ năng của Unit (key -> nhãn); {} = dùng nhãn mặc định
    testSkillLabels: {}, // như trên cho Mock Test
    excelImport: false, // hiện nút import spreadsheet
    aiExercise: false, // nút "Generate with AI" trong SectionsEditor
    wordImport: false, // nút "Import from Word" trong SectionsEditor
    textbook: false, // ô Textbook trên Unit + đưa vào prompt AI
    formatStatsSkills: ["reading", "listening"], // kỹ năng Unit có thống kê % theo dạng bài (trang bài nộp GV)
    legacyFormatGuess: false, // đoán dạng câu hỏi theo cơ chế cho câu cũ chưa có formatLabel
    formatPlaceholder: "Choose a Part…", // dòng placeholder của ô chọn dạng câu hỏi (null = không có)
    aiLevel: {
      label: "Students' level (TOEIC score)",
      placeholder: "e.g. 550, 450–600, 750+",
      suggestions: ["300", "400", "450", "500", "550", "600", "650", "700", "750", "800", "850"],
    },
    levelNamePlaceholder: "e.g. 300–450",
    testTemplates: [],
    publishCheck: false,
    sectionRanges: false,
    partResults: false,
    rubricVariants: null, // null = IELTS/TOEIC tự suy rubric (lib/grading/rubric.js); object = { kỹ năng: rubric }
  },
  general: {
    key: "general",
    label: "General English",
    lessonSkills: ["grammar", "vocabulary", "listening", "reading"], // G5: + writing, speaking
    testSkills: ["listening", "reading"], // G5: + writing, speaking
    defaultDurations: { listening: 15, reading: 45 },
    scoring: "ten-point",
    levelWord: "Grade",
    fixedLevels: [6, 7, 8, 9, 10, 11, 12],
    skillLabels: { vocabulary: "Vocabulary & Pronunciation" },
    testSkillLabels: { reading: "Written paper" },
    excelImport: true,
    aiExercise: true,
    wordImport: true,
    textbook: true,
    // General có tên dạng bài cả ở Grammar/Vocabulary (G1) nên thống kê cả hai.
    formatStatsSkills: ["grammar", "vocabulary", "reading", "listening"],
    legacyFormatGuess: false,
    formatPlaceholder: "Choose a question type…",
    aiLevel: {
      label: "Students' level (grade or CEFR)",
      placeholder: "e.g. Grade 7, A2",
      suggestions: ["Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12", "A1", "A2", "B1"],
    },
    levelNamePlaceholder: "e.g. Grade 10 entrance prep",
    testTemplates: ["thpt", "hcm10", "school"], // khuôn đề có thể chọn (lib/generalTemplates.js)
    publishCheck: true, // chặn xuất bản đề còn câu dở
    sectionRanges: true, // hiện "Questions a–b" cạnh tên phần
    partResults: true, // bảng kết quả theo từng phần
    rubricVariants: { writing: "general.writing", speaking: "general.speaking" }, // rubric thang 10 (G5)
  },
};

const PROGRAM_KEYS = Object.keys(PROGRAMS);
const DEFAULT_PROGRAM = "ielts";

function isProgram(k) {
  // hasOwnProperty để "constructor", "__proto__"... không lọt qua.
  return typeof k === "string" && Object.prototype.hasOwnProperty.call(PROGRAMS, k);
}

// Chương trình của 1 document (Class/Unit/Test/Submission). Thiếu field hoặc
// giá trị lạ -> IELTS (dữ liệu cũ chưa backfill vẫn chạy đúng).
function programOf(doc) {
  const p = doc && doc.program;
  return isProgram(p) ? p : DEFAULT_PROGRAM;
}

// `{ program: "ielts" }` KHÔNG khớp document thiếu field, nên mọi truy vấn lọc
// theo chương trình phải đi qua helper này. `null` trong $in khớp cả field
// thiếu -> thứ tự deploy và backfill không quan trọng.
function programFilter(p) {
  return p === DEFAULT_PROGRAM
    ? { program: { $in: [DEFAULT_PROGRAM, null] } }
    : { program: p };
}

// Điều kiện để học sinh của lớp `cls` được thấy / nộp bài vào một Unit hoặc
// Test: đúng level, ĐƯỢC GIAO cho lớp (classIds rỗng = chưa giao cho ai), đúng
// chương trình của lớp. Cùng luật với các route GET của học sinh
// (pages/api/units.js, pages/api/tests.js) — dùng chung ở đây để route nộp bài
// (pages/api/submissions.js) không thể lệch khỏi luật xem bài. Ghép thêm
// `_id` và `status: "published"` ở chỗ gọi.
function studentContentFilter(cls) {
  return { level: cls.level, classIds: cls._id, ...programFilter(programOf(cls)) };
}

// Kỹ năng `key` có thuộc chương trình của Unit / Test không (đọc registry, không
// hard-code). Dùng để từ chối nộp bài vào kỹ năng bị ẩn (kỹ năng chương trình đó không mở).
function lessonSkillAllowed(unit, key) {
  return PROGRAMS[programOf(unit)].lessonSkills.includes(key);
}
function testSkillAllowed(test, key) {
  return PROGRAMS[programOf(test)].testSkills.includes(key);
}

// Nhãn kỹ năng theo chương trình; `fallback` là nhãn mặc định đang hiện hôm nay.
function skillLabel(program, key, fallback) {
  return PROGRAMS[programOf({ program })].skillLabels[key] || fallback;
}
function testSkillLabel(program, key, fallback) {
  return PROGRAMS[programOf({ program })].testSkillLabels[key] || fallback;
}

// Từ chỉ khối/bậc: "Level" (IELTS, TOEIC) | "Grade" (General).
function levelWordOf(program) {
  return PROGRAMS[programOf({ program })].levelWord;
}

// Level hợp lệ cho Lớp/Unit/Test: khối cố định thì phải nằm trong danh sách, không thì số nguyên >= 1
// (đúng luật cũ của các route, KHÔNG chặn trần — dữ liệu IELTS/TOEIC cũ có level lớn vẫn lưu được).
function levelAllowed(program, level) {
  const fixed = PROGRAMS[programOf({ program })].fixedLevels;
  if (Array.isArray(fixed)) return fixed.includes(level);
  return Number.isInteger(level) && level >= 1;
}

// Workspace chỉ có 1 chương trình khác mặc định (vd chỉ General): chương trình đó
// là mặc định ngầm cho Unit/đề mới. IELTS-only / nhiều chương trình / rỗng -> null
// (không gửi `program`, server mặc định IELTS như cũ).
function implicitProgram(programs) {
  const list = Array.isArray(programs) ? programs.filter(isProgram) : [];
  return list.length === 1 && list[0] !== DEFAULT_PROGRAM ? list[0] : null;
}

// Đọc `?program=` từ query của API lọc (grading-queue, submissions, dashboard,
// students). Bỏ trống hoặc "all" = không lọc -> { program: null }. Giá trị hợp
// lệ -> { program: "toeic" }. Sai (lạ, hoặc truyền nhiều lần) -> { error } để
// route trả 400. Không có tham số => hành vi y hệt trước Phase 8.
function parseProgramParam(q) {
  if (q == null) return { program: null };
  if (Array.isArray(q)) return { program: null, error: "Invalid program" };
  const v = String(q).trim();
  if (v === "" || v === "all") return { program: null };
  if (!isProgram(v)) return { program: null, error: "Invalid program" };
  return { program: v };
}

module.exports = {
  PROGRAMS,
  PROGRAM_KEYS,
  DEFAULT_PROGRAM,
  isProgram,
  programOf,
  programFilter,
  parseProgramParam,
  studentContentFilter,
  lessonSkillAllowed,
  testSkillAllowed,
  skillLabel,
  testSkillLabel,
  levelWordOf,
  levelAllowed,
  implicitProgram,
};

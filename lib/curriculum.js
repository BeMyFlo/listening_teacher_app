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
  },
  toeic: {
    key: "toeic",
    label: "TOEIC",
    lessonSkills: ["grammar", "vocabulary", "listening", "reading", "writing", "speaking"],
    testSkills: ["listening", "reading", "writing", "speaking"],
    defaultDurations: { listening: 45, reading: 75, writing: 60, speaking: 20 },
    scoring: "toeic-scaled",
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
// hard-code). Dùng để từ chối nộp bài vào kỹ năng bị ẩn (vd Writing của TOEIC 8A).
function lessonSkillAllowed(unit, key) {
  return PROGRAMS[programOf(unit)].lessonSkills.includes(key);
}
function testSkillAllowed(test, key) {
  return PROGRAMS[programOf(test)].testSkills.includes(key);
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
};

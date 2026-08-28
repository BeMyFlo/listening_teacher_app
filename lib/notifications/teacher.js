const Teacher = require("../models/Teacher");
const { emit, fmtDateTime } = require("./index");

const SKILL_LABELS = { writing: "Writing", speaking: "Speaking" };

// Giáo viên nhận thông báo cho 1 học sinh: người phụ trách đúng lớp của em.
// Không ai khớp (chưa gán lớp) -> mọi giáo viên, để thông báo không bị mất.
async function recipientsForClass(classId) {
  const teachers = await Teacher.find({}).select("_id email classIds").lean();
  if (!teachers.length) return [];
  const cid = String(classId || "");
  const matched = teachers.filter(
    (t) => Array.isArray(t.classIds) && t.classIds.some((c) => String(c) === cid)
  );
  return matched.length ? matched : teachers;
}

// Học sinh vừa nộp 1 bài Writing/Speaking cần chấm tay -> báo giáo viên phụ
// trách. 1 thông báo / submission / giáo viên (dedupeKey). Lỗi ở đây không
// được làm hỏng response nộp bài — caller tự bọc try/catch.
async function notifyTeachersOfSubmission({ student, submission, unitOrTestName, skill, itemLabel }) {
  const teachers = await recipientsForClass(student && student.classId);
  if (!teachers.length) return;

  const skillLabel = SKILL_LABELS[skill] || "a task";
  const where = unitOrTestName ? ` in ${unitOrTestName}` : "";
  const lateTag = submission.isLate ? " (late)" : "";
  // Bài trong Lesson Unit -> trang chấm theo unit; bài trong Mock Test -> Mock Test Results.
  const link = submission.unitId
    ? `/teacher/lessons/${submission.unitId}/submissions`
    : `/teacher/submissions`;

  for (const t of teachers) {
    await emit({
      teacherId: t._id,
      type: "submission_received",
      dedupeKey: `${submission._id}:submission_received:${t._id}`,
      submissionId: submission._id,
      unitId: submission.unitId,
      link,
      title: `New ${skillLabel} submission${lateTag}`,
      body:
        `${student.name} submitted ${skillLabel}${itemLabel ? ` "${itemLabel}"` : ""}${where} ` +
        `on ${fmtDateTime(submission.submittedAt || submission.createdAt || new Date())}. Pending your review.`,
    });
  }
}

module.exports = { notifyTeachersOfSubmission };

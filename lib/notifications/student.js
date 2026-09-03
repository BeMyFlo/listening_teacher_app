const { emit, fmtDateTime } = require("./index");

const SKILL_LABELS = { writing: "Writing", speaking: "Speaking" };

// Giáo viên vừa XUẤT BẢN điểm 1 bài Writing/Speaking -> báo chuông cho học sinh.
// 1 thông báo / submission (dedupeKey): xuất bản lại sau khi sửa không ping lại.
// Lỗi ở đây không được làm hỏng response chấm bài — caller tự bọc try/catch.
async function notifyStudentGraded({ submission, teacherName }) {
  if (!submission || !submission.studentId) return;

  const skill = SKILL_LABELS[submission.kind] || "work";
  const band = submission.manualScore != null ? ` — Band ${submission.manualScore}` : "";
  const by = teacherName ? `${teacherName} graded` : "Your teacher graded";

  // Bài trong Lesson Unit -> trang bài của học sinh; bài trong Mock Test -> trang kết quả kỹ năng.
  const link = submission.unitId
    ? `/student/lessons/${submission.unitId}/prompts/${submission.promptId}`
    : submission.testId
    ? `/student/tests/${submission.testId}/${submission.testSkill || submission.kind}`
    : "/student/lessons";

  await emit({
    studentId: submission.studentId,
    type: "submission_graded",
    dedupeKey: `${submission._id}:submission_graded`,
    submissionId: submission._id,
    unitId: submission.unitId,
    link,
    title: `Your ${skill} was graded${band}`,
    body:
      `${by} your ${skill}${band} on ${fmtDateTime(submission.gradedAt || new Date())}. ` +
      `Open it to see your corrections and feedback.`,
  });
}

module.exports = { notifyStudentGraded };

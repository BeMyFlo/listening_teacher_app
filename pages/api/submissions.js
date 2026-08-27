const { connectDB } = require("../../lib/db");
const { requireStudent } = require("../../lib/auth");
const Test = require("../../lib/models/Test");
const Unit = require("../../lib/models/Unit");
const Student = require("../../lib/models/Student");
const Class = require("../../lib/models/Class");
const Submission = require("../../lib/models/Submission");
const { gradeSubmission } = require("../../lib/grade");
const notifications = require("../../lib/notifications");
const { resolveVariant } = require("../../lib/grading/rubric");
const { resolveDeadline } = require("../../lib/deadlines");

// Hạn nộp áp cho lớp của học sinh + kỹ năng đang nộp (hạn riêng kỹ năng ->
// fallback hạn chung Unit). Trả cờ trễ + snapshot dueAt để lưu vào Submission.
function unitLateness(unit, student, categoryKey, now = new Date()) {
  const due = resolveDeadline(unit, student.classId, categoryKey);
  if (!due) return { isLate: false, dueAt: undefined };
  return { isLate: now > new Date(due), dueAt: due };
}

// Gửi thông báo "nộp trễ" cho học sinh (1 lần / submission).
async function notifyLate(student, unit, submission, itemLabel) {
  await notifications.emit({
    studentId: student._id,
    type: "submission_late",
    dedupeKey: `${submission._id}:submission_late`,
    unitId: unit._id,
    submissionId: submission._id,
    dueAt: submission.dueAt,
    title: "Late submission",
    body:
      `You submitted "${itemLabel || "a task"}" in ${unit.name} after the deadline ` +
      `(${notifications.fmtDateTime(submission.dueAt)}). It has been marked Late.`,
  });
}

async function handler(req, res) {
  if (req.method === "GET") {
    await connectDB();
    const student = await Student.findById(req.auth.studentId);
    if (!student) {
      return res.status(401).json({ ok: false, error: "Account no longer exists, please sign in again" });
    }
    // Students may only ever see their own submissions.
    const rows = await Submission.find({ studentId: student._id }).sort({ submittedAt: -1 }).limit(100).lean();
    return res.status(200).json({ ok: true, rows });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  await connectDB();

  // Identity comes from the verified JWT, not the request body — otherwise
  // anyone could POST a submission under any other student's name.
  const student = await Student.findById(req.auth.studentId);
  if (!student) {
    return res.status(401).json({ ok: false, error: "Account no longer exists, please sign in again" });
  }

  // Level của học sinh suy từ Lớp. Chưa xếp lớp -> chưa làm được bài nào.
  const studentClass = student.classId ? await Class.findById(student.classId) : null;
  if (!studentClass) {
    return res.status(403).json({ ok: false, error: "Your account is not assigned to a class yet — please contact your teacher" });
  }
  const studentLevel = studentClass.level;

  const kind = (req.body && req.body.kind) || "test";

  if (kind === "test") {
    const { testId, skill, answers, replayCount } = req.body || {};
    if (!["listening", "reading"].includes(skill)) {
      return res.status(400).json({ ok: false, error: "Invalid skill" });
    }

    let test;
    try {
      test = await Test.findOne({ _id: testId, status: "published" });
    } catch (err) {
      return res.status(404).json({ ok: false, error: "Mock test not found" });
    }
    if (!test) {
      return res.status(404).json({ ok: false, error: "Mock test not found" });
    }

    // Cả 4 kỹ năng dùng chung 1 cửa sổ mở/khoá ở cấp Test.
    const now = new Date();
    if ((test.opensAt && test.opensAt > now) || (test.closesAt && test.closesAt < now)) {
      return res.status(400).json({ ok: false, error: "Mock test is currently closed" });
    }

    const { score, total, detail } = gradeSubmission(test.skills[skill], answers || {});

    const submission = await Submission.create({
      studentId: student._id,
      studentName: student.name,
      kind: "test",
      testId: test._id,
      testTitle: `${test.unit} · ${test.title}`.replace(/^ · /, ""),
      testSkill: skill,
      answers: answers || {},
      detail,
      score,
      total,
      replayCount: Number(replayCount) || 0
    });

    return res.status(201).json({
      ok: true,
      submissionId: submission._id,
      score,
      total,
      detail
    });
  }

  if (kind === "exercise") {
    const { unitId, categoryKey, exerciseId, answers } = req.body || {};
    let unit;
    try {
      unit = await Unit.findOne({ _id: unitId, status: "published", level: studentLevel });
    } catch (err) {
      return res.status(404).json({ ok: false, error: "Lesson unit not found" });
    }
    if (!unit) return res.status(404).json({ ok: false, error: "Lesson unit not found" });
    const category = unit.categories.find((c) => c.key === categoryKey);
    // Bài tập có thể nằm ở category.exercises, hoặc trong 1 chủ điểm grammar
    // (category.topics[].exercises), hoặc 1 nhóm từ vocab (category.groups[].exercises).
    let exercise = category && category.exercises.id(exerciseId);
    if (!exercise && category) {
      for (const t of category.topics || []) {
        exercise = t.exercises.id(exerciseId);
        if (exercise) break;
      }
    }
    if (!exercise && category) {
      for (const g of category.groups || []) {
        exercise = g.exercises.id(exerciseId);
        if (exercise) break;
      }
    }
    if (!exercise) return res.status(404).json({ ok: false, error: "Exercise not found" });

    const { score, total, detail } = gradeSubmission(exercise, answers || {});
    const { isLate, dueAt } = unitLateness(unit, student, categoryKey);
    const submission = await Submission.create({
      studentId: student._id,
      studentName: student.name,
      kind: "exercise",
      unitId: unit._id,
      categoryKey,
      exerciseId: exercise._id,
      exerciseTitle: exercise.title,
      answers: answers || {},
      detail,
      score,
      total,
      isLate,
      dueAt
    });
    if (isLate) await notifyLate(student, unit, submission, exercise.title);
    return res.status(201).json({ ok: true, submissionId: submission._id, score, total, detail, isLate });
  }

  if (kind === "writing" || kind === "speaking") {
    const { testId, unitId, categoryKey, promptId, essayText, audioUrl, audioPublicId } = req.body || {};
    if ((kind === "writing" && !String(essayText || "").trim())) {
      return res.status(400).json({ ok: false, error: "Please enter your essay" });
    }
    if (kind === "speaking" && !audioUrl) {
      return res.status(400).json({ ok: false, error: "Please record audio before submitting" });
    }

    // Prompt nằm trong 1 Mock Test (4-skill) — không phải Lesson Unit.
    if (testId) {
      let test;
      try {
        test = await Test.findOne({ _id: testId, status: "published" });
      } catch (err) {
        return res.status(404).json({ ok: false, error: "Mock test not found" });
      }
      if (!test) return res.status(404).json({ ok: false, error: "Mock test not found" });

      const now = new Date();
      if ((test.opensAt && test.opensAt > now) || (test.closesAt && test.closesAt < now)) {
        return res.status(400).json({ ok: false, error: "Mock test is currently closed" });
      }

      const skillBlock = test.skills[kind];
      const prompt = skillBlock && skillBlock.prompts.id(promptId);
      if (!prompt) return res.status(404).json({ ok: false, error: "Prompt not found" });

      const submission = await Submission.create({
        studentId: student._id,
        studentName: student.name,
        kind,
        testId: test._id,
        testTitle: `${test.unit} · ${test.title}`.replace(/^ · /, ""),
        testSkill: kind,
        promptId: prompt._id,
        essayText: kind === "writing" ? essayText : undefined,
        audioUrl: kind === "speaking" ? audioUrl : undefined,
        audioPublicId: kind === "speaking" ? audioPublicId : undefined,
        gradingStatus: "submitted",
        rubricVariant: resolveVariant(kind, prompt.writingTask)
      });
      return res.status(201).json({ ok: true, submissionId: submission._id, message: "Submitted successfully, pending teacher review" });
    }

    // Prompt nằm trong Lesson Unit — luồng cũ, không đổi.
    let unit;
    try {
      unit = await Unit.findOne({ _id: unitId, status: "published", level: studentLevel });
    } catch (err) {
      return res.status(404).json({ ok: false, error: "Lesson unit not found" });
    }
    if (!unit) return res.status(404).json({ ok: false, error: "Lesson unit not found" });
    const category = unit.categories.find((c) => c.key === categoryKey);
    const prompt = category && category.prompts.id(promptId);
    if (!prompt) return res.status(404).json({ ok: false, error: "Prompt not found" });
    const { isLate, dueAt } = unitLateness(unit, student, kind);
    const submission = await Submission.create({
      studentId: student._id,
      studentName: student.name,
      kind,
      unitId: unit._id,
      categoryKey,
      promptId: prompt._id,
      essayText: kind === "writing" ? essayText : undefined,
      audioUrl: kind === "speaking" ? audioUrl : undefined,
      audioPublicId: kind === "speaking" ? audioPublicId : undefined,
      gradingStatus: "submitted",
      rubricVariant: resolveVariant(kind, prompt.writingTask),
      isLate,
      dueAt
    });
    if (isLate) await notifyLate(student, unit, submission, prompt.title);
    return res.status(201).json({ ok: true, submissionId: submission._id, isLate, message: "Submitted successfully, pending teacher review" });
  }

  return res.status(400).json({ ok: false, error: "Invalid submission type" });
}

module.exports = requireStudent(handler);

module.exports.default = module.exports;

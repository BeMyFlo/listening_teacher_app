const { connectDB } = require("../lib/db");
const { requireStudent } = require("../lib/auth");
const Test = require("../lib/models/Test");
const Unit = require("../lib/models/Unit");
const Student = require("../lib/models/Student");
const Submission = require("../lib/models/Submission");
const { gradeSubmission } = require("../lib/grade");

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

  const kind = (req.body && req.body.kind) || "test";

  if (kind === "test") {
    const { testId, answers, replayCount } = req.body || {};

    let test;
    try {
      test = await Test.findOne({ _id: testId, status: "published" });
    } catch (err) {
      return res.status(404).json({ ok: false, error: "Mock test not found" });
    }
    if (!test) {
      return res.status(404).json({ ok: false, error: "Mock test not found" });
    }

    // Active schedule check
    const now = new Date();
    if ((test.opensAt && test.opensAt > now) || (test.closesAt && test.closesAt < now)) {
      return res.status(400).json({ ok: false, error: "Mock test is currently closed" });
    }

    const { score, total, detail } = gradeSubmission(test, answers || {});

    const submission = await Submission.create({
      studentId: student._id,
      studentName: student.name,
      kind: "test",
      testId: test._id,
      testTitle: `${test.unit} · ${test.title}`.replace(/^ · /, ""),
      answers: answers || {},
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
      unit = await Unit.findOne({ _id: unitId, status: "published", level: student.level });
    } catch (err) {
      return res.status(404).json({ ok: false, error: "Lesson unit not found" });
    }
    if (!unit) return res.status(404).json({ ok: false, error: "Lesson unit not found" });
    const category = unit.categories.find((c) => c.key === categoryKey);
    const exercise = category && category.exercises.id(exerciseId);
    if (!exercise) return res.status(404).json({ ok: false, error: "Exercise not found" });

    const { score, total, detail } = gradeSubmission(exercise, answers || {});
    const submission = await Submission.create({
      studentId: student._id,
      studentName: student.name,
      kind: "exercise",
      unitId: unit._id,
      categoryKey,
      exerciseId: exercise._id,
      exerciseTitle: exercise.title,
      answers: answers || {},
      score,
      total
    });
    return res.status(201).json({ ok: true, submissionId: submission._id, score, total, detail });
  }

  if (kind === "writing" || kind === "speaking") {
    const { unitId, categoryKey, promptId, essayText, audioUrl, audioPublicId } = req.body || {};
    let unit;
    try {
      unit = await Unit.findOne({ _id: unitId, status: "published", level: student.level });
    } catch (err) {
      return res.status(404).json({ ok: false, error: "Lesson unit not found" });
    }
    if (!unit) return res.status(404).json({ ok: false, error: "Lesson unit not found" });
    const category = unit.categories.find((c) => c.key === categoryKey);
    const prompt = category && category.prompts.id(promptId);
    if (!prompt) return res.status(404).json({ ok: false, error: "Prompt not found" });
    if (kind === "writing" && !String(essayText || "").trim()) {
      return res.status(400).json({ ok: false, error: "Please enter your essay" });
    }
    if (kind === "speaking" && !audioUrl) {
      return res.status(400).json({ ok: false, error: "Please record audio before submitting" });
    }
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
      gradingStatus: "submitted"
    });
    return res.status(201).json({ ok: true, submissionId: submission._id, message: "Submitted successfully, pending teacher review" });
  }

  return res.status(400).json({ ok: false, error: "Invalid submission type" });
}

module.exports = requireStudent(handler);

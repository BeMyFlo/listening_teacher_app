const { connectDB } = require("../lib/db");
const { requireStudent } = require("../lib/auth");
const Test = require("../lib/models/Test");
const Student = require("../lib/models/Student");
const Submission = require("../lib/models/Submission");
const { gradeSubmission } = require("../lib/grade");

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  await connectDB();

  // Identity comes from the verified JWT, not the request body — otherwise
  // anyone could POST a submission under any other student's name.
  const student = await Student.findById(req.auth.studentId);
  if (!student) {
    return res.status(401).json({ ok: false, error: "Tài khoản không còn tồn tại, vui lòng đăng nhập lại" });
  }

  const { testId, answers, replayCount } = req.body || {};

  let test;
  try {
    test = await Test.findOne({ _id: testId, status: "published" });
  } catch (err) {
    return res.status(404).json({ ok: false, error: "Không tìm thấy bài kiểm tra" });
  }
  if (!test) {
    return res.status(404).json({ ok: false, error: "Không tìm thấy bài kiểm tra" });
  }

  const { score, total, detail } = gradeSubmission(test, answers || {});

  const submission = await Submission.create({
    studentId: student._id,
    studentName: student.name,
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

module.exports = requireStudent(handler);

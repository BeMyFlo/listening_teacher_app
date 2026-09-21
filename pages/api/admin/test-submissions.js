const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const Test = require("../../../lib/models/Test");
const Class = require("../../../lib/models/Class");
const Student = require("../../../lib/models/Student");
const Submission = require("../../../lib/models/Submission");
const { buildTestOverview, buildStudentTestDetail } = require("../../../lib/teacher/testSubmissions");

const S = (v) => (v == null ? "" : String(v));

// GET /api/admin/test-submissions?testId=X             -> overview (per-student summary)
// GET /api/admin/test-submissions?testId=X&studentId=Y -> full 4-skill breakdown for one student
async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  await connectDB();
  const { testId, studentId } = req.query;

  let test;
  try {
    test = await Test.findById(testId).lean();
  } catch (err) {
    return res.status(404).json({ ok: false, error: "Mock test not found" });
  }
  if (!test) return res.status(404).json({ ok: false, error: "Mock test not found" });

  // Which classes / students belong to this test.
  const assignedClassIds = (test.classIds || []).map(S);
  const scope = assignedClassIds.length ? "classes" : "level";

  const classesAtLevel = await Class.find({ level: test.level }).sort({ name: 1 }).lean();
  const relevantClasses = scope === "classes"
    ? classesAtLevel.filter((c) => assignedClassIds.includes(S(c._id)))
    : classesAtLevel;
  const classById = {};
  classesAtLevel.forEach((c) => (classById[S(c._id)] = c));

  const relevantClassIds = relevantClasses.map((c) => c._id);
  const students = await Student.find({ classId: { $in: relevantClassIds } })
    .sort({ name: 1 })
    .lean();

  const submissions = await Submission.find({ testId: test._id })
    .sort({ submittedAt: -1 })
    .lean();

  // ----- Detail mode -----
  if (studentId) {
    const student = students.find((s) => S(s._id) === S(studentId));
    if (!student) return res.status(404).json({ ok: false, error: "Student not found for this test" });
    const mine = submissions.filter((s) => S(s.studentId) === S(studentId));
    const cls = student.classId ? classById[S(student.classId)] : null;
    return res.status(200).json({
      ok: true,
      test: { _id: test._id, title: test.title, unit: test.unit, level: test.level },
      student: { _id: student._id, name: student.name, className: cls ? cls.name : null },
      skills: buildStudentTestDetail({ test, submissions: mine }),
    });
  }

  // ----- Overview mode -----
  const studentCountByClass = {};
  students.forEach((s) => {
    const k = S(s.classId);
    studentCountByClass[k] = (studentCountByClass[k] || 0) + 1;
  });

  const rows = buildTestOverview({ test, submissions, students, classById });

  return res.status(200).json({
    ok: true,
    test: {
      _id: test._id,
      title: test.title,
      unit: test.unit,
      level: test.level,
      opensAt: test.opensAt,
      closesAt: test.closesAt,
      classIds: assignedClassIds,
    },
    scope,
    classes: relevantClasses.map((c) => ({
      _id: c._id,
      name: c.name,
      level: c.level,
      studentCount: studentCountByClass[S(c._id)] || 0,
    })),
    students: rows,
  });
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;

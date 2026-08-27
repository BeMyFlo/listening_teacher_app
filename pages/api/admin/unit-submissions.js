const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const Unit = require("../../../lib/models/Unit");
const Class = require("../../../lib/models/Class");
const Student = require("../../../lib/models/Student");
const Submission = require("../../../lib/models/Submission");
const { buildUnitOverview, buildStudentDetail } = require("../../../lib/teacher/unitSubmissions");

const S = (v) => (v == null ? "" : String(v));

// GET /api/admin/unit-submissions?unitId=X            -> overview (per-student summary)
// GET /api/admin/unit-submissions?unitId=X&studentId=Y -> full breakdown for one student
async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  await connectDB();
  const { unitId, studentId } = req.query;

  let unit;
  try {
    unit = await Unit.findById(unitId).lean();
  } catch (err) {
    return res.status(404).json({ ok: false, error: "Unit not found" });
  }
  if (!unit) return res.status(404).json({ ok: false, error: "Unit not found" });

  // Which classes / students belong to this unit.
  const assignedClassIds = (unit.classIds || []).map(S);
  const scope = assignedClassIds.length ? "classes" : "level";

  const classesAtLevel = await Class.find({ level: unit.level }).sort({ name: 1 }).lean();
  const relevantClasses = scope === "classes"
    ? classesAtLevel.filter((c) => assignedClassIds.includes(S(c._id)))
    : classesAtLevel;
  const classById = {};
  classesAtLevel.forEach((c) => (classById[S(c._id)] = c));

  const relevantClassIds = relevantClasses.map((c) => c._id);
  const students = await Student.find({ classId: { $in: relevantClassIds } })
    .sort({ name: 1 })
    .lean();

  const submissions = await Submission.find({ unitId: unit._id })
    .sort({ submittedAt: -1 })
    .lean();

  // ----- Detail mode -----
  if (studentId) {
    const student = students.find((s) => S(s._id) === S(studentId));
    if (!student) return res.status(404).json({ ok: false, error: "Student not found in this unit" });
    const mine = submissions.filter((s) => S(s.studentId) === S(studentId));
    const cls = student.classId ? classById[S(student.classId)] : null;
    return res.status(200).json({
      ok: true,
      unit: { _id: unit._id, name: unit.name, level: unit.level },
      student: { _id: student._id, name: student.name, className: cls ? cls.name : null },
      categories: buildStudentDetail({ unit, submissions: mine }),
    });
  }

  // ----- Overview mode -----
  const studentCountByClass = {};
  students.forEach((s) => {
    const k = S(s.classId);
    studentCountByClass[k] = (studentCountByClass[k] || 0) + 1;
  });

  const rows = buildUnitOverview({ unit, submissions, students, classById });

  return res.status(200).json({
    ok: true,
    unit: { _id: unit._id, name: unit.name, level: unit.level, classIds: assignedClassIds },
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

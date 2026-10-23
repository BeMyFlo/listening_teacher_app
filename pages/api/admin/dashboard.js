const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { withTenant, tenantFilter } = require("../../../lib/tenant");
const Submission = require("../../../lib/models/Submission");
const Test = require("../../../lib/models/Test");
const Unit = require("../../../lib/models/Unit");
const Class = require("../../../lib/models/Class");
const Student = require("../../../lib/models/Student");
const Teacher = require("../../../lib/models/Teacher");
const Notification = require("../../../lib/models/Notification");
const { buildTeacherDashboard } = require("../../../lib/teacher/dashboard");
const { parseProgramParam, programFilter } = require("../../../lib/curriculum");

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  await connectDB();

  // ?program= trống/all = không lọc (như trước); sai -> 400.
  const prog = parseProgramParam(req.query.program);
  if (prog.error) return res.status(400).json({ ok: false, error: prog.error });
  const pf = prog.program ? programFilter(prog.program) : {};

  // Phạm vi = lớp giáo viên phụ trách; chưa gán lớp nào -> tất cả lớp.
  const teacher = await Teacher.findById(req.auth.teacherId).select("classIds").lean();
  const allClasses = await Class.find(tenantFilter(req.ws, pf)).sort({ level: 1, name: 1 }).lean();
  const scoped = teacher && Array.isArray(teacher.classIds) && teacher.classIds.length;
  const scopeIds = new Set((scoped ? teacher.classIds : allClasses.map((c) => c._id)).map(String));
  const classes = allClasses.filter((c) => scopeIds.has(String(c._id)));
  const classIdList = classes.map((c) => c._id);

  const [students, units, totalUnits, totalTests, unreadSubmissions] = await Promise.all([
    Student.find(tenantFilter(req.ws, { classId: { $in: classIdList } })).select("name classId").lean(),
    Unit.find(tenantFilter(req.ws, { status: "published", "deadlines.classId": { $in: classIdList }, ...pf })).lean(),
    Unit.countDocuments(tenantFilter(req.ws, pf)),
    Test.countDocuments(tenantFilter(req.ws, pf)),
    Notification.countDocuments(tenantFilter(req.ws, {
      teacherId: req.auth.teacherId,
      type: "submission_received",
      "deliveries.inapp.readAt": null,
    })),
  ]);

  const studentIds = students.map((s) => s._id);
  const submissions = await Submission.find(tenantFilter(req.ws, { studentId: { $in: studentIds }, ...pf }))
    .select(
      "studentId studentName kind categoryKey unitId exerciseId promptId testTitle exerciseTitle score total manualScore rubricVariant gradingStatus submittedAt gradedAt isLate"
    )
    .lean();

  const payload = buildTeacherDashboard({
    classes,
    students,
    units,
    submissions,
    now: new Date(),
    totalUnits,
    totalTests,
    unreadSubmissions,
  });

  return res.status(200).json({ ok: true, ...payload });
}

module.exports = requireAuth(withTenant(handler));

module.exports.default = module.exports;

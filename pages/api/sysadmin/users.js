const { connectDB } = require("../../../lib/db");
const { requireRole } = require("../../../lib/auth");
const users = require("../../../lib/users");
const User = require("../../../lib/models/User");
const Teacher = require("../../../lib/models/Teacher");
const Student = require("../../../lib/models/Student");
const Class = require("../../../lib/models/Class");
const Submission = require("../../../lib/models/Submission");

async function handler(req, res) {
  await connectDB();

  if (req.method === "GET") {
    const { role, q } = req.query;
    const filter = {};
    if (role && ["admin", "teacher", "student"].includes(role)) filter.role = role;
    if (q) {
      const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ username: rx }, { name: rx }, { email: rx }];
    }

    const [list, classes, subCounts] = await Promise.all([
      User.find(filter).sort({ role: 1, createdAt: -1 }).lean(),
      Class.find().lean(),
      Submission.aggregate([{ $group: { _id: "$studentId", n: { $sum: 1 } } }]),
    ]);
    const classById = {};
    classes.forEach((c) => (classById[String(c._id)] = c));
    const subByStudent = {};
    subCounts.forEach((c) => (subByStudent[String(c._id)] = c.n));

    const teacherIds = list.filter((u) => u.teacherId).map((u) => u.teacherId);
    const studentIds = list.filter((u) => u.studentId).map((u) => u.studentId);
    const [teachers, students] = await Promise.all([
      Teacher.find({ _id: { $in: teacherIds } }).select("classIds").lean(),
      Student.find({ _id: { $in: studentIds } }).select("classId").lean(),
    ]);
    const tById = {};
    teachers.forEach((t) => (tById[String(t._id)] = t));
    const sById = {};
    students.forEach((s) => (sById[String(s._id)] = s));

    const rows = list.map((u) => {
      const t = u.teacherId ? tById[String(u.teacherId)] : null;
      const s = u.studentId ? sById[String(u.studentId)] : null;
      const cls = s && s.classId ? classById[String(s.classId)] : null;
      return {
        _id: u._id,
        role: u.role,
        name: u.name,
        username: u.username,
        email: u.email || "",
        active: u.active !== false,
        lastLoginAt: u.lastLoginAt || null,
        createdAt: u.createdAt,
        teacherId: u.teacherId || null,
        studentId: u.studentId || null,
        classId: s ? s.classId || null : null,
        className: cls ? cls.name : null,
        teacherClassIds: t ? (t.classIds || []).map(String) : [],
        submissionCount: u.studentId ? subByStudent[String(u.studentId)] || 0 : 0,
      };
    });
    return res.status(200).json({
      ok: true,
      rows,
      classes: classes.map((c) => ({ _id: String(c._id), name: c.name, level: c.level })),
    });
  }

  if (req.method === "POST") {
    const b = req.body || {};
    const role = b.role;
    try {
      if (role === "admin") {
        const { user } = await users.createAdmin(b);
        return res.status(201).json({ ok: true, user: { _id: user._id, username: user.username } });
      }
      if (role === "teacher") {
        const { user } = await users.createTeacher({ ...b, classIds: Array.isArray(b.classIds) ? b.classIds : [] });
        return res.status(201).json({ ok: true, user: { _id: user._id, username: user.username } });
      }
      if (role === "student") {
        if (!b.classId) return res.status(400).json({ ok: false, error: "Please select a class" });
        const { user } = await users.createStudent(b);
        return res.status(201).json({ ok: true, user: { _id: user._id, username: user.username } });
      }
      return res.status(400).json({ ok: false, error: "role must be admin, teacher or student" });
    } catch (e) {
      return res.status(e.status || 400).json({ ok: false, error: e.message });
    }
  }

  if (req.method === "PUT") {
    const { id } = req.query;
    const b = req.body || {};
    const user = await User.findById(id).catch(() => null);
    if (!user) return res.status(404).json({ ok: false, error: "User not found" });

    try {
      if (b.name != null) await users.renameUser(id, b.name);
      if (b.email != null) await users.setEmail(id, b.email);
      if (b.password) await users.setPassword(id, b.password);

      if (b.active != null) {
        const wantOff = b.active === false;
        if (wantOff && String(id) === String(req.auth.userId)) {
          return res.status(400).json({ ok: false, error: "You cannot disable your own account" });
        }
        if (wantOff && user.role === "admin") {
          const activeAdmins = await User.countDocuments({ role: "admin", active: { $ne: false } });
          if (activeAdmins <= 1) return res.status(400).json({ ok: false, error: "Cannot disable the last active admin" });
        }
        await users.setActive(id, b.active);
      }

      if ("classId" in b && user.studentId) {
        let cid = null;
        if (b.classId) {
          const cls = await Class.findById(b.classId).catch(() => null);
          if (!cls) return res.status(400).json({ ok: false, error: "Class not found" });
          cid = cls._id;
        }
        await Student.updateOne({ _id: user.studentId }, { $set: { classId: cid } });
      }
      if (Array.isArray(b.classIds) && user.teacherId) {
        const valid = await Class.find({ _id: { $in: b.classIds } }).select("_id").lean();
        await Teacher.updateOne({ _id: user.teacherId }, { $set: { classIds: valid.map((c) => c._id) } });
      }
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(e.status || 400).json({ ok: false, error: e.message });
    }
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (String(id) === String(req.auth.userId)) {
      return res.status(400).json({ ok: false, error: "You cannot delete your own account" });
    }
    const user = await User.findById(id).catch(() => null);
    if (!user) return res.status(404).json({ ok: false, error: "User not found" });
    if (user.role === "admin") {
      const admins = await User.countDocuments({ role: "admin" });
      if (admins <= 1) return res.status(400).json({ ok: false, error: "Cannot delete the last admin" });
    }
    try {
      await users.deleteUserCascade(id);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(e.status || 400).json({ ok: false, error: e.message });
    }
  }

  res.setHeader("Allow", "GET, POST, PUT, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireRole("admin")(handler);

module.exports.default = module.exports;

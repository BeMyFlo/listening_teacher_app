const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { withTenant, tenantFilter, assertOwned } = require("../../../lib/tenant");
const Class = require("../../../lib/models/Class");
const Student = require("../../../lib/models/Student");
const Teacher = require("../../../lib/models/Teacher");
const Unit = require("../../../lib/models/Unit");
const Test = require("../../../lib/models/Test");
const { teacherScope, canAccessClass } = require("../../../lib/teacherScope");

async function handler(req, res) {
  await connectDB();
  const { id } = req.query;

  // Giáo viên chỉ thao tác trên lớp mình phụ trách (chưa gán lớp -> tất cả).
  const scope = await teacherScope(req.auth);

  if (req.method === "GET" && !id) {
    const [classes, counts] = await Promise.all([
      Class.find(tenantFilter(req.ws, scope.all ? {} : { _id: { $in: scope.classIds } }))
        .sort({ level: 1, name: 1 })
        .lean(),
      Student.aggregate([
        { $match: tenantFilter(req.ws, { classId: { $ne: null } }) },
        { $group: { _id: "$classId", count: { $sum: 1 } } },
      ]),
    ]);
    const byClass = {};
    counts.forEach((c) => (byClass[String(c._id)] = c.count));
    const rows = classes.map((c) => ({
      _id: c._id,
      name: c.name,
      level: c.level,
      createdAt: c.createdAt,
      studentCount: byClass[String(c._id)] || 0,
    }));
    return res.status(200).json({ ok: true, rows });
  }

  if (req.method === "POST") {
    const name = String((req.body && req.body.name) || "").trim();
    const level = Number(req.body && req.body.level);
    if (!name) return res.status(400).json({ ok: false, error: "Missing class name" });
    if (!Number.isInteger(level) || level < 1) {
      return res.status(400).json({ ok: false, error: "Please select a valid level" });
    }
    const cls = await Class.create({ name, level, workspaceId: req.ws.workspaceId });
    // Giáo viên đang bị teacherScope giới hạn (classIds không rỗng) tự tạo
    // lớp mới -> PHẢI tự động thêm lớp đó vào classIds của chính họ, nếu
    // không lớp vừa tạo sẽ biến mất khỏi màn hình Classes của chính người
    // tạo ra nó (Class không có field sở hữu, không có gì tự đồng bộ).
    // Bug thật đã phát hiện 2026-09-25 — xem PLAN-MULTI-TENANT.md Phase 3
    // bước 4. Giáo viên "toàn quyền" (scope.all=true, classIds rỗng) thì
    // không cần đụng gì — rỗng vẫn có nghĩa là thấy hết.
    if (!scope.all && req.auth && req.auth.teacherId) {
      await Teacher.updateOne(
        { _id: req.auth.teacherId },
        { $addToSet: { classIds: cls._id } }
      );
    }
    return res.status(201).json({ ok: true, class: cls });
  }

  const cls = await assertOwned(req.ws, Class, id, { message: "Class not found" });
  if (!canAccessClass(scope, cls._id)) {
    return res.status(403).json({ ok: false, error: "That class is not in your assigned classes" });
  }

  if (req.method === "GET") {
    const students = await Student.find(tenantFilter(req.ws, { classId: cls._id })).sort({ name: 1 }).lean();
    return res.status(200).json({
      ok: true,
      class: { _id: cls._id, name: cls.name, level: cls.level, createdAt: cls.createdAt },
      students: students.map((s) => ({ _id: s._id, name: s.name, username: s.username })),
    });
  }

  if (req.method === "PUT") {
    const { name, level } = req.body || {};
    if (name != null) {
      if (!String(name).trim()) return res.status(400).json({ ok: false, error: "Class name cannot be empty" });
      cls.name = String(name).trim();
    }
    if (level != null) {
      const lvl = Number(level);
      if (!Number.isInteger(lvl) || lvl < 1) return res.status(400).json({ ok: false, error: "Invalid level" });
      cls.level = lvl;
    }
    await cls.save();
    return res.status(200).json({ ok: true, class: cls });
  }

  if (req.method === "DELETE") {
    // Gỡ lớp khỏi học sinh (giữ nguyên level của họ) và khỏi Unit/Test đã gán.
    await Promise.all([
      Student.updateMany({ classId: cls._id }, { $set: { classId: null } }),
      Unit.updateMany({ classIds: cls._id }, { $pull: { classIds: cls._id } }),
      Test.updateMany({ classIds: cls._id }, { $pull: { classIds: cls._id } }),
    ]);
    await cls.deleteOne();
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST, PUT, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireAuth(withTenant(handler));

module.exports.default = module.exports;

// Admin chủ yếu XEM lớp của mọi workspace; tạo/sửa chỉ khi giáo viên nhờ.
// Cố ý KHÔNG có DELETE: xoá lớp gỡ học sinh và bài học/bài thi -> việc của giáo viên.
const mongoose = require("mongoose");
const { connectDB } = require("../../../lib/db");
const { requireRole } = require("../../../lib/auth");
const { asObjectId } = require("../../../lib/validate");
const Class = require("../../../lib/models/Class");
const Student = require("../../../lib/models/Student");
const Teacher = require("../../../lib/models/Teacher");
const Workspace = require("../../../lib/models/Workspace");

async function workspaceNames(ids) {
  const docs = ids.length ? await Workspace.find({ _id: { $in: ids } }).select("name").lean() : [];
  const m = {};
  docs.forEach((w) => (m[String(w._id)] = w.name));
  return m;
}

async function handler(req, res) {
  await connectDB();
  const { id } = req.query;

  if (req.method === "GET" && !id) {
    const filter = {};
    if (req.query.workspaceId) {
      const wid = asObjectId(req.query.workspaceId);
      if (!wid) return res.status(400).json({ ok: false, error: "Invalid workspace" });
      filter.workspaceId = new mongoose.Types.ObjectId(wid);
    }
    const [classes, counts] = await Promise.all([
      Class.find(filter).lean(),
      Student.aggregate([
        { $match: { classId: { $ne: null } } },
        { $group: { _id: "$classId", n: { $sum: 1 } } },
      ]),
    ]);
    const byClass = {};
    counts.forEach((c) => (byClass[String(c._id)] = c.n));
    const names = await workspaceNames([...new Set(classes.map((c) => String(c.workspaceId)))]);
    const rows = classes.map((c) => ({
      _id: c._id,
      name: c.name,
      level: c.level,
      createdAt: c.createdAt,
      workspaceId: String(c.workspaceId),
      workspaceName: names[String(c.workspaceId)] || "",
      studentCount: byClass[String(c._id)] || 0,
    }));
    rows.sort((a, b) => a.workspaceName.localeCompare(b.workspaceName) || a.level - b.level || a.name.localeCompare(b.name));
    return res.status(200).json({ ok: true, rows });
  }

  if (req.method === "GET") {
    const cid = asObjectId(id);
    const cls = cid ? await Class.findById(cid).lean() : null;
    if (!cls) return res.status(404).json({ ok: false, error: "Class not found" });
    const [students, names] = await Promise.all([
      Student.find({ classId: cls._id }).sort({ name: 1 }).select("name username").lean(),
      workspaceNames([String(cls.workspaceId)]),
    ]);
    return res.status(200).json({
      ok: true,
      class: {
        _id: cls._id,
        name: cls.name,
        level: cls.level,
        workspaceId: String(cls.workspaceId),
        workspaceName: names[String(cls.workspaceId)] || "",
        createdAt: cls.createdAt,
      },
      students: students.map((s) => ({ _id: s._id, name: s.name, username: s.username })),
    });
  }

  if (req.method === "POST") {
    const b = req.body || {};
    const wid = asObjectId(b.workspaceId);
    const ws = wid ? await Workspace.findById(wid).select("_id").lean() : null;
    if (!ws) return res.status(400).json({ ok: false, error: "Workspace not found" });
    const name = String(b.name || "").trim();
    const level = Number(b.level);
    if (!name) return res.status(400).json({ ok: false, error: "Missing class name" });
    if (!Number.isInteger(level) || level < 1) {
      return res.status(400).json({ ok: false, error: "Please select a valid level" });
    }
    const cls = await Class.create({ name, level, workspaceId: ws._id });
    // Giáo viên đang bị teacherScope giới hạn (classIds không rỗng) chỉ thấy lớp trong
    // danh sách -> thêm lớp mới vào, nếu không họ không thấy lớp mình vừa nhờ tạo.
    // classIds rỗng = thấy hết, để nguyên.
    await Teacher.updateMany(
      { workspaceId: ws._id, "classIds.0": { $exists: true } },
      { $addToSet: { classIds: cls._id } }
    );
    req.auditWorkspaceId = ws._id;
    return res.status(201).json({ ok: true, class: cls });
  }

  if (req.method === "PUT") {
    const cid = asObjectId(id);
    const cls = cid ? await Class.findById(cid) : null;
    if (!cls) return res.status(404).json({ ok: false, error: "Class not found" });
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
    req.auditWorkspaceId = cls.workspaceId;
    return res.status(200).json({ ok: true, class: cls });
  }

  res.setHeader("Allow", "GET, POST, PUT");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireRole("admin")(handler);

module.exports.default = module.exports;

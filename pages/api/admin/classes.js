const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const Class = require("../../../lib/models/Class");
const Student = require("../../../lib/models/Student");
const Unit = require("../../../lib/models/Unit");
const Test = require("../../../lib/models/Test");
const Message = require("../../../lib/models/Message");
const Conversation = require("../../../lib/models/Conversation");
const Teacher = require("../../../lib/models/Teacher");
const { deleteClassChatMedia } = require("../../../lib/cloudinary");

async function handler(req, res) {
  await connectDB();
  const { id } = req.query;

  if (req.method === "GET" && !id) {
    const [classes, counts] = await Promise.all([
      Class.find().sort({ level: 1, name: 1 }).lean(),
      Student.aggregate([
        { $match: { classId: { $ne: null } } },
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
    const cls = await Class.create({ name, level });
    return res.status(201).json({ ok: true, class: cls });
  }

  let cls;
  try {
    cls = await Class.findById(id);
  } catch (err) {
    return res.status(404).json({ ok: false, error: "Class not found" });
  }
  if (!cls) return res.status(404).json({ ok: false, error: "Class not found" });

  if (req.method === "GET") {
    const students = await Student.find({ classId: cls._id }).sort({ name: 1 }).lean();
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
    // Gỡ lớp khỏi học sinh (giữ nguyên level của họ), khỏi Unit/Test/Teacher đã
    // gán, và xoá phòng chat của lớp.
    await Promise.all([
      Student.updateMany({ classId: cls._id }, { $set: { classId: null } }),
      Unit.updateMany({ classIds: cls._id }, { $pull: { classIds: cls._id } }),
      Test.updateMany({ classIds: cls._id }, { $pull: { classIds: cls._id } }),
      Teacher.updateMany({ classIds: cls._id }, { $pull: { classIds: cls._id } }),
      Message.deleteMany({ classId: cls._id }),
      Conversation.deleteOne({ classId: cls._id }),
    ]);
    deleteClassChatMedia(String(cls._id)).catch((e) => console.error("[chat] media cleanup:", e.message));
    await cls.deleteOne();
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST, PUT, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;

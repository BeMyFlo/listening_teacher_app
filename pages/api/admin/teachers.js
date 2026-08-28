const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const Teacher = require("../../../lib/models/Teacher");
const Class = require("../../../lib/models/Class");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function handler(req, res) {
  await connectDB();

  if (req.method === "GET") {
    const [teachers, classes] = await Promise.all([
      Teacher.find().sort({ createdAt: 1 }).lean(),
      Class.find().sort({ level: 1, name: 1 }).lean(),
    ]);
    return res.status(200).json({
      ok: true,
      rows: teachers.map((t) => ({
        _id: t._id,
        name: t.name,
        username: t.username,
        email: t.email || "",
        classIds: (t.classIds || []).map(String),
      })),
      classes: classes.map((c) => ({ _id: String(c._id), name: c.name, level: c.level })),
    });
  }

  if (req.method === "PUT") {
    const { id } = req.query;
    let teacher;
    try {
      teacher = await Teacher.findById(id);
    } catch (err) {
      return res.status(404).json({ ok: false, error: "Teacher not found" });
    }
    if (!teacher) return res.status(404).json({ ok: false, error: "Teacher not found" });

    const { email, classIds } = req.body || {};
    if (email != null) {
      const e = String(email).trim().toLowerCase();
      if (e && !EMAIL_RE.test(e)) {
        return res.status(400).json({ ok: false, error: "Invalid email address" });
      }
      teacher.email = e;
    }
    if (classIds != null) {
      if (!Array.isArray(classIds)) {
        return res.status(400).json({ ok: false, error: "classIds must be an array" });
      }
      const valid = await Class.find({ _id: { $in: classIds } }).select("_id").lean();
      teacher.classIds = valid.map((c) => c._id);
    }
    await teacher.save();
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;

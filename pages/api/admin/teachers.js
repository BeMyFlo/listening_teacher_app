const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { withTenant, tenantFilter, assertOwned } = require("../../../lib/tenant");
const { asObjectId } = require("../../../lib/validate");
const Teacher = require("../../../lib/models/Teacher");
const Class = require("../../../lib/models/Class");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function handler(req, res) {
  await connectDB();

  if (req.method === "GET") {
    const [teachers, classes] = await Promise.all([
      Teacher.find(tenantFilter(req.ws)).sort({ createdAt: 1 }).lean(),
      Class.find(tenantFilter(req.ws)).sort({ level: 1, name: 1 }).lean(),
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
    const teacher = await assertOwned(req.ws, Teacher, id, { message: "Teacher not found" });

    // Chỉ sửa được chính mình, hoặc owner sửa đồng nghiệp trong workspace.
    if (String(teacher._id) !== String(req.auth.teacherId) && req.ws.role !== "owner") {
      return res.status(403).json({ ok: false, error: "You can only edit your own settings" });
    }

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
      // Bỏ id rác trước khi query (tránh CastError -> 500), rồi chỉ giữ lớp của workspace.
      const validIds = classIds.map(asObjectId).filter(Boolean);
      const valid = await Class.find(tenantFilter(req.ws, { _id: { $in: validIds } })).select("_id").lean();
      teacher.classIds = valid.map((c) => c._id);
    }
    await teacher.save();
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireAuth(withTenant(handler));

module.exports.default = module.exports;

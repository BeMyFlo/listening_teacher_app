const { connectDB } = require("../../../lib/db");
const { requireRole } = require("../../../lib/auth");
const { clearTenantCache } = require("../../../lib/tenant");
const { asObjectId } = require("../../../lib/validate");
const { validateSlug } = require("../../../lib/slug");
const { workspaceOrigin } = require("../../../lib/host");
const Workspace = require("../../../lib/models/Workspace");
const WorkspaceMember = require("../../../lib/models/WorkspaceMember");
const User = require("../../../lib/models/User");
const Student = require("../../../lib/models/Student");
const Class = require("../../../lib/models/Class");

const countBy = (Model) => Model.aggregate([{ $group: { _id: "$workspaceId", n: { $sum: 1 } } }]);
const toMap = (arr) => arr.reduce((m, x) => ((m[String(x._id)] = x.n), m), {});

async function handler(req, res) {
  await connectDB();

  if (req.method === "GET") {
    const [list, tc, sc, cc] = await Promise.all([
      Workspace.find().sort({ createdAt: 1 }).lean(),
      countBy(WorkspaceMember),
      countBy(Student),
      countBy(Class),
    ]);
    const owners = await User.find({ _id: { $in: list.map((w) => w.ownerUserId) } }).select("username name").lean();
    const ownerById = {};
    owners.forEach((u) => (ownerById[String(u._id)] = u));
    const teachers = toMap(tc), students = toMap(sc), classes = toMap(cc);
    return res.status(200).json({
      ok: true,
      rows: list.map((w) => {
        const o = ownerById[String(w.ownerUserId)];
        return {
          _id: w._id,
          name: w.name,
          slug: w.slug,
          origin: workspaceOrigin(w.slug),
          status: w.status,
          createdAt: w.createdAt,
          owner: { username: o ? o.username : "", name: o ? o.name : "" },
          teachers: teachers[String(w._id)] || 0,
          students: students[String(w._id)] || 0,
          classes: classes[String(w._id)] || 0,
        };
      }),
    });
  }

  if (req.method === "PUT") {
    const id = asObjectId(req.query.id);
    const ws = id ? await Workspace.findById(id) : null;
    if (!ws) return res.status(404).json({ ok: false, error: "Workspace not found" });

    const { status, name, slug } = req.body || {};
    if (status != null) {
      if (!Workspace.STATUSES.includes(status)) {
        return res.status(400).json({ ok: false, error: "status must be active or suspended" });
      }
      ws.status = status;
    }
    if (name != null) {
      const nm = String(name).trim();
      if (!nm || nm.length > 140) {
        return res.status(400).json({ ok: false, error: "Workspace name must be 1-140 characters" });
      }
      ws.name = nm;
    }
    if (slug != null) {
      // Đổi địa chỉ làm link cũ hỏng; dữ liệu không đổi (không bản ghi nào khác lưu slug).
      const v = validateSlug(slug);
      if (!v.ok) return res.status(400).json({ ok: false, error: v.error });
      if (v.slug !== ws.slug) {
        if (await Workspace.exists({ slug: v.slug, _id: { $ne: ws._id } })) {
          return res.status(409).json({ ok: false, error: "That workspace address is already taken" });
        }
        ws.slug = v.slug;
      }
    }
    try {
      await ws.save();
    } catch (e) {
      if (e && e.code === 11000) return res.status(409).json({ ok: false, error: "That workspace address is already taken" });
      throw e;
    }
    clearTenantCache();
    return res.status(200).json({ ok: true, workspace: { _id: ws._id, name: ws.name, slug: ws.slug, status: ws.status, origin: workspaceOrigin(ws.slug) } });
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireRole("admin")(handler);

module.exports.default = module.exports;

const { connectDB } = require("../../../lib/db");
const { requireRole } = require("../../../lib/auth");
const AuditLog = require("../../../lib/models/AuditLog");

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  await connectDB();

  const { actorRole, action, q, page = "0", limit = "50" } = req.query;
  const lim = Math.min(200, Math.max(1, Number(limit) || 50));
  const skip = Math.max(0, Number(page) || 0) * lim;

  const filter = {};
  if (actorRole) filter.actorRole = actorRole;
  if (action) filter.action = new RegExp("^" + String(action).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  if (q) filter.path = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  const [rows, total, oldest] = await Promise.all([
    AuditLog.find(filter).sort({ at: -1 }).skip(skip).limit(lim).lean(),
    AuditLog.countDocuments(filter),
    AuditLog.findOne().sort({ at: 1 }).select("at").lean(),
  ]);

  return res.status(200).json({
    ok: true,
    rows,
    total,
    page: Number(page) || 0,
    limit: lim,
    oldest: oldest ? oldest.at : null,
    retentionDays: 3,
  });
}

module.exports = requireRole("admin")(handler);

module.exports.default = module.exports;

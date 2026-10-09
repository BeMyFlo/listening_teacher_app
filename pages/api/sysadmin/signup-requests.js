// Yêu cầu dùng thử từ trang giới thiệu — phía ADMIN.
//   GET    /api/sysadmin/signup-requests              -> danh sách (lọc status) + đếm theo trạng thái
//   PUT    /api/sysadmin/signup-requests?id=<id>      -> đổi status / ghi chú
//   DELETE /api/sysadmin/signup-requests?id=<id>      -> xoá (dữ liệu cá nhân: admin xoá được khi không còn cần)
const { connectDB } = require("../../../lib/db");
const { requireRole } = require("../../../lib/auth");
const SignupRequest = require("../../../lib/models/SignupRequest");
const { asObjectId } = require("../../../lib/validate");

const LIMIT = 200;

async function handler(req, res) {
  await connectDB();
  const id = req.query.id ? asObjectId(req.query.id) : null;
  if (req.query.id && !id) return res.status(404).json({ ok: false, error: "Request not found" });

  if (req.method === "GET") {
    const filter = {};
    if (SignupRequest.STATUSES.includes(req.query.status)) filter.status = req.query.status;
    const [rows, counts] = await Promise.all([
      SignupRequest.find(filter).sort({ createdAt: -1 }).limit(LIMIT).lean(),
      SignupRequest.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    ]);
    const summary = { new: 0, contacted: 0, accepted: 0, rejected: 0 };
    counts.forEach((c) => { if (c._id in summary) summary[c._id] = c.n; });
    return res.status(200).json({ ok: true, rows, summary });
  }

  if (req.method === "PUT" && id) {
    const b = req.body || {};
    const patch = {};
    if (SignupRequest.STATUSES.includes(b.status)) patch.status = b.status;
    if (typeof b.note === "string") patch.note = b.note.trim().slice(0, 1000);
    if (!Object.keys(patch).length) return res.status(400).json({ ok: false, error: "Nothing to update" });
    const doc = await SignupRequest.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
    if (!doc) return res.status(404).json({ ok: false, error: "Request not found" });
    return res.status(200).json({ ok: true, row: doc });
  }

  if (req.method === "DELETE" && id) {
    const r = await SignupRequest.deleteOne({ _id: id });
    if (!r.deletedCount) return res.status(404).json({ ok: false, error: "Request not found" });
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, PUT, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireRole("admin")(handler);
module.exports.default = module.exports;

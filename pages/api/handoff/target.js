// Người dùng đăng nhập (giáo viên/học sinh) có địa chỉ riêng để chuyển sang không?
// Địa chỉ do SERVER tính từ workspace của tài khoản.
const { connectDB } = require("../../../lib/db");
const { requireAnyRole } = require("../../../lib/auth");
const { withTenant } = require("../../../lib/tenant");
const { hostFromReq, workspaceOrigin } = require("../../../lib/host");
const Workspace = require("../../../lib/models/Workspace");

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  // Admin đang "đăng nhập hộ" (impBy) hoặc đang ở subdomain: không chuyển.
  if (req.auth.impBy || hostFromReq(req).kind !== "root") {
    return res.status(200).json({ ok: true, origin: null });
  }
  await connectDB();
  const ws = await Workspace.findById(req.ws.workspaceId).select("slug").lean();
  return res.status(200).json({ ok: true, origin: ws ? workspaceOrigin(ws.slug) : null });
}

module.exports = requireAnyRole(["teacher", "student"])(withTenant(handler));

module.exports.default = module.exports;

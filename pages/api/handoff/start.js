// Bước giữa của chuyển phiên: ở DOMAIN GỐC, người đã đăng nhập xin 1 mã dùng-một-lần gắn với
// `state` do subdomain sinh. Trả { origin, code } — origin do server tính.
const { connectDB } = require("../../../lib/db");
const { requireAnyRole } = require("../../../lib/auth");
const { withTenant } = require("../../../lib/tenant");
const { hostFromReq, workspaceOrigin } = require("../../../lib/host");
const { TOKEN_RE, issueCode } = require("../../../lib/handoff");
const rateLimit = require("../../../lib/rateLimit");
const audit = require("../../../lib/audit");
const Workspace = require("../../../lib/models/Workspace");

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const gate = rateLimit.hit(`handoff-start:${rateLimit.clientIp(req)}`, { max: 30 });
  if (gate.limited) {
    res.setHeader("Retry-After", String(gate.retryAfterSec));
    return res.status(429).json({ ok: false, error: "Too many requests. Please try again shortly." });
  }
  // Chỉ phát mã ở domain gốc, không cho phiên "đăng nhập hộ", và phải có userId trong token.
  if (req.auth.impBy) return res.status(403).json({ ok: false, error: "Not available for this session" });
  if (hostFromReq(req).kind !== "root") return res.status(400).json({ ok: false, error: "Not available here" });
  if (!req.auth.userId) return res.status(400).json({ ok: false, error: "Please sign in again" });
  const state = req.body && req.body.state;
  if (typeof state !== "string" || !TOKEN_RE.test(state)) {
    return res.status(400).json({ ok: false, error: "Invalid request" });
  }

  await connectDB();
  const ws = await Workspace.findById(req.ws.workspaceId).select("slug").lean();
  const origin = ws ? workspaceOrigin(ws.slug) : null;
  if (!origin) return res.status(400).json({ ok: false, error: "This workspace has no address of its own" });

  const code = await issueCode({
    userId: req.auth.userId,
    role: req.auth.role,
    workspaceId: req.ws.workspaceId,
    state,
  });
  audit.record({ req, res, action: "auth.handoff_issued", status: 200, meta: { workspaceId: String(req.ws.workspaceId) } });
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ ok: true, origin, code });
}

module.exports = requireAnyRole(["teacher", "student"])(withTenant(handler));

module.exports.default = module.exports;

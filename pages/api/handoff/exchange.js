// Bước cuối: ở SUBDOMAIN của trung tâm, đổi mã dùng-một-lần lấy phiên đăng nhập thường.
// Không cần token (đây chính là bước tạo token). MỌI thất bại trả cùng một thông báo.
const { connectDB } = require("../../../lib/db");
const { signUserToken } = require("../../../lib/auth");
const { workspaceBySlug } = require("../../../lib/tenant");
const { hostFromReq } = require("../../../lib/host");
const { TOKEN_RE, sha256, safeEqualHex, consumeCode } = require("../../../lib/handoff");
const rateLimit = require("../../../lib/rateLimit");
const audit = require("../../../lib/audit");
const User = require("../../../lib/models/User");
const Student = require("../../../lib/models/Student");
const Teacher = require("../../../lib/models/Teacher");
const WorkspaceMember = require("../../../lib/models/WorkspaceMember");

const FAIL = { ok: false, error: "This sign-in link is invalid or has expired. Please sign in again." };

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const hostInfo = hostFromReq(req);
  if (hostInfo.kind !== "tenant") return res.status(400).json({ ok: false, error: "Not available here" });

  const gate = rateLimit.hit(`handoff-exchange:${rateLimit.clientIp(req)}`, { max: 30 });
  if (gate.limited) {
    res.setHeader("Retry-After", String(gate.retryAfterSec));
    return res.status(429).json({ ok: false, error: "Too many requests. Please try again shortly." });
  }

  const { code, state } = req.body || {};
  const fail = (reason) => {
    audit.record({ req, res, actor: { role: "system" }, action: "auth.handoff_failed", status: 401, meta: { reason } });
    return res.status(401).json(FAIL);
  };
  if (typeof code !== "string" || typeof state !== "string" || !TOKEN_RE.test(code) || !TOKEN_RE.test(state)) {
    return fail("malformed");
  }

  await connectDB();
  // Đốt mã NGAY khi trình ra, trước mọi kiểm tra khác: mã dùng sai host/state cũng không dùng lại được.
  const doc = await consumeCode(code);
  if (!doc) return fail("unknown_or_used");
  if (new Date(doc.expiresAt).getTime() <= Date.now()) return fail("expired");
  if (!safeEqualHex(doc.stateHash, sha256(state))) return fail("state_mismatch");

  const target = await workspaceBySlug(hostInfo.slug);
  if (!target || String(target.workspaceId) !== String(doc.workspaceId)) return fail("wrong_host");
  if (target.status === "suspended") return fail("suspended");

  const user = await User.findById(doc.userId);
  if (!user || user.active === false || user.role !== doc.role) return fail("user");

  let profile = null;
  if (doc.role === "teacher") {
    const member = await WorkspaceMember.exists({ workspaceId: doc.workspaceId, userId: user._id });
    if (!member || !user.teacherId) return fail("membership");
    profile = await Teacher.findById(user.teacherId).lean();
  } else {
    profile = user.studentId ? await Student.findById(user.studentId).lean() : null;
    if (!profile || String(profile.workspaceId) !== String(doc.workspaceId)) return fail("membership");
  }

  audit.record({
    req, res,
    actor: { role: user.role, userId: user._id, name: (profile && profile.name) || user.name },
    action: "auth.handoff",
    status: 200,
    meta: { workspaceId: String(doc.workspaceId) },
  });
  return res.status(200).json({
    ok: true,
    role: user.role,
    token: signUserToken(user, profile),
    name: (profile && profile.name) || user.name || "",
  });
};

module.exports.default = module.exports;

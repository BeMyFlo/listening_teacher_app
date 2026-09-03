// Ghi nhật ký thay đổi. "Bắn rồi quên" — không bao giờ throw, không chặn response.
const AuditLog = require("./models/AuditLog");

const SECRET_KEYS = /^(password|passwordhash|token|newpassword|currentpassword)$/i;
// Field dài / nhạy cảm về nội dung -> không lưu vào log.
const SKIP_KEYS = /^(essaytext|answers|transcript|audiourl|detail|criteria|annotations|speakingnotes|improvedsample|html)$/i;

function sanitize(value, depth = 0) {
  if (value == null) return value;
  if (typeof value === "string") return value.length > 300 ? value.slice(0, 300) + "…" : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    if (depth > 2) return `[${value.length} items]`;
    return value.slice(0, 20).map((v) => sanitize(v, depth + 1));
  }
  if (typeof value === "object") {
    if (depth > 2) return "{…}";
    const out = {};
    for (const k of Object.keys(value)) {
      if (SECRET_KEYS.test(k)) { out[k] = "***"; continue; }
      if (SKIP_KEYS.test(k)) { out[k] = "[omitted]"; continue; }
      out[k] = sanitize(value[k], depth + 1);
    }
    return out;
  }
  return String(value);
}

function deriveAction(method, path) {
  const seg = String(path || "").split("?")[0].split("/").filter(Boolean).pop() || "root";
  const verb = { POST: "create", PUT: "update", PATCH: "update", DELETE: "delete" }[method] || String(method || "").toLowerCase();
  return `${seg}.${verb}`;
}

function clientIp(req) {
  const xf = req && req.headers && req.headers["x-forwarded-for"];
  if (xf) return String(xf).split(",")[0].trim();
  return (req && req.socket && req.socket.remoteAddress) || "";
}

// record({ req, res, actor?, action?, status?, meta? })
function record(opts = {}) {
  try {
    const { req = {}, res = {}, actor: actorIn, action, status, meta } = opts;
    const a = actorIn || req.auth || {};
    const method = req.method || "";
    const path = req.url || "";

    const doc = {
      at: new Date(),
      actorRole: a.role || "system",
      actorId: a.userId || a.actorId || null,
      actorName: a.name || a.actorName || "",
      impBy: a.impBy || null,
      method,
      path,
      status: status != null ? status : res.statusCode || 0,
      action: action || deriveAction(method, path),
      meta: meta !== undefined ? sanitize(meta) : sanitize(req.body),
      ip: clientIp(req),
    };
    AuditLog.create(doc).catch(() => {});
  } catch {
    /* nuốt mọi lỗi — log không được làm hỏng request */
  }
}

module.exports = { record, deriveAction };

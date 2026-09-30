// Cài đặt workspace của giáo viên đang đăng nhập: tên, ngôn ngữ, múi giờ, màu.
// Mọi giáo viên xem được; chỉ owner của workspace được sửa.
const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { withTenant } = require("../../../lib/tenant");
const Workspace = require("../../../lib/models/Workspace");
const { sanitizeTheme } = require("../../../lib/theme");

const LOCALES = ["vi", "en"];

function validTimezone(tz) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function view(ws, role) {
  const { theme } = sanitizeTheme(ws.settings && ws.settings.theme);
  return {
    workspace: { _id: ws._id, name: ws.name, slug: ws.slug, locale: ws.locale, timezone: ws.timezone },
    theme: theme || {},
    canEdit: role === "owner",
  };
}

async function handler(req, res) {
  await connectDB();
  const ws = await Workspace.findById(req.ws.workspaceId);
  if (!ws) return res.status(404).json({ ok: false, error: "Workspace not found" });

  if (req.method === "GET") {
    return res.status(200).json({ ok: true, ...view(ws, req.ws.role) });
  }

  if (req.method === "PUT") {
    if (req.ws.role !== "owner") {
      return res.status(403).json({ ok: false, error: "Only the workspace owner can change these settings" });
    }
    const { name, locale, timezone, theme } = req.body || {};

    // Kiểm tra hết trước, rồi mới ghi.
    if (name != null) {
      const nm = String(name).trim();
      if (!nm || nm.length > 140) {
        return res.status(400).json({ ok: false, error: "Workspace name must be 1-140 characters" });
      }
      ws.name = nm;
    }
    if (locale != null) {
      if (!LOCALES.includes(locale)) return res.status(400).json({ ok: false, error: "Invalid language" });
      ws.locale = locale;
    }
    if (timezone != null) {
      if (typeof timezone !== "string" || !validTimezone(timezone)) {
        return res.status(400).json({ ok: false, error: "Invalid time zone" });
      }
      ws.timezone = timezone;
    }
    if (theme !== undefined) {
      const r = sanitizeTheme(theme);
      if (r.error) return res.status(400).json({ ok: false, error: r.error });
      const settings = { ...(ws.settings || {}) };
      if (Object.keys(r.theme).length) settings.theme = r.theme;
      else delete settings.theme;
      ws.settings = settings;
      ws.markModified("settings");
    }

    await ws.save();
    return res.status(200).json({ ok: true, ...view(ws, req.ws.role) });
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireAuth(withTenant(handler));

module.exports.default = module.exports;

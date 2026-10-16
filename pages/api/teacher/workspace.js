// Cài đặt workspace của giáo viên đang đăng nhập: tên, ngôn ngữ, múi giờ, màu.
// Mọi giáo viên xem được; chỉ owner của workspace được sửa.
const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { withTenant, tenantFilter } = require("../../../lib/tenant");
const Workspace = require("../../../lib/models/Workspace");
const Class = require("../../../lib/models/Class");
const Unit = require("../../../lib/models/Unit");
const Test = require("../../../lib/models/Test");
const { PROGRAM_KEYS, programFilter } = require("../../../lib/curriculum");
const { sanitizeLevelNames } = require("../../../lib/levelNames");
const { sanitizeTheme } = require("../../../lib/theme");
const { isCloudinaryUrl } = require("../../../lib/validate");

const LOCALES = ["vi", "en"];

function validTimezone(tz) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const plainLevelNames = (ws) =>
  (ws.levelNames || []).map((x) => ({ program: x.program, level: x.level, name: x.name }));

// Các level đang được Lớp / Unit / Test dùng, theo chương trình — để trang cài đặt
// hiện đủ mọi level đang có kể cả khi chưa đặt tên. { ielts: [1,2], toeic: [1] }
async function usedLevels(ws) {
  const out = {};
  for (const p of PROGRAM_KEYS) {
    const set = new Set();
    for (const M of [Class, Unit, Test]) {
      for (const lv of await M.distinct("level", tenantFilter(ws, programFilter(p)))) {
        if (Number.isInteger(lv) && lv >= 1) set.add(lv);
      }
    }
    out[p] = [...set].sort((a, b) => a - b);
  }
  return out;
}

function view(ws, role) {
  const { theme } = sanitizeTheme(ws.settings && ws.settings.theme);
  return {
    levelNames: plainLevelNames(ws),
    workspace: { _id: ws._id, name: ws.name, slug: ws.slug, logoUrl: ws.logoUrl || "", locale: ws.locale, timezone: ws.timezone },
    theme: theme || {},
    canEdit: role === "owner",
  };
}

async function handler(req, res) {
  await connectDB();
  const ws = await Workspace.findById(req.ws.workspaceId);
  if (!ws) return res.status(404).json({ ok: false, error: "Workspace not found" });

  if (req.method === "GET") {
    return res.status(200).json({ ok: true, ...view(ws, req.ws.role), usedLevels: await usedLevels(req.ws) });
  }

  if (req.method === "PUT") {
    if (req.ws.role !== "owner") {
      return res.status(403).json({ ok: false, error: "Only the workspace owner can change these settings" });
    }
    const { name, locale, timezone, theme, logoUrl, levelNames } = req.body || {};

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
    if (logoUrl !== undefined) {
      // Chỉ nhận ảnh đã upload lên Cloudinary của mình; "" = bỏ logo.
      if (logoUrl !== "" && (!isCloudinaryUrl(logoUrl) || logoUrl.length > 500)) {
        return res.status(400).json({ ok: false, error: "Logo must be an image uploaded through the app" });
      }
      ws.logoUrl = logoUrl;
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

    if (levelNames !== undefined) {
      const r = sanitizeLevelNames(levelNames);
      if (r.error) return res.status(400).json({ ok: false, error: r.error });
      ws.levelNames = r.levelNames;
    }

    await ws.save();
    return res.status(200).json({ ok: true, ...view(ws, req.ws.role) });
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireAuth(withTenant(handler));

module.exports.default = module.exports;

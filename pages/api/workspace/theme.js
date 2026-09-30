// Theme màu của workspace, cho giáo viên VÀ học sinh (client áp lên trang).
const { connectDB } = require("../../../lib/db");
const { requireAnyRole } = require("../../../lib/auth");
const { withTenant } = require("../../../lib/tenant");
const Workspace = require("../../../lib/models/Workspace");
const { sanitizeTheme } = require("../../../lib/theme");

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  await connectDB();
  const ws = await Workspace.findById(req.ws.workspaceId).select("settings").lean();
  // Kiểm tra lại lúc đọc: dù DB có gì thì client chỉ nhận màu hợp lệ.
  const { theme } = sanitizeTheme(ws && ws.settings && ws.settings.theme);
  return res.status(200).json({ ok: true, theme: theme || {} });
}

module.exports = requireAnyRole(["teacher", "student"])(withTenant(handler));

module.exports.default = module.exports;

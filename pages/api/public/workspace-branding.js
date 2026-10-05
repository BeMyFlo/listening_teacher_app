// Thương hiệu CÔNG KHAI của trung tâm đang truy cập (cho trang đăng nhập, trước khi
// có token). Slug lấy từ header Host phía server — BỎ QUA mọi tham số client gửi.
// Chỉ trả 3 trường vốn đã công khai theo thiết kế: tên, logo, màu. Không trả id,
// slug, số liệu hay bất cứ thứ gì khác.
const { connectDB } = require("../../../lib/db");
const { hostFromReq } = require("../../../lib/host");
const Workspace = require("../../../lib/models/Workspace");
const { sanitizeTheme } = require("../../../lib/theme");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const hostInfo = hostFromReq(req);
  res.setHeader("Cache-Control", "public, max-age=60");
  if (hostInfo.kind !== "tenant") {
    return res.status(404).json({ ok: false, error: "No workspace for this address" });
  }
  await connectDB();
  const w = await Workspace.findOne({ slug: hostInfo.slug }).select("name logoUrl status settings").lean();
  if (!w) return res.status(404).json({ ok: false, error: "No workspace for this address" });
  if (w.status === "suspended") {
    return res.status(200).json({ ok: true, suspended: true, workspace: null });
  }
  const { theme } = sanitizeTheme(w.settings && w.settings.theme);
  return res.status(200).json({
    ok: true,
    suspended: false,
    workspace: { name: w.name, logoUrl: w.logoUrl || "", theme: theme || {} },
  });
};

module.exports.default = module.exports;

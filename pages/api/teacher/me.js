// Hồ sơ của giáo viên đang đăng nhập + workspace của họ. Dùng cho header/sidebar.
const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { withTenant } = require("../../../lib/tenant");
const Teacher = require("../../../lib/models/Teacher");
const Workspace = require("../../../lib/models/Workspace");
const { activePrograms, workspaceLevelNames } = require("../../../lib/curriculumServer");

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  await connectDB();

  const teacher = await Teacher.findById(req.auth.teacherId)
    .select("name username email classIds")
    .lean();
  const workspace = await Workspace.findById(req.ws.workspaceId)
    .select("name slug logoUrl locale timezone status")
    .lean();

  return res.status(200).json({
    ok: true,
    teacher: teacher || null,
    workspace: workspace || null,
    membershipRole: req.ws.role,
    // Phase 8: chương trình workspace đang dùng, suy ra từ dữ liệu (không lưu).
    programs: await activePrograms(req.ws),
    // Tên level (theo chương trình) để các trang gắn nhãn level mà không gọi thêm API.
    levelNames: await workspaceLevelNames(req.ws),
  });
}

module.exports = requireAuth(withTenant(handler));

module.exports.default = module.exports;

// Quản lý level của workspace (giáo viên): danh sách, tạo, đổi tên, xoá.
// Level thuộc về Lớp; tên lưu ở Workspace.levelNames. Logic thuần ở lib/levelsAdmin.js.
// Xem docs/plans/PLAN-LEVEL-NAMES.md.
const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { withTenant, tenantFilter } = require("../../../lib/tenant");
const Workspace = require("../../../lib/models/Workspace");
const Class = require("../../../lib/models/Class");
const Unit = require("../../../lib/models/Unit");
const Test = require("../../../lib/models/Test");
const { PROGRAM_KEYS, isProgram, programFilter } = require("../../../lib/curriculum");
const { LEVEL_MAX } = require("../../../lib/levelNames");
const { validLevel, mergeLevels, planCreate, planRename, planDelete } = require("../../../lib/levelsAdmin");

// Mức dùng của một chương trình trong workspace: số lớp theo level + level của Unit/Test.
async function loadUsage(ws, program) {
  const filter = tenantFilter(ws, programFilter(program));
  const [classRows, unitLevels, testLevels] = await Promise.all([
    Class.aggregate([{ $match: filter }, { $group: { _id: "$level", n: { $sum: 1 } } }]),
    Unit.distinct("level", filter),
    Test.distinct("level", filter),
  ]);
  const classCounts = {};
  for (const r of classRows) classCounts[r._id] = r.n;
  return { classCounts, unitLevels, testLevels };
}

const plainNames = (w) =>
  ((w && w.levelNames) || []).map((x) => ({ program: x.program, level: x.level, name: x.name }));

async function handler(req, res) {
  await connectDB();
  const ws = req.ws;
  const body = req.body || {};

  if (req.method === "GET") {
    const w = await Workspace.findById(ws.workspaceId).select("levelNames").lean();
    const names = plainNames(w);
    const levels = {};
    for (const p of PROGRAM_KEYS) levels[p] = mergeLevels(names, p, await loadUsage(ws, p));
    return res.status(200).json({ ok: true, levels });
  }

  if (!["POST", "PUT", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, PUT, DELETE");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const src = req.method === "DELETE" ? req.query || {} : body;
  const program = src.program;
  if (!isProgram(program)) return res.status(400).json({ ok: false, error: "Invalid program" });

  let level = null;
  if (req.method !== "POST") {
    level = Number(src.level);
    if (src.level == null || src.level === "" || !validLevel(level)) {
      return res.status(400).json({ ok: false, error: `Level must be a whole number from 1 to ${LEVEL_MAX}` });
    }
  }

  const w = await Workspace.findById(ws.workspaceId);
  if (!w) return res.status(404).json({ ok: false, error: "Workspace not found" });
  const names = plainNames(w);
  const usage = await loadUsage(ws, program);

  const plan =
    req.method === "POST" ? planCreate(names, program, body.name, usage)
    : req.method === "PUT" ? planRename(names, program, level, body.name, usage)
    : planDelete(names, program, level, usage);
  if (plan.error) return res.status(plan.status).json({ ok: false, error: plan.error });

  w.levelNames = plan.levelNames;
  await w.save();
  if (req.method === "DELETE") return res.status(200).json({ ok: true });
  return res
    .status(plan.status)
    .json({ ok: true, level: { program, level: plan.level, name: plan.name } });
}

module.exports = requireAuth(withTenant(handler));

module.exports.default = module.exports;

// Nhật ký gọi LLM cho admin: danh sách + thống kê (GET), chi tiết 1 lần gọi
// kèm system prompt (GET ?id=).

const { connectDB } = require("../../../lib/db");
const { requireRole } = require("../../../lib/auth");
const AiLog = require("../../../lib/models/AiLog");
const AiPrompt = require("../../../lib/models/AiPrompt");

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const HEAVY = "-prompt -response -systemHash";

function buildFilter({ purpose, status, model, q, days }) {
  const d = Math.min(30, Math.max(1, Number(days) || 7));
  const filter = { at: { $gte: new Date(Date.now() - d * 24 * 60 * 60 * 1000) } };
  // "grading" khớp cả grading.writing lẫn grading.speaking.
  if (purpose) filter.purpose = new RegExp("^" + escapeRe(purpose) + "(\\.|$)");
  if (status === "ok") filter.ok = true;
  if (status === "error") filter.ok = false;
  if (model) filter.model = String(model);
  if (q) {
    const re = new RegExp(escapeRe(q), "i");
    filter.$or = [
      { actorName: re },
      { "context.unitName": re },
      { "context.testTitle": re },
      { "context.studentName": re },
      { "context.promptTitle": re },
      { error: re },
    ];
  }
  return { filter, days: d };
}

const sumFields = {
  calls: { $sum: 1 },
  errors: { $sum: { $cond: ["$ok", 0, 1] } },
  fallbacks: { $sum: { $cond: [{ $gt: [{ $size: "$attempts" }, 1] }, 1, 0] } },
  promptTokens: { $sum: "$promptTokens" },
  outputTokens: { $sum: "$outputTokens" },
  thoughtsTokens: { $sum: "$thoughtsTokens" },
  totalTokens: { $sum: "$totalTokens" },
  avgMs: { $avg: "$durationMs" },
  maxMs: { $max: "$durationMs" },
};

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  await connectDB();

  if (req.query.id) {
    let log;
    try {
      log = await AiLog.findById(req.query.id).lean();
    } catch {
      log = null;
    }
    if (!log) return res.status(404).json({ ok: false, error: "Log not found" });
    const sys = log.systemHash ? await AiPrompt.findById(log.systemHash).select("text").lean() : null;
    return res.status(200).json({ ok: true, log: { ...log, systemInstruction: sys ? sys.text : "" } });
  }

  const { page = "0", limit = "50" } = req.query;
  const lim = Math.min(200, Math.max(1, Number(limit) || 50));
  const skip = Math.max(0, Number(page) || 0) * lim;
  const { filter, days } = buildFilter(req.query);
  const since30 = { at: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } };

  const [rows, total, totals, byPurpose, byModel, purposes, models] = await Promise.all([
    AiLog.find(filter).select(HEAVY).sort({ at: -1 }).skip(skip).limit(lim).lean(),
    AiLog.countDocuments(filter),
    AiLog.aggregate([{ $match: filter }, { $group: { _id: null, ...sumFields } }]),
    AiLog.aggregate([{ $match: filter }, { $group: { _id: "$purpose", ...sumFields } }, { $sort: { calls: -1 } }]),
    AiLog.aggregate([{ $match: filter }, { $group: { _id: "$model", ...sumFields } }, { $sort: { calls: -1 } }]),
    AiLog.distinct("purpose", since30),
    AiLog.distinct("model", since30),
  ]);

  return res.status(200).json({
    ok: true,
    rows,
    total,
    page: Number(page) || 0,
    limit: lim,
    days,
    stats: {
      totals: totals[0] || { calls: 0, errors: 0, fallbacks: 0, promptTokens: 0, outputTokens: 0, thoughtsTokens: 0, totalTokens: 0, avgMs: 0, maxMs: 0 },
      byPurpose,
      byModel,
    },
    purposes: purposes.sort(),
    models: models.filter(Boolean).sort(),
    retentionDays: AiLog.RETENTION_DAYS,
  });
}

module.exports = requireRole("admin")(handler);

module.exports.default = module.exports;

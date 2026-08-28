const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { KNOWN_MODELS, envChain, getGradingModels, setGradingModels } = require("../../../lib/grading/aiModels");
const { isEnabled } = require("../../../lib/gemini");

async function handler(req, res) {
  await connectDB();

  if (req.method === "GET") {
    const models = await getGradingModels();
    return res.status(200).json({
      ok: true,
      models,
      known: KNOWN_MODELS,
      envDefault: envChain(),
      geminiConfigured: isEnabled(),
    });
  }

  if (req.method === "PUT") {
    const { models } = req.body || {};
    if (!Array.isArray(models) || models.length === 0) {
      return res.status(400).json({ ok: false, error: "Provide at least one model" });
    }
    const saved = await setGradingModels(models);
    if (!saved.length) {
      return res.status(400).json({ ok: false, error: "No valid model ids" });
    }
    return res.status(200).json({ ok: true, models: saved });
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;

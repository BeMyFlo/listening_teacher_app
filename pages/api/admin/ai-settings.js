const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { KNOWN_MODELS, envChain, getGradingModels } = require("../../../lib/grading/aiModels");
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

  res.setHeader("Allow", "GET");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;

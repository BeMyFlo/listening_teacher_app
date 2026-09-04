const { connectDB } = require("../../../lib/db");
const { requireRole } = require("../../../lib/auth");
const { isEnabled: geminiEnabled } = require("../../../lib/gemini");
const { KNOWN_MODELS, envChain, getGradingModels, setGradingModels } = require("../../../lib/grading/aiModels");
const { generateDeadlineNotificationsForAll } = require("../../../lib/notifications/generate");
const { sweepDeadlineEmailJobs } = require("../../../lib/notifications/deadlineAssign");
const audit = require("../../../lib/audit");

function envSet(name) {
  return !!(process.env[name] && String(process.env[name]).trim());
}

async function handler(req, res) {
  await connectDB();

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      integrations: {
        mongodb: envSet("MONGODB_URI"),
        jwtSecret: envSet("JWT_SECRET"),
        gemini: geminiEnabled(),
        email: envSet("GMAIL_USER") && envSet("GMAIL_APP_PASSWORD"),
        cloudinary: envSet("CLOUDINARY_API_SECRET"),
        cronSecret: envSet("CRON_SECRET"),
        adminBootstrap: envSet("ADMIN_PASSWORD"),
        teacherBootstrap: envSet("TEACHER_PASSWORD"),
        appUrl: process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "",
      },
      runtime: {
        node: process.version,
        env: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
        region: process.env.VERCEL_REGION || "",
      },
      ai: {
        models: await getGradingModels(),
        known: KNOWN_MODELS,
        envChain: envChain(),
      },
    });
  }

  if (req.method === "PUT") {
    const models = Array.isArray(req.body && req.body.models) ? req.body.models : null;
    if (!models) return res.status(400).json({ ok: false, error: "models must be an array" });
    const saved = await setGradingModels(models);
    return res.status(200).json({ ok: true, models: saved });
  }

  if (req.method === "POST") {
    const action = req.body && req.body.action;
    if (action === "deadline-scan") {
      const scan = await generateDeadlineNotificationsForAll();
      let jobs = null;
      try { jobs = await sweepDeadlineEmailJobs(); } catch (e) { jobs = { error: e.message }; }
      audit.record({ req, res, action: "system.deadline-scan", status: 200, meta: { scan, jobs } });
      return res.status(200).json({ ok: true, scan, jobs });
    }
    return res.status(400).json({ ok: false, error: "Unknown action" });
  }

  res.setHeader("Allow", "GET, PUT, POST");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireRole("admin")(handler);

module.exports.default = module.exports;

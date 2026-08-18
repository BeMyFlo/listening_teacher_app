const { connectDB } = require("../../lib/db");
const { requireAuth } = require("../../lib/auth");
const Submission = require("../../lib/models/Submission");

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  await connectDB();

  const { testId, name } = req.query;
  const filter = {};
  if (testId) filter.testId = testId;
  if (name) filter.studentName = { $regex: String(name).trim(), $options: "i" };

  const rows = await Submission.find(filter).sort({ submittedAt: -1 }).lean();
  return res.status(200).json({ ok: true, rows });
}

module.exports = requireAuth(handler);

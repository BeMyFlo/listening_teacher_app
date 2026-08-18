const { connectDB } = require("../../lib/db");
const Test = require("../../lib/models/Test");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  await connectDB();
  const filter = { status: "published" };
  if (req.query.subject === "listening" || req.query.subject === "reading") {
    filter.subject = req.query.subject;
  }
  const tests = await Test.find(filter).sort({ createdAt: -1 }).lean();

  const rows = tests.map((t) => ({
    id: t._id,
    subject: t.subject,
    title: t.title,
    unit: t.unit,
    totalQuestions: (t.sections || []).reduce((n, s) => n + (s.fields || []).length, 0)
  }));

  return res.status(200).json({ ok: true, rows });
};

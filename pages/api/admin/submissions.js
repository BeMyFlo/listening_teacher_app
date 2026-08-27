const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const Submission = require("../../../lib/models/Submission");
const { resolveVariant, getRubric, overallBand, validateCriteria } = require("../../../lib/grading/rubric");

const KINDS = ["test", "exercise", "writing", "speaking"];

// Điểm tổng do giáo viên nhập (override) — band 0–9, bước 0.5.
function validOverride(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 9 && Math.round(n * 2) === n * 2;
}

async function handler(req, res) {
  await connectDB();
  const { id } = req.query;

  if (req.method === "GET") {
    const { testId, name, kind, gradingStatus } = req.query;
    const filter = {};
    if (testId) filter.testId = testId;
    if (name) filter.studentName = { $regex: String(name).trim(), $options: "i" };
    if (kind) {
      if (!KINDS.includes(kind)) {
        return res.status(400).json({ ok: false, error: "Invalid submission kind" });
      }
      filter.kind = kind;
    }
    if (gradingStatus) {
      if (!["submitted", "graded"].includes(gradingStatus)) {
        return res.status(400).json({ ok: false, error: "Invalid gradingStatus" });
      }
      filter.gradingStatus = gradingStatus;
    }

    const rows = await Submission.find(filter).sort({ submittedAt: -1 }).lean();
    return res.status(200).json({ ok: true, rows });
  }

  // Manual grading for Writing/Speaking: PUT ?id=<submissionId>
  if (req.method === "PUT" && id) {
    let submission;
    try {
      submission = await Submission.findById(id);
    } catch (err) {
      return res.status(404).json({ ok: false, error: "Submission not found" });
    }
    if (!submission) {
      return res.status(404).json({ ok: false, error: "Submission not found" });
    }
    if (submission.kind !== "writing" && submission.kind !== "speaking") {
      return res.status(400).json({ ok: false, error: "Only Writing and Speaking submissions can be manually graded" });
    }

    const { manualScore, manualFeedback, criteria } = req.body || {};

    if (Array.isArray(criteria)) {
      // ----- Chấm theo rubric IELTS (4 tiêu chí) -----
      let variant = req.body.rubricVariant || submission.rubricVariant;
      if (!variant) variant = resolveVariant(submission.kind); // speaking / writing.task2 mặc định
      if (!getRubric(variant)) {
        return res.status(400).json({ ok: false, error: "Unknown grading rubric" });
      }
      const cerr = validateCriteria(variant, criteria);
      if (cerr) return res.status(400).json({ ok: false, error: cerr });

      const clean = criteria.map((c) => ({
        key: c.key,
        band: Number(c.band),
        comment: String(c.comment || ""),
      }));
      const auto = overallBand(clean);
      const overall = validOverride(manualScore) ? Number(manualScore) : auto;

      submission.criteria = clean;
      submission.rubricVariant = variant;
      submission.manualScore = overall;
      submission.manualFeedback = String(manualFeedback || "");
    } else {
      // ----- Chấm nhanh: chỉ 1 điểm tổng (luồng cũ) -----
      const scoreNum = Number(manualScore);
      if (manualScore == null || manualScore === "" || Number.isNaN(scoreNum)) {
        return res.status(400).json({ ok: false, error: "Please enter a valid score" });
      }
      submission.manualScore = scoreNum;
      submission.manualFeedback = String(manualFeedback || "");
    }

    submission.gradingStatus = "graded";
    submission.gradedAt = new Date();
    submission.gradedBy = req.auth.teacherId;
    await submission.save();

    return res.status(200).json({ ok: true, submission });
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;

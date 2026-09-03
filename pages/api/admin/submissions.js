const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const Submission = require("../../../lib/models/Submission");
const { resolveVariant, getRubric, overallBand, validateCriteria } = require("../../../lib/grading/rubric");
const { validateAnnotations, reconcileAnnotations } = require("../../../lib/grading/annotate");

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

    const { manualScore, manualFeedback, criteria, annotations, gradeSource, transcript, speakingNotes, priorities, topicVocabulary, improvedSample, mainIssue } = req.body || {};

    // Speaking: transcript + ghi chú theo mốc giây. Cập nhật TRƯỚC annotations
    // vì annotations của speaking neo vào transcript (có thể đổi cùng lúc).
    if (submission.kind === "speaking") {
      if (typeof transcript === "string") submission.transcript = transcript;
      if (Array.isArray(speakingNotes)) {
        submission.speakingNotes = speakingNotes.map((n) => ({
          id: n.id || Math.random().toString(36).slice(2, 10),
          atSeconds: Number.isFinite(Number(n.atSeconds)) ? Number(n.atSeconds) : null,
          category: String(n.category || "other"),
          criterion: n.criterion || null,
          comment: String(n.comment || ""),
          source: n.source === "ai" ? "ai" : "teacher",
        }));
      }
    }

    // Chú thích inline (tuỳ chọn) — neo vào essayText (Writing) hoặc
    // transcript (Speaking); không áp dụng cho kind khác.
    if (annotations !== undefined) {
      if (submission.kind !== "writing" && submission.kind !== "speaking") {
        return res.status(400).json({ ok: false, error: "Annotations are only for Writing and Speaking submissions" });
      }
      const anchorText = submission.kind === "writing" ? submission.essayText || "" : submission.transcript || "";
      // Hoà giải overlap thay vì từ chối cả lần lưu — chỗ sửa bị chồng được hạ
      // xuống "comment" (không mất lỗi). Nếu vì lý do nào đó vẫn không hợp lệ thì
      // bỏ qua annotation lần này chứ KHÔNG chặn lưu điểm/nhận xét.
      const reconciled = reconcileAnnotations(anchorText, annotations || []).annotations;
      const aerr = validateAnnotations(anchorText, reconciled);
      if (aerr) {
        console.warn("[grade] annotations still invalid after reconcile, skipping:", aerr);
      } else {
        submission.annotations = reconciled;
      }
    }

    if (["teacher", "ai", "ai-reviewed"].includes(gradeSource)) submission.gradeSource = gradeSource;

    // "Suggested Actions" — 3 mục cố định (Priorities/Topic vocabulary/Improved sample).
    if (Array.isArray(priorities)) {
      submission.priorities = priorities.map((p) => String(p || "").trim()).filter(Boolean).slice(0, 3);
    }
    if (Array.isArray(topicVocabulary)) {
      submission.topicVocabulary = topicVocabulary
        .map((v) => ({ term: String((v && v.term) || "").trim(), meaning: String((v && v.meaning) || "").trim(), example: String((v && v.example) || "").trim() }))
        .filter((v) => v.term)
        .slice(0, 8);
    }
    if (typeof improvedSample === "string") submission.improvedSample = improvedSample.trim();
    if (typeof mainIssue === "string") submission.mainIssue = mainIssue.trim();

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

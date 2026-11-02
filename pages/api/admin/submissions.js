const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { withTenant, tenantFilter, assertOwned } = require("../../../lib/tenant");
const Submission = require("../../../lib/models/Submission");
const Test = require("../../../lib/models/Test");
const { rebuildDetail } = require("../../../lib/grade");
const { resolveVariant, getRubric, overallScore, validateCriteria, isToeicVariant, isGeneralVariant, criterionKeys, validGeneralCriterionScore, scoreRange, taskScore } = require("../../../lib/grading/rubric");
const { validateAnnotations, reconcileAnnotations } = require("../../../lib/grading/annotate");
const { notifyStudentGraded } = require("../../../lib/notifications/student");
const Student = require("../../../lib/models/Student");
const { teacherScope } = require("../../../lib/teacherScope");
const { asObjectId } = require("../../../lib/validate");
const { parseProgramParam, programFilter } = require("../../../lib/curriculum");

const KINDS = ["test", "exercise", "writing", "speaking"];
const LIST_LIMIT = 500;

// Bài nộp không lưu classId, nên phạm vi lớp phải quy về danh sách studentId.
// Trả null nghĩa là không giới hạn.
async function scopedStudentIds(ws, auth) {
  const scope = await teacherScope(auth);
  if (scope.all) return null;
  const students = await Student.find(tenantFilter(ws, { classId: { $in: scope.classIds } })).select("_id").lean();
  return students.map((s) => s._id);
}

// Điểm tổng do giáo viên nhập (override) — band 0–9, bước 0.5.
function validOverride(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 9 && Math.round(n * 2) === n * 2;
}

// TOEIC: điểm câu là số nguyên 0..maxScore của dạng đề (không có "override" tách riêng).
function validToeicScore(variant, v) {
  if (v === null || v === "" || v === undefined) return false;
  const n = Number(v);
  const { min, max } = scoreRange(variant);
  return Number.isInteger(n) && n >= min && n <= max;
}

// General (thang 10): điểm tổng phải nằm trong 0–10.
const GENERAL_TOTAL_MAX = 10;
function inGeneralTotalRange(v) {
  const n = Number(v);
  return v !== "" && Number.isFinite(n) && n >= 0 && n <= GENERAL_TOTAL_MAX;
}

async function handler(req, res) {
  await connectDB();
  const { id } = req.query;

  // Giáo viên chỉ thấy bài nộp của học sinh trong lớp mình (chưa gán -> tất cả).
  const studentIds = await scopedStudentIds(req.ws, req.auth);

  if (req.method === "GET") {
    const { testId, name, kind, gradingStatus } = req.query;
    const filter = {};
    // ?program= trống/all = không lọc (như trước); sai -> 400.
    const prog = parseProgramParam(req.query.program);
    if (prog.error) return res.status(400).json({ ok: false, error: prog.error });
    if (prog.program) Object.assign(filter, programFilter(prog.program));
    if (studentIds) filter.studentId = { $in: studentIds };
    if (testId) {
      const tid = asObjectId(testId);
      if (!tid) return res.status(400).json({ ok: false, error: "Invalid testId" });
      filter.testId = tid;
    }
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

    // Có trần để trang không tải nguyên collection khi dữ liệu lớn dần.
    const rows = await Submission.find(tenantFilter(req.ws, filter)).sort({ submittedAt: -1 }).limit(LIST_LIMIT).lean();

    // Auto-graded mock tests (listening/reading) store answers as internal
    // option ids. Rebuild a readable per-question detail from the live test so
    // the teacher review shows real words + right/wrong marks, not raw ids —
    // and so rows saved before this resolution still display correctly.
    const testRows = rows.filter((r) => r.kind === "test" && r.testId && r.testSkill);
    if (testRows.length) {
      const testIds = [...new Set(testRows.map((r) => String(r.testId)))];
      const tests = await Test.find(tenantFilter(req.ws, { _id: { $in: testIds } }))
        .select("skills")
        .lean();
      const byId = new Map(tests.map((t) => [String(t._id), t]));
      for (const r of testRows) {
        const t = byId.get(String(r.testId));
        const skillBlock = t && t.skills && t.skills[r.testSkill];
        const rebuilt = rebuildDetail(skillBlock, r.answers);
        if (rebuilt) r.detail = rebuilt;
      }
    }

    return res.status(200).json({ ok: true, rows });
  }

  // Manual grading for Writing/Speaking: PUT ?id=<submissionId>
  if (req.method === "PUT" && id) {
    const submission = await assertOwned(req.ws, Submission, id, { message: "Submission not found" });
    // Không chấm bài của học sinh ngoài lớp mình phụ trách.
    if (studentIds && !studentIds.some((sid) => String(sid) === String(submission.studentId))) {
      return res.status(403).json({ ok: false, error: "That student is not in your assigned classes" });
    }
    if (submission.kind !== "writing" && submission.kind !== "speaking") {
      return res.status(400).json({ ok: false, error: "Only Writing and Speaking submissions can be manually graded" });
    }
    const wasGraded = submission.gradingStatus === "graded";

    const { manualScore, manualFeedback, criteria, annotations, gradeSource, transcript, speakingNotes, priorities, topicVocabulary, improvedSample, mainIssue } = req.body || {};

    // publish=false -> lưu bản nháp (gradingStatus "draft"), học sinh CHƯA thấy.
    // Thiếu field này (client cũ) -> mặc định xuất bản luôn như trước.
    const publish = req.body.publish !== false;

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
      // Bài TOEIC luôn chấm theo đúng dạng đề đã nộp, client không đổi sang rubric khác.
      if (isToeicVariant(submission.rubricVariant)) variant = submission.rubricVariant;
      // Bài General (thang 10) cũng khoá theo rubric đã chốt lúc nộp; và ngược lại client không được
      // đẩy rubric General vào bài IELTS/TOEIC (sẽ lưu điểm 0–10 vào chỗ band 0–9).
      const generalSub = isGeneralVariant(submission.rubricVariant);
      if (generalSub) variant = submission.rubricVariant;
      else if (isGeneralVariant(variant)) {
        return res.status(400).json({ ok: false, error: "This rubric does not match the submission" });
      }
      if (!variant) variant = resolveVariant(submission.kind, undefined, submission.program); // speaking / writing.task2 mặc định
      if (!getRubric(variant)) {
        return res.status(400).json({ ok: false, error: "Unknown grading rubric" });
      }
      // Bản nháp: cho phép thiếu band (chưa chấm xong). Xuất bản: bắt đủ 4 band.
      if (publish) {
        const cerr = validateCriteria(variant, criteria);
        if (cerr) return res.status(400).json({ ok: false, error: cerr });
      }

      const toeic = isToeicVariant(variant);
      const general = isGeneralVariant(variant);
      const clean = criteria.map((c) => ({
        key: c.key,
        band: c.band == null || c.band === "" ? null : Number(c.band),
        comment: String(c.comment || ""),
      }));
      if (toeic) {
        // Bản nháp vẫn không cho điểm ngoài khoảng (chỉ cho để trống).
        const bad = clean.find((c) => c.band != null && (c.key !== "score" || !validToeicScore(variant, c.band)));
        if (bad) return res.status(400).json({ ok: false, error: validateCriteria(variant, [bad]) || "Invalid score" });
      }
      if (general) {
        // Bản nháp vẫn không cho điểm ngoài thang (chỉ cho để trống).
        const keys = criterionKeys(variant);
        const bad = clean.find((c) => c.band != null && (!keys.includes(c.key) || !validGeneralCriterionScore(c.band)));
        if (bad) {
          const msg = keys.includes(bad.key) ? `${bad.key}: score must be from 0 to ${scoreRange(variant).max} in steps of 0.25.` : "Invalid criterion: " + bad.key;
          return res.status(400).json({ ok: false, error: msg });
        }
      }
      const auto = overallScore(variant, clean);
      if (general && manualScore != null && manualScore !== "") {
        // Tổng = tổng 4 tiêu chí, không ghi đè. Client có thể gửi lại đúng tổng; số khác bị chặn.
        if (!inGeneralTotalRange(manualScore)) {
          return res.status(400).json({ ok: false, error: `Score must be from 0 to ${GENERAL_TOTAL_MAX}` });
        }
        if (auto != null && Number(manualScore) !== auto) {
          return res.status(400).json({ ok: false, error: "The total must equal the sum of the criteria scores" });
        }
      }
      const overall = !toeic && !general && validOverride(manualScore) ? Number(manualScore) : auto;

      submission.criteria = clean;
      submission.rubricVariant = variant;
      submission.manualScore = overall;
      submission.manualFeedback = String(manualFeedback || "");
    } else {
      // ----- Chấm nhanh: chỉ 1 điểm tổng (luồng cũ) -----
      const scoreNum = Number(manualScore);
      const hasScore = !(manualScore == null || manualScore === "" || Number.isNaN(scoreNum));
      if (hasScore && isToeicVariant(submission.rubricVariant) && !validToeicScore(submission.rubricVariant, manualScore)) {
        const { max } = scoreRange(submission.rubricVariant);
        return res.status(400).json({ ok: false, error: `Score must be a whole number from 0 to ${max}` });
      }
      if (hasScore && isGeneralVariant(submission.rubricVariant)) {
        // General: điểm luôn lấy từ 4 tiêu chí, không có đường nhập 1 số tổng.
        if (!inGeneralTotalRange(manualScore)) {
          return res.status(400).json({ ok: false, error: `Score must be from 0 to ${GENERAL_TOTAL_MAX}` });
        }
        return res.status(400).json({ ok: false, error: "Please grade with the criteria scores" });
      }
      if (publish && !hasScore) {
        return res.status(400).json({ ok: false, error: "Please enter a valid score" });
      }
      if (hasScore) submission.manualScore = scoreNum;
      if (manualFeedback != null) submission.manualFeedback = String(manualFeedback || "");
    }

    if (publish) {
      submission.gradingStatus = "graded";
      submission.gradedAt = new Date();
      submission.gradedBy = req.auth.teacherId;
    } else {
      // Bản nháp — học sinh chưa thấy. Không đụng gradedAt/gradedBy.
      submission.gradingStatus = "draft";
    }
    await submission.save();

    // Xuất bản điểm lần đầu -> báo chuông cho học sinh (kèm đường dẫn tới bài đã
    // chấm + nhận xét). Không để lỗi thông báo làm hỏng response chấm bài.
    if (publish && !wasGraded) {
      try {
        await notifyStudentGraded({ submission, teacherName: req.auth && req.auth.name });
      } catch (err) {
        console.error("[notifications] notifyStudentGraded failed:", err.message);
      }
    }

    return res.status(200).json({ ok: true, submission });
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireAuth(withTenant(handler));

module.exports.default = module.exports;

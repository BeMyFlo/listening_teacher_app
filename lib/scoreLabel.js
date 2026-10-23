// Nhãn + phần trăm điểm của 1 bài Writing/Speaking đã chấm — dùng chung server + client.
// IELTS: "Band 6.5" (band 0–9). TOEIC S&W (variant `toeic.*`): "Score 2/3" (điểm thô / max của dạng đề).
// Max TOEIC suy ra từ sub.rubricVariant. Phần IELTS giữ ĐÚNG chữ/số cũ.
const { isToeicVariant, scoreRange } = require("./grading/rubric");

function isToeicSub(sub) {
  return !!sub && isToeicVariant(sub.rubricVariant);
}

// Điểm tối đa của bài (TOEIC theo dạng đề, IELTS 9).
function scoreMax(sub) {
  return isToeicSub(sub) ? scoreRange(sub.rubricVariant).max : 9;
}

// opts.missing: chữ thay cho điểm khi manualScore null (vd "?"). Mặc định in thẳng giá trị như code cũ.
function formatScore(sub, opts) {
  const s = sub ? sub.manualScore : undefined;
  const shown = s == null && opts && opts.missing != null ? opts.missing : s;
  if (isToeicSub(sub)) return `Score ${shown}/${scoreMax(sub)}`;
  return `Band ${shown}`;
}

// Phần trăm 0–100 (chưa làm tròn); null nếu chưa có điểm.
function scorePct(sub) {
  if (!sub || sub.manualScore == null || !Number.isFinite(Number(sub.manualScore))) return null;
  return (Number(sub.manualScore) / scoreMax(sub)) * 100;
}

// Tổng điểm thô / tổng max của các bài TOEIC đã chấm (bản mới nhất mỗi đề). Không có bài TOEIC -> null,
// để caller giữ nguyên đường IELTS.
function toeicTotals(gradedSubs) {
  const toeic = (gradedSubs || []).filter(isToeicSub);
  if (!toeic.length) return null;
  return {
    scoreSum: toeic.reduce((a, s) => a + (Number(s.manualScore) || 0), 0),
    maxSum: toeic.reduce((a, s) => a + scoreMax(s), 0),
  };
}

// Mock Test TOEIC Writing/Speaking: gộp bản nộp mới nhất của từng đề trong 1 kỹ năng.
// null nếu kỹ năng đó không phải TOEIC (hoặc chưa nộp gì) -> caller giữ nguyên đường IELTS.
// count = số đề của kỹ năng trong Mock Test (meta.count).
function toeicSkillSummary(subs, testId, skill, count) {
  const latest = new Map();
  (subs || [])
    .filter((s) => String(s.testId) === String(testId) && s.testSkill === skill && (s.kind === "writing" || s.kind === "speaking"))
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
    .forEach((s) => {
      const k = String(s.promptId);
      if (!latest.has(k)) latest.set(k, s);
    });
  const list = [...latest.values()];
  if (!list.some(isToeicSub)) return null;
  const gradedSubs = list.filter((s) => s.gradingStatus === "graded" && s.manualScore != null);
  const total = Math.max(Number(count) || 0, list.length);
  const t = toeicTotals(gradedSubs) || { scoreSum: 0, maxSum: 0 };
  const complete = total > 0 && gradedSubs.length >= total;
  return {
    graded: gradedSubs.length,
    total,
    complete,
    scoreSum: t.scoreSum,
    maxSum: t.maxSum,
    // "27/35 points" khi mọi đề đã chấm, chưa đủ thì "x/y graded".
    text: complete ? `${t.scoreSum}/${t.maxSum} points` : `${gradedSubs.length}/${total} graded`,
  };
}

module.exports = { isToeicSub, scoreMax, formatScore, scorePct, toeicTotals, toeicSkillSummary };

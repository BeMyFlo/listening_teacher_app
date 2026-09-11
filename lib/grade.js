// Server-side mirror of the grading rules that used to live in assets/student.js,
// so scoring stays consistent now that answer keys no longer ship to the browser.
function normalize(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,]$/g, "");
}

// IELTS multi-select ("choose TWO answers") — dùng cho phần "full credit"
// (còn cả câu đúng hoàn toàn hay không, để hiện dấu tick/dấu X trong review).
function normalizeSet(values) {
  return (Array.isArray(values) ? values : [])
    .map(normalize)
    .filter(Boolean)
    .sort()
    .join("|");
}

function isCorrect(field, value) {
  if (Number(field.selectCount) > 1) {
    const submitted = normalizeSet(value);
    return submitted.length > 0 && submitted === normalizeSet(field.answers);
  }
  const v = normalize(value);
  if (!v) return false;
  return (field.answers || []).some((a) => normalize(a) === v);
}

// Điểm thực nhận cho 1 câu. Câu 1-đáp-án: cả-hoặc-không (đúng = trọn điểm).
// Câu nhiều đáp án (selectCount > 1): chấm ĐỘC LẬP từng đáp án — tổng điểm
// của câu chia đều cho số đáp án đúng cần chọn, chọn đúng đáp án nào được
// phần điểm đáp án đó, thiếu/chọn sai không trừ điểm (giống cách 1 câu "chọn
// 2 trong N" được ghi 2 số câu riêng trên đề thi thật, mỗi số 1 điểm độc lập).
function pointsEarned(field, value) {
  const weight = Math.max(1, Number(field.score) || 1);
  const selectCount = Number(field.selectCount) || 1;
  if (selectCount <= 1) return isCorrect(field, value) ? weight : 0;

  const correctSet = new Set((field.answers || []).map(normalize).filter(Boolean));
  if (!correctSet.size) return 0;
  const submitted = new Set((Array.isArray(value) ? value : []).map(normalize).filter(Boolean));
  let hits = 0;
  submitted.forEach((v) => {
    if (correctSet.has(v)) hits++;
  });
  // Kẹp ở correctSet.size phòng trường hợp field.score không khớp số đáp án
  // đúng thực tế (vd giáo viên chỉnh tay) — không cho vượt quá tổng điểm câu.
  return (weight * Math.min(hits, correctSet.size)) / correctSet.size;
}

// Choice questions store an internal option value (e.g. "o11_1", "optmtoc2da214")
// both in the student's answer and in the answer key. Map it back to the
// human-readable option label so the teacher review shows real words, not ids.
// Options can live on the field itself or, for matching questions, on the
// section's shared matchOptions list. Fill-in answers pass through unchanged.
function fieldOptions(field, section) {
  if (field && field.options && field.options.length) return field.options;
  return (section && section.matchOptions) || [];
}

function readableValue(field, section, value) {
  const options = fieldOptions(field, section);
  const lookup = (v) => {
    const opt = options.find((o) => o.value === v);
    return opt ? opt.label : v;
  };
  if (Array.isArray(value)) return value.map(lookup).filter((s) => s !== "" && s != null).join(", ");
  if (value == null || value === "") return "";
  return lookup(value);
}

function detailEntry(field, section, value) {
  const weight = Math.max(1, Number(field.score) || 1);
  const isMulti = Number(field.selectCount) > 1;
  const earned = pointsEarned(field, value);
  return {
    id: field.id,
    label: field.label,
    submitted: readableValue(field, section, value),
    // `correct` = trọn điểm (giữ nguyên ý nghĩa cũ, dùng để tô xanh/đỏ).
    // `partial` = được điểm nhưng chưa trọn (câu nhiều đáp án chọn đúng 1
    // phần) — review có thể tô riêng màu vàng thay vì đỏ hẳn.
    correct: earned >= weight,
    partial: earned > 0 && earned < weight,
    earned,
    score: weight,
    explanation: field.explanation || "",
    answer: readableValue(
      field,
      section,
      isMulti ? field.answers || [] : field.answers && field.answers[0]
    ),
  };
}

function gradeSubmission(test, submittedAnswers) {
  let score = 0;
  let total = 0;
  const detail = [];

  test.sections.forEach((section) => {
    section.fields.forEach((field) => {
      const isMulti = Number(field.selectCount) > 1;
      const value = (submittedAnswers && submittedAnswers[field.id]) || (isMulti ? [] : "");
      const entry = detailEntry(field, section, value);
      total += entry.score;
      score += entry.earned;
      detail.push(entry);
    });
  });

  return { score, total, detail };
}

// Rebuild a readable per-question detail for an existing submission straight
// from the test/exercise definition — used by the teacher review so old rows
// (saved before labels were resolved, or with a stale key) still display
// correctly. `skillBlock` is a { sections: [...] } shape (Test.skills.listening,
// an exercise, ...). Returns null when there's nothing to rebuild from.
function rebuildDetail(skillBlock, submittedAnswers) {
  if (!skillBlock || !Array.isArray(skillBlock.sections)) return null;
  const detail = [];
  skillBlock.sections.forEach((section) => {
    (section.fields || []).forEach((field) => {
      const isMulti = Number(field.selectCount) > 1;
      const value = (submittedAnswers && submittedAnswers[field.id]) || (isMulti ? [] : "");
      detail.push(detailEntry(field, section, value));
    });
  });
  return detail;
}

module.exports = { normalize, isCorrect, gradeSubmission, rebuildDetail };

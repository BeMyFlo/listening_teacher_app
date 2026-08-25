// Server-side mirror of the grading rules that used to live in assets/student.js,
// so scoring stays consistent now that answer keys no longer ship to the browser.
function normalize(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,]$/g, "");
}

// IELTS multi-select ("choose TWO answers") requires the exact set of
// correct options — no partial credit for getting some of them.
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

function gradeSubmission(test, submittedAnswers) {
  let score = 0;
  let total = 0;
  const detail = [];

  test.sections.forEach((section) => {
    section.fields.forEach((field) => {
      const weight = Math.max(1, Number(field.score) || 1);
      total += weight;
      const isMulti = Number(field.selectCount) > 1;
      const value = (submittedAnswers && submittedAnswers[field.id]) || (isMulti ? [] : "");
      const ok = isCorrect(field, value);
      if (ok) score += weight;
      detail.push({
        id: field.id,
        label: field.label,
        submitted: value,
        correct: ok,
        score: weight,
        answer: isMulti ? (field.answers || []).join(", ") : field.answers && field.answers[0]
      });
    });
  });

  return { score, total, detail };
}

module.exports = { normalize, isCorrect, gradeSubmission };

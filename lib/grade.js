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
  const ok = isCorrect(field, value);
  return {
    id: field.id,
    label: field.label,
    submitted: readableValue(field, section, value),
    correct: ok,
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
      if (entry.correct) score += entry.score;
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

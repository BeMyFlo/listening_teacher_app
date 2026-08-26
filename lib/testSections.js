function normalizeSections(sections) {
  if (!Array.isArray(sections)) return [];
  return sections.map((s) => ({
    name: String(s.name || ""),
    audioId: s.audioId || undefined,
    passageText: String(s.passageText || ""),
    imageId: s.imageId || undefined,
    matchOptions: Array.isArray(s.matchOptions)
      ? s.matchOptions.map((o) => ({ value: String(o.value || ""), label: String(o.label || "") })).filter((o) => o.value)
      : [],
    // Pin vị trí (%) cho câu hỏi Diagram/Map Labelling — bỏ qua entry có
    // fieldId không hợp lệ, kẹp x/y về [0,100] vì tọa độ tính theo % ảnh.
    labelPoints: Array.isArray(s.labelPoints)
      ? s.labelPoints
          .filter((lp) => Number.isFinite(Number(lp.fieldId)))
          .map((lp) => ({
            fieldId: Number(lp.fieldId),
            x: Math.min(100, Math.max(0, Number(lp.x) || 0)),
            y: Math.min(100, Math.max(0, Number(lp.y) || 0))
          }))
      : [],
    fields: Array.isArray(s.fields)
      ? s.fields.map((f) => ({
          id: Number(f.id),
          label: String(f.label || ""),
          type: f.type === "choice" ? "choice" : "fill",
          pre: String(f.pre || ""),
          post: String(f.post || ""),
          hint: String(f.hint || ""),
          options: Array.isArray(f.options) ? f.options : [],
          selectCount: Math.max(1, Number(f.selectCount) || 1),
          score: Math.max(1, Number(f.score) || 1),
          answers: Array.isArray(f.answers) ? f.answers.map(String) : []
        }))
      : []
  }));
}

// Field ids double as DOM row ids and grading-detail keys on the student
// side, so they must be unique across the whole test, not just per section.
function hasDuplicateFieldIds(sections) {
  const ids = sections.flatMap((s) => s.fields.map((f) => f.id));
  return new Set(ids).size !== ids.length;
}

// Listening sections need audio; Reading sections need a passage and/or an
// image (diagram/map labelling) to be meaningful. Lesson exercises for
// other skills (grammar/vocabulary) have no media requirement.
function sectionMediaError(subject, section) {
  if (subject !== "listening" && subject !== "reading") {
    if (!section.fields.length) {
      return "Each exercise section must have at least one question.";
    }
    return null;
  }
  if (subject === "listening" && !section.audioId) {
    return "Each listening section must have an audio track selected.";
  }
  if (subject === "reading" && !section.passageText.trim() && !section.imageId) {
    return "Each reading section must contain a passage text or a diagram/map image.";
  }
  return null;
}

// Full validation pass for a test's normalized sections: media requirements,
// referenced Audio/Image docs actually exist, "choice" fields have somewhere
// to source their options from, and field ids are unique test-wide.
async function validateSections(subject, normalized) {
  const Audio = require("./models/Audio");
  const Image = require("./models/Image");

  for (const s of normalized) {
    const mediaError = sectionMediaError(subject, s);
    if (mediaError) return mediaError;
    if (s.audioId && !(await Audio.exists({ _id: s.audioId }))) {
      return "Selected audio track does not exist.";
    }
    if (s.imageId && !(await Image.exists({ _id: s.imageId }))) {
      return "Selected image does not exist.";
    }
    for (const f of s.fields) {
      if (f.type === "choice" && f.options.length === 0 && s.matchOptions.length === 0) {
        return `Question ${f.id}: requires either individual options or shared match options.`;
      }
    }
  }
  if (hasDuplicateFieldIds(normalized)) {
    return "Duplicate question numbers found across sections. Please review question numbers.";
  }
  return null;
}

// Writing/Speaking dùng "prompts" (đề bài, chấm tay) thay vì sections câu
// hỏi — chung shape với Unit.js's PromptSchema (title/instructions/imageId).
function normalizePrompts(prompts) {
  if (!Array.isArray(prompts)) return [];
  return prompts.map((p) => ({
    title: String(p.title || ""),
    instructions: String(p.instructions || ""),
    imageId: p.imageId || undefined
  }));
}

// Mỗi prompt cần tối thiểu tiêu đề + đề bài — ảnh minh hoạ là optional.
async function validatePrompts(normalized) {
  const Image = require("./models/Image");
  for (const p of normalized) {
    if (!p.title.trim() || !p.instructions.trim()) {
      return "Each prompt needs a title and instructions.";
    }
    if (p.imageId && !(await Image.exists({ _id: p.imageId }))) {
      return "Selected image does not exist.";
    }
  }
  return null;
}

module.exports = {
  normalizeSections,
  hasDuplicateFieldIds,
  sectionMediaError,
  validateSections,
  normalizePrompts,
  validatePrompts
};

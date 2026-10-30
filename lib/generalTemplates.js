// Khuôn đề General English (Phase 12 G2, mục 2.2): dữ liệu khuôn + hàm thuần dùng
// chung server / client. CommonJS thuần, KHÔNG React, KHÔNG DB.
const { PROGRAMS, isProgram } = require("./curriculum");
const { GENERAL_LABELS } = require("./generalFormats");

// Chữ giữ chỗ cho đoạn văn của phần cần đoạn văn: để luật "Reading section cần passage"
// hiện có vẫn qua (lưu nháp được) nhưng không xuất bản được khi chưa thay.
const PASSAGE_PLACEHOLDER = "Paste the passage here.";

const MAX_PER_PART = 60;
const MAX_TOTAL = 100;

// Mỗi phần: name (học sinh thấy), instruction (chỉ hiện cho giáo viên khi chọn khuôn, không lưu),
// questions [{ format, count }], passage (có đoạn văn hay không — chỉ áp cho reading).
const TEMPLATES = {
  thpt: {
    key: "thpt",
    label: "THPT graduation exam",
    note: "40 questions · 50 minutes · format used since 2025 (Bộ GD&ĐT)",
    source: "Bộ GD&ĐT — đề tham khảo 2025, giữ khuôn năm 2026",
    defaultGrade: 12,
    skills: {
      reading: {
        durationMinutes: 50,
        parts: [
          { name: "Part 1 — Notice", questions: [{ format: "g-cloze", count: 6 }], passage: true,
            instruction: "Read the following advertisement/announcement and choose the option that best fits each of the numbered blanks." },
          { name: "Part 2 — Leaflet", questions: [{ format: "g-cloze", count: 6 }], passage: true,
            instruction: "Read the following leaflet and choose the option that best fits each of the numbered blanks." },
          { name: "Part 3 — Arrangement", questions: [{ format: "g-arrange", count: 5 }], passage: false,
            instruction: "Arrange the sentences into a meaningful text (dialogue/letter/paragraph)." },
          { name: "Part 4 — Sentence/phrase completion", questions: [{ format: "g-cloze", count: 5 }], passage: true,
            instruction: "Read the following passage and choose the option that best completes each numbered blank." },
          { name: "Part 5 — Reading 1", questions: [{ format: "g-mcq", count: 8 }], passage: true,
            instruction: "Read the passage and choose the best answer to each question." },
          { name: "Part 6 — Reading 2", questions: [{ format: "g-mcq", count: 10 }], passage: true,
            instruction: "Read the passage and choose the best answer to each question." },
        ],
      },
    },
  },
  hcm10: {
    key: "hcm10",
    label: "Grade 10 entrance exam — Ho Chi Minh City",
    note: "40 questions · 90 minutes · sample paper 2026 (Sở GD&ĐT TP.HCM)",
    source: "Sở GD&ĐT TP.HCM — đề minh hoạ tuyển sinh lớp 10, năm 2026",
    defaultGrade: 9,
    skills: {
      reading: {
        durationMinutes: 90,
        parts: [
          { name: "Part 1 — Phonetics", questions: [{ format: "g-pron", count: 2 }, { format: "g-stress", count: 2 }], passage: false,
            instruction: "Choose the word whose underlined part is pronounced differently / whose stress pattern differs." },
          { name: "Part 2 — Vocabulary, grammar & communication", questions: [{ format: "g-mcq", count: 12 }], passage: false,
            instruction: "Choose the best option to complete each sentence or exchange." },
          { name: "Part 3 — Cloze", questions: [{ format: "g-cloze", count: 6 }], passage: true,
            instruction: "Read the passage and choose the option that best fits each numbered blank." },
          { name: "Part 4 — Reading", questions: [{ format: "g-mcq", count: 6 }], passage: true,
            instruction: "Read the passage and choose the best answer to each question." },
          { name: "Part 5 — Word form", questions: [{ format: "g-wform", count: 6 }], passage: false,
            instruction: "Write the correct form of the word in brackets." },
          { name: "Part 6 — Guided phrases", questions: [{ format: "g-phrase", count: 2 }], passage: true,
            instruction: "Write phrases/sentences from the information given." },
          { name: "Part 7 — Sentence writing", questions: [{ format: "g-rewrite", count: 4 }], passage: false,
            instruction: "Rewrite each sentence so that it keeps the same meaning." },
        ],
      },
    },
  },
  school: {
    key: "school",
    label: "School test",
    note: "Mid-term / final test · 28 reading questions + optional listening",
    source: "Cấu trúc kiểm tra giữa kỳ / cuối kỳ phổ biến ở trường (2025–2026), số câu chỉnh được",
    defaultGrade: 9,
    skills: {
      listening: {
        durationMinutes: 15,
        optional: true,
        parts: [
          { name: "Part 1 — Listening A", questions: [{ format: "g-mcq", count: 5 }], passage: false,
            instruction: "Listen and choose the best answer." },
          { name: "Part 2 — Listening B", questions: [{ format: "g-tf", count: 5 }], passage: false,
            instruction: "Listen and decide whether each statement is true or false." },
        ],
      },
      reading: {
        durationMinutes: 45,
        parts: [
          { name: "Part 1 — Phonetics", questions: [{ format: "g-pron", count: 2 }, { format: "g-stress", count: 2 }], passage: false,
            instruction: "Choose the word whose underlined part is pronounced differently / whose stress pattern differs." },
          { name: "Part 2 — Vocabulary & Grammar", questions: [{ format: "g-mcq", count: 8 }], passage: false,
            instruction: "Choose the best option to complete each sentence." },
          { name: "Part 3 — Cloze", questions: [{ format: "g-cloze", count: 5 }], passage: true,
            instruction: "Read the passage and choose the option that best fits each numbered blank." },
          { name: "Part 4 — Reading comprehension", questions: [{ format: "g-tf", count: 5 }], passage: true,
            instruction: "Read the passage and decide whether each statement is true or false." },
          { name: "Part 5 — Writing", questions: [{ format: "g-reorder", count: 3 }, { format: "g-rewrite", count: 3 }], passage: false,
            instruction: "Put the words in order, then rewrite the sentences." },
        ],
      },
    },
  },
};

// Khuôn chọn được của một chương trình (đọc registry `testTemplates`).
function templatesFor(program) {
  if (!isProgram(program)) return [];
  return PROGRAMS[program].testTemplates
    .map((k) => TEMPLATES[k])
    .filter(Boolean);
}

function isCount(n) {
  return Number.isInteger(n) && n >= 0 && n <= MAX_PER_PART;
}

// Áp số câu giáo viên sửa lên khuôn. `counts` = { [skill]: [phần0, phần1, ...] }; mỗi phần là số
// (chỉ khi phần có đúng 1 dạng) hoặc mảng số theo từng dạng của phần. Thiếu = giữ mặc định.
// `includeListening`: khuôn có listening tuỳ chọn thì chỉ giữ khi true.
// Phần 0 câu bị bỏ. Trả { template, error } — template có thêm totalQuestions.
function resolveTemplate(key, opts) {
  const base = Object.prototype.hasOwnProperty.call(TEMPLATES, key) ? TEMPLATES[key] : null;
  if (!base) return { template: null, error: "Unknown template" };
  const { counts, includeListening } = opts || {};
  const skills = {};
  let total = 0;

  for (const skillKey of Object.keys(base.skills)) {
    const src = base.skills[skillKey];
    if (src.optional && !includeListening) continue;
    const given = counts && Array.isArray(counts[skillKey]) ? counts[skillKey] : [];
    const parts = [];
    for (let i = 0; i < src.parts.length; i++) {
      const part = src.parts[i];
      const want = given[i];
      let groupCounts;
      if (want === undefined || want === null) {
        groupCounts = part.questions.map((q) => q.count);
      } else if (Array.isArray(want)) {
        if (want.length !== part.questions.length) return { template: null, error: `${part.name}: wrong number of question counts` };
        groupCounts = want;
      } else if (part.questions.length === 1) {
        groupCounts = [want];
      } else {
        return { template: null, error: `${part.name}: set a count for each question type` };
      }
      if (!groupCounts.every(isCount)) {
        return { template: null, error: `${part.name}: question count must be a whole number from 0 to ${MAX_PER_PART}` };
      }
      const questions = part.questions
        .map((q, qi) => ({ format: q.format, count: groupCounts[qi] }))
        .filter((q) => q.count > 0);
      if (!questions.length) continue; // phần 0 câu -> bỏ
      total += questions.reduce((n, q) => n + q.count, 0);
      parts.push({ name: part.name, instruction: part.instruction, passage: !!part.passage, questions });
    }
    if (parts.length) skills[skillKey] = { durationMinutes: src.durationMinutes, parts };
  }

  if (total < 1) return { template: null, error: "The template needs at least 1 question" };
  if (total > MAX_TOTAL) return { template: null, error: `A template can have at most ${MAX_TOTAL} questions` };
  const { skills: _skills, ...meta } = base;
  return { template: { ...meta, skills, totalQuestions: total }, error: null };
}

// ---- Kiểm câu dở (dùng chung client + server) ----

const SKILL_ORDER = ["listening", "reading"];

// Mongoose array / mảng thường / undefined -> mảng thường.
function toArr(x) {
  return x ? Array.from(x) : [];
}
function blank(v) {
  return v == null || !String(v).trim();
}

// Lý do câu `f` (shape server) còn dở, hoặc null. Mỗi câu chỉ trả lý do đầu tiên.
function fieldReason(f) {
  const fmt = f.formatLabel;
  const answers = toArr(f.answers).filter((a) => !blank(a));
  const tokens = toArr(f.tokens).filter((t) => !blank(t));
  // Dạng không cần label: phát âm/trọng âm (đề ở lựa chọn), cloze/open cloze (đề ở đoạn văn),
  // sắp xếp từ (đề là các mảnh), biển báo có ảnh. Câu điền có chỗ trống đầu câu: đề nằm ở `post`/`pre`.
  const labelOptional =
    fmt === GENERAL_LABELS.pron ||
    fmt === GENERAL_LABELS.stress ||
    fmt === GENERAL_LABELS.cloze ||
    fmt === GENERAL_LABELS.ocloze ||
    fmt === GENERAL_LABELS.reorder ||
    tokens.length > 0 ||
    (fmt === GENERAL_LABELS.sign && !!f.imageId);
  const hasText = !blank(f.label) || (f.type !== "choice" && (!blank(f.post) || !blank(f.pre)));
  if (!labelOptional && !hasText) return "the question text is empty";

  if (f.type === "choice") {
    const options = toArr(f.options);
    if (options.some((o) => blank(o && o.label))) return "an option is empty";
    if (!answers.length) return "no correct answer";
    return null;
  }
  // Server không lưu kind: sắp xếp từ nhận ra qua tokens hoặc nhãn dạng bài.
  if (tokens.length || fmt === GENERAL_LABELS.reorder) {
    if (tokens.length < 2) return "needs at least 2 pieces";
  }
  if (!answers.length) return "no correct answer";
  return null;
}

// Câu còn dở trong `skills` (shape server: test.skills, plain object hoặc Mongoose doc) ->
// [{ skill, fieldId, reason }] theo thứ tự câu (listening trước reading, đúng thứ tự section).
function incompleteQuestions(skills) {
  const out = [];
  if (!skills) return out;
  for (const skillKey of SKILL_ORDER) {
    const block = skills[skillKey];
    for (const sec of toArr(block && block.sections)) {
      const fields = toArr(sec.fields);
      if (!fields.length) continue;
      if (skillKey === "reading") {
        const passage = String(sec.passageText || "").trim();
        const hasCloze = fields.some((f) => f.formatLabel === GENERAL_LABELS.cloze);
        if (passage === PASSAGE_PLACEHOLDER || (!passage && hasCloze && !sec.imageId)) {
          out.push({ skill: skillKey, fieldId: fields[0].id, reason: "the passage is still empty" });
        }
      }
      for (const f of fields) {
        const reason = fieldReason(f);
        if (reason) out.push({ skill: skillKey, fieldId: f.id, reason });
      }
    }
  }
  return out;
}

module.exports = {
  PASSAGE_PLACEHOLDER,
  MAX_PER_PART,
  MAX_TOTAL,
  TEMPLATES,
  templatesFor,
  resolveTemplate,
  incompleteQuestions,
};

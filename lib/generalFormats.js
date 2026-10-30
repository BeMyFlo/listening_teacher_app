// Dạng bài General (Phase 12 G1, mục 1 + 3.4): hằng số nhãn + helper thuần dùng
// chung server / builder / học sinh. CommonJS thuần.
const { underlinedParts } = require("./underline");

// Khoá = key trong bảng plan bỏ tiền tố "g-".
const GENERAL_LABELS = {
  mcq: "Multiple choice",
  pron: "Pronunciation — odd one out",
  stress: "Word stress",
  comm: "Communication — best response",
  error: "Error identification",
  syn: "Synonym / Antonym",
  sign: "Signs & notices",
  verb: "Verb form",
  wform: "Word form",
  cloze: "Cloze — multiple choice",
  ocloze: "Open cloze",
  tf: "True / False",
  tfng: "True / False / Not Given",
  rq: "Answer the questions",
  insert: "Sentence insertion [I]–[IV]",
  arrange: "Arrange sentences into a text",
  reorder: "Sentence building (reorder words)",
  rewrite: "Sentence transformation",
  combine: "Sentence combination",
  closest: "Closest meaning",
  phrase: "Guided phrase writing",
  gap: "Gap fill",
};

// Chế độ gạch chân theo nhãn: "label" (đề), "options" (lựa chọn) hoặc null.
function underlineModeOf(formatLabel) {
  if (formatLabel === GENERAL_LABELS.error || formatLabel === GENERAL_LABELS.syn) return "label";
  if (formatLabel === GENERAL_LABELS.pron) return "options";
  return null;
}

function isErrorIdFormat(formatLabel) {
  return formatLabel === GENERAL_LABELS.error;
}

// Chữ cái lựa chọn A–D từ các phần gạch chân của câu Error identification (2–4 phần).
function optionLettersFromUnderlines(label) {
  const norm = String(label || "").replace(/<u>(.*?)<\/u>/gi, "__$1__");
  const parts = underlinedParts(norm);
  if (parts.length < 2 || parts.length > 4) {
    throw new Error(`Found ${parts.length} underlined parts. Error identification requires 2 to 4 underlined parts.`);
  }
  return ["A", "B", "C", "D"].slice(0, parts.length);
}

// 14 dạng đề mà AI hỗ trợ sinh (mục 3.2 PLAN-PHASE12-G3)
const AI_FORMATS = [
  "g-mcq",
  "g-comm",
  "g-verb",
  "g-wform",
  "g-error",
  "g-syn",
  "g-pron",
  "g-stress",
  "g-reorder",
  "g-rewrite",
  "g-combine",
  "g-closest",
  "g-cloze",
  "g-tf",
];

// Danh sách format AI hỗ trợ theo từng kỹ năng (bảng 3.2 PLAN-PHASE12-G3)
const AI_FORMATS_BY_SUBJECT = {
  grammar: [
    "g-mcq", "g-comm", "g-verb", "g-wform", "g-error", "g-reorder", "g-rewrite", "g-combine", "g-closest",
  ],
  vocabulary: [
    "g-mcq", "g-pron", "g-stress", "g-comm", "g-syn", "g-wform", "g-reorder",
  ],
  reading: [
    "g-mcq", "g-wform", "g-syn", "g-closest", "g-cloze", "g-tf",
  ],
  listening: [],
};

// Danh sách format key General theo kỹ năng (mục 3.1 PLAN-PHASE12-G3)
const GENERAL_SUBJECT_FORMAT_KEYS = {
  grammar: [
    "g-mcq", "g-comm", "g-error", "g-verb", "g-wform", "g-cloze", "g-ocloze",
    "g-arrange", "g-reorder", "g-rewrite", "g-combine", "g-closest", "g-gap",
  ],
  vocabulary: [
    "g-mcq", "g-pron", "g-stress", "g-comm", "g-syn", "g-sign", "g-wform",
    "g-cloze", "g-reorder", "g-phrase", "g-gap",
  ],
  listening: [
    "g-mcq", "g-comm", "g-tf", "g-tfng", "g-rq", "g-gap",
  ],
  reading: [
    "g-mcq", "g-pron", "g-stress", "g-comm", "g-error", "g-syn", "g-sign",
    "g-verb", "g-wform", "g-cloze", "g-ocloze", "g-tf", "g-tfng", "g-rq",
    "g-insert", "g-arrange", "g-reorder", "g-rewrite", "g-combine", "g-closest",
    "g-phrase", "g-gap",
  ],
};

function aiFormatsFor(subject) {
  return AI_FORMATS_BY_SUBJECT[subject] || [];
}

// Tách câu thành mảnh: có "/" thì tách theo "/", không thì theo khoảng trắng.
// Dấu câu cuối (.?!) dính vào mảnh cuối; bỏ mảnh rỗng.
function splitTokens(sentence) {
  const s = String(sentence == null ? "" : sentence).trim();
  if (!s) return [];
  const parts = s.includes("/") ? s.split("/") : s.split(/\s+/);
  return parts.map((p) => p.trim()).filter(Boolean);
}

// Fisher–Yates trả mảng mới.
function fisherYates(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sameOrder(a, b) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

// Xáo đến khi khác thứ tự gốc (tối đa 10 lần; không thể khác thì chịu).
function shuffleTokens(tokens, rng = Math.random) {
  const src = Array.isArray(tokens) ? tokens : [];
  let out = fisherYates(src, rng);
  for (let i = 0; i < 10 && sameOrder(out, src) && src.length > 1; i++) {
    out = fisherYates(src, rng);
  }
  return out;
}

// "b-d-a-c-e" | "b, d, a" | "bdace" → ["b","d","a","c","e"]
function orderLetters(order) {
  return (String(order == null ? "" : order).toLowerCase().match(/[a-z]/g)) || [];
}

function factorial(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

// Mọi hoán vị (chỉ gọi khi n nhỏ).
function allPermutations(letters) {
  if (letters.length <= 1) return [letters.join("-")];
  const out = new Set();
  const rec = (rest, acc) => {
    if (!rest.length) return void out.add(acc.join("-"));
    rest.forEach((l, i) => rec([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, l]));
  };
  rec(letters, []);
  return [...out];
}

// n hoán vị nhiễu khác nhau, khác đáp án, cùng kiểu "b-d-a-c-e".
function arrangeDistractors(order, n = 3, rng = Math.random) {
  const letters = orderLetters(order);
  const correct = letters.join("-");
  if (letters.length < 2) return [];
  if (factorial(letters.length) <= 720) {
    const pool = allPermutations(letters).filter((p) => p !== correct);
    return fisherYates(pool, rng).slice(0, n);
  }
  const seen = new Set([correct]);
  const out = [];
  for (let tries = 0; out.length < n && tries < 500; tries++) {
    const p = fisherYates(letters, rng).join("-");
    if (!seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }
  return out;
}

// 4 lựa chọn (đáp án đúng ở vị trí ngẫu nhiên) + chỉ số đáp án đúng.
function arrangeOptions(order, rng = Math.random) {
  const correct = orderLetters(order).join("-");
  const options = fisherYates([correct, ...arrangeDistractors(order, 3, rng)], rng);
  return { options, correctIndex: options.indexOf(correct) };
}

// Câu học sinh đã ghép (chuỗi) -> chỉ số các mảnh theo thứ tự, để khôi phục chip khi tải lại / xem lại.
// Mảnh có thể nhiều từ ("gets up") nên khớp theo chuỗi từ đầu câu, ưu tiên mảnh dài nhất; mỗi mảnh dùng
// một lần (hai mảnh cùng chữ là hai chỉ số). Phần không khớp mảnh nào thì bỏ qua một từ rồi khớp tiếp.
function chosenTokenIndexes(tokens, value) {
  if (!Array.isArray(tokens) || typeof value !== "string") return [];
  let rest = value.trim();
  const used = new Set();
  const chosen = [];
  while (rest) {
    let best = -1;
    tokens.forEach((t, i) => {
      if (used.has(i) || !t) return;
      const fits = rest === t || rest.startsWith(t + " ");
      if (fits && (best < 0 || t.length > tokens[best].length)) best = i;
    });
    if (best < 0) {
      const sp = rest.indexOf(" ");
      rest = sp < 0 ? "" : rest.slice(sp + 1).trim();
      continue;
    }
    used.add(best);
    chosen.push(best);
    rest = rest.slice(tokens[best].length).trim();
  }
  return chosen;
}

// Kiểm lỗi câu hỏi General ở client (Phase 12 G1 bước 3 / mục 3.1, 3.2):
// - reorder: thiếu mảnh (< 2) hoặc thiếu đáp án đúng
// - Error identification: sai số lựa chọn so với số phần gạch chân (2–4)
function generalQuestionError(field) {
  if (!field) return null;
  const isReorder = field.kind === "reorder" || (Array.isArray(field.tokens) && field.tokens.length > 0);
  if (isReorder) {
    const answers = String(field.answersText || (Array.isArray(field.answers) ? field.answers.join("\n") : ""))
      .split(/\n/)
      .map((a) => a.trim())
      .filter(Boolean);
    if (!answers.length) {
      return `Question ${field.id}: Sentence building (reorder) questions must have at least 1 correct answer.`;
    }
    const tokens = (Array.isArray(field.tokens) ? field.tokens : []).map((t) => String(t).trim()).filter(Boolean);
    if (tokens.length < 2) {
      return `Question ${field.id}: Sentence building (reorder) questions must have at least 2 pieces.`;
    }
  }
  if (isErrorIdFormat(field.formatLabel)) {
    const parts = underlinedParts(field.label || "");
    if (parts.length < 2 || parts.length > 4) {
      return `Question ${field.id}: Error identification requires 2 to 4 underlined parts in the question prompt.`;
    }
    const optCount = Array.isArray(field.options) ? field.options.length : 0;
    if (optCount !== parts.length) {
      return `Question ${field.id}: Error identification has ${optCount} option${optCount === 1 ? "" : "s"} but requires exactly ${parts.length} matching the underlined parts.`;
    }
  }
  return null;
}

function findGeneralSectionError(sections) {
  if (!Array.isArray(sections)) return null;
  for (const s of sections) {
    for (const f of s.fields || []) {
      const err = generalQuestionError(f);
      if (err) return { fieldId: f.id, message: err };
    }
  }
  return null;
}

module.exports = {
  GENERAL_LABELS,
  underlineModeOf,
  isErrorIdFormat,
  optionLettersFromUnderlines,
  AI_FORMATS,
  GENERAL_SUBJECT_FORMAT_KEYS,
  aiFormatsFor,
  splitTokens,
  shuffleTokens,
  arrangeDistractors,
  arrangeOptions,
  chosenTokenIndexes,
  generalQuestionError,
  findGeneralSectionError,
};

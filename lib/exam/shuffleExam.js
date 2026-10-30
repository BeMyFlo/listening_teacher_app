// Mã đề: trộn đề theo seed (Phase 12 G4 bước 4, D6/D7). Hàm thuần, PRNG theo seed (không dùng hàm ngẫu nhiên của hệ thống), KHÔNG sửa đầu vào.
// shuffleExam(skills, { seed, code }):
//   skills = { listening: { sections }, reading: { sections } } (section/field shape server; có thể thêm imageUrl ở section/field)
//   code "0" / rỗng = giữ nguyên thứ tự, số câu và lựa chọn gốc.
// Trả { parts: [{ skill, name, passageText, imageUrl, matchOptions, questions: [...] }], answers: [{ skill, part, number, answer }] }.
// Số câu đánh lại 1..N THEO TỪNG KỸ NĂNG (như đề online), chỗ trống đánh số trong đoạn văn được viết lại theo.
const { GENERAL_LABELS } = require("../generalFormats");
const { rewriteBlanks } = require("./blanks");

const LETTERS = "ABCDEFGHIJ";
const NO_SHUFFLE_FORMATS = new Set([
  GENERAL_LABELS.error,
  GENERAL_LABELS.tf,
  GENERAL_LABELS.tfng,
  GENERAL_LABELS.insert,
  GENERAL_LABELS.arrange,
]);
const BAD_OPTION_RE = /all of the above|none of the above|both .* and|neither .* nor/i;
const ROMAN_OPTION_RE = /^\s*\[?\s*(?:I|II|III|IV)\s*\]?\s*$/;
const TFNG_VALUES = new Set(["true", "false", "ng", "yes", "no"]);

// ---------------------------------------------------------------- PRNG theo seed

function hashSeed(str) {
  // cyrb53 rút gọn -> số nguyên 32 bit
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

// mulberry32
function makeRng(seedStr) {
  let a = hashSeed(String(seedStr));
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------- luật D7

const isRealCode = (code) => {
  const s = String(code == null ? "" : code).trim();
  return s !== "" && s !== "0";
};

// Lựa chọn của câu có được phép trộn không (D7).
function canShuffleOptions(f) {
  if (f.type !== "choice") return false;
  const opts = Array.isArray(f.options) ? f.options : [];
  if (opts.length < 2) return false;
  if (NO_SHUFFLE_FORMATS.has(f.formatLabel)) return false;
  const labels = opts.map((o) => String((o && o.label) || ""));
  if (labels.some((l) => BAD_OPTION_RE.test(l))) return false;
  if (labels.every((l) => ROMAN_OPTION_RE.test(l))) return false; // [I]–[IV]
  // Lựa chọn chỉ là chữ cái A–D (câu nghe không có đề in): không có gì để trộn.
  if (labels.every((l) => /^[A-D]$/.test(l.trim()))) return false;
  // True / False / Not Given dù nhãn format khác.
  if (opts.every((o) => TFNG_VALUES.has(String((o && o.value) || "").toLowerCase()))) return false;
  return true;
}

const hasPassage = (sec) => !!String(sec.passageText || "").trim();
const hasNote = (sec) => !!String(sec.noteText || "").trim() || !!sec.noteDoc;
const widthOf = (f) => (Number(f.idEnd) > Number(f.id) ? Number(f.idEnd) - Number(f.id) + 1 : 1);

function joinAnswers(arr) {
  return arr.filter((a) => String(a).trim() !== "").join(" / ");
}

// Một câu server -> câu in. `rng` null = giữ nguyên lựa chọn / mảnh.
function printQuestion(f, sec, number, rng) {
  const opts = Array.isArray(f.options) ? f.options : [];
  let order = opts.map((_, i) => i);
  if (rng && canShuffleOptions(f)) order = shuffled(order, rng);
  const options = order.map((src, i) => ({ letter: LETTERS[i] || String(i + 1), label: String((opts[src] && opts[src].label) || "") }));

  let answer = "";
  if (f.type === "choice") {
    if (opts.length) {
      const newLetterOfValue = new Map();
      order.forEach((src, i) => newLetterOfValue.set(String(opts[src].value), LETTERS[i] || String(i + 1)));
      answer = (f.answers || [])
        .map((a) => newLetterOfValue.get(String(a)))
        .filter(Boolean)
        .sort()
        .join(", ");
    } else {
      // Matching: lựa chọn nằm ở section.matchOptions.
      const mo = (sec.matchOptions || []).map((o) => String(o.value));
      answer = (f.answers || []).map((a) => (mo.indexOf(String(a)) >= 0 ? LETTERS[mo.indexOf(String(a))] : String(a))).join(", ");
    }
  } else {
    answer = joinAnswers((f.answers || []).map(String));
  }

  let tokens = Array.isArray(f.tokens) ? f.tokens.slice() : [];
  if (rng && tokens.length > 1) {
    const src = tokens.join("\u0001");
    let out = shuffled(tokens, rng);
    for (let i = 0; i < 5 && out.join("\u0001") === src; i++) out = shuffled(tokens, rng);
    tokens = out;
  }

  const q = {
    number,
    numberEnd: widthOf(f) > 1 ? number + widthOf(f) - 1 : null,
    type: f.type === "choice" ? "choice" : "fill",
    label: String(f.label || ""),
    pre: String(f.pre || ""),
    post: String(f.post || ""),
    hint: String(f.hint || ""),
    tokens,
    options: f.type === "choice" ? options : [],
    imageUrl: f.imageUrl || "",
    formatLabel: String(f.formatLabel || ""),
    selectCount: Math.max(1, Number(f.selectCount) || 1),
  };
  return { q, answer };
}

// ---------------------------------------------------------------- chính

function shuffleExam(skills, opts = {}) {
  const real = isRealCode(opts.code);
  const seed = String(opts.seed == null ? "" : opts.seed) + "|" + String(opts.code == null ? "" : opts.code).trim();
  const parts = [];
  const answers = [];

  for (const skill of ["listening", "reading"]) {
    const sections = (skills && skills[skill] && skills[skill].sections) || [];
    let next = 1;
    sections.forEach((sec, pi) => {
      if (!sec || !(sec.fields || []).length) return;
      const rng = real ? makeRng(`${seed}|${skill}|${pi}`) : null;
      // Thứ tự câu: giữ nguyên nếu có đoạn văn / khung note (chỗ trống gắn với đoạn), không thì trộn.
      let order = sec.fields.map((_, i) => i);
      if (rng && !hasPassage(sec) && !hasNote(sec)) order = shuffled(order, rng);

      const map = new Map(); // số cũ -> số mới (viết lại chỗ trống đoạn văn)
      const questions = [];
      for (const idx of order) {
        const f = sec.fields[idx];
        const number = real ? next : Number(f.id);
        const pq = printQuestion(f, sec, number, rng);
        questions.push(pq.q);
        answers.push({ skill, part: sec.name || "", number, answer: pq.answer });
        const w = widthOf(f);
        map.set(Number(f.id), number);
        if (real) next += w;
      }

      let passageText = String(sec.passageText || "");
      if (real && passageText && !questions.every((q, i) => q.number === Number(sec.fields[order[i]].id))) {
        passageText = rewriteBlanks(passageText, map).text;
      }

      parts.push({
        skill,
        name: String(sec.name || ""),
        passageText,
        imageUrl: sec.imageUrl || "",
        matchOptions: (sec.matchOptions || []).map((o, i) => ({ letter: LETTERS[i] || String(i + 1), label: String(o.label || "") })),
        questions,
      });
    });
  }
  return { parts, answers };
}

module.exports = { shuffleExam, makeRng, canShuffleOptions, hashSeed };

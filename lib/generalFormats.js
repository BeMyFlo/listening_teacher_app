// Dạng bài General (Phase 12 G1, mục 1 + 3.4): hằng số nhãn + helper thuần dùng
// chung server / builder / học sinh. CommonJS thuần, không import gì khác.

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

module.exports = {
  GENERAL_LABELS,
  underlineModeOf,
  isErrorIdFormat,
  splitTokens,
  shuffleTokens,
  arrangeDistractors,
  arrangeOptions,
};

// Phần dùng chung cho các module soạn bài bằng AI (grammarLesson, vocabLesson):
// đọc trình độ học sinh, làm sạch text, chuỗi model, lượt kiểm tra đáp án,
// chia đều câu hỏi theo dạng.

const MAX_TOPICS = 3;
// 2 lượt AI (soạn + kiểm tra) × tối đa 3 chủ đề phải xong trong 60s.
const QUESTION_COUNTS = [5, 8, 10];
// Sinh dư vài câu: lượt kiểm tra đáp án sẽ loại những câu sai/mơ hồ, sau đó
// mới cắt về đúng số câu giáo viên chọn.
const EXTRA_QUESTIONS = 3;
const MAX_FIELD = 3000;

// ---- Trình độ học sinh ----
// Giáo viên gõ tự do (vd "6.5", "Band 5.5", "B2") — không ép vào vài mốc cố
// định vì mỗi lớp nhắm 1 band khác nhau.
const DEFAULT_STUDENT_LEVEL = "IELTS band 4.0–5.0 (pre-intermediate)";
const CEFR_BAND = { A1: 2.5, A2: 3.5, B1: 5, B2: 6, C1: 7, C2: 8 };

// Lấy band từ số gõ vào ("5.0–5.5" -> lấy số lớn) hoặc quy đổi từ CEFR.
function bandOf(raw) {
  const s = String(raw || "");
  // Số dính sau chữ cái (chữ "2" trong "B2") không phải band.
  const nums = (s.match(/(?<![A-Za-z])\d(?:[.,]\d)?/g) || [])
    .map((n) => Number(n.replace(",", ".")))
    .filter((n) => n >= 1 && n <= 9);
  if (nums.length) return Math.max(...nums);
  const cefr = (s.toUpperCase().match(/\b[ABC][12]\b/g) || []).map((c) => CEFR_BAND[c]);
  return cefr.length ? Math.max(...cefr) : null;
}

// Mức độ khó theo band: "foundation" | "core" | "upper" | "advanced". Mỗi
// module tự viết hướng dẫn cho từng mức (chỉ ghi "band 6.5" thì model vẫn
// viết như lớp cơ bản — đã test).
function tierOf(band) {
  if (band == null || band <= 4) return "foundation";
  if (band <= 5.5) return "core";
  if (band <= 6.5) return "upper";
  return "advanced";
}

function describeStudentLevel(raw) {
  const s = String(raw || "").trim();
  if (!s) return DEFAULT_STUDENT_LEVEL;
  // Chỉ gõ số (vd "6.5") -> hiểu là IELTS band.
  if (/^\d(?:[.,]\d)?$/.test(s)) return `IELTS band ${s.replace(",", ".")}`;
  return s;
}

// ---- Model ----
// Soạn bài cần độ chính xác hơn chấm bài: ưu tiên Flash (không phải Flash
// Lite như chuỗi chấm bài), phần còn lại của chuỗi chấm bài làm dự phòng.
const PREFERRED_MODELS = ["gemini-2.5-flash"];
function lessonModels(gradingChain) {
  return [...PREFERRED_MODELS, ...(gradingChain || []).filter((m) => !PREFERRED_MODELS.includes(m))];
}

// ---- Text ----
// Chặn markdown lọt vào (học sinh sẽ thấy nguyên dấu ** / #) + cắt độ dài.
function toPlain(s, max = MAX_FIELD) {
  return String(s == null ? "" : s)
    .replace(/\r\n?/g, "\n")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[*•]\s+/gm, "- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

// 1 dòng, bỏ luôn dấu gạch dưới (chỗ trống ___ do code tự chèn).
const oneLine = (s) => toPlain(s).replace(/\s*\n\s*/g, " ").replace(/_{2,}/g, "").trim();
const sameText = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
const words = (t) => String(t).toLowerCase().match(/[a-z']+/g) || [];
const capStr = (v, n) => String(v || "").trim().slice(0, n);

// "1. Present simple\n- Past simple" -> ["Present simple", "Past simple"]
function parseLines(text) {
  return [
    ...new Set(
      String(text || "")
        .split(/\r?\n/)
        .map((s) => s.trim().replace(/^[-*•\d.)\s]+/, "").trim().slice(0, 160))
        .filter(Boolean)
    ),
  ];
}

// ---- Lượt kiểm tra đáp án: AI thứ hai đóng vai giám khảo độc lập ----
const CHECK_SYSTEM = [
  "You are a meticulous English examiner reviewing an answer key written by another teacher.",
  "Judge every item exactly as written, trying each candidate in turn.",
  "Be strict: a candidate counts as acceptable if a careful native speaker would accept it as correct and natural in some reasonable reading of the item.",
].join("\n");

const CHECK_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          n: { type: "integer" },
          keyIsCorrect: { type: "boolean" },
          acceptable: { type: "array", items: { type: "string" } },
          note: { type: "string" },
        },
        required: ["n", "keyIsCorrect", "acceptable"],
      },
    },
  },
  required: ["items"],
};

const CHECK_HEADER = [
  "Check each item below. For every item return:",
  "- n: the item number",
  "- keyIsCorrect: true only if the Key is correct and natural for that item",
  "- acceptable: for choice items, every option (copied exactly) that is acceptable; for gap-fill items, every word/phrase that correctly fills the gap using the word in brackets (include the key if correct, plus contractions and other correct structures)",
  "- note: one short line on any problem, else empty",
  "",
];

// verdict -> Map n -> item
const verdictMap = (verdict) => new Map(((verdict && verdict.items) || []).map((it) => [Number(it.n), it]));

// Lý do bỏ câu (hoặc null) — dùng chung mọi dạng. Giám khảo bỏ sót câu -> bỏ
// luôn (thà thiếu câu còn hơn sai đáp án).
function reviewProblem(it) {
  if (!it) return "not reviewed";
  if (!it.keyIsCorrect) return `answer key judged wrong${it.note ? `: ${it.note}` : ""}`;
  return null;
}

const acceptedList = (it) => [...new Set(((it && it.acceptable) || []).map(oneLine).filter(Boolean))];

// Câu chọn đáp án (lựa chọn riêng hoặc ngân hàng từ chung trong q.opts): giữ
// khi đáp án là lựa chọn DUY NHẤT được giám khảo chấp nhận.
function choiceProblem(q, it) {
  const base = reviewProblem(it);
  if (base) return base;
  const ok = acceptedList(it);
  const accepted = q.opts.filter((o) => ok.some((a) => sameText(a, o)));
  if (accepted.length !== 1 || !sameText(accepted[0], q.answer)) {
    return `more than one option could be right (${accepted.join(", ") || "none confirmed"})`;
  }
  return null;
}

// Cắt về đúng số câu, chia đều các dạng theo thứ tự `types` (dạng nào thiếu
// thì dạng khác bù).
function pickBalanced(questions, count, types) {
  const pools = types.map((t) => questions.filter((q) => q.type === t));
  const taken = pools.map(() => 0);
  let total = 0;
  let progress = true;
  while (total < count && progress) {
    progress = false;
    for (let i = 0; i < pools.length && total < count; i++) {
      if (taken[i] < pools[i].length) {
        taken[i] += 1;
        total += 1;
        progress = true;
      }
    }
  }
  return pools.flatMap((p, i) => p.slice(0, taken[i]));
}

module.exports = {
  MAX_TOPICS,
  QUESTION_COUNTS,
  EXTRA_QUESTIONS,
  bandOf,
  tierOf,
  describeStudentLevel,
  lessonModels,
  toPlain,
  oneLine,
  sameText,
  words,
  capStr,
  parseLines,
  CHECK_SYSTEM,
  CHECK_SCHEMA,
  CHECK_HEADER,
  verdictMap,
  reviewProblem,
  acceptedList,
  choiceProblem,
  pickBalanced,
};

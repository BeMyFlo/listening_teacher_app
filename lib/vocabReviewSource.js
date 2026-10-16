// Vocab Review theo từng skill (Reading / Listening) — phần dùng chung cho cả
// client (editor tính sourceHash, hiện chấm báo) lẫn server (route AI, lưu Unit).
// Giữ CommonJS thuần, không phụ thuộc Mongoose, để cả `import` từ app/ lẫn
// `require` từ pages/api/ và tests/ đều dùng được (cùng kiểu lib/lessonImport.js).
//
// `cat` ở đây là category theo shape API/payload: { key, exercises: [{ sections: [...] }] }
// (client dựng từ state editor bằng sectionsToPayload trước khi gọi).

const REVIEW_SKILLS = ["reading", "listening"];
const MAX_WORDS = 60;
// Phần nguồn gửi cho AI — passage/transcript được ưu tiên, phần còn lại lấp chỗ trống.
const MAX_SOURCE_CHARS = 30000;

const S = (v) => String(v == null ? "" : v);

const isReviewSkill = (key) => REVIEW_SKILLS.includes(key);

// Mấy lựa chọn cố định của True/False/Not Given, Yes/No/Not Given — nhiễu, không phải từ vựng.
const NOISE_OPTIONS = new Set(["true", "false", "not given", "yes", "no"]);

// Giữ xuống dòng (đoạn văn) nhưng gọn khoảng trắng; chỗ trống [[3]] thành ___.
function cleanBlock(s) {
  return S(s)
    .replace(/\r\n?/g, "\n")
    .replace(/\[\[\d+\]\]/g, "___")
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Chuẩn hoá để so khớp: 1 dòng, khoảng trắng đơn, dấu nháy cong -> thẳng, ellipsis -> "...".
function normalizeForMatch(s) {
  return S(s)
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim();
}

// Text của 1 section, tách 2 nhóm: `primary` (passage / transcript) và `secondary`
// (note, câu hỏi, lựa chọn, đáp án điền từ của Listening).
function sectionParts(sec, listening) {
  const primary = [];
  const secondary = [];
  const s = sec || {};

  const main = cleanBlock(listening ? s.transcript : s.passageText);
  if (main) primary.push(main);

  // Section soạn bằng khối note thì noteText thật nằm trong noteBlocks (noteText
  // gốc là bản gộp của chúng) — lấy 1 nguồn để không bị lặp.
  const blocks = Array.isArray(s.noteBlocks) ? s.noteBlocks : [];
  const noteTexts = blocks.length ? blocks.map((b) => b && b.noteText) : [s.noteText];
  noteTexts.map(cleanBlock).filter(Boolean).forEach((t) => secondary.push(t));

  const optLabels = (opts) =>
    (Array.isArray(opts) ? opts : [])
      .map((o) => cleanBlock(o && o.label))
      .filter((l) => l && !NOISE_OPTIONS.has(l.toLowerCase()));
  const bank = optLabels(s.matchOptions);
  if (bank.length) secondary.push(bank.join("; "));

  for (const f of Array.isArray(s.fields) ? s.fields : []) {
    if (!f) continue;
    const line = [f.label, f.pre, f.post].map(cleanBlock).filter(Boolean).join(" ");
    if (line) secondary.push(line);
    const opts = optLabels(f.options);
    if (opts.length) secondary.push(opts.join("; "));
    // Listening không có lời thoại -> đáp án điền từ thường chính là từ khoá của bài.
    if (listening && f.type !== "choice") {
      const ans = (Array.isArray(f.answers) ? f.answers : []).map(cleanBlock).filter(Boolean);
      if (ans.length) secondary.push(ans.join("; "));
    }
  }
  return { primary, secondary };
}

// Gom text nguồn của 1 skill. Không truyền `max` = lấy đủ (dùng để tính hash);
// có `max` thì cắt, ưu tiên passage/transcript rồi mới tới phần còn lại.
function collectSource(cat, opts) {
  const max = opts && Number(opts.max) > 0 ? Number(opts.max) : 0;
  const listening = !!cat && cat.key === "listening";
  const exercises = cat && Array.isArray(cat.exercises) ? cat.exercises : [];
  const primary = [];
  const secondary = [];
  for (const ex of exercises) {
    for (const sec of ex && Array.isArray(ex.sections) ? ex.sections : []) {
      const p = sectionParts(sec, listening);
      primary.push(...p.primary);
      secondary.push(...p.secondary);
    }
  }
  const head = primary.join("\n\n");
  const tail = secondary.join("\n");
  if (!max) return [head, tail].filter(Boolean).join("\n\n");
  const headCut = head.slice(0, max);
  const room = max - headCut.length;
  const tailCut = room > 20 ? tail.slice(0, room - 2) : "";
  return [headCut, tailCut].filter(Boolean).join("\n\n");
}

// Dấu vân tay ngắn (FNV-1a 32-bit + độ dài) của text nguồn — chỉ để phát hiện
// bài đã đổi, không cần an toàn mật mã. Nguồn rỗng -> "".
function hashSource(text) {
  const s = normalizeForMatch(text);
  if (!s) return "";
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36) + "-" + s.length.toString(36);
}

const sourceHashOf = (cat) => hashSource(collectSource(cat));

// Trạng thái Vocab Review của 1 skill so với nội dung bài hiện tại:
//   "none"  — skill chưa có bài/text để lấy từ
//   "empty" — có bài nhưng chưa có từ nào
//   "stale" — có từ nhưng bài đã đổi kể từ lần tạo (hash lệch)
//   "fresh" — khớp
function reviewState(cat) {
  const hash = sourceHashOf(cat);
  const exCount = cat && Array.isArray(cat.exercises) ? cat.exercises.length : 0;
  if (!isReviewSkill(cat && cat.key) || !exCount || !hash) return { state: "none", hash };
  const vr = (cat && cat.vocabReview) || {};
  if (!Array.isArray(vr.words) || !vr.words.length) return { state: "empty", hash };
  return { state: vr.sourceHash === hash ? "fresh" : "stale", hash };
}

// ---- Lưu: làm sạch vocabReview của 1 category từ body client ----
const WORD_FIELDS = ["partOfSpeech", "ipa", "meaning", "definitionEn", "example", "collocation", "synonyms"];
const CAP_WORD = 80;
const CAP_FIELD = 400;
const CAP_CONTEXT = 500;

function sanitizeVocabReview(catKey, raw) {
  if (!isReviewSkill(catKey)) return { enabled: false, words: [], sourceHash: "" };
  const r = raw && typeof raw === "object" ? raw : {};
  const seen = new Set();
  const words = [];
  for (const w of Array.isArray(r.words) ? r.words : []) {
    if (!w || typeof w !== "object") continue;
    const word = S(w.word).trim().slice(0, CAP_WORD);
    if (!word) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const row = { word };
    for (const f of WORD_FIELDS) row[f] = S(w[f]).trim().slice(0, CAP_FIELD);
    row.context = S(w.context).trim().slice(0, CAP_CONTEXT);
    words.push(row);
    if (words.length >= MAX_WORDS) break;
  }
  return {
    enabled: r.enabled === true,
    words,
    sourceHash: S(r.sourceHash).trim().slice(0, 40),
  };
}

module.exports = {
  REVIEW_SKILLS,
  MAX_WORDS,
  MAX_SOURCE_CHARS,
  isReviewSkill,
  normalizeForMatch,
  collectSource,
  hashSource,
  sourceHashOf,
  reviewState,
  sanitizeVocabReview,
};

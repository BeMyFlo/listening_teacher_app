// So khớp câu khoan dung (Phase 12 G1, mục 3.3) cho câu có `matchMode: "sentence"`.
// Áp SAU `normalize` cũ của lib/grade.js (đã lowercase + gộp khoảng trắng),
// nhưng cũng an toàn với chuỗi thô. CommonJS thuần.

// Bảng viết tắt đặc biệt (áp trước luật chung n't).
const CONTRACTIONS = {
  "won't": "will not",
  "can't": "cannot",
  "shan't": "shall not",
};
// Hậu tố chung. KHÔNG mở 's (vừa is/has vừa sở hữu cách).
const SUFFIXES = [
  ["n't", " not"],
  ["'m", " am"],
  ["'re", " are"],
  ["'ve", " have"],
  ["'ll", " will"],
  ["'d", " would"],
];

function normalizeSentence(s) {
  let t = String(s == null ? "" : s).toLowerCase();
  t = t.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-");
  for (const [from, to] of Object.entries(CONTRACTIONS)) {
    t = t.replace(new RegExp("\\b" + from + "(?![a-z])", "g"), to);
  }
  for (const [suf, to] of SUFFIXES) {
    t = t.replace(new RegExp(suf + "(?![a-z'])", "g"), to);
  }
  t = t.replace(/\bcan not\b/g, "cannot");
  t = t.replace(/\s+/g, " ").trim();
  t = t.replace(/[.!?]+$/, "").trim();
  t = t.replace(/\s+,/g, ",").replace(/,\s*/g, ", ");
  t = t.replace(/,\s*$/, ",");
  return t.replace(/\s+/g, " ").trim();
}

module.exports = { normalizeSentence, CONTRACTIONS, SUFFIXES };

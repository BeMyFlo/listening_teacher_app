// Dạng "Listen and choose — no printed question" (Phase 8, C8 / bước 5.3a):
// TOEIC Part 1, Part 2 (và Listening IELTS nếu giáo viên muốn) — đề không in
// chữ, học sinh chỉ nghe rồi chọn A/B/C(/D).
//
// KHÔNG có schema chấm điểm mới: câu lưu như một câu `choice` thường với
// `label: ""`, `options: [{value:"A",label:"A"},…]`, `answers: ["B"]`. File này
// chỉ chứa phần nhận diện + sinh lựa chọn, dùng chung server / giáo viên /
// học sinh (CommonJS thuần như lib/curriculum.js, không import gì khác).

const LETTERS = ["A", "B", "C", "D"];
const LETTER_FORMAT_LABEL = "Listen and choose — no printed question";
const TOEIC_P1_LABEL = "Part 1 — Photographs";
const TOEIC_P2_LABEL = "Part 2 — Question–Response";
const LETTER_FORMAT_LABELS = [LETTER_FORMAT_LABEL, TOEIC_P1_LABEL, TOEIC_P2_LABEL];

// n lựa chọn A.. (2–4) ở dạng server: [{ value: "A", label: "A" }, …].
function letterOptions(n) {
  const count = Math.min(LETTERS.length, Math.max(2, Number(n) || LETTERS.length));
  return LETTERS.slice(0, count).map((l) => ({ value: l, label: l }));
}

function onlyLetters(labels) {
  return (
    Array.isArray(labels) &&
    labels.length >= 2 &&
    labels.length <= LETTERS.length &&
    labels.every((l) => /^[A-D]$/.test(String(l == null ? "" : l).trim()))
  );
}

// Nhận diện câu letter-only từ dữ liệu server / public:
// `choice` + đề trống (hoặc formatLabel thuộc dạng này) + mọi lựa chọn là một
// chữ cái A–D + chọn 1 đáp án.
function isLetterOnlyField(f) {
  if (!f || f.type !== "choice") return false;
  if (Number(f.selectCount) > 1) return false;
  if (!onlyLetters((f.options || []).map((o) => o && o.label))) return false;
  const emptyLabel = !String(f.label || "").trim();
  return emptyLabel || LETTER_FORMAT_LABELS.includes(f.formatLabel);
}

// Cùng ý, cho field ở dạng editor ({kind:"mcq", options:[{id,text}]}). Builder chặt
// hơn phía học sinh: PHẢI có formatLabel của dạng này — nếu không, một câu mcq thường
// đang soạn dở (đề còn trống, mới gõ lựa chọn "A", "B") sẽ bị đổi giao diện giữa chừng.
function isLetterEditorField(f) {
  if (!f || f.kind !== "mcq") return false;
  if (!LETTER_FORMAT_LABELS.includes(f.formatLabel)) return false;
  return onlyLetters((f.options || []).map((o) => o && o.text));
}

module.exports = {
  LETTERS,
  LETTER_FORMAT_LABEL,
  TOEIC_P1_LABEL,
  TOEIC_P2_LABEL,
  LETTER_FORMAT_LABELS,
  letterOptions,
  isLetterOnlyField,
  isLetterEditorField,
};

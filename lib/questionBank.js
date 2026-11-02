// Logic thuần của ngân hàng câu hỏi (Phase 12 G4): chuẩn hoá + kiểm 1 mục, đọc hàng ma trận,
// bốc ngẫu nhiên. Không đụng DB trừ validateItem (qua validateSections, có kiểm ảnh theo workspace).
const { levelAllowed } = require("./curriculum");
const { GENERAL_LABELS } = require("./generalFormats");
const { incompleteQuestions, MAX_PER_PART, MAX_TOTAL } = require("./generalTemplates");
const { isDifficulty } = require("./generalTopics");
const { normalizeSections, hasDuplicateFieldIds, validateSections } = require("./testSections");

const FORMAT_KEYS = Object.keys(GENERAL_LABELS).map((k) => "g-" + k);
const MAX_ITEMS_PER_REQUEST = 100;
const MAX_PICK_QUESTIONS = MAX_TOTAL; // 100 câu / lần bốc
const MAX_PICK_ROWS = 50;
const MAX_CANDIDATES_PER_ROW = 2000;

const isFormatKey = (k) => typeof k === "string" && FORMAT_KEYS.includes(k);
const str = (v, max) => String(v == null ? "" : v).trim().slice(0, max);

// Nhãn dạng bài ("Word form") -> key ("g-wform"); không khớp -> "".
function formatKeyFromLabel(label) {
  for (const k of Object.keys(GENERAL_LABELS)) if (GENERAL_LABELS[k] === label) return "g-" + k;
  return "";
}

// Số câu mà 1 field chiếm (câu gộp idEnd chiếm cả dải).
function questionCountOf(fields) {
  return fields.reduce((n, f) => n + (Number(f.idEnd) > Number(f.id) ? Number(f.idEnd) - Number(f.id) + 1 : 1), 0);
}

// Chuẩn hoá 1 mục gửi lên -> { item, error }. `raw` có thể là document cũ đã gộp với thay đổi.
function buildItem(raw, program) {
  raw = raw || {};
  const level = Number(raw.level);
  if (!Number.isInteger(level) || !levelAllowed(program, level)) return { error: "Choose a valid grade." };

  const kind = raw.kind === "group" ? "group" : "single";
  const rawFields = Array.isArray(raw.fields) ? raw.fields : [];
  let format = raw.format ? String(raw.format) : "";
  if (!format && rawFields[0]) format = formatKeyFromLabel(rawFields[0].formatLabel);
  if (!isFormatKey(format)) return { error: "Choose a valid question type." };

  const difficulty = raw.difficulty == null ? "" : String(raw.difficulty);
  if (difficulty && !isDifficulty(difficulty)) return { error: "Invalid difficulty." };

  const section = normalizeSections([
    {
      passageText: kind === "group" ? raw.passageText : "",
      imageId: kind === "group" ? raw.imageId : undefined,
      fields: rawFields,
    },
  ])[0];
  const fields = section.fields;

  if (!fields.length) return { error: "A question item needs at least one question." };
  if (kind === "single" && fields.length !== 1) return { error: "A single item has exactly one question." };
  if (fields.length > MAX_PER_PART) return { error: `A group can have at most ${MAX_PER_PART} questions.` };
  if (fields.some((f) => !Number.isFinite(f.id))) return { error: "Every question needs a number." };
  if (hasDuplicateFieldIds([section])) return { error: "Duplicate question numbers in this item." };

  return {
    item: {
      program,
      level,
      textbook: str(raw.textbook, 120),
      unitLabel: str(raw.unitLabel, 120),
      topic: str(raw.topic, 80),
      difficulty,
      format,
      kind,
      passageText: section.passageText,
      imageId: section.imageId,
      fields,
      questionCount: questionCountOf(fields),
      sourceRef: str(raw.sourceRef, 200),
    },
  };
}

// Kiểm nội dung 1 mục đã buildItem: luật media (nhóm cần đoạn văn hoặc ảnh), ảnh thuộc đúng workspace,
// rồi câu dở. null = hợp lệ.
async function validateItem(ws, item) {
  const section = { passageText: item.passageText, imageId: item.imageId, fields: item.fields, matchOptions: [], noteBlocks: [] };
  const normalized = normalizeSections([section]);
  const mediaError = await validateSections(ws, item.kind === "group" ? "reading" : "grammar", normalized);
  if (mediaError) return mediaError;
  const unfinished = incompleteQuestions({ reading: { sections: normalized } });
  if (unfinished.length) return `Question ${unfinished[0].fieldId} is not finished: ${unfinished[0].reason}`;
  return null;
}

// Hàng ma trận gửi lên -> { rows, error }. difficulty rỗng = mọi mức độ.
function parsePickRows(rawRows) {
  if (!Array.isArray(rawRows) || !rawRows.length) return { error: "Add at least one row." };
  if (rawRows.length > MAX_PICK_ROWS) return { error: `At most ${MAX_PICK_ROWS} rows per request.` };
  const rows = [];
  let total = 0;
  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i] || {};
    const count = Number(r.count);
    if (!Number.isInteger(count) || count < 1) return { error: `Row ${i + 1}: count must be a whole number of at least 1.` };
    if (!isFormatKey(r.format)) return { error: `Row ${i + 1}: choose a valid question type.` };
    const difficulty = r.difficulty == null ? "" : String(r.difficulty);
    if (difficulty && !isDifficulty(difficulty)) return { error: `Row ${i + 1}: invalid difficulty.` };
    total += count;
    if (total > MAX_PICK_QUESTIONS) return { error: `Pick at most ${MAX_PICK_QUESTIONS} questions per request.` };
    rows.push({ format: r.format, difficulty, topic: str(r.topic, 80), count });
  }
  return { rows };
}

// Bốc ngẫu nhiên các mục từ `candidates` [{ _id, questionCount }] cho đến đủ `need` câu.
// Không tách nhóm: mục có questionCount lớn hơn phần còn thiếu thì bỏ qua, thử mục khác.
// `used` (Set id dạng chuỗi) chống bốc trùng giữa các hàng; hàm thêm id mới bốc vào đó.
// -> { chosen: [id], picked: số câu, shortage }
function pickItems(candidates, need, used, rng = Math.random) {
  const pool = candidates.filter((c) => !used.has(String(c._id)) && Number(c.questionCount) > 0);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const chosen = [];
  let remaining = need;
  for (const c of pool) {
    if (remaining <= 0) break;
    const qc = Number(c.questionCount);
    if (qc > remaining) continue;
    chosen.push(c._id);
    used.add(String(c._id));
    remaining -= qc;
  }
  return { chosen, picked: need - remaining, shortage: remaining };
}

// Thoát ký tự đặc biệt để chuỗi người dùng gõ dùng an toàn trong RegExp.
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  FORMAT_KEYS,
  MAX_ITEMS_PER_REQUEST,
  MAX_PICK_QUESTIONS,
  MAX_PICK_ROWS,
  MAX_CANDIDATES_PER_ROW,
  isFormatKey,
  formatKeyFromLabel,
  questionCountOf,
  buildItem,
  validateItem,
  parsePickRows,
  pickItems,
  escapeRegex,
};

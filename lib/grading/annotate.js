// Lớp chú thích chấm bài (annotation) — KHÔNG phá huỷ bài gốc.
//
// essayText của học sinh là bất biến. Việc chấm = 1 mảng annotations, mỗi cái
// neo vào offset ký tự trong essayText gốc. Giáo viên và AI (Gemini) đều sinh
// ra cùng 1 định dạng này -> render giống hệt nhau, và AI có thể chấm thay.
//
// action:
//   "delete"  : xoá đoạn [start,end)                         -> hiển thị gạch đỏ
//   "replace" : xoá [start,end), chèn insertText              -> gạch đỏ + chữ xanh
//   "insert"  : chèn insertText tại start (start===end)       -> chữ xanh
//   "comment" : không đổi chữ, chỉ tô + ghi chú [start,end)   -> highlight

const CATEGORIES = ["grammar", "vocabulary", "spelling", "cohesion", "punctuation", "task", "style", "other"];
const CRITERIA = ["TR", "CC", "LR", "GRA", "TA", "FC", "PR"];
const ACTIONS = ["delete", "replace", "insert", "comment"];
const MUTATING = new Set(["delete", "replace", "insert"]);

function rid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

// Chuẩn hoá 1 annotation thô (từ client hoặc AI) -> object đầy đủ field.
function normalizeAnnotation(a, essayText = "") {
  const start = Math.max(0, Math.floor(Number(a.start) || 0));
  let end = Math.max(start, Math.floor(Number(a.end != null ? a.end : a.start) || start));
  if (essayText) end = Math.min(end, essayText.length);
  const action = ACTIONS.includes(a.action) ? a.action : "comment";
  return {
    id: a.id || rid(),
    start,
    end: action === "insert" ? start : end,
    quote: typeof a.quote === "string" ? a.quote : essayText.slice(start, end),
    action,
    insertText: action === "replace" || action === "insert" ? String(a.insertText || "") : "",
    category: CATEGORIES.includes(a.category) ? a.category : "other",
    criterion: CRITERIA.includes(a.criterion) ? a.criterion : null,
    comment: String(a.comment || ""),
    severity: a.severity === "minor" || a.severity === "major" ? a.severity : null,
    source: a.source === "ai" ? "ai" : "teacher",
  };
}

// null nếu hợp lệ, chuỗi lỗi nếu không.
function validateAnnotations(essayText, annotations) {
  if (!Array.isArray(annotations)) return "annotations must be an array";
  const len = (essayText || "").length;
  const ranges = [];
  for (const raw of annotations) {
    const a = normalizeAnnotation(raw, essayText);
    if (a.start < 0 || a.end > len || a.start > a.end) return `annotation out of range (${a.start},${a.end}) len ${len}`;
    if ((a.action === "replace" || a.action === "insert") && !a.insertText) return `${a.action} needs insertText`;
    if (MUTATING.has(a.action)) {
      for (const r of ranges) {
        // hai đoạn thay đổi không được đè lên nhau (insert điểm nằm trong đoạn xoá cũng cấm)
        if (a.start < r.end && a.end > r.start) return "overlapping edits are not allowed";
        if (a.action === "insert" && a.start > r.start && a.start < r.end) return "cannot insert inside a deleted span";
      }
      ranges.push({ start: a.start, end: a.end });
    }
  }
  return null;
}

// Bản văn đã sửa sạch (giữ + chèn, bỏ phần xoá).
function applyAnnotations(essayText, annotations) {
  const muts = (annotations || [])
    .map((a) => normalizeAnnotation(a, essayText))
    .filter((a) => MUTATING.has(a.action))
    .sort((x, y) => x.start - y.start || x.end - y.end);
  let out = "";
  let cur = 0;
  for (const m of muts) {
    if (m.start > cur) out += essayText.slice(cur, m.start);
    if (m.action === "insert") {
      out += m.insertText;
    } else if (m.action === "replace") {
      out += m.insertText;
      cur = m.end;
    } else {
      cur = m.end; // delete
    }
    if (m.action === "insert") cur = Math.max(cur, m.start);
  }
  if (cur < essayText.length) out += essayText.slice(cur);
  return out;
}

// Chuỗi segment để render (UI giáo viên + màn học sinh dùng chung).
//   { text, kind: "keep"|"del"|"ins", ann?: {...mutation}, marks?: [{...comment}] }
function buildSegments(essayText, annotations) {
  const text = essayText || "";
  const all = (annotations || []).map((a) => normalizeAnnotation(a, text));
  const muts = all.filter((a) => MUTATING.has(a.action)).sort((x, y) => x.start - y.start || x.end - y.end);
  const comments = all.filter((a) => a.action === "comment");

  // Bước 1: dựng segment thô từ các mutation (mỗi keep/del giữ origStart/origEnd).
  const rough = [];
  let cur = 0;
  const pushKeep = (s, e) => {
    if (e > s) rough.push({ text: text.slice(s, e), kind: "keep", os: s, oe: e });
  };
  for (const m of muts) {
    if (m.start > cur) pushKeep(cur, m.start);
    cur = Math.max(cur, m.start);
    if (m.action === "insert") {
      rough.push({ text: m.insertText, kind: "ins", ann: m });
    } else if (m.action === "replace") {
      rough.push({ text: text.slice(m.start, m.end), kind: "del", os: m.start, oe: m.end, ann: m });
      rough.push({ text: m.insertText, kind: "ins", ann: m });
      cur = m.end;
    } else {
      rough.push({ text: text.slice(m.start, m.end), kind: "del", os: m.start, oe: m.end, ann: m });
      cur = m.end;
    }
  }
  pushKeep(cur, text.length);

  if (!comments.length) return rough.map((s) => strip(s, true));

  // Bước 2: cắt các segment gốc theo biên comment, gắn marks.
  const bounds = new Set();
  comments.forEach((c) => {
    bounds.add(c.start);
    bounds.add(c.end);
  });
  const out = [];
  for (const seg of rough) {
    if (seg.os == null) {
      out.push(strip(seg));
      continue;
    }
    const cuts = [seg.os, ...[...bounds].filter((b) => b > seg.os && b < seg.oe).sort((a, b) => a - b), seg.oe];
    for (let i = 0; i < cuts.length - 1; i++) {
      const s = cuts[i];
      const e = cuts[i + 1];
      const marks = comments
        .filter((c) => c.start <= s && c.end >= e)
        .map((c) => ({ id: c.id, category: c.category, criterion: c.criterion, comment: c.comment, source: c.source }));
      const piece = { text: text.slice(s, e), kind: seg.kind, os: s, oe: e };
      if (seg.ann) piece.ann = pick(seg.ann);
      if (marks.length) piece.marks = marks;
      out.push(piece);
    }
  }
  return out;
}

function pick(a) {
  return { id: a.id, action: a.action, category: a.category, criterion: a.criterion, comment: a.comment, insertText: a.insertText, source: a.source };
}
function strip(seg, keepPos) {
  const p = { text: seg.text, kind: seg.kind };
  if (keepPos && seg.os != null) {
    p.os = seg.os;
    p.oe = seg.oe;
  }
  if (seg.ann) p.ann = pick(seg.ann);
  return p;
}

// Tìm offset của lần xuất hiện thứ `occurrence` (1-based) của `quote` trong text.
// Dùng để (a) đổi output quote-based của Gemini sang offset, (b) neo lại
// annotation của giáo viên khi offset lệch sau khi sửa lại chữ.
function resolveQuote(essayText, quote, occurrence = 1) {
  if (!quote) return null;
  let from = 0;
  let n = 0;
  while (true) {
    const i = essayText.indexOf(quote, from);
    if (i === -1) return null;
    n++;
    if (n === occurrence) return { start: i, end: i + quote.length };
    from = i + 1;
  }
}

module.exports = {
  CATEGORIES,
  CRITERIA,
  ACTIONS,
  rid,
  normalizeAnnotation,
  validateAnnotations,
  applyAnnotations,
  buildSegments,
  resolveQuote,
};

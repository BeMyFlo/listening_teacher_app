// Đổ câu từ ngân hàng vào khung đề + đổi câu (Swap) — Phase 12 G4 bước 3.
// Hàm thuần, không React / DB / mạng; KHÔNG sửa đầu vào (mọi hàm trả bản sao).
// `bankItemId` (và bankFormat / bankKind) chỉ sống trong state của builder: fieldToServer không gửi các khoá này.
import { GENERAL_ALL_FORMATS } from "./questionFormats.js";
import { fieldFromServer, refId } from "./sectionTransforms.js";

export const DIFF_KEYS = ["nb", "th", "vd", "vdc"];

const fmtLabelOf = (key) => (GENERAL_ALL_FORMATS.find((f) => f.key === key) || { label: "" }).label;
const isEmptyStr = (v) => v == null || String(v).trim() === "";

// ---------------------------------------------------------------- ma trận -> kế hoạch bốc

// Ô ma trận mặc định của 1 dạng có `total` câu: tất cả ở "Any".
export function defaultMatrixCell(total) {
  return { any: String(total), nb: "", th: "", vd: "", vdc: "" };
}

function cellNum(v) {
  const s = String(v == null ? "" : v).trim();
  if (s === "") return 0;
  return /^\d+$/.test(s) ? Number(s) : NaN;
}

// Tổng các ô của 1 dạng (ô trống = 0), hoặc NaN nếu có ô sai.
export function cellSum(cell) {
  const c = cell || {};
  let n = 0;
  for (const k of ["any", ...DIFF_KEYS]) {
    const v = cellNum(c[k]);
    if (Number.isNaN(v)) return NaN;
    n += v;
  }
  return n;
}

// "" nếu tổng khớp `total`, không thì câu lỗi cho giáo viên.
export function cellError(cell, total) {
  const sum = cellSum(cell);
  if (Number.isNaN(sum)) return "Use whole numbers only.";
  if (sum !== total) return `Counts add up to ${sum}, but this type has ${total} question${total === 1 ? "" : "s"}.`;
  return "";
}

// base = khuôn gốc (TEMPLATES[key]); counts[skill][pi][qi] = số câu đã chỉnh; skillKeys = kỹ năng đang dùng;
// matrix["skill:pi:qi"] = ô { any, nb, th, vd, vdc }; với PHẦN CÓ ĐOẠN VĂN: matrix[key] = chuỗi mức độ của nhóm ("" = Any),
// key = dạng đầu tiên có số câu > 0 của phần đó.
// Trả { rows, errors }. Hàng: { key, skill, part (chỉ số phần SAU resolve = chỉ số section khung), name, format,
//   difficulty, count, passage }. Phần 0 câu bị bỏ (đúng như resolveTemplate nên chỉ số khớp khung).
export function buildFillPlan(base, counts, skillKeys, matrix = {}) {
  const rows = [];
  const errors = [];
  for (const sk of skillKeys) {
    const def = base.skills[sk];
    if (!def) continue;
    let rp = 0;
    def.parts.forEach((p, pi) => {
      const cs = p.questions.map((q, qi) => Number(((counts[sk] || [])[pi] || [])[qi] ?? q.count));
      const total = cs.reduce((a, b) => a + (b > 0 ? b : 0), 0);
      if (total <= 0) return; // phần bị bỏ
      const part = rp++;
      if (p.passage && sk === "reading") {
        const qi = cs.findIndex((c) => c > 0);
        const d = String(matrix[`${sk}:${pi}:${qi}`] || "");
        rows.push({ key: `${sk}:${pi}:${qi}`, skill: sk, part, name: p.name, format: p.questions[qi].format, difficulty: DIFF_KEYS.includes(d) ? d : "", count: total, passage: true });
        return;
      }
      p.questions.forEach((q, qi) => {
        const n = cs[qi];
        if (!(n > 0)) return;
        const key = `${sk}:${pi}:${qi}`;
        const cell = matrix[key] || defaultMatrixCell(n);
        const err = cellError(cell, n);
        if (err) {
          errors.push(`${p.name}${p.questions.length > 1 ? " — " + fmtLabelOf(q.format) : ""}: ${err}`);
          return;
        }
        for (const dk of ["any", ...DIFF_KEYS]) {
          const c = cellNum(cell[dk]);
          if (c > 0) rows.push({ key, skill: sk, part, name: p.name, format: q.format, difficulty: dk === "any" ? "" : dk, count: c, passage: false });
        }
      });
    });
  }
  return { rows, errors };
}

// Hàng kế hoạch -> thân gửi API pick (chỉ các trường server nhận).
export function planToPickRows(plan) {
  return plan.map((r) => ({ format: r.format, difficulty: r.difficulty || "", count: r.count }));
}

// ---------------------------------------------------------------- chép mục ngân hàng -> câu của builder

// Một câu server của mục -> câu dạng editor. Nhãn của mục chép xuống câu (giá trị sẵn có của câu thắng).
// Ghi nhớ nguồn: bankItemId/bankFormat/bankKind (chỉ trong state), __src = số câu gốc (để viết lại chỗ trống đoạn văn).
function itemFieldToEditor(item, srcField) {
  const f = fieldFromServer(srcField, {});
  f.topic = srcField.topic || item.topic || "";
  f.difficulty = srcField.difficulty || item.difficulty || "";
  f.bankItemId = String(item._id);
  f.bankFormat = item.format || "";
  f.bankKind = item.kind === "group" ? "group" : "single";
  f.__src = Number(srcField.id);
  f.__srcEnd = srcField.idEnd ? Number(srcField.idEnd) : null;
  return f;
}

// Viết lại số chỗ trống trong đoạn văn: "(21)", "[21]", "___21___", "21......" -> số mới theo `map` (cũ -> mới).
// Chỗ trống không có trong map -> không đoán, đưa vào `unmatched`.
// Không dùng lookbehind (client cũ); "21." trơn KHÔNG coi là chỗ trống.
export function rewriteBlanks(text, map) {
  const unmatched = [];
  const re = /\((\d{1,3})\)|\[(\d{1,3})\]|(_{2,}\s*)(\d{1,3})(\s*_{2,})|(^|[^\d])(\d{1,3})(?=\s*(?:\.{3,}|…|_{2,}))/g;
  const sub = (old) => {
    const n = map.get(Number(old));
    if (n == null) {
      if (!unmatched.includes(Number(old))) unmatched.push(Number(old));
      return null;
    }
    return String(n);
  };
  const out = String(text || "").replace(re, (m, a, b, c1, c2, c3, d1, d2) => {
    if (a != null) {
      const n = sub(a);
      return n == null ? m : "(" + n + ")";
    }
    if (b != null) {
      const n = sub(b);
      return n == null ? m : "[" + n + "]";
    }
    if (c2 != null) {
      const n = sub(c2);
      return n == null ? m : c1 + n + c3;
    }
    const n = sub(d2);
    return n == null ? m : d1 + n;
  });
  return { text: out, unmatched };
}

// Đánh số lại 1..N liền qua mọi phần của 1 kỹ năng; viết lại chỗ trống đoạn văn của phần có nhóm (__src).
// Sửa trực tiếp `sections` (đã là bản sao). flags.push({ skill, part, message }). Xoá khoá tạm __src.
function renumberSkill(skill, sections, flags, start = 1) {
  let next = start;
  sections.forEach((sec) => {
    const map = new Map();
    for (const f of sec.fields) {
      const width = f.idEnd && Number(f.idEnd) > Number(f.id) ? Number(f.idEnd) - Number(f.id) + 1 : 1;
      if (f.__src != null) map.set(f.__src, next);
      f.id = next;
      f.idEnd = width > 1 ? next + width - 1 : null;
      next += width;
    }
    if (map.size && sec.passageText) {
      const r = rewriteBlanks(sec.passageText, map);
      sec.passageText = r.text;
      for (const n of r.unmatched) {
        flags.push({ skill, part: sec.name, message: `The passage mentions blank (${n}), which matches no question. Check it by hand.` });
      }
    }
    for (const f of sec.fields) {
      delete f.__src;
      delete f.__srcEnd;
    }
  });
}

// ---------------------------------------------------------------- đổ vào khung

// skeleton = { skills: { listening?, reading? } } (buildSkeleton). plan = hàng của buildFillPlan.
// pickedByRow[i] = mảng mục (shape server) đã bốc cho plan[i].
// opts.allowPartSize: cho phần theo cỡ nhóm đoạn văn thật.
// -> { skills, shortages: [{ skill, partIndex, part, format, difficulty, missing }], flags, filled, total }
export function fillSkeletonFromBank(skeleton, plan, pickedByRow, opts = {}) {
  const allow = !!opts.allowPartSize;
  const skills = structuredClone((skeleton && skeleton.skills) || {});
  const shortages = [];
  const flags = [];
  const used = new Set(); // một mục chỉ vào đề một lần

  (plan || []).forEach((row, i) => {
    const sec = skills[row.skill] && skills[row.skill].sections[row.part];
    const items = ((pickedByRow && pickedByRow[i]) || []).filter((it) => it && !used.has(String(it._id)));
    const short = (missing) => {
      if (missing > 0)
        shortages.push({ skill: row.skill, partIndex: row.part, part: sec ? sec.name : row.name, format: row.format, difficulty: row.difficulty || "", missing });
    };
    if (!sec) return short(row.count);

    if (row.passage) {
      // Một phần có đoạn văn chỉ nhận MỘT nhóm. Chọn nhóm vừa nhất: lớn nhất mà không vượt chỗ, không thì nhỏ nhất vượt chỗ (khi cho phép).
      const slot = sec.fields.length;
      const groups = items.filter((it) => it && it.kind === "group" && (it.fields || []).length > 0);
      const fits = groups.filter((g) => g.fields.length <= slot).sort((a, b) => b.fields.length - a.fields.length);
      const over = allow ? groups.filter((g) => g.fields.length > slot).sort((a, b) => a.fields.length - b.fields.length) : [];
      const g = fits[0] || over[0];
      if (!g) return short(row.count);
      used.add(String(g._id));
      const gf = g.fields.map((sf) => itemFieldToEditor(g, sf));
      if (gf.length > slot) sec.fields = gf; // cho phép: theo cỡ nhóm
      else if (gf.length < slot && allow) sec.fields = gf;
      else sec.fields = [...gf, ...sec.fields.slice(gf.length)]; // thiếu câu: phần còn lại để trống
      sec.passageText = g.passageText || "";
      sec.imageId = g.imageId ? refId(g.imageId) : "";
      if (gf.length < slot && !allow) short(slot - gf.length);
      return;
    }

    const label = fmtLabelOf(row.format);
    let placed = 0;
    for (const it of items) {
      if (!it || it.kind !== "single" || !(it.fields || []).length) continue;
      const idx = sec.fields.findIndex((f) => !f.bankItemId && f.formatLabel === label);
      if (idx < 0) break;
      const old = sec.fields[idx];
      used.add(String(it._id));
      const nf = itemFieldToEditor(it, it.fields[0]);
      const w = nf.__srcEnd && nf.__srcEnd > nf.__src ? nf.__srcEnd - nf.__src : 0;
      nf.id = old.id;
      nf.idEnd = w ? Number(old.id) + w : null; // câu gộp nhiều số giữ độ rộng
      sec.fields[idx] = nf;
      placed++;
    }
    short(row.count - placed);
  });

  let filled = 0;
  let total = 0;
  for (const [sk, def] of Object.entries(skills)) {
    renumberSkill(sk, def.sections, flags);
    for (const sec of def.sections) {
      total += sec.fields.length;
      filled += sec.fields.filter((f) => f.bankItemId).length;
    }
  }
  return { skills, shortages, flags, filled, total };
}

// Câu tóm tắt: "36 of 40 filled, 4 missing: Part 2 — Word form (NB) x3, ...". Rỗng thiếu -> "All 40 questions filled."
export function describeFill(result, max = 6) {
  const { filled, total, shortages, flags } = result;
  const lines = [];
  if (!shortages.length) lines.push(`${filled} of ${total} filled from the bank.`);
  else {
    const missing = shortages.reduce((n, s) => n + s.missing, 0);
    const parts = shortages.slice(0, max).map(
      (s) => `${s.part} — ${fmtLabelOf(s.format) || s.format}${s.difficulty ? " (" + s.difficulty.toUpperCase() + ")" : ""} ×${s.missing}`
    );
    if (shortages.length > max) parts.push(`and ${shortages.length - max} more`);
    lines.push(`${filled} of ${total} filled, ${missing} missing: ${parts.join("; ")}.`);
  }
  for (const f of flags) lines.push(`${f.part}: ${f.message}`);
  return lines;
}

// ---------------------------------------------------------------- Swap

// Mọi bankItemId đang có trong đề (skills = { listening: { sections }, reading: { sections } }) — để loại khi bốc lại.
export function collectBankItemIds(skills) {
  const out = new Set();
  for (const def of Object.values(skills || {})) {
    for (const sec of (def && def.sections) || []) for (const f of sec.fields || []) if (f.bankItemId) out.add(String(f.bankItemId));
  }
  return [...out];
}

// Các chỉ số field của cùng mục ngân hàng với câu (si, fi) trong phần si (nhóm -> cả nhóm, câu lẻ -> chính nó).
export function bankSlotOf(sections, si, fi) {
  const sec = sections[si];
  const f = sec && sec.fields[fi];
  if (!f || !f.bankItemId) return [];
  if (f.bankKind !== "group") return [fi];
  const out = [];
  sec.fields.forEach((x, i) => {
    if (x.bankItemId === f.bankItemId) out.push(i);
  });
  return out;
}

// Thay câu / nhóm tại (si, fi) bằng `item`, giữ số câu và nhãn. Câu lẻ cần mục lẻ cùng độ rộng số;
// nhóm cần nhóm đúng cỡ. -> { sections, flags } hoặc { error }.
export function swapInSections(sections, si, fi, item) {
  const slot = bankSlotOf(sections, si, fi);
  if (!slot.length) return { error: "This question did not come from the bank." };
  if (!item || !(item.fields || []).length) return { error: "No replacement available." };
  const out = structuredClone(sections);
  const sec = out[si];
  const target = sec.fields[fi];
  const flags = [];

  if (target.bankKind === "group") {
    if (item.kind !== "group" || item.fields.length !== slot.length) {
      return { error: `Only a passage with exactly ${slot.length} question${slot.length === 1 ? "" : "s"} can replace this one.` };
    }
    const map = new Map();
    slot.forEach((idx, k) => {
      const old = sec.fields[idx];
      const nf = itemFieldToEditor(item, item.fields[k]);
      map.set(nf.__src, Number(old.id));
      nf.id = old.id;
      nf.idEnd = old.idEnd || null;
      delete nf.__src;
      delete nf.__srcEnd;
      sec.fields[idx] = nf;
    });
    const r = rewriteBlanks(item.passageText || "", map);
    sec.passageText = r.text;
    sec.imageId = item.imageId ? refId(item.imageId) : "";
    for (const n of r.unmatched) flags.push({ part: sec.name, message: `The passage mentions blank (${n}), which matches no question. Check it by hand.` });
    return { sections: out, flags };
  }

  if (item.kind !== "single") return { error: "Only a single question can replace this one." };
  const nf = itemFieldToEditor(item, item.fields[0]);
  const oldW = target.idEnd && Number(target.idEnd) > Number(target.id) ? Number(target.idEnd) - Number(target.id) : 0;
  const newW = nf.__srcEnd && nf.__srcEnd > nf.__src ? nf.__srcEnd - nf.__src : 0;
  if (oldW !== newW) return { error: "That question covers a different range of numbers, so it cannot replace this one." };
  nf.id = target.id;
  nf.idEnd = target.idEnd || null;
  delete nf.__src;
  delete nf.__srcEnd;
  sec.fields[fi] = nf;
  return { sections: out, flags };
}

// Từ danh sách mục server bốc được, chọn mục dùng thay được cho (si, fi); null nếu không có.
export function pickSwapCandidate(items, sections, si, fi) {
  const slot = bankSlotOf(sections, si, fi);
  for (const it of items || []) {
    if (swapInSections(sections, si, fi, it).sections && slot.length) return it;
  }
  return null;
}

// Thân gửi API pick cho Swap: cùng dạng/mức độ/chủ điểm (có thể nới), loại mọi mục đã có trong đề.
export function swapPickBody({ program, level, sections, si, fi, excludeIds, sameDifficulty = true, sameTopic = true }) {
  const slot = bankSlotOf(sections, si, fi);
  const f = sections[si].fields[fi];
  const row = { format: f.bankFormat, count: slot.length };
  if (sameDifficulty && f.difficulty) row.difficulty = f.difficulty;
  if (sameTopic && f.topic) row.topic = f.topic;
  return { program, level, rows: [row], excludeIds: [...new Set((excludeIds || []).map(String))] };
}

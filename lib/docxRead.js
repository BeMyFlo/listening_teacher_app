// Đọc file .docx thành text thuần cho bước AI tách đề (Phase 12 G3).
// Thuần: không AI, không DB. Chỉ dùng lib/zipRead (zlib) — KHÔNG dùng thư viện
// docx ngoài (file người dùng tải lên là dữ liệu không tin được).
// Quy ước đầu ra: gạch chân -> <u>x</u>, đáp án tô màu -> <mark>x</mark>,
// chỗ trống -> ____, ảnh -> [IMG1]… (xem docs/plans/PLAN-PHASE12-G3.md 2.4, 4.2).

const path = require("path");
const { listEntries, readEntry, decodeEntities } = require("./zipRead");

const NOT_DOCX = "This is not a .docx file. In Word choose File → Save As → Word Document (.docx).";
const TOO_LONG = "This file is too long — split it into smaller files (about 40 questions each).";
const MAX_DOC_BYTES = 15 * 1024 * 1024;
const MAX_IMG_BYTES = 2 * 1024 * 1024;
const MAX_IMG_TOTAL = 3 * 1024 * 1024;
const MAX_IMAGES = 20;
const MAX_TEXT = 60000;
const MAX_WARNINGS = 50;

// ---------- tiện ích ----------
function attr(tag, name) {
  const m = new RegExp("(?:^|\\s)" + name + '="([^"]*)"').exec(tag);
  return m ? decodeEntities(m[1]) : null;
}

function detectImage(b) {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 6 && b.toString("latin1", 0, 4) === "GIF8") return "image/gif";
  if (b.length >= 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  return null;
}

// ---------- đánh số tự động ----------
function toLetters(n, upper) {
  let s = "";
  while (n > 0) {
    n--;
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return upper ? s.toUpperCase() : s;
}

function toRoman(n, upper) {
  const map = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
  let s = "";
  for (const [v, r] of map) while (n >= v) { s += r; n -= v; }
  return upper ? s.toUpperCase() : s;
}

function formatNum(n, fmt) {
  switch (fmt) {
    case "upperLetter": return toLetters(n, true);
    case "lowerLetter": return toLetters(n, false);
    case "upperRoman": return toRoman(n, true);
    case "lowerRoman": return toRoman(n, false);
    default: return String(n);
  }
}

function parseNumbering(xml) {
  const abstracts = new Map(); // abstractNumId -> { [ilvl]: { fmt, text, start } }
  const nums = new Map(); // numId -> { abs, starts: { [ilvl]: start } }
  if (!xml) return { abstracts, nums };
  let m;
  const absRe = /<w:abstractNum\b([^>]*)>([\s\S]*?)<\/w:abstractNum>/g;
  while ((m = absRe.exec(xml))) {
    const id = attr(m[1], "w:abstractNumId");
    if (id == null) continue;
    const lvls = {};
    const lvlRe = /<w:lvl\b([^>]*)>([\s\S]*?)<\/w:lvl>/g;
    let lm;
    while ((lm = lvlRe.exec(m[2]))) {
      const il = Number(attr(lm[1], "w:ilvl"));
      if (!Number.isFinite(il)) continue;
      const start = lm[2].match(/<w:start\b([^>]*)\/?>/);
      const fmt = lm[2].match(/<w:numFmt\b([^>]*)\/?>/);
      const txt = lm[2].match(/<w:lvlText\b([^>]*)\/?>/);
      lvls[il] = {
        fmt: fmt ? attr(fmt[1], "w:val") || "decimal" : "decimal",
        text: txt ? attr(txt[1], "w:val") || "" : "%" + (il + 1) + ".",
        start: start ? Number(attr(start[1], "w:val")) || 1 : 1,
      };
    }
    abstracts.set(id, lvls);
  }
  const numRe = /<w:num\b([^>]*)>([\s\S]*?)<\/w:num>/g;
  while ((m = numRe.exec(xml))) {
    const id = attr(m[1], "w:numId");
    const a = m[2].match(/<w:abstractNumId\b([^>]*)\/?>/);
    if (id == null || !a) continue;
    const starts = {};
    const ovRe = /<w:lvlOverride\b([^>]*?)(?:\/>|>([\s\S]*?)<\/w:lvlOverride>)/g;
    let om;
    while ((om = ovRe.exec(m[2]))) {
      const so = (om[2] || "").match(/<w:startOverride\b([^>]*)\/?>/);
      const il = Number(attr(om[1], "w:ilvl"));
      if (so && Number.isFinite(il)) starts[il] = Number(attr(so[1], "w:val")) || 1;
    }
    nums.set(id, { abs: attr(a[1], "w:val"), starts });
  }
  return { abstracts, nums };
}

function makeNumberer(xml) {
  const { abstracts, nums } = parseNumbering(xml);
  const counters = new Map(); // numId -> mảng đếm theo ilvl
  const lvlInfo = (numId, il) => {
    const n = nums.get(numId);
    const base = (n && abstracts.get(n.abs) && abstracts.get(n.abs)[il]) || {
      fmt: "decimal", text: "%" + (il + 1) + ".", start: 1,
    };
    const start = n && n.starts[il] != null ? n.starts[il] : base.start;
    return { ...base, start };
  };
  return function prefix(numId, il) {
    if (!nums.has(numId)) return "";
    let c = counters.get(numId);
    if (!c) counters.set(numId, (c = []));
    c[il] = c[il] === undefined ? lvlInfo(numId, il).start : c[il] + 1;
    c.length = il + 1; // reset cấp dưới
    const info = lvlInfo(numId, il);
    if (info.fmt === "none") return "";
    if (!["decimal", "decimalZero", "ordinal", "upperLetter", "lowerLetter", "upperRoman", "lowerRoman"].includes(info.fmt)) {
      return "- ";
    }
    const text = info.text.replace(/%([1-9])/g, (_, k) => {
      const l = Number(k) - 1;
      const li = lvlInfo(numId, l);
      const v = c[l] === undefined ? li.start : c[l];
      return formatNum(v, li.fmt);
    });
    return text ? text + " " : "";
  };
}

// ---------- dựng dòng từ các đoạn run ----------
function wrap(tag, inner) {
  if (!inner.trim()) return inner;
  const lead = inner.match(/^\s*/)[0];
  const trail = inner.slice(lead.length).match(/\s*$/)[0];
  const core = inner.slice(lead.length, inner.length - trail.length);
  return `${lead}<${tag}>${core}</${tag}>${trail}`;
}

function isBlankText(t) {
  const s = t.replace(/\s+/g, "");
  return s === "" || /^(_+|…+|\.{3,})$/.test(s);
}

// Gộp các run gạch chân liền nhau thành 1 thẻ <u>; run gạch chân rỗng -> ____.
function renderU(group) {
  let out = "";
  let i = 0;
  while (i < group.length) {
    const s = group[i];
    if (s.u && !s.raw) {
      let j = i;
      let text = "";
      while (j < group.length && group[j].u && !group[j].raw) text += group[j++].text;
      out += isBlankText(text) ? "____" : wrap("u", text);
      i = j;
    } else {
      out += s.text;
      i++;
    }
  }
  return out;
}

function render(segs) {
  let out = "";
  let i = 0;
  while (i < segs.length) {
    const mark = !!segs[i].mark;
    let j = i;
    while (j < segs.length && !!segs[j].mark === mark) j++;
    const inner = renderU(segs.slice(i, j));
    out += mark ? wrap("mark", inner) : inner;
    i = j;
  }
  return out;
}

function normalizeBlanks(line) {
  return line.replace(/_{3,}/g, "____").replace(/…{2,}/g, "____").replace(/\.{4,}/g, "____");
}

// ---------- chính ----------
function readDocx(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4) throw new Error(NOT_DOCX);
  if (buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0) throw new Error(NOT_DOCX);

  let entries;
  try {
    entries = listEntries(buf);
  } catch {
    throw new Error(NOT_DOCX);
  }
  const byName = new Map(entries.map((e) => [e.name, e]));
  if (!byName.has("word/document.xml")) throw new Error(NOT_DOCX);
  const readText = (name, max) => {
    const e = byName.get(name);
    return e ? readEntry(buf, e, { maxBytes: max }).toString("utf8") : "";
  };

  let xml = readText("word/document.xml", MAX_DOC_BYTES);
  // Bỏ mc:Fallback (giữ mc:Choice) để textbox/ảnh không bị lặp.
  xml = xml.replace(/<mc:Fallback\b[^>]*\/>/g, "").replace(/<mc:Fallback\b[^>]*>[\s\S]*?<\/mc:Fallback>/g, "");

  const rels = {};
  const relRe = /<Relationship\b([^>]*)\/?>/g;
  let rm;
  const relsXml = readText("word/_rels/document.xml.rels", 2 * 1024 * 1024);
  while ((rm = relRe.exec(relsXml))) {
    const id = attr(rm[1], "Id");
    const target = attr(rm[1], "Target");
    if (id && target) rels[id] = target;
  }
  const nextPrefix = makeNumberer(readText("word/numbering.xml", 5 * 1024 * 1024));

  const warnings = [];
  const warn = (s) => { if (warnings.length < MAX_WARNINGS) warnings.push(s); };
  const images = [];
  let imgCount = 0;
  let imgTotal = 0;

  function addImage(rid) {
    const n = ++imgCount;
    const marker = `[IMG${n}]`;
    const target = rid && rels[rid];
    if (!target) { warn(`Image ${n} was not found in the file — add it by hand.`); return marker; }
    const name = path.posix.normalize(target.startsWith("/") ? target.slice(1) : "word/" + target);
    const e = byName.get(name);
    if (!e) { warn(`Image ${n} was not found in the file — add it by hand.`); return marker; }
    if (images.length >= MAX_IMAGES) { warn(`Image ${n} was skipped (more than ${MAX_IMAGES} images) — add it by hand.`); return marker; }
    let data;
    try {
      data = readEntry(buf, e, { maxBytes: MAX_IMG_BYTES });
    } catch {
      warn(`Image ${n} is larger than 2 MB — add it by hand.`);
      return marker;
    }
    const mimeType = detectImage(data);
    if (!mimeType) { warn(`Image ${n} is in a format the app can't show (EMF/WMF) — add it by hand.`); return marker; }
    if (imgTotal + data.length > MAX_IMG_TOTAL) { warn(`Image ${n} was skipped (images are over 3 MB in total) — add it by hand.`); return marker; }
    imgTotal += data.length;
    images.push({ ref: `IMG${n}`, name: path.posix.basename(name), mimeType, buffer: data });
    return marker;
  }

  const lines = [];
  const sinks = [lines]; // nơi nhận dòng: gốc hoặc đoạn trong ô bảng
  const trStack = [];
  const pStack = [];
  let chg = 0; // đang trong *PrChange (thay đổi theo dõi) -> bỏ qua thuộc tính
  let mathDepth = 0;
  let inT = false, tPreserve = false, tBuf = "";

  function emit(p) {
    let text = render(p.segs);
    if (p.prefix && text.trim()) text = p.prefix + text;
    p.prefix = "";
    p.segs = [];
    sinks[sinks.length - 1].push(text);
  }

  const tagRe = /<([^>]*)>|([^<]+)/g;
  let tm;
  while ((tm = tagRe.exec(xml))) {
    if (tm[2] !== undefined) {
      if (inT) tBuf += tm[2];
      continue;
    }
    const t = tm[1];
    if (!t || t[0] === "?" || t[0] === "!") continue;
    const closing = t[0] === "/";
    const self = t[t.length - 1] === "/";
    const name = t.replace(/^\//, "").split(/[\s/]/)[0];
    const p = pStack[pStack.length - 1];
    const run = p && p.run;

    if (/^w:\w*PrChange$/.test(name)) { if (!self) chg += closing ? -1 : 1; continue; }
    if (name === "m:oMath") { if (!self) mathDepth += closing ? -1 : 1; continue; }

    switch (name) {
      case "w:p":
        if (!closing) {
          // Đoạn lồng (textbox): đưa nốt phần đã có của đoạn ngoài ra trước.
          if (p && p.segs.length) emit(p);
          pStack.push({ segs: [], run: null, prefix: "", num: null });
          if (self) emit(pStack.pop());
        } else if (p) {
          emit(pStack.pop());
        }
        break;
      case "w:numPr":
        if (p && !chg) {
          if (!closing) p.num = { id: null, il: 0 };
          else if (p.num) {
            if (p.num.id && p.num.id !== "0") p.prefix = nextPrefix(p.num.id, p.num.il);
            p.num = null;
          }
        }
        break;
      case "w:ilvl":
        if (p && p.num && !closing) p.num.il = Number(attr(t, "w:val")) || 0;
        break;
      case "w:numId":
        if (p && p.num && !closing) p.num.id = attr(t, "w:val");
        break;
      case "w:r":
        if (p && !closing) {
          p.run = self ? null : { u: false, mark: false, parts: [], inRPr: false };
        } else if (p && closing && p.run) {
          const r = p.run;
          p.run = null;
          let text = "";
          const flush = () => {
            if (text) p.segs.push({ text, u: r.u, mark: r.mark });
            text = "";
          };
          for (const part of r.parts) {
            if (part.marker) { flush(); p.segs.push({ text: part.marker, raw: true }); }
            else text += part.text;
          }
          flush();
        }
        break;
      case "w:rPr":
        if (run && !chg && !self) run.inRPr = !closing;
        break;
      case "w:u":
        if (run && run.inRPr && !chg && !closing && attr(t, "w:val") !== "none") run.u = true;
        break;
      case "w:highlight":
        if (run && run.inRPr && !chg && !closing && attr(t, "w:val") !== "none") run.mark = true;
        break;
      case "w:shd":
        if (run && run.inRPr && !chg && !closing) {
          const f = (attr(t, "w:fill") || "auto").toLowerCase();
          if (f !== "auto" && f !== "ffffff") run.mark = true;
        }
        break;
      case "w:color":
        if (run && run.inRPr && !chg && !closing) {
          const c = (attr(t, "w:val") || "auto").toLowerCase();
          if (c !== "auto" && c !== "000000") run.mark = true;
        }
        break;
      case "w:t":
        if (closing) {
          if (inT && run && !mathDepth) {
            run.parts.push({ text: decodeEntities(tPreserve ? tBuf : tBuf.trim()) });
          }
          inT = false;
          tBuf = "";
        } else if (!self) {
          inT = true;
          tBuf = "";
          tPreserve = attr(t, "xml:space") === "preserve";
        }
        break;
      case "w:tab":
        if (run && !run.inRPr && !closing) run.parts.push({ text: "\t" });
        break;
      case "w:br": {
        const ty = attr(t, "w:type");
        if (run && !closing && ty !== "page" && ty !== "column") run.parts.push({ text: "\n" });
        break;
      }
      case "w:cr":
        if (run && !closing) run.parts.push({ text: "\n" });
        break;
      case "w:noBreakHyphen":
        if (run && !closing) run.parts.push({ text: "-" });
        break;
      case "a:blip":
      case "v:imagedata": {
        if (closing || !p) break;
        const rid = name === "a:blip" ? attr(t, "r:embed") : attr(t, "r:id");
        if (name === "a:blip" && !rid) break; // ảnh liên kết ngoài (r:link) — bỏ
        const marker = addImage(rid);
        if (run) run.parts.push({ marker });
        else p.segs.push({ text: marker, raw: true });
        break;
      }
      case "w:tr":
        if (!closing) {
          if (!self) trStack.push({ cells: [] });
        } else {
          const tr = trStack.pop();
          if (tr) sinks[sinks.length - 1].push(tr.cells.join(" | "));
        }
        break;
      case "w:tc":
        if (!closing) {
          if (!self) sinks.push([]);
        } else if (sinks.length > 1) {
          const parts = sinks.pop();
          const tr = trStack[trStack.length - 1];
          const cell = parts.map((s) => s.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean).join(" ");
          if (tr) tr.cells.push(cell);
        }
        break;
      default:
    }
  }

  const text = lines
    .join("\n")
    .split("\n")
    .map((l) => normalizeBlanks(l).replace(/[ \t]+$/, ""))
    .filter((l, i, a) => !(l === "" && (i === 0 || a[i - 1] === "")))
    .join("\n")
    .trim();
  if (text.length > MAX_TEXT) throw new Error(TOO_LONG);
  return { text, images, warnings };
}

module.exports = { readDocx };

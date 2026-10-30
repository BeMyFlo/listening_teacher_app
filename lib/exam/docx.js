// Xuất đề / đáp án ra Word (.docx) — Phase 12 G4 bước 4 (D8). OOXML tối giản tự viết + lib/zipWrite.js.
// Hàm thuần: nhận dữ liệu đã trộn (shuffleExam) + ảnh đã tải sẵn, trả Buffer. Mọi chữ của giáo viên được escape XML.
const { parseUnderline } = require("../underline");
const { underlineModeOf } = require("../generalFormats");
const { writeZip } = require("../zipWrite");

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

const MAX_IMG_W = 5040000; // 14 cm theo EMU
const MAX_IMG_H = 2880000; // 8 cm
const MISSING = "[image missing]";
const BLANK_RE = /_{3,}|\.{4,}|…/;

// ---------------------------------------------------------------- XML an toàn

// Bỏ ký tự điều khiển không hợp lệ trong XML 1.0 + surrogate lẻ.
function clean(s) {
  const str = String(s == null ? "" : s);
  let out = "";
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const n = str.charCodeAt(i + 1);
      if (n >= 0xdc00 && n <= 0xdfff) {
        out += str[i] + str[i + 1];
        i++;
      }
      continue; // surrogate lẻ: bỏ
    }
    if (c >= 0xdc00 && c <= 0xdfff) continue;
    if (c === 9 || c === 10 || c === 13 || (c >= 0x20 && c <= 0xfffd)) out += str[i];
  }
  return out;
}

function esc(s) {
  return clean(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// ---------------------------------------------------------------- ảnh

function detectImage(b) {
  if (!Buffer.isBuffer(b)) return null;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", mime: "image/png" };
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpeg", mime: "image/jpeg" };
  if (b.length >= 6 && b.toString("latin1", 0, 4) === "GIF8") return { ext: "gif", mime: "image/gif" };
  return null; // WebP và định dạng khác: Word cũ không mở được
}

function imageSize(b, ext) {
  try {
    if (ext === "png" && b.length >= 24) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    if (ext === "gif" && b.length >= 10) return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
    if (ext === "jpeg") {
      let p = 2;
      while (p + 9 < b.length) {
        if (b[p] !== 0xff) {
          p++;
          continue;
        }
        const m = b[p + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(p + 7), h: b.readUInt16BE(p + 5) };
        p += 2 + b.readUInt16BE(p + 2);
      }
    }
  } catch {
    // rơi xuống mặc định
  }
  return { w: 4, h: 3 };
}

// ---------------------------------------------------------------- khối XML nhỏ

function runXml(text, o = {}) {
  const props =
    (o.b ? "<w:b/>" : "") + (o.i ? "<w:i/>" : "") + (o.sz ? `<w:sz w:val="${o.sz}"/>` : "") + (o.u ? '<w:u w:val="single"/>' : "");
  const rPr = props ? `<w:rPr>${props}</w:rPr>` : "";
  // \n -> xuống dòng, \t -> tab
  const pieces = clean(text).split(/(\n|\t)/);
  let out = "";
  for (const p of pieces) {
    if (p === "\n") out += `<w:r>${rPr}<w:br/></w:r>`;
    else if (p === "\t") out += `<w:r>${rPr}<w:tab/></w:r>`;
    else if (p !== "") out += `<w:r>${rPr}<w:t xml:space="preserve">${esc(p)}</w:t></w:r>`;
  }
  return out;
}

// Chữ có thể có gạch chân `__x__` (và <u>x</u>). underline=false: giữ nguyên chữ.
function richRuns(text, underline, o = {}) {
  const t = String(text == null ? "" : text);
  if (!underline) return runXml(t, o);
  const norm = t.replace(/<u>(.*?)<\/u>/gi, "__$1__");
  return parseUnderline(norm)
    .map((s) => runXml(s.text, { ...o, u: !!s.u }))
    .join("");
}

function para(inner, o = {}) {
  const ppr =
    (o.keepNext ? "<w:keepNext/>" : "") +
    (o.tabs ? `<w:tabs>${o.tabs.map((p) => `<w:tab w:val="left" w:pos="${p}"/>`).join("")}</w:tabs>` : "") +
    `<w:spacing w:before="${o.before || 0}" w:after="${o.after == null ? 80 : o.after}"/>` +
    (o.ind ? `<w:ind w:left="${o.ind}"/>` : "") +
    (o.align ? `<w:jc w:val="${o.align}"/>` : "");
  return `<w:p><w:pPr>${ppr}</w:pPr>${inner}</w:p>`;
}

const textPara = (text, o = {}) => para(runXml(text, o), o);

// ---------------------------------------------------------------- bối cảnh dựng (ảnh)

function makeCtx(imagesByUrl) {
  return { images: imagesByUrl || {}, media: [], relByUrl: new Map(), rels: [], drawId: 0 };
}

// Đoạn chứa ảnh nhúng; thiếu / sai định dạng -> "[image missing]".
function imageParagraph(ctx, url, o = {}) {
  if (!url) return "";
  const entry = ctx.images[url];
  const buf = entry && (Buffer.isBuffer(entry) ? entry : entry.buffer);
  const kind = detectImage(buf);
  if (!kind) return textPara(MISSING, { i: true, ind: o.ind });
  let rel = ctx.relByUrl.get(url);
  if (!rel) {
    const n = ctx.media.length + 1;
    rel = { rId: "rIdImg" + n, name: `media/image${n}.${kind.ext}` };
    ctx.relByUrl.set(url, rel);
    ctx.media.push({ path: "word/" + rel.name, buffer: buf });
    ctx.rels.push(`<Relationship Id="${rel.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${rel.name}"/>`);
  }
  const { w, h } = imageSize(buf, kind.ext);
  let cx = Math.min(MAX_IMG_W, Math.max(1, w) * 9525); // 96 dpi
  let cy = Math.round((cx * Math.max(1, h)) / Math.max(1, w));
  if (cy > MAX_IMG_H) {
    cx = Math.round((cx * MAX_IMG_H) / cy);
    cy = MAX_IMG_H;
  }
  const id = ++ctx.drawId;
  const drawing =
    `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:docPr id="${id}" name="Picture ${id}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="image${id}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rel.rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  return para(drawing, { ind: o.ind, after: 100 });
}

// ---------------------------------------------------------------- đầu đề

function header(meta, subtitle) {
  const m = meta || {};
  const out = [];
  out.push(textPara("", { after: 0 })); // dòng trường / sở: để trống cho giáo viên điền
  out.push(textPara(String(m.title || "Test"), { b: true, sz: 32, align: "center", after: 60 }));
  if (subtitle) out.push(textPara(subtitle, { b: true, sz: 26, align: "center", after: 60 }));
  const line = `Grade: ${m.grade || "____"}     Time: ${m.time || "____"}     Code: ${m.code || "____"}`;
  out.push(textPara(line, { align: "center", after: 120 }));
  out.push(textPara("Name: ______________________________     Class: ____________", { after: 200 }));
  return out;
}

// ---------------------------------------------------------------- câu hỏi

function optionLines(q, uOpts) {
  const items = q.options.map((o) => ({ letter: o.letter, label: o.label }));
  const text = (it) => (it.label && it.label !== it.letter ? `${it.letter}. ${it.label}` : `${it.letter}.`);
  const maxLen = Math.max(...items.map((it) => String(it.label || "").length));
  const per = items.length <= 4 && maxLen <= 14 ? items.length : maxLen <= 38 ? 2 : 1;
  const tabs = per === 1 ? null : per === 2 ? [4800] : [2400, 4800, 7200];
  const out = [];
  for (let i = 0; i < items.length; i += per) {
    const row = items.slice(i, i + per);
    const inner = row
      .map((it, k) => {
        const lead = k > 0 ? runXml("\t") : "";
        if (!(it.label && it.label !== it.letter)) return lead + runXml(text(it));
        return lead + runXml(`${it.letter}. `) + richRuns(it.label, uOpts);
      })
      .join("");
    out.push(para(inner, { ind: 360, after: 40, tabs }));
  }
  return out;
}

function questionXml(ctx, q) {
  const mode = underlineModeOf(q.formatLabel);
  const num = q.numberEnd ? `${q.number}-${q.numberEnd}.` : `${q.number}.`;
  const out = [];
  const hasBlank = BLANK_RE.test(q.label) || BLANK_RE.test(q.pre) || BLANK_RE.test(q.post);

  out.push(para(runXml(num + " ", { b: true }) + richRuns(q.label, mode === "label"), { after: 40, keepNext: true }));
  if (q.imageUrl) out.push(imageParagraph(ctx, q.imageUrl, { ind: 360 }));
  if (q.type === "fill" && (q.pre || q.post)) {
    const mid = hasBlank ? " " : " .......................... ";
    out.push(textPara(`${q.pre}${mid}${q.post}`.trim(), { ind: 360, after: 40 }));
  }
  if (q.tokens && q.tokens.length) out.push(textPara(q.tokens.join("  /  "), { ind: 360, after: 40 }));
  if (q.hint) out.push(textPara(`(${q.hint})`, { i: true, ind: 360, after: 40 }));
  if (q.type === "choice" && q.options.length) out.push(...optionLines(q, mode === "options"));
  if (q.type === "fill" && !hasBlank) {
    out.push(textPara("..............................................................................................", { ind: 360, after: 80 }));
  }
  out.push(textPara("", { after: 60 }));
  return out.join("");
}

function partXml(ctx, part) {
  const out = [];
  if (part.name) out.push(textPara(part.name, { b: true, sz: 26, before: 160, after: 80, keepNext: true }));
  if (part.skill === "listening") out.push(textPara("Listening: audio not included", { i: true, after: 80 }));
  if (part.imageUrl) out.push(imageParagraph(ctx, part.imageUrl));
  if (part.passageText) {
    for (const line of String(part.passageText).split(/\n+/)) {
      if (line.trim()) out.push(para(richRuns(line, true), { after: 80 }));
    }
  }
  if (part.matchOptions && part.matchOptions.length) {
    for (const o of part.matchOptions) out.push(textPara(`${o.letter}. ${o.label}`, { ind: 360, after: 20 }));
  }
  for (const q of part.questions) out.push(questionXml(ctx, q));
  return out.join("");
}

function promptsXml(ctx, prompts) {
  const out = [];
  const seen = new Set();
  for (const p of prompts || []) {
    if (!seen.has(p.skill)) {
      seen.add(p.skill);
      out.push(textPara(p.skill === "speaking" ? "Speaking" : "Writing", { b: true, sz: 26, before: 240, after: 80, keepNext: true }));
    }
    if (p.title) out.push(textPara(p.title, { b: true, after: 40 }));
    if (p.imageUrl) out.push(imageParagraph(ctx, p.imageUrl));
    for (const line of String(p.instructions || "").split(/\n+/)) if (line.trim()) out.push(textPara(line, { after: 60 }));
    if (p.skill !== "speaking") {
      for (let i = 0; i < 8; i++) out.push(textPara("..............................................................................................", { after: 100 }));
    }
  }
  return out.join("");
}

// ---------------------------------------------------------------- đóng gói

const SECT =
  '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>';

const STYLES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
  `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/>` +
  `<w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;

function pack(ctx, bodyXml) {
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${bodyXml}${SECT}</w:body></w:document>`;
  const exts = new Set(ctx.media.map((m) => m.path.split(".").pop()));
  const defaults =
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
    (exts.has("png") ? '<Default Extension="png" ContentType="image/png"/>' : "") +
    (exts.has("jpeg") ? '<Default Extension="jpeg" ContentType="image/jpeg"/>' : "") +
    (exts.has("gif") ? '<Default Extension="gif" ContentType="image/gif"/>' : "");
  const types =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${defaults}` +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>';
  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  const docRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    ctx.rels.join("") +
    "</Relationships>";
  const files = {
    "[Content_Types].xml": types,
    "_rels/.rels": rootRels,
    "word/document.xml": doc,
    "word/_rels/document.xml.rels": docRels,
    "word/styles.xml": STYLES,
  };
  for (const m of ctx.media) files[m.path] = m.buffer;
  return writeZip(files);
}

// exam = { parts, answers, prompts? } (shuffleExam + prompts); meta = { title, grade, time, code }
function renderExamDocx(exam, meta, imagesByUrl) {
  const ctx = makeCtx(imagesByUrl);
  const body = header(meta).join("") + (exam.parts || []).map((p) => partXml(ctx, p)).join("") + promptsXml(ctx, exam.prompts);
  return pack(ctx, body);
}

const SKILL_TITLES = { listening: "Listening", reading: "Reading" };

function renderAnswerKeyDocx(exam, meta) {
  const ctx = makeCtx({});
  const out = header(meta, "Answer key");
  const answers = exam.answers || [];
  if (!answers.length) out.push(textPara("This test has no auto-graded questions.", { i: true }));
  for (const skill of ["listening", "reading"]) {
    const list = answers.filter((a) => a.skill === skill);
    if (!list.length) continue;
    out.push(textPara(SKILL_TITLES[skill], { b: true, sz: 26, before: 160, after: 80, keepNext: true }));
    const short = list.every((a) => String(a.answer).length <= 6);
    if (short) {
      for (let i = 0; i < list.length; i += 5) {
        const row = list.slice(i, i + 5);
        const inner = row.map((a, k) => (k ? runXml("\t") : "") + runXml(`${a.number}. `, { b: true }) + runXml(String(a.answer))).join("");
        out.push(para(inner, { tabs: [1800, 3600, 5400, 7200], after: 60 }));
      }
    } else {
      for (const a of list) out.push(para(runXml(`${a.number}. `, { b: true }) + runXml(String(a.answer)), { after: 40, ind: 360 }));
    }
  }
  return pack(ctx, out.join(""));
}

module.exports = { renderExamDocx, renderAnswerKeyDocx, clean, esc, detectImage, imageSize, MISSING };

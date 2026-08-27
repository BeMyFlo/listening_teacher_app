// Đọc file .xlsx (ZIP chứa XML) chỉ bằng module `zlib` có sẵn của Node —
// KHÔNG dùng thư viện "xlsx" (đang có lỗ hổng prototype pollution + ReDoS
// chưa vá, rủi ro thật vì đây là chỗ nhận file người dùng). Chỉ hỗ trợ
// đúng những gì cần: đọc từng sheet thành mảng 2 chiều chuỗi.

const zlib = require("zlib");

// ---------- ZIP tối giản (không ZIP64 — file xlsx bài tập luôn nhỏ) ----------
function unzip(buf) {
  const files = {};
  // Tìm End Of Central Directory: quét ngược tìm chữ ký PK\x05\x06.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 65536; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Invalid .xlsx file (ZIP central directory not found)");

  const entries = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);

  for (let n = 0; n < entries; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;

    // Local header -> vị trí data
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    files[name] = method === 0 ? raw : zlib.inflateRawSync(raw);
  }
  return files;
}

// ---------- XML tối giản ----------
function decodeEntities(s) {
  return String(s).replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (m, e) => {
    if (e === "amp") return "&";
    if (e === "lt") return "<";
    if (e === "gt") return ">";
    if (e === "quot") return '"';
    if (e === "apos") return "'";
    if (e[0] === "#") {
      const code = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return m;
  });
}

// Lấy toàn bộ text trong các thẻ <t>…</t> của 1 đoạn XML.
function extractText(xml) {
  let out = "";
  const re = /<t[^>]*>([\s\S]*?)<\/t>/g;
  let m;
  while ((m = re.exec(xml))) out += decodeEntities(m[1]);
  return out;
}

function parseSharedStrings(xml) {
  const list = [];
  if (!xml) return list;
  const re = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = re.exec(xml))) list.push(extractText(m[1]));
  return list;
}

function colIndex(ref) {
  const letters = String(ref).replace(/[^A-Za-z]/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.toUpperCase().charCodeAt(0) - 64);
  return n - 1;
}

function parseSheet(xml, shared) {
  const rows = [];
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let rm;
  while ((rm = rowRe.exec(xml))) {
    const cells = {};
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm;
    while ((cm = cellRe.exec(rm[1]))) {
      const attrs = cm[1] || "";
      const body = cm[2] || "";
      const rMatch = attrs.match(/\br="([A-Z]+)\d+"/);
      const tMatch = attrs.match(/\bt="([^"]+)"/);
      const idx = rMatch ? colIndex(rMatch[1]) : Object.keys(cells).length;
      const t = tMatch ? tMatch[1] : "n";
      let val = "";
      if (t === "s") {
        const v = body.match(/<v>([\s\S]*?)<\/v>/);
        val = v ? shared[Number(v[1])] || "" : "";
      } else if (t === "inlineStr") {
        val = extractText(body);
      } else {
        const v = body.match(/<v>([\s\S]*?)<\/v>/);
        val = v ? decodeEntities(v[1]) : "";
      }
      cells[idx] = val;
    }
    const max = Object.keys(cells).length ? Math.max(...Object.keys(cells).map(Number)) : -1;
    rows.push(Array.from({ length: max + 1 }, (_, i) => cells[i] || ""));
  }
  return rows;
}

// Đọc các thuộc tính của 1 thẻ mở/tự đóng — không phụ thuộc thứ tự.
function tagAttrs(tag) {
  const out = {};
  const re = /([\w:.-]+)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(tag))) out[m[1]] = decodeEntities(m[2]);
  return out;
}

// Trả về { [tenSheet]: rows[][] }
function readWorkbook(buf) {
  const files = unzip(buf);
  const dec = (name) => (files[name] ? files[name].toString("utf8") : "");

  const shared = parseSharedStrings(dec("xl/sharedStrings.xml"));

  const wbXml = dec("xl/workbook.xml");
  const relsXml = dec("xl/_rels/workbook.xml.rels");

  const rels = {};
  let rm;
  const relRe = /<Relationship\b([^>]*)\/?>/g;
  while ((rm = relRe.exec(relsXml))) {
    const a = tagAttrs(rm[1]);
    if (a.Id && a.Target) rels[a.Id] = a.Target.replace(/^\/?xl\//, "").replace(/^\//, "");
  }

  const sheets = {};
  const sheetRe = /<sheet\b([^>]*)\/?>/g;
  let sm;
  while ((sm = sheetRe.exec(wbXml))) {
    const a = tagAttrs(sm[1]);
    const rid = a["r:id"] || a["id"];
    if (!a.name || !rid) continue;
    const target = rels[rid] || "";
    const xml = dec("xl/" + target) || dec(target);
    if (xml) sheets[a.name] = parseSheet(xml, shared);
  }
  return sheets;
}

module.exports = { readWorkbook };

// Đọc file .xlsx (ZIP chứa XML) chỉ bằng module `zlib` có sẵn của Node —
// KHÔNG dùng thư viện "xlsx" (đang có lỗ hổng prototype pollution + ReDoS
// chưa vá, rủi ro thật vì đây là chỗ nhận file người dùng). Chỉ hỗ trợ
// đúng những gì cần: đọc từng sheet thành mảng 2 chiều chuỗi.

const { listEntries, readEntry, decodeEntities } = require("./zipRead");

const MAX_ENTRY_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

// ---------- XML tối giản ----------
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
  const entries = listEntries(buf);
  const byName = new Map(entries.map((e) => [e.name, e]));
  // Trần tổng: nhiều sheet (hoặc nhiều <sheet> trỏ cùng 1 file) không được cộng dồn quá MAX_TOTAL_BYTES.
  let budget = MAX_TOTAL_BYTES;
  const dec = (name) => {
    const e = byName.get(name);
    if (!e) return "";
    if (budget <= 0) throw new Error("File is too large after decompression");
    const data = readEntry(buf, e, { maxBytes: Math.min(MAX_ENTRY_BYTES, budget) });
    budget -= data.length;
    return data.toString("utf8");
  };

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

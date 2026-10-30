// Đọc ZIP tối giản chỉ bằng `zlib` — dùng cho .xlsx và .docx (file người dùng
// tải lên = dữ liệu không tin được). Không ZIP64. Chặn zip bomb: kiểm size
// khai báo trước khi giải nén và giới hạn dung lượng sau giải nén.

const zlib = require("zlib");

const MAX_ENTRIES = 2000;
const TOO_LARGE = "File is too large after decompression";

function listEntries(buf) {
  // Tìm End Of Central Directory: quét ngược tìm chữ ký PK\x05\x06.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 65536; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Invalid file (ZIP central directory not found)");

  const count = buf.readUInt16LE(eocd + 10);
  if (count > MAX_ENTRIES) throw new Error("Invalid file (too many entries in ZIP)");
  let p = buf.readUInt32LE(eocd + 16);

  const entries = [];
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const offset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    entries.push({ name, method, compSize, size, offset });
  }
  return entries;
}

function readEntry(buf, entry, { maxBytes = 20 * 1024 * 1024 } = {}) {
  if (entry.size > maxBytes) throw new Error(TOO_LARGE);
  const off = entry.offset;
  if (off + 30 > buf.length || buf.readUInt32LE(off) !== 0x04034b50) {
    throw new Error("Invalid file (bad ZIP entry)");
  }
  const dataStart = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
  const raw = buf.subarray(dataStart, dataStart + entry.compSize);
  if (entry.method === 0) {
    if (raw.length > maxBytes) throw new Error(TOO_LARGE);
    return raw;
  }
  if (entry.method === 8) {
    try {
      return zlib.inflateRawSync(raw, { maxOutputLength: maxBytes });
    } catch (e) {
      if (e instanceof RangeError || e.code === "ERR_BUFFER_TOO_LARGE") throw new Error(TOO_LARGE);
      throw new Error("Invalid file (cannot decompress ZIP entry)");
    }
  }
  throw new Error("Invalid file (unsupported ZIP compression)");
}

// Đọc 1 entry theo tên thành chuỗi UTF-8; thiếu -> "".
function readText(buf, entries, name, maxBytes) {
  const e = entries.find((x) => x.name === name);
  return e ? readEntry(buf, e, { maxBytes }).toString("utf8") : "";
}

function decodeEntities(s) {
  return String(s).replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (m, e) => {
    if (e === "amp") return "&";
    if (e === "lt") return "<";
    if (e === "gt") return ">";
    if (e === "quot") return '"';
    if (e === "apos") return "'";
    if (e[0] === "#") {
      const code = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try {
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      } catch {
        return m;
      }
    }
    return m;
  });
}

module.exports = { listEntries, readEntry, readText, decodeEntities, MAX_ENTRIES };

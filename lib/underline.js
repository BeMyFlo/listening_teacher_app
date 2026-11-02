// Gạch chân trong đề / lựa chọn (Phase 12 G1, mục 3.1): `__chữ__` = gạch chân.
// CommonJS thuần, dùng chung server + client. "____" (chỗ trống, 4+ gạch dưới)
// KHÔNG phải gạch chân.

// Phần bên trong: ít nhất 1 ký tự khác "_", không xuống dòng, không chứa "__".
// Dấu mở/đóng không được dính thêm "_" ngoài (để "____" không khớp).
// KHÔNG dùng lookbehind (cú pháp "?<!" / "?<=" trong regex): file này chạy trong trang làm bài của MỌI học sinh, và Safari
// iOS < 16.4 báo lỗi cú pháp với lookbehind -> cả trang không tải được. Thay bằng nhóm
// `(^|[^_])` bắt ký tự đứng trước rồi trừ ra khỏi vị trí khớp.
const UNDERLINE_RE = /(^|[^_])__(?!_)([^\n_]+(?:_[^\n_]+)*)__(?!_)/g;

// "h__ea__d" → [{text:"h",u:false},{text:"ea",u:true},{text:"d",u:false}]
function parseUnderline(text) {
  if (typeof text !== "string" || text === "") return [];
  const out = [];
  let last = 0;
  const re = new RegExp(UNDERLINE_RE.source, "g");
  let m;
  while ((m = re.exec(text)) !== null) {
    const start = m.index + m[1].length;
    if (start > last) out.push({ text: text.slice(last, start), u: false });
    out.push({ text: m[2], u: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), u: false });
  return out;
}

// Bỏ dấu "__", giữ nguyên phần còn lại.
function stripUnderline(text) {
  if (typeof text !== "string") return "";
  return parseUnderline(text).map((s) => s.text).join("");
}

// Các phần gạch chân theo thứ tự xuất hiện (dùng cho dạng tìm lỗi sai).
function underlinedParts(text) {
  return parseUnderline(text).filter((s) => s.u).map((s) => s.text);
}

function hasUnderline(text) {
  return underlinedParts(text).length > 0;
}

module.exports = { parseUnderline, stripUnderline, underlinedParts, hasUnderline };

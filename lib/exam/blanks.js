// Viết lại số chỗ trống trong đoạn văn (CommonJS thuần, dùng chung builder + xuất đề).

// Viết lại số chỗ trống trong đoạn văn: "(21)", "[21]", "___21___", "21......" -> số mới theo `map` (cũ -> mới).
// Chỗ trống không có trong map -> không đoán, đưa vào `unmatched`.
// Không dùng lookbehind (client cũ); "21." trơn KHÔNG coi là chỗ trống.
function rewriteBlanks(text, map) {
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

module.exports = { rewriteBlanks };

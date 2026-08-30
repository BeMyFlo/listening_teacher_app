// Bộ render Markdown rút gọn cho nội dung lý thuyết (Theory Content của mỗi kỹ
// năng). An toàn: mọi văn bản đều escape HTML trước khi ghép, chỉ sinh ra một
// tập thẻ cố định. Cặp với toolbar trong components/teacher/TheoryEditor.js và
// CSS .lesson-text.
//
// Cú pháp hỗ trợ:
//   # H1        ## H2        ### H3
//   - bullet    * bullet     1. numbered
//   > blockquote
//   ---         (đường kẻ ngang)
//   **đậm**   *nghiêng*  _nghiêng_   `code`
//   ==tô sáng==   ==tô sáng=={green|blue|pink|red}   (không suffix = vàng)
//   [chữ](https://link)
//   Dòng trống = đoạn mới; xuống dòng đơn trong đoạn = <br>.

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Nhận văn bản THÔ của 1 dòng/đoạn -> escape rồi áp inline formatting.
function inline(rawText) {
  let s = escapeHtml(rawText);
  // `code` trước để nội dung bên trong không bị bold/italic.
  s = s.replace(/`([^`]+?)`/g, (_, c) => `<code>${c}</code>`);
  // [chữ](url) — chỉ nhận http/https, còn lại giữ nguyên chữ.
  s = s.replace(/\[([^\]]+?)\]\(([^)\s]+?)\)/g, (m, label, url) => {
    if (!/^https?:\/\//i.test(url)) return label;
    const safe = url.replace(/"/g, "%22");
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  s = s.replace(/\*\*([^\n]+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^\n*]+?)\*(?!\*)/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^_])_([^\n_]+?)_(?!_)/g, "$1<em>$2</em>");
  // Tô sáng — chạy sau cùng để bold/italic bên trong vẫn ăn.
  s = s.replace(/==(.+?)==(?:\{(green|blue|pink|red)\})?/g, (_, txt, color) => {
    const cls = color ? ` class="mk-${color}"` : "";
    return `<mark${cls}>${txt}</mark>`;
  });
  return s;
}

export function renderTheory(raw) {
  const lines = String(raw == null ? "" : raw).split(/\r?\n/);
  const out = [];
  let list = null; // "ul" | "ol" | null
  let para = []; // các dòng thô của đoạn hiện tại

  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };
  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${para.map(inline).join("<br>")}</p>`);
      para = [];
    }
  };

  for (const line of lines) {
    const t = line.trim();

    if (t === "") {
      flushPara();
      closeList();
      continue;
    }

    // Đường kẻ ngang
    if (/^-{3,}$/.test(t) || /^\*{3,}$/.test(t)) {
      flushPara();
      closeList();
      out.push("<hr>");
      continue;
    }

    // Tiêu đề
    const h = t.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flushPara();
      closeList();
      const tag = { 1: "h3", 2: "h4", 3: "h5" }[h[1].length];
      out.push(`<${tag}>${inline(h[2].trim())}</${tag}>`);
      continue;
    }

    // Blockquote
    const q = t.match(/^>\s?(.*)$/);
    if (q) {
      flushPara();
      closeList();
      out.push(`<blockquote>${inline(q[1].trim())}</blockquote>`);
      continue;
    }

    // Danh sách có số
    const ol = t.match(/^\d+[.)]\s+(.*)$/);
    if (ol) {
      flushPara();
      if (list !== "ol") {
        closeList();
        out.push("<ol>");
        list = "ol";
      }
      out.push(`<li>${inline(ol[1].trim())}</li>`);
      continue;
    }

    // Danh sách bullet
    const ul = t.match(/^[-*]\s+(.*)$/);
    if (ul) {
      flushPara();
      if (list !== "ul") {
        closeList();
        out.push("<ul>");
        list = "ul";
      }
      out.push(`<li>${inline(ul[1].trim())}</li>`);
      continue;
    }

    // Dòng thường -> gom vào đoạn
    closeList();
    para.push(t);
  }

  flushPara();
  closeList();
  return out.join("\n");
}

export default renderTheory;

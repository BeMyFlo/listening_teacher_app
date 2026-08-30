"use client";

import { useRef, useState } from "react";
import TheoryFormatGuide from "./TheoryFormatGuide";

// Ô soạn lý thuyết — Markdown rút gọn, render bởi lib/theoryFormat.js ở phía
// học sinh (.lesson-text). Toolbar chèn cú pháp giúp; gõ tay vẫn được.
export default function TheoryEditor({ theory, media, onChange, catLabel }) {
  const taRef = useRef(null);
  const [showGuide, setShowGuide] = useState(false);
  const set = (k, v) => onChange({ ...theory, [k]: v });

  function apply(next, selStart, selEnd) {
    set("html", next);
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(selStart, selEnd == null ? selStart : selEnd);
    });
  }

  // Bọc vùng chọn bằng marker (đậm / nghiêng / code). suffix: phần thêm sau
  // marker đóng (dùng cho highlight màu: ==text=={green}).
  function wrap(marker, suffix = "") {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const selected = value.slice(s, e) || "text";
    const next = value.slice(0, s) + marker + selected + marker + suffix + value.slice(e);
    apply(next, s + marker.length, s + marker.length + selected.length);
  }

  // Thêm/bỏ tiền tố ở đầu mỗi dòng trong vùng chọn (tiêu đề, trích dẫn, bullet,
  // danh sách số). `has` = regex nhận đúng tiền tố này; bấm lần nữa khi mọi dòng
  // đã có -> gỡ bỏ (toggle). Chuyển từ kiểu list khác sang thì thay thế.
  function prefixLines(kind) {
    const ANY = /^(\s*)(#{1,3}\s+|>\s?|[-*]\s+|\d+[.)]\s+)/;
    const HAS = {
      h2: /^\s*##\s+/,
      h3: /^\s*###\s+/,
      quote: /^\s*>\s?/,
      ul: /^\s*[-*]\s+/,
      ol: /^\s*\d+[.)]\s+/,
    }[kind];
    const PREFIX = { h2: "## ", h3: "### ", quote: "> ", ul: "- " }[kind];

    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const lineStart = value.lastIndexOf("\n", s - 1) + 1;
    let lineEnd = value.indexOf("\n", e);
    if (lineEnd === -1) lineEnd = value.length;

    const lines = value.slice(lineStart, lineEnd).split("\n");
    const nonEmpty = lines.filter((l) => l.trim());
    const allHave = nonEmpty.length > 0 && nonEmpty.every((l) => HAS.test(l));

    let nextBlock;
    if (allHave) {
      nextBlock = lines.map((l) => l.replace(HAS, "")).join("\n"); // toggle off
    } else {
      const bare = lines.map((l) => l.replace(ANY, "$1"));
      if (kind === "ol") {
        let n = 0;
        nextBlock = bare.map((l) => (l.trim() ? `${++n}. ${l}` : l)).join("\n");
      } else {
        nextBlock = bare.map((l) => (l.trim() ? PREFIX + l : l)).join("\n");
      }
    }

    const next = value.slice(0, lineStart) + nextBlock + value.slice(lineEnd);
    apply(next, lineStart, lineStart + nextBlock.length);
  }

  function insertAtCursor(text) {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const next = value.slice(0, s) + text + value.slice(e);
    apply(next, s + text.length);
  }

  function insertLink() {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const label = value.slice(s, e) || "link text";
    let url = "";
    try {
      url = window.prompt("Link URL (https://...)", "https://") || "";
    } catch {
      url = "";
    }
    url = url.trim();
    if (!url || url === "https://") return;
    const snippet = `[${label}](${url})`;
    const next = value.slice(0, s) + snippet + value.slice(e);
    apply(next, s + 1, s + 1 + label.length);
  }

  const Btn = ({ title, onClick, children, className }) => (
    <button type="button" className={"icon-btn theory-btn " + (className || "")} title={title} onClick={onClick}>
      {children}
    </button>
  );

  // Bảng màu highlight — ==text=={color}. "yellow" là mặc định nên không gắn suffix.
  const HIGHLIGHTS = [
    ["yellow", "Highlight — yellow"],
    ["green", "Highlight — green"],
    ["blue", "Highlight — blue"],
    ["pink", "Highlight — pink"],
    ["red", "Highlight — red"],
  ];

  return (
    <div>
      <div className="form-row">
        <label>Theory Content</label>
        <div className="theory-toolbar">
          <Btn title="Heading" onClick={() => prefixLines("h2")}>H</Btn>
          <Btn title="Subheading" onClick={() => prefixLines("h3")}>
            <span style={{ fontSize: ".82em" }}>H</span>
          </Btn>
          <span className="theory-toolbar-sep" />
          <Btn title="Bold  (**text**)" className="theory-btn-bold" onClick={() => wrap("**")}><b>B</b></Btn>
          <Btn title="Italic  (*text*)" className="theory-btn-italic" onClick={() => wrap("*")}><i>I</i></Btn>
          <Btn title="Inline code  (`text`)" onClick={() => wrap("`")}>
            <span style={{ fontFamily: "monospace" }}>{"<>"}</span>
          </Btn>
          <span className="theory-toolbar-sep" />
          <Btn title="Bullet list" onClick={() => prefixLines("ul")}>•</Btn>
          <Btn title="Numbered list" onClick={() => prefixLines("ol")}>1.</Btn>
          <Btn title="Quote" onClick={() => prefixLines("quote")}>&ldquo;</Btn>
          <Btn title="Link  [text](url)" onClick={insertLink}>🔗</Btn>
          <Btn title="Divider" onClick={() => insertAtCursor("\n\n---\n\n")}>
            <span style={{ letterSpacing: "-2px" }}>——</span>
          </Btn>
          <span className="theory-toolbar-sep" />
          {HIGHLIGHTS.map(([c, title]) => (
            <button
              key={c}
              type="button"
              className={"theory-swatch mk-" + c}
              title={title}
              onClick={() => wrap("==", c === "yellow" ? "" : `{${c}}`)}
            >
              A
            </button>
          ))}
          <span className="theory-toolbar-sep" />
          <Btn
            title="Formatting guide"
            className={"theory-btn-help" + (showGuide ? " active" : "")}
            onClick={() => setShowGuide((v) => !v)}
          >
            ?
          </Btn>
        </div>

        {showGuide && <TheoryFormatGuide onClose={() => setShowGuide(false)} />}
        <textarea
          ref={taRef}
          rows={24}
          className="theory-html"
          placeholder={
            "Theory content for " +
            (catLabel || "") +
            "…\n\n## Heading\n- bullet point\n1. step one\n> a note\n**bold**, *italic*, ==highlight==, [link](https://…)"
          }
          value={theory.html || ""}
          onChange={(e) => set("html", e.target.value)}
        />
        <p className="theory-toolbar-hint" style={{ marginTop: 6 }}>
          Formats as you type: <code># ## ###</code> headings · <code>- </code> / <code>1. </code> lists ·{" "}
          <code>&gt; </code> quote · <code>---</code> divider · <code>**bold**</code> · <code>*italic*</code> ·{" "}
          <code>==highlight==</code> · <code>[text](url)</code>
        </p>
      </div>
      <div className="form-row">
        <label>Audio Illustration (optional)</label>
        <select
          className="select-inline section-audio-select"
          style={{ width: "100%" }}
          value={theory.audioId || ""}
          onChange={(e) => set("audioId", e.target.value)}
        >
          <option value="">— Select audio track —</option>
          {media.audio.map((a) => (
            <option key={a._id} value={a._id}>
              {(a.unit ? a.unit + " · " : "") + a.title}
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label>Image Illustration (optional)</label>
        <select
          className="select-inline section-image-select"
          style={{ width: "100%" }}
          value={theory.imageId || ""}
          onChange={(e) => set("imageId", e.target.value)}
        >
          <option value="">— No diagram/map image —</option>
          {media.images.map((im) => (
            <option key={im._id} value={im._id}>
              {(im.unit ? im.unit + " · " : "") + im.title}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

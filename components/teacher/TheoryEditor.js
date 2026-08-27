"use client";

import { useRef } from "react";

// Ô soạn lý thuyết — markup khớp renderTheoryTab của legacy.
export default function TheoryEditor({ theory, media, onChange, catLabel }) {
  const taRef = useRef(null);
  const set = (k, v) => onChange({ ...theory, [k]: v });

  function wrap(marker) {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const selected = value.slice(s, e);
    const next = value.slice(0, s) + marker + selected + marker + value.slice(e);
    set("html", next);
    requestAnimationFrame(() => {
      ta.focus({ preventScroll: true });
      const cur = selected ? s + marker.length * 2 + selected.length : s + marker.length;
      ta.setSelectionRange(cur, cur);
    });
  }

  return (
    <div>
      <div className="form-row">
        <label>Theory Content</label>
        <div className="theory-toolbar">
          <button type="button" className="icon-btn theory-btn-bold" title="Bold selected text (**text**)" onClick={() => wrap("**")}>
            <b>B</b>
          </button>
          <button type="button" className="icon-btn theory-btn-italic" title="Italicize selected text (*text*)" onClick={() => wrap("*")}>
            <i>I</i>
          </button>
          <span className="theory-toolbar-hint">
            Select text, then click to bold/italicize — or type **bold** / *italic* directly.
          </span>
        </div>
        <textarea
          ref={taRef}
          rows={24}
          className="theory-html"
          placeholder={"Theory content for " + (catLabel || "") + "..."}
          value={theory.html || ""}
          onChange={(e) => set("html", e.target.value)}
        />
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

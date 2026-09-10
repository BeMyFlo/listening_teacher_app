"use client";

import RichTextEditor from "./RichTextEditor";
import { theoryToDoc, docToTheoryMarkdown } from "@/lib/tiptap/theoryConvert";
import { importTheoryText } from "@/lib/tiptap/importText";

// Ô soạn lý thuyết — WYSIWYG (TipTap). Nội dung lưu dưới dạng JSON (theory.doc);
// theory.html vẫn được ghi lại từ doc để tương thích ngược với bản render cũ.
export default function TheoryEditor({ theory, media, onChange, catLabel }) {
  const set = (k, v) => onChange({ ...theory, [k]: v });

  // Bài cũ chỉ có html — chuyển sang doc khi mở editor.
  const doc =
    theory.doc && Array.isArray(theory.doc.content)
      ? theory.doc
      : theory.html
      ? theoryToDoc(theory.html)
      : null;

  function setDoc(nextDoc) {
    onChange({ ...theory, doc: nextDoc, html: docToTheoryMarkdown(nextDoc) });
  }

  function importFromAI(raw) {
    const { doc: nextDoc, html } = importTheoryText(raw);
    onChange({ ...theory, doc: nextDoc, html });
  }

  return (
    <div>
      <div className="form-row">
        <label>Theory Content</label>
        <RichTextEditor
          variant="theory"
          value={doc}
          onChange={setDoc}
          onImport={importFromAI}
          placeholder={
            "Theory content for " +
            (catLabel || "") +
            "…  Use the toolbar for headings, bold, lists, quotes, links and highlight."
          }
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

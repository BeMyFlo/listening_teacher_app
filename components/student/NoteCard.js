"use client";

import { useEffect, useRef, useState } from "react";
import { useDialog } from "@/components/ui/Dialog";

const COLORS = ["yellow", "green", "blue", "pink", "red"];

// 1 thẻ ghi chú trong cuốn sổ. Sửa nội dung tại chỗ (lưu khi rời ô).
export default function NoteCard({ note, onUpdate, onDelete, showSource = true }) {
  const dialog = useDialog();
  const [body, setBody] = useState(note.body || "");
  const taRef = useRef(null);

  useEffect(() => {
    setBody(note.body || "");
  }, [note._id, note.body]);

  function commitBody() {
    const v = body.trim();
    if (!v || v === note.body) {
      if (!v) setBody(note.body || "");
      return;
    }
    onUpdate(note._id, { body: v });
  }

  async function del() {
    const ok = await dialog.confirmDelete("Delete this note from your notebook?");
    if (ok) onDelete(note._id);
  }

  const s = note.source || {};

  return (
    <div className={"note-card note-color-" + (note.color || "yellow")}>
      {note.quote ? <blockquote className="note-card-quote">{note.quote}</blockquote> : null}
      <textarea
        ref={taRef}
        className="note-card-body"
        rows={Math.min(8, Math.max(2, String(body).split("\n").length))}
        value={body}
        placeholder="Write your note…"
        onChange={(e) => setBody(e.target.value)}
        onBlur={commitBody}
      />
      <div className="note-card-foot">
        <div className="note-card-colors">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={"note-swatch note-color-" + c + (note.color === c ? " on" : "")}
              title={c}
              onClick={() => onUpdate(note._id, { color: c })}
            />
          ))}
        </div>
        <button
          type="button"
          className={"note-card-btn" + (note.pinned ? " on" : "")}
          title={note.pinned ? "Unpin" : "Pin to top"}
          onClick={() => onUpdate(note._id, { pinned: !note.pinned })}
        >
          <svg className="icon"><use href="#icon-star" /></svg>
        </button>
        <button type="button" className="note-card-btn danger" title="Delete" onClick={del}>
          <svg className="icon"><use href="#icon-trash" /></svg>
        </button>
      </div>
      {showSource && (s.contextName || s.itemLabel) ? (
        <a className="note-card-source" href={s.href || undefined}>
          <svg className="icon"><use href={"#icon-" + (s.kind === "test" ? "clipboard" : "book-open")} /></svg>
          {[s.contextName, s.skill && cap(s.skill), s.itemLabel].filter(Boolean).join(" · ")}
        </a>
      ) : null}
    </div>
  );
}

function cap(x) {
  return String(x || "").charAt(0).toUpperCase() + String(x || "").slice(1);
}

"use client";

import { hashStr, useHighlightStore, HighlightMarksText } from "./HighlightText";

/* Công cụ hỗ trợ làm Reading: tô vàng (highlight) + ghi chú (note).
   Engine dùng chung với cột câu hỏi (HighlightText.js); ở đây thêm thanh
   công cụ + danh sách "Your notes". Stored locally in localStorage. */

export default function ReadingPassage({ text, storageKey, noteSource = null }) {
  const passage = text || "";
  // Keep the exact legacy key so students don't lose existing highlights.
  const key = "reading-tools:" + hashStr((storageKey || "") + "|" + passage);
  const { marks, setMarks } = useHighlightStore(key);

  const noted = marks.filter((m) => m.note).sort((a, b) => a.start - b.start);

  return (
    <div className="reading-tools">
      <div className="reading-tools-bar">
        <span className="rt-hint">
          <svg className="icon"><use href="#icon-edit" /></svg>
          Select text in the passage to <b>highlight</b> or add a <b>note</b>
        </span>
        {marks.length > 0 && (
          <button type="button" className="rt-clear" onClick={() => setMarks([])}>
            Clear all ({marks.length})
          </button>
        )}
      </div>

      <HighlightMarksText text={passage} marks={marks} setMarks={setMarks} preLine noteSource={noteSource} />

      {noted.length > 0 && (
        <div className="rt-notes">
          <h4>Your notes</h4>
          {noted.map((m) => (
            <div className="rt-note-item" key={m.id}>
              <span className="rt-note-quote">“{passage.slice(m.start, m.end)}”</span>
              <span className="rt-note-body">{m.note}</span>
              <button
                type="button"
                className="rt-note-del"
                onClick={() => setMarks((prev) => prev.filter((x) => x.id !== m.id))}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

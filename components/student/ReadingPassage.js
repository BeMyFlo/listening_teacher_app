"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* Công cụ hỗ trợ làm Reading: tô vàng (highlight) + ghi chú (note).
   Stored locally in the browser (localStorage) so students do not lose their work. */

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return String(h >>> 0);
}

function mergeMark(marks, start, end, note) {
  const overlap = marks.filter((m) => m.start < end && m.end > start);
  const rest = marks.filter((m) => !(m.start < end && m.end > start));
  let s = start;
  let e = end;
  const notes = [];
  overlap.forEach((m) => {
    s = Math.min(s, m.start);
    e = Math.max(e, m.end);
    if (m.note) notes.push(m.note);
  });
  if (note) notes.push(note);
  return [...rest, { id: hashStr(s + "-" + e + "-" + Math.random()), start: s, end: e, note: notes.join(" · ") }];
}

export default function ReadingPassage({ text, storageKey }) {
  const passage = text || "";
  const key = "reading-tools:" + hashStr((storageKey || "") + "|" + passage);
  const ref = useRef(null);
  const [marks, setMarks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [popup, setPopup] = useState(null); // { x, y, start, end } | { x, y, markId }
  const [noteFor, setNoteFor] = useState(null); // { markId, value }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setMarks(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(key, JSON.stringify(marks));
    } catch {}
  }, [marks, key, loaded]);

  useEffect(() => {
    const close = () => {
      setPopup(null);
    };
    document.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, []);

  const segments = useMemo(() => {
    const t = passage;
    const sorted = [...marks].filter((m) => m.start < m.end).sort((a, b) => a.start - b.start);
    const segs = [];
    let pos = 0;
    for (const m of sorted) {
      const s = Math.max(m.start, pos);
      const e = Math.min(m.end, t.length);
      if (s >= e) continue;
      if (s > pos) segs.push({ type: "plain", start: pos, text: t.slice(pos, s) });
      segs.push({ type: "mark", start: s, text: t.slice(s, e), mark: m });
      pos = e;
    }
    if (pos < t.length) segs.push({ type: "plain", start: pos, text: t.slice(pos) });
    if (!segs.length) segs.push({ type: "plain", start: 0, text: t });
    return segs;
  }, [passage, marks]);

  const readSelection = useCallback(() => {
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    const root = ref.current;
    if (!root || !root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
    const toGlobal = (node, offset) => {
      const el = node.nodeType === 3 ? node.parentElement : node;
      const base = el && el.getAttribute ? el.getAttribute("data-start") : null;
      if (base == null) return null;
      return Number(base) + offset;
    };
    const a = toGlobal(range.startContainer, range.startOffset);
    const b = toGlobal(range.endContainer, range.endOffset);
    if (a == null || b == null) return null;
    const start = Math.min(a, b);
    const end = Math.max(a, b);
    if (end - start < 1) return null;
    const rect = range.getBoundingClientRect();
    return { start, end, rect };
  }, []);

  function onMouseUp() {
    const s = readSelection();
    if (!s) return;
    setPopup({ x: s.rect.left + s.rect.width / 2, y: s.rect.top, start: s.start, end: s.end });
  }

  function addHighlight(withNote) {
    if (!popup || popup.start == null) return;
    const next = mergeMark(marks, popup.start, popup.end, "");
    setMarks(next);
    try {
      window.getSelection().removeAllRanges();
    } catch {}
    if (withNote) {
      const created = next.find((m) => m.start <= popup.start && m.end >= popup.end);
      if (created) setNoteFor({ markId: created.id, value: created.note || "" });
    }
    setPopup(null);
  }

  function removeMark(id) {
    setMarks((prev) => prev.filter((m) => m.id !== id));
    setPopup(null);
    setNoteFor(null);
  }

  function saveNote() {
    if (!noteFor) return;
    setMarks((prev) =>
      prev.map((m) => (m.id === noteFor.markId ? { ...m, note: noteFor.value.trim() } : m))
    );
    setNoteFor(null);
  }

  const noted = marks
    .filter((m) => m.note)
    .sort((a, b) => a.start - b.start);

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

      <div
        className="reading-passage-text"
        ref={ref}
        onMouseUp={onMouseUp}
        style={{ whiteSpace: "pre-line" }}
      >
        {segments.map((seg, i) =>
          seg.type === "mark" ? (
            <mark
              key={i}
              className={"rt-mark" + (seg.mark.note ? " has-note" : "")}
              data-start={seg.start}
              onClick={(e) => {
                e.stopPropagation();
                const r = e.currentTarget.getBoundingClientRect();
                setPopup({ x: r.left + r.width / 2, y: r.top, markId: seg.mark.id });
              }}
            >
              {seg.text}
            </mark>
          ) : (
            <span key={i} data-start={seg.start}>
              {seg.text}
            </span>
          )
        )}
      </div>

      {noted.length > 0 && (
        <div className="rt-notes">
          <h4>Your notes</h4>
          {noted.map((m) => (
            <div className="rt-note-item" key={m.id}>
              <span className="rt-note-quote">“{passage.slice(m.start, m.end)}”</span>
              <span className="rt-note-body">{m.note}</span>
              <button
                type="button"
                className="rt-note-edit"
                onClick={() => setNoteFor({ markId: m.id, value: m.note || "" })}
              >
                Edit
              </button>
              <button type="button" className="rt-note-del" onClick={() => removeMark(m.id)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {popup && (
        <div
          className="rt-popup"
          style={{ position: "fixed", left: popup.x, top: popup.y - 8, transform: "translate(-50%, -100%)" }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {popup.start != null ? (
            <>
              <button type="button" onClick={() => addHighlight(false)}>
                <span className="rt-swatch" /> Highlight
              </button>
              <button type="button" onClick={() => addHighlight(true)}>
                Highlight + note
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  const m = marks.find((x) => x.id === popup.markId);
                  setNoteFor({ markId: popup.markId, value: (m && m.note) || "" });
                  setPopup(null);
                }}
              >
                {marks.find((x) => x.id === popup.markId && x.note) ? "Edit note" : "Add note"}
              </button>
              <button type="button" onClick={() => removeMark(popup.markId)}>
                Remove highlight
              </button>
            </>
          )}
        </div>
      )}

      {noteFor && (
        <div className="rt-note-editor-backdrop" onClick={() => setNoteFor(null)}>
          <div className="rt-note-editor" onClick={(e) => e.stopPropagation()}>
            <h4>Note</h4>
            <p className="rt-note-editor-quote">
              “{passage.slice(
                (marks.find((m) => m.id === noteFor.markId) || {}).start || 0,
                (marks.find((m) => m.id === noteFor.markId) || {}).end || 0
              )}”
            </p>
            <textarea
              rows={4}
              autoFocus
              value={noteFor.value}
              onChange={(e) => setNoteFor({ ...noteFor, value: e.target.value })}
              placeholder="Type your note..."
            />
            <div className="rt-note-editor-actions">
              <button type="button" className="btn secondary" onClick={() => setNoteFor(null)}>
                Cancel
              </button>
              <button type="button" className="btn" onClick={saveNote}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

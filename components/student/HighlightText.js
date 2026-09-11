"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { postNote } from "@/lib/client/useNotes";
import { api } from "@/lib/client/api";

/* Reusable "select text -> highlight + note" engine, shared by the reading
   passage tool and the question column. Marks are stored per text block in
   localStorage. Extracted from the original ReadingPassage.js. */

export function hashStr(s) {
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

// localStorage-backed marks for one text block, addressed by an explicit key.
export function useHighlightStore(lsKey) {
  const [marks, setMarks] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let next = [];
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) next = JSON.parse(raw);
    } catch {}
    setMarks(Array.isArray(next) ? next : []);
    setLoaded(true);
  }, [lsKey]);

  useEffect(() => {
    if (!loaded) return;
    try {
      if (marks.length) localStorage.setItem(lsKey, JSON.stringify(marks));
      else localStorage.removeItem(lsKey);
    } catch {}
  }, [marks, lsKey, loaded]);

  return { marks, setMarks };
}

// Remove every question-highlight block belonging to one section.
export function clearHighlights(prefix) {
  try {
    const doomed = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) doomed.push(k);
    }
    doomed.forEach((k) => localStorage.removeItem(k));
    return doomed.length;
  } catch {
    return 0;
  }
}

/* The interactive text itself. Controlled: marks + setMarks come from
   useHighlightStore (or a parent). `inline` renders a <span> that flows inside
   surrounding text instead of a block. */
export function HighlightMarksText({ text, marks, setMarks, inline = false, className = "", preLine = false, noteSource = null }) {
  const passage = text || "";
  const ref = useRef(null);
  const [popup, setPopup] = useState(null); // {x,y,start,end} | {x,y,markId}
  const [noteFor, setNoteFor] = useState(null); // {markId, value}

  useEffect(() => {
    const close = () => setPopup(null);
    document.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, []);

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

  // Trên mobile (long-press để bôi chọn) KHÔNG có sự kiện `mouseup` khi thả
  // tay, nên nút "Highlight" không bao giờ hiện. Nghe thêm `selectionchange`
  // (debounce để đợi học sinh kéo xong) rồi mở popup ngay tại vùng đã chọn —
  // cách này chạy cho cả chuột lẫn cảm ứng.
  useEffect(() => {
    let t;
    const onSelChange = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const s = readSelection();
        if (s) setPopup({ x: s.rect.left + s.rect.width / 2, y: s.rect.top, start: s.start, end: s.end });
      }, 400);
    };
    document.addEventListener("selectionchange", onSelChange);
    return () => {
      clearTimeout(t);
      document.removeEventListener("selectionchange", onSelChange);
    };
  }, [readSelection]);

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
      if (created) setNoteFor({ markId: created.id, value: created.note || "", toNotebook: false });
    }
    setPopup(null);
  }

  function removeMark(id) {
    setMarks((prev) => prev.filter((m) => m.id !== id));
    setPopup(null);
    setNoteFor(null);
  }

  const setNoteId = (markId, noteId) =>
    setMarks((prev) => prev.map((m) => (m.id === markId ? { ...m, noteId } : m)));

  function saveNote() {
    if (!noteFor) return;
    const markId = noteFor.markId;
    const val = noteFor.value.trim();
    const mark = marks.find((m) => m.id === markId);
    setMarks((prev) => prev.map((m) => (m.id === markId ? { ...m, note: val } : m)));

    // Ghi chú tạm thời = vệt vàng + tooltip (localStorage, theo máy).
    // Chỉ khi học sinh tick "Save to my notebook" mới đẩy vào sổ (DB).
    if (noteSource && mark) {
      const wantSaved = !!noteFor.toNotebook && !!val;
      if (wantSaved && !mark.noteId) {
        postNote({ body: val, quote: passage.slice(mark.start, mark.end), source: noteSource })
          .then((n) => n && n._id && setNoteId(markId, n._id))
          .catch(() => {});
      } else if (wantSaved && mark.noteId) {
        api.student.notes.update(mark.noteId, { body: val }).catch(() => {});
      } else if (!wantSaved && mark.noteId) {
        api.student.notes.remove(mark.noteId).catch(() => {});
        setNoteId(markId, undefined);
      }
    }
    setNoteFor(null);
  }

  const Tag = inline ? "span" : "div";
  const body = segments.map((seg, i) =>
    seg.type === "mark" ? (
      <mark
        key={i}
        className={"rt-mark" + (seg.mark.note ? " has-note" : "") + (seg.mark.noteId ? " in-notebook" : "")}
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
  );

  return (
    <>
      <Tag
        ref={ref}
        className={(inline ? "rt-inline" : "reading-passage-text") + (className ? " " + className : "")}
        onMouseUp={onMouseUp}
        style={preLine ? { whiteSpace: "pre-line" } : undefined}
      >
        {body}
      </Tag>

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
                  setNoteFor({ markId: popup.markId, value: (m && m.note) || "", toNotebook: !!(m && m.noteId) });
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
            {noteSource && (
              <label className="rt-note-tonotebook">
                <input
                  type="checkbox"
                  checked={!!noteFor.toNotebook}
                  onChange={(e) => setNoteFor({ ...noteFor, toNotebook: e.target.checked })}
                />
                Save to my notebook (keeps it across devices)
              </label>
            )}
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
    </>
  );
}

/* Uncontrolled convenience wrapper: give it a text string + a stable
   localStorage key, get a self-persisting highlightable block. */
export default function HighlightText({ text, lsKey, inline = false, className = "", preLine = false, noteSource = null }) {
  const { marks, setMarks } = useHighlightStore(lsKey);
  if (!text) return inline ? <span className={className}>{text}</span> : <div className={className}>{text}</div>;
  return (
    <HighlightMarksText
      text={text}
      marks={marks}
      setMarks={setMarks}
      inline={inline}
      className={className}
      preLine={preLine}
      noteSource={noteSource}
    />
  );
}

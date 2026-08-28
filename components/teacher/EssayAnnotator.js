"use client";

// Chấm Writing inline: sửa chữ (xanh = thêm, đỏ gạch = xoá) + ghi chú gắn
// tiêu chí. Xuất ra mảng annotation (lib/grading/annotate.js) — cùng định dạng
// mà AI (Gemini) sinh ra, nên AI chấm thay được.

import { useMemo, useRef, useState } from "react";
import {
  buildSegments,
  applyAnnotations,
  normalizeAnnotation,
  resolveQuote,
  CATEGORIES,
  rid,
} from "@/lib/grading/annotate";
import { diffToAnnotations } from "@/lib/grading/diff";

const CRIT_OPTS = { writing: ["TR", "CC", "LR", "GRA"], speaking: ["FC", "LR", "GRA", "PR"] };
const CAT_LABEL = {
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  spelling: "Spelling",
  cohesion: "Cohesion",
  punctuation: "Punctuation",
  task: "Task",
  style: "Style",
  other: "Other",
};

export default function EssayAnnotator({ essayText = "", annotations = [], kind = "writing", onChange, onAiGrade, aiBusy }) {
  const [mode, setMode] = useState("annotate");
  const [draft, setDraft] = useState(essayText); // cho chế độ edit
  const [sel, setSel] = useState(null); // { start, end, quote, x, y }
  const [form, setForm] = useState({ action: "comment", insertText: "", category: "grammar", criterion: "", comment: "" });
  const [editWarn, setEditWarn] = useState("");
  const essayRef = useRef(null);

  const anns = useMemo(() => (annotations || []).map((a) => normalizeAnnotation(a, essayText)), [annotations, essayText]);
  const segments = useMemo(() => buildSegments(essayText, anns), [essayText, anns]);
  const crits = CRIT_OPTS[kind] || CRIT_OPTS.writing;

  function emit(next) {
    onChange && onChange(next.map((a) => normalizeAnnotation(a, essayText)));
  }

  // ---- Annotate: bắt vùng bôi đen -> offset trong bài gốc ----
  function onMouseUp() {
    const s = window.getSelection();
    if (!s || s.isCollapsed || !essayRef.current) return setSel(null);
    const r = s.getRangeAt(0);
    if (!essayRef.current.contains(r.commonAncestorContainer)) return setSel(null);
    const a = boundary(r.startContainer, r.startOffset, "start");
    const b = boundary(r.endContainer, r.endOffset, "end");
    if (a == null || b == null) return setSel(null);
    const start = Math.min(a, b);
    const end = Math.max(a, b);
    if (end <= start) return setSel(null);
    const rect = r.getBoundingClientRect();
    const box = essayRef.current.getBoundingClientRect();
    setSel({ start, end, quote: essayText.slice(start, end), x: rect.left - box.left, y: rect.bottom - box.top + 6 });
    setForm({ action: "comment", insertText: "", category: "grammar", criterion: "", comment: "" });
  }

  // node/offset trong DOM -> offset ký tự trong essayText gốc
  function boundary(node, offset, side) {
    let el = node.nodeType === 3 ? node.parentElement : node;
    while (el && el !== essayRef.current && !el.hasAttribute("data-os")) el = el.parentElement;
    if (el && el.hasAttribute("data-os")) {
      const os = Number(el.getAttribute("data-os"));
      const within = node.nodeType === 3 ? offset : side === "start" ? 0 : el.textContent.length;
      return os + Math.min(within, el.textContent.length);
    }
    // rơi vào đoạn chèn (ins) — bám mép đoạn gốc liền kề
    const spans = [...essayRef.current.querySelectorAll("[data-os]")];
    for (const sp of spans) {
      const pos = sp.compareDocumentPosition(node);
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return Number(sp.getAttribute("data-oe"));
    }
    return spans.length ? Number(spans[0].getAttribute("data-os")) : 0;
  }

  function addFromSelection() {
    if (!sel) return;
    const a = {
      id: rid(),
      action: form.action,
      start: sel.start,
      end: form.action === "insert" ? sel.start : sel.end,
      quote: sel.quote,
      insertText: form.action === "comment" || form.action === "delete" ? "" : form.insertText,
      category: form.category,
      criterion: form.criterion || null,
      comment: form.comment,
      source: "teacher",
    };
    emit([...anns, a]);
    setSel(null);
    window.getSelection()?.removeAllRanges();
  }

  function removeAnn(id) {
    emit(anns.filter((a) => a.id !== id));
  }
  function patchAnn(id, patch) {
    emit(anns.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  // ---- Edit text: diff bản gốc vs bản sửa ----
  function applyEdits() {
    const comments = anns.filter((a) => a.action === "comment");
    const diff = diffToAnnotations(essayText, draft);
    // giữ comment, neo lại theo quote nếu offset lệch
    const kept = comments.map((c) => {
      const r = essayText.slice(c.start, c.end) === c.quote ? null : resolveQuote(essayText, c.quote, 1);
      return r ? { ...c, start: r.start, end: r.end } : c;
    });
    setEditWarn(comments.length && diff.length ? "Text re-diffed. Comments kept — re-check any on text you removed." : "");
    emit([...kept, ...diff]);
    setMode("annotate");
  }

  function switchMode(m) {
    if (m === "edit") setDraft(applyAnnotations(essayText, anns));
    setSel(null);
    setEditWarn("");
    setMode(m);
  }

  // ---- nhóm annotation theo tiêu chí cho panel ----
  const groups = useMemo(() => {
    const g = {};
    [...crits, "—"].forEach((k) => (g[k] = []));
    anns.forEach((a) => {
      const k = a.criterion && g[a.criterion] ? a.criterion : "—";
      g[k].push(a);
    });
    return g;
  }, [anns, crits]);

  return (
    <div className="essay-annot-wrap">
      <div className="ea-bar">
        <div className="ea-modeswitch">
          <button type="button" className={"rubric-pilltab" + (mode === "annotate" ? " active" : "")} onClick={() => switchMode("annotate")}>
            Annotate
          </button>
          <button type="button" className={"rubric-pilltab" + (mode === "edit" ? " active" : "")} onClick={() => switchMode("edit")}>
            Edit text
          </button>
        </div>
        {onAiGrade && (
          <button type="button" className="btn secondary ea-ai-btn" disabled={aiBusy} onClick={onAiGrade}>
            <svg className="icon"><use href="#icon-sparkles" /></svg> {aiBusy ? "Grading…" : "AI grade (Gemini)"}
          </button>
        )}
      </div>

      {mode === "edit" ? (
        <div className="ea-edit">
          <textarea rows={12} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
            <button type="button" className="btn" style={{ padding: "8px 16px" }} onClick={applyEdits}>
              Apply changes
            </button>
            <button type="button" className="btn secondary" style={{ padding: "8px 16px" }} onClick={() => setDraft(essayText)}>
              Reset to original
            </button>
          </div>
          {editWarn && <p className="notice warn" style={{ marginTop: 8 }}>{editWarn}</p>}
        </div>
      ) : (
        <>
          <div className="essay-annot" ref={essayRef} onMouseUp={onMouseUp}>
            {segments.map((seg, i) => {
              if (seg.kind === "ins") return <ins key={i} className="ea-add">{seg.text}</ins>;
              const cls =
                (seg.kind === "del" ? "ea-del" : "") + (seg.marks && seg.marks.length ? " ea-hl" : "");
              const title = [
                ...(seg.marks || []).map((m) => `${m.criterion || "—"} · ${CAT_LABEL[m.category]}: ${m.comment}`),
              ].join("\n");
              const Tag = seg.kind === "del" ? "del" : "span";
              return (
                <Tag
                  key={i}
                  className={cls.trim() || undefined}
                  data-os={seg.os}
                  data-oe={seg.oe}
                  data-cat={seg.marks && seg.marks[0] ? seg.marks[0].category : undefined}
                  title={title || undefined}
                >
                  {seg.text}
                </Tag>
              );
            })}

            {sel && (
              <div className="ea-toolbar" style={{ left: sel.x, top: sel.y }}>
                <div className="ea-tb-actions">
                  {["comment", "replace", "delete"].map((act) => (
                    <button
                      key={act}
                      type="button"
                      className={"ea-tb-btn" + (form.action === act ? " active" : "")}
                      onClick={() => setForm((f) => ({ ...f, action: act }))}
                    >
                      {act === "comment" ? "Comment" : act === "replace" ? "Replace" : "Delete"}
                    </button>
                  ))}
                </div>
                {form.action === "replace" && (
                  <input
                    autoFocus
                    className="ea-tb-input"
                    placeholder="Replace with…"
                    value={form.insertText}
                    onChange={(e) => setForm((f) => ({ ...f, insertText: e.target.value }))}
                  />
                )}
                <div className="ea-tb-row">
                  <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                  </select>
                  <select value={form.criterion} onChange={(e) => setForm((f) => ({ ...f, criterion: e.target.value }))}>
                    <option value="">criterion…</option>
                    {crits.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <input
                  className="ea-tb-input"
                  placeholder="Note (optional)"
                  value={form.comment}
                  onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                />
                <div className="ea-tb-row">
                  <button type="button" className="btn" style={{ padding: "6px 14px", fontSize: ".82rem" }} onClick={addFromSelection}>
                    Add
                  </button>
                  <button type="button" className="ea-tb-btn" onClick={() => setSel(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>

          {anns.length > 0 && (
            <div className="ea-list">
              {[...crits, "—"].map((ck) =>
                groups[ck] && groups[ck].length ? (
                  <div key={ck} className="ea-list-group">
                    <div className="ea-list-head">{ck === "—" ? "Unassigned" : ck} · {groups[ck].length}</div>
                    {groups[ck].map((a) => (
                      <div key={a.id} className="ea-list-item">
                        <span className={"pill " + (a.action === "delete" ? "pill-danger" : a.action === "comment" ? "pill-info" : "pill-ok")}>
                          {a.action}
                        </span>
                        <span className="ea-chip">{CAT_LABEL[a.category]}</span>
                        <span className="ea-quote">
                          “{a.quote || "∅"}”{a.insertText ? <> → <b>{a.insertText}</b></> : null}
                        </span>
                        {a.comment && <span className="ea-note">{a.comment}</span>}
                        <select
                          className="ea-mini"
                          value={a.criterion || ""}
                          onChange={(e) => patchAnn(a.id, { criterion: e.target.value || null })}
                        >
                          <option value="">—</option>
                          {crits.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button type="button" className="icon-btn danger" title="Remove" onClick={() => removeAnn(a.id)}>
                          <svg className="icon"><use href="#icon-trash" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

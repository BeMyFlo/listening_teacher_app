"use client";

// Chấm Writing inline: sửa chữ (xanh = thêm, đỏ gạch = xoá) + ghi chú gắn
// tiêu chí. Xuất ra mảng annotation (lib/grading/annotate.js) — cùng định dạng
// mà AI (Gemini) sinh ra, nên AI chấm thay được.
//
// MỘT khung duy nhất — không có ô "Quick edit" tách riêng nữa (giáo viên phản
// ánh 2 khung nhìn qua nhìn lại khó dùng). Thao tác trực tiếp trên bản tô màu:
//   - Bôi đen chữ MỚI  -> mở toolbar tạo chú thích (Comment/Replace/Delete).
//   - Bấm vào chữ ĐÃ gạch/tô (kể cả do AI chấm) -> mở lại toolbar đó để SỬA
//     hoặc XOÁ ngay tại chỗ, không cần kéo xuống danh sách bên dưới.
// (Từng thử làm hẳn vùng tô màu gõ tự do được bằng contentEditable, nhưng với
// bài nhiều lỗi (15-30+) nó gây lỗi layout của Chrome không ổn định — nên việc
// sửa/xoá vẫn đi qua toolbar (thao tác rời rạc), không phải gõ tự do.)

import { useMemo, useRef, useState } from "react";
import {
  buildSegments,
  normalizeAnnotation,
  CATEGORIES,
  colorGroup,
  rid,
} from "@/lib/grading/annotate";

const CRIT_OPTS = { writing: ["TR", "CC", "LR", "GRA"], speaking: ["FC", "LR", "GRA", "PR"] };
const CAT_LABEL = {
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  spelling: "Spelling",
  cohesion: "Cohesion",
  punctuation: "Punctuation",
  idea: "Idea/Logic",
  task: "Idea/Logic",
  style: "Vocabulary",
  other: "Other",
};

export default function EssayAnnotator({ essayText = "", annotations = [], kind = "writing", onChange, onAiGrade, aiBusy }) {
  const [sel, setSel] = useState(null); // new selection: { start, end, quote, x, y }
  const [editId, setEditId] = useState(null); // id of an EXISTING annotation being edited, or null
  const [editPos, setEditPos] = useState({ x: 0, y: 0 });
  const [form, setForm] = useState({ action: "comment", insertText: "", category: "grammar", criterion: "", comment: "" });
  const essayRef = useRef(null);

  const anns = useMemo(() => (annotations || []).map((a) => normalizeAnnotation(a, essayText)), [annotations, essayText]);
  const segments = useMemo(() => buildSegments(essayText, anns), [essayText, anns]);
  const crits = CRIT_OPTS[kind] || CRIT_OPTS.writing;

  function emit(next) {
    onChange && onChange(next.map((a) => normalizeAnnotation(a, essayText)));
  }

  // ---- Annotate: bắt vùng bôi đen MỚI -> offset trong bài gốc ----
  function onMouseUp() {
    const s = window.getSelection();
    if (!s || s.isCollapsed || !essayRef.current) return;
    const r = s.getRangeAt(0);
    if (!essayRef.current.contains(r.commonAncestorContainer)) return;
    const a = boundary(r.startContainer, r.startOffset, "start");
    const b = boundary(r.endContainer, r.endOffset, "end");
    if (a == null || b == null) return;
    const start = Math.min(a, b);
    const end = Math.max(a, b);
    if (end <= start) return;
    const rect = r.getBoundingClientRect();
    const box = essayRef.current.getBoundingClientRect();
    setEditId(null);
    setSel({ start, end, quote: essayText.slice(start, end), x: rect.left - box.left, y: rect.bottom - box.top + 6 });
    setForm({ action: "comment", insertText: "", category: "grammar", criterion: "", comment: "" });
  }

  // Bấm vào 1 chỗ ĐÃ chấm (gạch/tô, kể cả của AI) -> mở lại toolbar tại đó để
  // sửa hoặc xoá ngay, thay vì phải kéo xuống danh sách bên dưới.
  function onMarkClick(e, annId) {
    e.stopPropagation();
    const a = anns.find((x) => x.id === annId);
    if (!a || !essayRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const box = essayRef.current.getBoundingClientRect();
    window.getSelection()?.removeAllRanges();
    setSel(null);
    setEditId(a.id);
    setForm({
      action: a.action === "delete" || a.action === "replace" ? a.action : "comment",
      insertText: a.insertText || "",
      category: a.category,
      criterion: a.criterion || "",
      comment: a.comment || "",
    });
    setEditPos({ x: rect.left - box.left, y: rect.bottom - box.top + 6 });
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

  // Lưu/xoá annotation đang mở để SỬA (mở từ việc bấm vào chữ đã gạch/tô).
  function saveEdit() {
    if (!editId) return;
    patchAnn(editId, {
      action: form.action,
      insertText: form.action === "comment" || form.action === "delete" ? "" : form.insertText,
      category: form.category,
      criterion: form.criterion || null,
      comment: form.comment,
    });
    setEditId(null);
  }
  function deleteEdit() {
    if (!editId) return;
    removeAnn(editId);
    setEditId(null);
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
        <b style={{ fontSize: ".9rem" }}>Essay</b>
        {onAiGrade && (
          <button type="button" className="btn secondary ea-ai-btn" disabled={aiBusy} onClick={onAiGrade}>
            <svg className="icon"><use href="#icon-sparkles" /></svg> {aiBusy ? "Grading…" : "AI grade (Gemini)"}
          </button>
        )}
      </div>

      <p style={{ margin: "0 0 8px", color: "var(--muted)", fontSize: ".82rem" }}>
        <svg className="icon"><use href="#icon-info" /></svg> Bôi đen chữ để chấm; bấm vào chữ đã gạch/tô (kể cả của AI) để sửa hoặc xoá.
      </p>
      <div className="essay-annot" ref={essayRef} onMouseUp={onMouseUp}>
        {segments.map((seg, i) => {
          const clickable = !!seg.ann || (seg.marks && seg.marks.length === 1);
          const clickId = seg.ann ? seg.ann.id : seg.marks && seg.marks.length === 1 ? seg.marks[0].id : null;
          const onClick = clickable ? (e) => onMarkClick(e, clickId) : undefined;
          if (seg.kind === "ins")
            return (
              <ins key={i} className="ea-add" onClick={onClick} style={clickable ? { cursor: "pointer" } : undefined}>
                {seg.text}
              </ins>
            );
          const cls =
            (seg.kind === "del" ? "ea-del" : "") + (seg.marks && seg.marks.length ? " ea-hl" : "");
          const title = [
            ...(seg.marks || []).map((m) => `${m.criterion || "—"} · ${CAT_LABEL[m.category]}: ${m.comment}`),
          ].join("\n");
          const Tag = seg.kind === "del" ? "del" : "span";
          const cat = seg.marks && seg.marks[0] ? seg.marks[0].category : seg.ann ? seg.ann.category : null;
          return (
            <Tag
              key={i}
              className={cls.trim() || undefined}
              data-os={seg.os}
              data-oe={seg.oe}
              data-cat={cat ? colorGroup(cat) : undefined}
              title={title || undefined}
              onClick={onClick}
              style={clickable ? { cursor: "pointer" } : undefined}
            >
              {seg.text}
            </Tag>
          );
        })}

        {(sel || editId) && (
          <div className="ea-toolbar" style={{ left: sel ? sel.x : editPos.x, top: sel ? sel.y : editPos.y }}>
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
              {sel ? (
                <button type="button" className="btn" style={{ padding: "6px 14px", fontSize: ".82rem" }} onClick={addFromSelection}>
                  Add
                </button>
              ) : (
                <>
                  <button type="button" className="btn" style={{ padding: "6px 14px", fontSize: ".82rem" }} onClick={saveEdit}>
                    Save
                  </button>
                  <button type="button" className="ea-tb-btn" style={{ color: "var(--red)" }} onClick={deleteEdit}>
                    Delete
                  </button>
                </>
              )}
              <button type="button" className="ea-tb-btn" onClick={() => { setSel(null); setEditId(null); }}>Cancel</button>
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
    </div>
  );
}

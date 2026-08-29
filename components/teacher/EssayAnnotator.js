"use client";

// Chấm Writing inline: sửa chữ (xanh = thêm, đỏ gạch = xoá) + ghi chú gắn
// tiêu chí. Xuất ra mảng annotation (lib/grading/annotate.js) — cùng định dạng
// mà AI (Gemini) sinh ra, nên AI chấm thay được.
//
// "Quick edit" bên dưới bản tô màu: gõ/xoá thẳng vào ô, màu tự cập nhật sau
// khi ngừng gõ ~400ms — không cần nút Apply hay chuyển tab riêng. (Từng thử
// làm hẳn vùng tô màu gõ được trực tiếp bằng contentEditable, nhưng với bài
// nhiều lỗi (15-30+) nó gây lỗi layout của Chrome không ổn định — dùng ô
// nhập tách riêng để tránh rủi ro đó.)

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildSegments,
  applyAnnotations,
  normalizeAnnotation,
  CATEGORIES,
  colorGroup,
  rid,
} from "@/lib/grading/annotate";
import { reconcileEdits } from "@/lib/grading/diff";

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
  const [sel, setSel] = useState(null); // { start, end, quote, x, y }
  const [form, setForm] = useState({ action: "comment", insertText: "", category: "grammar", criterion: "", comment: "" });
  const essayRef = useRef(null);
  const debounceRef = useRef(null);
  const lastSyncedRef = useRef(null);

  const anns = useMemo(() => (annotations || []).map((a) => normalizeAnnotation(a, essayText)), [annotations, essayText]);
  const segments = useMemo(() => buildSegments(essayText, anns), [essayText, anns]);
  const crits = CRIT_OPTS[kind] || CRIT_OPTS.writing;

  const [draft, setDraft] = useState(() => applyAnnotations(essayText, anns));

  function emit(next) {
    onChange && onChange(next.map((a) => normalizeAnnotation(a, essayText)));
  }

  // Đồng bộ lại ô "Quick edit" khi annotations đổi từ BÊN NGOÀI (AI vừa chấm
  // xong, đổi bài...) — bỏ qua nếu đúng bằng cái mình vừa tự emit ra (tránh
  // ghi đè lại chữ đang gõ dở bằng chính giá trị mình vừa gửi lên).
  useEffect(() => {
    const corrected = applyAnnotations(essayText, anns);
    if (corrected !== lastSyncedRef.current) {
      lastSyncedRef.current = corrected;
      setDraft(corrected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [essayText, annotations]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  function handleDraftChange(text) {
    setDraft(text);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const next = reconcileEdits(essayText, anns, text);
      lastSyncedRef.current = text;
      emit(next);
    }, 400);
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

      <div className="ea-cols">
      <div className="essay-annot" ref={essayRef} onMouseUp={onMouseUp}>
        {segments.map((seg, i) => {
          if (seg.kind === "ins") return <ins key={i} className="ea-add">{seg.text}</ins>;
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

      <div className="ea-quickedit-wrap">
        <label className="ea-quickedit-label">
          <svg className="icon"><use href="#icon-edit" /></svg> Sửa nhanh — gõ/xoá ở đây, màu bên trái tự cập nhật khi ngừng gõ
        </label>
        <textarea
          className="ea-quickedit"
          rows={6}
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
        />
      </div>
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

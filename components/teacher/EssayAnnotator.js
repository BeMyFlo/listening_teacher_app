"use client";

// Chấm Writing inline: sửa chữ (xanh = thêm, đỏ gạch = xoá) + ghi chú gắn
// tiêu chí. Xuất ra mảng annotation (lib/grading/annotate.js) — cùng định dạng
// mà AI (Gemini) sinh ra, nên AI chấm thay được.
//
// MỘT khung duy nhất, gõ/xoá TRỰC TIẾP như 1 ô văn bản thật — giáo viên yêu
// cầu rõ: bấm vào đâu là con trỏ hiện ở đó, Backspace/Delete tại chỗ đó gạch
// đỏ NGAY ký tự gốc, gõ chữ mới hiện xanh NGAY, không qua toolbar/note gì cả.
//   - contentEditable=true để có con trỏ thật + focus bàn phím bình thường.
//   - MỌI thao tác sửa chữ (gõ/Backspace/Delete/dán) bị chặn ở onBeforeInput
//     rồi tự tay quy đổi thành 1 annotation (delete/insert/replace) neo vào
//     essayText GỐC — KHÔNG bao giờ để trình duyệt tự ý sửa DOM (đây chính là
//     nguyên nhân layout Chrome bị lỗi ở lần thử contentEditable tự do trước
//     đây, với bài nhiều lỗi 15-30+). Sau khi cập nhật state, con trỏ được tự
//     đặt lại đúng vị trí logic (xem placeCaret/useLayoutEffect bên dưới).
//   - Bôi đen 1 đoạn rồi thả chuột vẫn mở toolbar Comment/Replace/Delete như
//     cũ — dùng khi muốn GẮN tiêu chí (GRA/LR/...) + ghi chú giải thích cho
//     học sinh, không chỉ sửa chữ suông. Annotation nào (kể cả gõ trực tiếp
//     hay do AI chấm) cũng bấm vào để mở lại toolbar đó, gán tiêu chí/ghi chú
//     hoặc xoá — xem onMarkClick.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  buildSegments,
  normalizeAnnotation,
  CATEGORIES,
  MUTATING,
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
  // Annotation đang được gõ tiếp (đang "mở"), để ký tự tiếp theo NỐI vào chứ
  // không tạo annotation insert mới mỗi ký tự. Reset khi con trỏ dời đi.
  const activeInsertRef = useRef(null); // { id, os } | null
  // Vị trí con trỏ CẦN đặt lại sau khi React render xong (segments đổi).
  const caretGoalRef = useRef(null); // { os, insertAnnId } | null

  const anns = useMemo(() => (annotations || []).map((a) => normalizeAnnotation(a, essayText)), [annotations, essayText]);
  const segments = useMemo(() => buildSegments(essayText, anns), [essayText, anns]);
  const crits = CRIT_OPTS[kind] || CRIT_OPTS.writing;

  // Gõ nhanh thật có thể bắn nhiều sự kiện beforeinput liên tiếp TRƯỚC KHI
  // React kịp render lại — nếu đọc `anns` (đóng gói lúc render) thì phím gõ
  // thứ 2 vẫn thấy state CŨ (chưa có ký tự thứ 1), tự ghi đè/lệch vị trí.
  // annsRef luôn giữ giá trị MỚI NHẤT — cập nhật ngay khi emit() gọi (không
  // đợi re-render) và đồng bộ lại theo props đã commit qua effect bên dưới.
  const annsRef = useRef(anns);
  useEffect(() => {
    annsRef.current = anns;
  }, [anns]);

  function emit(next) {
    const normalized = next.map((a) => normalizeAnnotation(a, essayText));
    annsRef.current = normalized;
    onChange && onChange(normalized);
  }

  function queueCaret(os, insertAnnId) {
    caretGoalRef.current = { os, insertAnnId: insertAnnId || null };
    activeInsertRef.current = insertAnnId ? { id: insertAnnId, os } : null;
  }

  // Đặt lại con trỏ thật (Selection API) sau mỗi lần segments đổi vì 1 phím
  // gõ/xoá — bắt buộc vì React render lại DOM, trình duyệt sẽ mất con trỏ.
  useLayoutEffect(() => {
    const goal = caretGoalRef.current;
    if (!goal || !essayRef.current) return;
    caretGoalRef.current = null;
    const s = window.getSelection();
    if (!s) return;
    const container = essayRef.current;
    let node = null;
    let offset = 0;
    if (goal.insertAnnId) {
      const insEl = container.querySelector(`ins[data-ann-id="${goal.insertAnnId}"]`);
      if (insEl && insEl.firstChild) {
        node = insEl.firstChild;
        offset = node.textContent.length;
      }
    }
    if (!node) {
      const spans = [...container.querySelectorAll("[data-os]")];
      const keepSpan = spans.find(
        (sp) =>
          sp.tagName !== "DEL" &&
          sp.tagName !== "INS" &&
          Number(sp.getAttribute("data-os")) <= goal.os &&
          goal.os <= Number(sp.getAttribute("data-oe"))
      );
      const anySpan =
        keepSpan ||
        spans.find((sp) => Number(sp.getAttribute("data-os")) <= goal.os && goal.os <= Number(sp.getAttribute("data-oe")));
      if (anySpan && anySpan.firstChild) {
        node = anySpan.firstChild;
        offset = Math.max(0, goal.os - Number(anySpan.getAttribute("data-os")));
      } else if (container.lastChild) {
        const last = container.lastChild;
        node = last.nodeType === 3 ? last : last.firstChild;
        offset = node ? (node.textContent || "").length : 0;
      }
    }
    if (!node) return;
    try {
      const range = document.createRange();
      const len = node.textContent ? node.textContent.length : 0;
      range.setStart(node, Math.max(0, Math.min(offset, len)));
      range.collapse(true);
      s.removeAllRanges();
      s.addRange(range);
    } catch {}
  }, [segments]);

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
    activeInsertRef.current = null;
    setEditId(null);
    // Toạ độ theo VIEWPORT (không trừ box) — toolbar giờ portal ra <body>,
    // định vị bằng position:fixed, để không còn là con của vùng
    // contentEditable (select/option lồng trong contentEditable có lỗi
    // tương tác trên 1 số trình duyệt: mở được dropdown nhưng bấm chọn
    // không ăn).
    setSel({ start, end, quote: essayText.slice(start, end), x: rect.left, y: rect.bottom + 6 });
    setForm({ action: "comment", insertText: "", category: "grammar", criterion: "", comment: "" });
  }

  // Bấm vào 1 chỗ ĐÃ chấm (gạch/tô, kể cả của AI) -> mở lại toolbar tại đó để
  // sửa hoặc xoá ngay, thay vì phải kéo xuống danh sách bên dưới.
  function onMarkClick(e, annId) {
    e.preventDefault(); // đừng để trình duyệt đặt con trỏ gõ vào giữa 1 mark
    e.stopPropagation();
    const a = annsRef.current.find((x) => x.id === annId);
    if (!a || !essayRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    window.getSelection()?.removeAllRanges();
    activeInsertRef.current = null;
    setSel(null);
    setEditId(a.id);
    setForm({
      action: a.action === "delete" || a.action === "replace" ? a.action : "comment",
      insertText: a.insertText || "",
      category: a.category,
      criterion: a.criterion || "",
      comment: a.comment || "",
    });
    setEditPos({ x: rect.left, y: rect.bottom + 6 });
  }

  // Có annotation nào (kể cả comment không đổi chữ) đang chiếm CHẶT ĐÚNG
  // khoảng [lo,hi) hoặc chồng lấn không — nếu có thì KHÔNG gõ/xoá trực tiếp ở
  // đây, để giáo viên dùng toolbar (tránh tự ý phá 1 annotation đã có
  // tiêu chí/ghi chú/nguồn AI).
  function overlapsExisting(lo, hi) {
    return annsRef.current.some((a) => a.start < hi && a.end > lo);
  }

  // ---- Gõ/xoá TRỰC TIẾP: chặn mọi thay đổi DOM của trình duyệt, tự quy đổi
  // thành annotation neo vào essayText gốc, rồi tự đặt lại con trỏ. ----
  function onBeforeInput(e) {
    if (!essayRef.current) return;
    const type = e.inputType || "";
    const s = window.getSelection();
    if (!s || !s.rangeCount) return;
    const r = s.getRangeAt(0);
    if (!essayRef.current.contains(r.commonAncestorContainer)) return;
    e.preventDefault();

    const a0 = boundary(r.startContainer, r.startOffset, "start");
    const b0 = boundary(r.endContainer, r.endOffset, "end");
    if (a0 == null || b0 == null) return;
    const lo = Math.min(a0, b0);
    const hi = Math.max(a0, b0);
    const collapsed = lo === hi;
    const data = e.data != null ? e.data : e.dataTransfer ? e.dataTransfer.getData("text/plain") : "";

    // Có bôi đen sẵn (không phải chỉ đặt con trỏ) — gõ đè/xoá cả đoạn đó.
    if (!collapsed) {
      if (overlapsExisting(lo, hi)) return; // đoạn này đã có chú thích -> dùng toolbar
      if (type === "insertText" || type === "insertFromPaste" || type === "insertReplacementText") {
        if (!data) return;
        const a = { id: rid(), action: "replace", start: lo, end: hi, quote: essayText.slice(lo, hi), insertText: data, category: "grammar", criterion: null, comment: "", source: "teacher" };
        emit([...annsRef.current, a]);
        queueCaret(lo, a.id);
        return;
      }
      if (type === "deleteContentBackward" || type === "deleteContentForward" || type === "deleteByCut") {
        const a = { id: rid(), action: "delete", start: lo, end: hi, quote: essayText.slice(lo, hi), insertText: "", category: "grammar", criterion: null, comment: "", source: "teacher" };
        emit([...annsRef.current, a]);
        queueCaret(lo, null);
      }
      return;
    }

    const os = lo;

    if (type === "insertText" || type === "insertFromPaste" || type === "insertReplacementText") {
      if (!data) return;
      if (activeInsertRef.current && activeInsertRef.current.os === os) {
        const cur = annsRef.current.find((x) => x.id === activeInsertRef.current.id);
        if (cur) {
          patchAnn(cur.id, { insertText: cur.insertText + data });
          queueCaret(os, cur.id);
          return;
        }
      }
      const a = { id: rid(), action: "insert", start: os, end: os, quote: "", insertText: data, category: "grammar", criterion: null, comment: "", source: "teacher" };
      emit([...annsRef.current, a]);
      queueCaret(os, a.id);
      return;
    }

    if (type === "deleteContentBackward") {
      if (activeInsertRef.current && activeInsertRef.current.os === os) {
        const cur = annsRef.current.find((x) => x.id === activeInsertRef.current.id);
        if (cur) {
          const nextText = cur.insertText.slice(0, -1);
          if (nextText) {
            patchAnn(cur.id, { insertText: nextText });
            queueCaret(os, cur.id);
          } else {
            emit(annsRef.current.filter((x) => x.id !== cur.id));
            queueCaret(os, null);
          }
          return;
        }
      }
      if (os <= 0) return;
      // Đã có 1 vùng xoá/thay thế bắt đầu NGAY tại con trỏ (vd vừa Backspace
      // xong 1 lần) -> ăn thêm 1 ký tự gốc bên trái bằng cách nới `start`,
      // thay vì tạo 1 annotation rời rạc mới sát bên.
      const adj = annsRef.current.find((a) => MUTATING.has(a.action) && a.action !== "insert" && a.start === os);
      if (adj) {
        const newStart = adj.start - 1;
        patchAnn(adj.id, { start: newStart, quote: essayText.slice(newStart, adj.end) });
        queueCaret(newStart, null);
        return;
      }
      if (overlapsExisting(os - 1, os)) return;
      const a = { id: rid(), action: "delete", start: os - 1, end: os, quote: essayText.slice(os - 1, os), insertText: "", category: "grammar", criterion: null, comment: "", source: "teacher" };
      emit([...annsRef.current, a]);
      queueCaret(os - 1, null);
      return;
    }

    if (type === "deleteContentForward") {
      if (os >= essayText.length) return;
      // Đối xứng: có vùng xoá/thay thế kết thúc NGAY tại con trỏ -> ăn thêm
      // 1 ký tự gốc bên phải bằng cách nới `end`.
      const adj = annsRef.current.find((a) => MUTATING.has(a.action) && a.action !== "insert" && a.end === os);
      if (adj) {
        const newEnd = adj.end + 1;
        patchAnn(adj.id, { end: newEnd, quote: essayText.slice(adj.start, newEnd) });
        queueCaret(os, null);
        return;
      }
      if (overlapsExisting(os, os + 1)) return;
      const a = { id: rid(), action: "delete", start: os, end: os + 1, quote: essayText.slice(os, os + 1), insertText: "", category: "grammar", criterion: null, comment: "", source: "teacher" };
      emit([...annsRef.current, a]);
      queueCaret(os, null);
    }
  }

  // React's onBeforeInput PROP is unreliable for this (it's built on a
  // composition-event polyfill, not a plain passthrough of the native
  // event — plain ASCII typing/backspace often never reaches it). Attach a
  // REAL native listener instead, via a ref so it always calls the latest
  // closure without re-attaching on every render.
  const onBeforeInputRef = useRef(onBeforeInput);
  onBeforeInputRef.current = onBeforeInput;
  useEffect(() => {
    const el = essayRef.current;
    if (!el) return;
    const handler = (e) => onBeforeInputRef.current(e);
    el.addEventListener("beforeinput", handler);
    return () => el.removeEventListener("beforeinput", handler);
  }, []);

  // node/offset trong DOM -> offset ký tự trong essayText gốc
  function boundary(node, offset, side) {
    let el = node.nodeType === 3 ? node.parentElement : node;
    while (el && el !== essayRef.current && !el.hasAttribute("data-os")) el = el.parentElement;
    if (el && el.hasAttribute("data-os")) {
      const os = Number(el.getAttribute("data-os"));
      // <ins> (chữ vừa chèn) không chiếm ký tự gốc nào — nó neo tại ĐÚNG 1
      // điểm bất kể đã gõ thêm bao nhiêu ký tự vào trong đó. Cộng thêm offset
      // trong text của nó (như làm với đoạn "keep") sẽ tính SAI vị trí, lệch
      // dần theo mỗi ký tự đã gõ — đây chính là lỗi gõ chữ nhảy lung tung.
      if (el.tagName === "INS") return os;
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
    emit([...annsRef.current, a]);
    setSel(null);
    window.getSelection()?.removeAllRanges();
  }

  function removeAnn(id) {
    emit(annsRef.current.filter((a) => a.id !== id));
  }
  function patchAnn(id, patch) {
    emit(annsRef.current.map((a) => (a.id === id ? { ...a, ...patch } : a)));
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
        <svg className="icon"><use href="#icon-info" /></svg> Bấm vào đâu gõ/xoá ngay ở đó (xoá = gạch đỏ, gõ thêm = chữ xanh). Bôi đen 1
        đoạn để gắn tiêu chí + ghi chú; bấm vào chữ đã gạch/tô (kể cả của AI) để sửa hoặc xoá chú thích đó.
      </p>
      <div
        className="essay-annot"
        ref={essayRef}
        contentEditable
        suppressContentEditableWarning
        onMouseUp={onMouseUp}
        // Grammarly (và tương tự) quét mọi vùng contentEditable và có thể
        // xung đột với cấu trúc <ins>/<del> lồng nhau ở đây, gây giật/nhảy
        // trang. Các thuộc tính này báo cho Grammarly bỏ qua khung này.
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
      >
        {segments.map((seg, i) => {
          // Key ổn định theo NỘI DUNG (id annotation, hoặc offset gốc cho
          // đoạn "keep"), KHÔNG dùng index mảng — mỗi lần gõ/xoá làm số
          // lượng segment thay đổi (thêm 1 del/ins là dịch index mọi thứ
          // phía sau), nên key={i} khiến React gán NHẦM node DOM cũ cho nội
          // dung mới ở cùng vị trí, làm việc đặt lại con trỏ (placeCaret)
          // tính sai chỗ — đây chính là lỗi gõ số nhảy lung tung vị trí.
          const key = seg.ann ? `${seg.kind}-${seg.ann.id}` : `keep-${seg.os}`;
          const clickable = !!seg.ann || (seg.marks && seg.marks.length === 1);
          const clickId = seg.ann ? seg.ann.id : seg.marks && seg.marks.length === 1 ? seg.marks[0].id : null;
          const onClick = clickable ? (e) => onMarkClick(e, clickId) : undefined;
          if (seg.kind === "ins")
            return (
              <ins
                key={key}
                className="ea-add"
                data-ann-id={seg.ann ? seg.ann.id : undefined}
                data-os={seg.ann ? seg.ann.start : undefined}
                data-oe={seg.ann ? seg.ann.start : undefined}
                onClick={onClick}
                style={clickable ? { cursor: "pointer" } : undefined}
              >
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
              key={key}
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

      </div>

      {/* Portal ra <body>, KHÔNG lồng trong vùng contentEditable ở trên —
          <select> lồng trong contentEditable mở được dropdown nhưng bấm
          chọn option không ăn trên 1 số trình duyệt. position:fixed nên
          toạ độ sel.x/y ở trên đã tính theo viewport, không trừ theo box. */}
      {(sel || editId) &&
        typeof document !== "undefined" &&
        createPortal(
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
          </div>,
          document.body
        )}

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

"use client";

import { Fragment } from "react";

// Renders the ProseMirror/TipTap doc JSON produced by the teacher WYSIWYG
// editors. Two entry points: <TheoryDoc> (lesson theory) and <NoteDoc>
// (Note/Summary Completion — needs the blank -> input wiring passed in).

function applyMarks(text, marks) {
  let el = text;
  for (const m of marks || []) {
    if (m.type === "bold") el = <strong>{el}</strong>;
    else if (m.type === "italic") el = <em>{el}</em>;
    else if (m.type === "code") el = <code>{el}</code>;
    else if (m.type === "textStyle" && m.attrs && m.attrs.color) {
      el = <span style={{ color: m.attrs.color }}>{el}</span>;
    } else if (m.type === "highlight") {
      const c = (m.attrs && m.attrs.color) || "yellow";
      el = <mark className={c && c !== "yellow" ? "mk-" + c : undefined}>{el}</mark>;
    } else if (m.type === "link" && m.attrs && m.attrs.href) {
      el = (
        <a href={m.attrs.href} target="_blank" rel="noopener noreferrer">
          {el}
        </a>
      );
    }
  }
  return el;
}

// inline children -> React. `onBlank` maps a blank node to an element;
// `onText(text, key)` optionally wraps plain (unmarked) text runs.
function inlineChildren(nodes, onBlank, onText, keyBase = "") {
  return (nodes || []).map((n, i) => {
    const k = keyBase + i;
    if (n.type === "text") {
      if (onText && (!n.marks || !n.marks.length)) return <Fragment key={i}>{onText(n.text || "", k)}</Fragment>;
      return <Fragment key={i}>{applyMarks(n.text || "", n.marks)}</Fragment>;
    }
    if (n.type === "hardBreak") return <br key={i} />;
    if (n.type === "blank" && onBlank) return <Fragment key={i}>{onBlank(Number(n.attrs && n.attrs.id), k)}</Fragment>;
    return null;
  });
}

// ---------- Theory ----------
function theoryBlock(node, i, renderText) {
  const kids = (n, kb) => inlineChildren(n.content, null, renderText, kb);
  switch (node.type) {
    case "heading": {
      const lvl = Math.min(3, Math.max(1, (node.attrs && node.attrs.level) || 1));
      const Tag = { 1: "h3", 2: "h4", 3: "h5" }[lvl];
      return <Tag key={i}>{kids(node, "b" + i + ":")}</Tag>;
    }
    case "bulletList":
      return (
        <ul key={i}>
          {(node.content || []).map((li, k) => (
            <li key={k}>{kids((li.content || [])[0] || {}, "b" + i + "-" + k + ":")}</li>
          ))}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={i}>
          {(node.content || []).map((li, k) => (
            <li key={k}>{kids((li.content || [])[0] || {}, "b" + i + "-" + k + ":")}</li>
          ))}
        </ol>
      );
    case "blockquote":
      return (
        <blockquote key={i}>
          {(node.content || []).map((p, k) => (
            <p key={k}>{kids(p, "b" + i + "-" + k + ":")}</p>
          ))}
        </blockquote>
      );
    case "horizontalRule":
      return <hr key={i} />;
    case "paragraph":
    default:
      return <p key={i}>{kids(node, "b" + i + ":")}</p>;
  }
}

export function TheoryDoc({ doc, renderText }) {
  if (!doc || !Array.isArray(doc.content)) return null;
  return <div className="lesson-text">{doc.content.map((n, i) => theoryBlock(n, i, renderText))}</div>;
}

// Tìm id ô trống ĐẦU TIÊN trong 1 node (đệ quy vào content) — dùng để tra
// formatLabel của khung qua field tương ứng, không cần lưu format riêng cho
// từng khung.
function firstBlankId(node) {
  if (!node) return null;
  if (node.type === "blank") return Number(node.attrs && node.attrs.id);
  if (Array.isArray(node.content)) {
    for (const c of node.content) {
      const id = firstBlankId(c);
      if (id != null) return id;
    }
  }
  return null;
}
function firstBlankIdInNodes(nodes) {
  for (const n of nodes || []) {
    const id = firstBlankId(n);
    if (id != null) return id;
  }
  return null;
}

// ---------- Note / Summary Completion ----------
// renderBlank(id, key) -> element (the numbered input). Content before the
// FIRST horizontalRule is the shared instructions (outside any box). Each
// horizontalRule after that starts a new boxed block — lets one section carry
// more than one instruction/word-limit group (e.g. Q31-35 "TWO WORDS ONLY",
// Q36-40 "ONE WORD ONLY") instead of just a single instructions+box split.
// `fieldsById` (optional) lets a khung whose questions were picked as "Flow-
// chart Completion" render as connected boxes+arrows like the real exam,
// instead of the plain bordered paragraph block used for every other
// Completion format.
export function NoteDoc({ doc, renderBlank, renderText, fieldsById }) {
  if (!doc || !Array.isArray(doc.content)) return null;
  const nodes = doc.content;

  const segments = [[]];
  nodes.forEach((n) => {
    if (n.type === "horizontalRule") segments.push([]);
    else segments[segments.length - 1].push(n);
  });
  const hasDivider = segments.length > 1;
  const intro = hasDivider ? segments[0] : [];
  const boxes = hasDivider ? segments.slice(1) : [segments[0]];

  const inl = (n, kb) => inlineChildren(n.content, renderBlank, renderText, kb);

  const block = (node, key) => {
    switch (node.type) {
      case "heading":
        return (node.attrs && node.attrs.level) >= 2 ? (
          <h4 key={key} className="note-h2">
            {inl(node, "b" + key + ":")}
          </h4>
        ) : (
          <h3 key={key} className="note-h1">
            {inl(node, "b" + key + ":")}
          </h3>
        );
      case "bulletList":
        return (
          <ul key={key} className="note-ul">
            {(node.content || []).map((li, k) => (
              <li key={k}>{inl((li.content || [])[0] || {}, "b" + key + "-" + k + ":")}</li>
            ))}
          </ul>
        );
      case "paragraph":
      default: {
        const kids = inl(node, "b" + key + ":");
        const empty = !(node.content && node.content.length);
        return empty ? (
          <div key={key} style={{ height: 8 }} />
        ) : (
          <p key={key} className="note-p">
            {kids}
          </p>
        );
      }
    }
  };

  // Flow-chart box: mỗi paragraph (step) thành 1 khung riêng, nối bằng mũi
  // tên xuống — heading/bulletList (nếu có, vd tiêu đề chart) vẫn hiện bình
  // thường ở trên, không đóng khung.
  const flowBlock = (node, key) => {
    if (node.type === "heading" || node.type === "bulletList") return block(node, key);
    const kids = inl(node, "b" + key + ":");
    if (!(node.content && node.content.length)) return null;
    return (
      <div key={key} className="note-flow-step">
        {kids}
      </div>
    );
  };

  const isFlowChartBox = (boxNodes) => {
    if (!fieldsById) return false;
    const id = firstBlankIdInNodes(boxNodes);
    const f = id != null ? fieldsById[id] : null;
    return !!(f && f.formatLabel === "Flow-chart Completion");
  };

  return (
    <div className="note-completion">
      {intro.map((n, i) => (
        <p key={i} className="note-completion-intro">
          {inlineChildren(n.content, renderBlank, renderText, "intro" + i + ":")}
        </p>
      ))}
      {boxes.map((boxNodes, bi) => {
        if (isFlowChartBox(boxNodes)) {
          const steps = boxNodes
            .map((n, i) => ({ n, i, el: flowBlock(n, bi + "-" + i) }))
            .filter((s) => s.el != null);
          return (
            <div key={bi} className="note-flow-chart">
              {steps.map((s, si) => (
                <Fragment key={s.i}>
                  {s.el}
                  {s.n.type !== "heading" && s.n.type !== "bulletList" && si < steps.length - 1 && (
                    <div className="note-flow-arrow" aria-hidden="true">
                      &#9660;
                    </div>
                  )}
                </Fragment>
              ))}
            </div>
          );
        }
        return (
          <div key={bi} className="note-completion-box">
            {boxNodes.map((n, i) => block(n, bi + "-" + i))}
          </div>
        );
      })}
    </div>
  );
}

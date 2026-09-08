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

// ---------- Note / Summary Completion ----------
// renderBlank(id, key) -> element (the numbered input). Content before the
// first horizontalRule is the instructions (outside the box).
export function NoteDoc({ doc, renderBlank, renderText }) {
  if (!doc || !Array.isArray(doc.content)) return null;
  const nodes = doc.content;
  const dividerAt = nodes.findIndex((n) => n.type === "horizontalRule");
  const intro = dividerAt >= 0 ? nodes.slice(0, dividerAt) : [];
  const box = dividerAt >= 0 ? nodes.slice(dividerAt + 1) : nodes;

  const inl = (n, kb) => inlineChildren(n.content, renderBlank, renderText, kb);

  const block = (node, i) => {
    switch (node.type) {
      case "heading":
        return (node.attrs && node.attrs.level) >= 2 ? (
          <h4 key={i} className="note-h2">
            {inl(node, "b" + i + ":")}
          </h4>
        ) : (
          <h3 key={i} className="note-h1">
            {inl(node, "b" + i + ":")}
          </h3>
        );
      case "bulletList":
        return (
          <ul key={i} className="note-ul">
            {(node.content || []).map((li, k) => (
              <li key={k}>{inl((li.content || [])[0] || {}, "b" + i + "-" + k + ":")}</li>
            ))}
          </ul>
        );
      case "paragraph":
      default: {
        const kids = inl(node, "b" + i + ":");
        const empty = !(node.content && node.content.length);
        return empty ? (
          <div key={i} style={{ height: 8 }} />
        ) : (
          <p key={i} className="note-p">
            {kids}
          </p>
        );
      }
    }
  };

  return (
    <div className="note-completion">
      {intro.map((n, i) => (
        <p key={i} className="note-completion-intro">
          {inlineChildren(n.content, renderBlank, renderText, "intro" + i + ":")}
        </p>
      ))}
      <div className="note-completion-box">{box.map((n, i) => block(n, i))}</div>
    </div>
  );
}

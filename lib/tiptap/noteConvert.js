// Legacy Note/Summary-Completion markup  <->  ProseMirror doc JSON.
//
// Legacy `noteText` line syntax (see lib/noteLayout.js):
//   # ...   bold centred heading      -> heading level 1
//   ## ...  sub-heading               -> heading level 2
//   - ...   bullet (consecutive = 1 list)
//   ---     divider: lines before = instructions (outside the box),
//           lines after = the note (inside the box)   -> horizontalRule
//   [[n]]   numbered blank             -> { type:"blank", attrs:{ id:n } }
//
// The blank id ties to a question id in section.fields, everywhere downstream
// (grading, DOM ids, review). Keep it stable across a round-trip.

const { blankIdsFromDoc } = require("./doc");

function inlineNodesFromText(text) {
  const re = /\[\[(\d+)\]\]/g;
  const out = [];
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ type: "text", text: text.slice(last, m.index) });
    out.push({ type: "blank", attrs: { id: Number(m[1]) } });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

function para(text) {
  const content = inlineNodesFromText(text).filter((n) => n.type !== "text" || n.text !== "");
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
}

function noteTextToDoc(noteText) {
  const raw = String(noteText == null ? "" : noteText);
  const lines = raw.split("\n");
  const dividerIdx = lines.findIndex((l) => l.trim() === "---");
  const content = [];

  const emit = (line, insideBox) => {
    const t = line.trim();
    if (/^-\s+/.test(t)) {
      const item = { type: "listItem", content: [para(t.replace(/^-\s+/, ""))] };
      const prev = content[content.length - 1];
      if (prev && prev.type === "bulletList") prev.content.push(item);
      else content.push({ type: "bulletList", content: [item] });
      return;
    }
    if (/^##\s+/.test(t)) {
      content.push({ type: "heading", attrs: { level: 2 }, content: inlineNodesFromText(t.replace(/^##\s+/, "")) });
      return;
    }
    if (/^#\s+/.test(t)) {
      content.push({ type: "heading", attrs: { level: 1 }, content: inlineNodesFromText(t.replace(/^#\s+/, "")) });
      return;
    }
    if (!t) {
      // keep spacing only inside the box; ignore stray blanks in instructions
      if (insideBox) content.push({ type: "paragraph" });
      return;
    }
    content.push(para(line));
  };

  if (dividerIdx >= 0) {
    lines.slice(0, dividerIdx).forEach((l) => emit(l, false));
    content.push({ type: "horizontalRule" });
    lines.slice(dividerIdx + 1).forEach((l) => emit(l, true));
  } else {
    lines.forEach((l) => emit(l, true));
  }

  if (content.length === 0) content.push({ type: "paragraph" });
  return { type: "doc", content };
}

// Serialize inline children (text + blank nodes) back to a markup string.
function inlineText(node) {
  return (node.content || [])
    .map((n) => {
      if (n.type === "text") return String(n.text || "");
      if (n.type === "blank") return `[[${Number(n.attrs && n.attrs.id)}]]`;
      if (n.type === "hardBreak") return " ";
      return "";
    })
    .join("");
}

function docToNoteText(doc) {
  if (!doc || !Array.isArray(doc.content)) return "";
  const lines = [];
  for (const node of doc.content) {
    switch (node.type) {
      case "heading":
        lines.push((node.attrs && node.attrs.level >= 2 ? "## " : "# ") + inlineText(node));
        break;
      case "bulletList":
        for (const li of node.content || []) {
          const p = (li.content || []).find((c) => c.type === "paragraph") || li;
          lines.push("- " + inlineText(p));
        }
        break;
      case "orderedList":
        for (const li of node.content || []) {
          const p = (li.content || []).find((c) => c.type === "paragraph") || li;
          lines.push("- " + inlineText(p));
        }
        break;
      case "horizontalRule":
        lines.push("---");
        break;
      case "paragraph":
      default:
        lines.push(inlineText(node));
        break;
    }
  }
  return lines.join("\n");
}

module.exports = { noteTextToDoc, docToNoteText, blankIdsFromDoc };

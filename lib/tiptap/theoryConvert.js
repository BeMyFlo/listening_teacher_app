// Legacy Theory-Content mini-markdown (lib/theoryFormat.js)  <->  ProseMirror doc JSON.
//
// Line rules mirror `renderTheory`:
//   # / ## / ###      -> heading level 1 / 2 / 3
//   - * / 1. 1)        -> bulletList / orderedList
//   >                 -> blockquote
//   --- / ***         -> horizontalRule
//   blank line        -> paragraph break
//   single newline in a paragraph -> hardBreak
// Inline markup handled by lib/tiptap/inlineMarkup.js.

const { inlineToNodes, nodesToInline } = require("./inlineMarkup");

function theoryToDoc(raw) {
  const lines = String(raw == null ? "" : raw).split(/\r?\n/);
  const content = [];
  let list = null; // { type, content: [listItem...] }
  let para = []; // raw lines of the current paragraph

  const flushPara = () => {
    if (!para.length) return;
    const inline = [];
    para.forEach((ln, i) => {
      if (i > 0) inline.push({ type: "hardBreak" });
      inline.push(...inlineToNodes(ln));
    });
    content.push({ type: "paragraph", content: inline });
    para = [];
  };
  const closeList = () => {
    if (list) content.push(list);
    list = null;
  };
  const pushItem = (kind, text) => {
    if (!list || list.type !== kind) {
      closeList();
      list = { type: kind, content: [] };
    }
    list.content.push({ type: "listItem", content: [{ type: "paragraph", content: inlineToNodes(text) }] });
  };

  for (const line of lines) {
    const t = line.trim();

    if (t === "") {
      flushPara();
      closeList();
      continue;
    }
    if (/^-{3,}$/.test(t) || /^\*{3,}$/.test(t)) {
      flushPara();
      closeList();
      content.push({ type: "horizontalRule" });
      continue;
    }
    const h = t.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flushPara();
      closeList();
      content.push({ type: "heading", attrs: { level: h[1].length }, content: inlineToNodes(h[2].trim()) });
      continue;
    }
    const q = t.match(/^>\s?(.*)$/);
    if (q) {
      flushPara();
      closeList();
      content.push({ type: "blockquote", content: [{ type: "paragraph", content: inlineToNodes(q[1].trim()) }] });
      continue;
    }
    const ol = t.match(/^\d+[.)]\s+(.*)$/);
    if (ol) {
      flushPara();
      pushItem("orderedList", ol[1].trim());
      continue;
    }
    const ul = t.match(/^[-*]\s+(.*)$/);
    if (ul) {
      flushPara();
      pushItem("bulletList", ul[1].trim());
      continue;
    }
    closeList();
    para.push(t);
  }
  flushPara();
  closeList();

  if (content.length === 0) content.push({ type: "paragraph" });
  return { type: "doc", content };
}

function paraLines(node) {
  // split inline content on hardBreak, serialize each run
  const runs = [[]];
  for (const n of node.content || []) {
    if (n.type === "hardBreak") runs.push([]);
    else runs[runs.length - 1].push(n);
  }
  return runs.map((r) => nodesToInline(r));
}

function docToTheoryMarkdown(doc) {
  if (!doc || !Array.isArray(doc.content)) return "";
  const out = [];
  for (const node of doc.content) {
    switch (node.type) {
      case "heading": {
        const lvl = Math.min(3, Math.max(1, (node.attrs && node.attrs.level) || 1));
        out.push("#".repeat(lvl) + " " + nodesToInline(node.content));
        break;
      }
      case "blockquote": {
        const inner = (node.content || []).map((p) => "> " + nodesToInline(p.content)).join("\n");
        out.push(inner);
        break;
      }
      case "bulletList":
        out.push(
          (node.content || [])
            .map((li) => "- " + nodesToInline(((li.content || [])[0] || {}).content))
            .join("\n")
        );
        break;
      case "orderedList":
        out.push(
          (node.content || [])
            .map((li, i) => `${i + 1}. ` + nodesToInline(((li.content || [])[0] || {}).content))
            .join("\n")
        );
        break;
      case "horizontalRule":
        out.push("---");
        break;
      case "paragraph":
      default:
        out.push(paraLines(node).join("\n"));
        break;
    }
  }
  return out.join("\n\n").trim();
}

module.exports = { theoryToDoc, docToTheoryMarkdown };

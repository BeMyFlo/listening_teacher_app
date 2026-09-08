// Bidirectional conversion between the legacy inline mini-markup used by
// lib/theoryFormat.js and an array of ProseMirror text nodes with marks.
//
// Supported (same set + precedence as theoryFormat's `inline()`):
//   `code`                 -> code mark (contents literal, no nested marks)
//   [label](https://url)   -> link mark  (http/https only; else plain label)
//   **bold**               -> bold mark
//   *italic*  _italic_      -> italic mark
//   ==text=={green|blue|pink|red}  -> coloured text (textStyle mark, attrs.color hex)
//   ==text==  (no suffix)         -> yellow highlight mark (legacy marker)

const HL_COLORS = ["green", "blue", "pink", "red", "yellow"];

// Text colour palette for Theory Content.
const TEXT_COLORS = [
  { name: "green", hex: "#059669" },
  { name: "blue", hex: "#2563eb" },
  { name: "pink", hex: "#db2777" },
  { name: "red", hex: "#dc2626" },
];
const NAME_TO_HEX = Object.fromEntries(TEXT_COLORS.map((c) => [c.name, c.hex]));
const HEX_TO_NAME = Object.fromEntries(TEXT_COLORS.map((c) => [c.hex.toLowerCase(), c.name]));

// Each token: regex + makeMark(match) -> a mark object, or null to keep the
// inner text plain. `nest` = recurse into the inner text for more marks.
const TOKENS = [
  { re: /`([^`]+?)`/, nest: false, text: (m) => m[1], makeMark: () => ({ type: "code" }) },
  {
    re: /\[([^\]]+?)\]\(([^)\s]+?)\)/,
    nest: false,
    text: (m) => m[1],
    makeMark: (m) =>
      /^https?:\/\//i.test(m[2]) ? { type: "link", attrs: { href: m[2], target: "_blank", rel: "noopener noreferrer" } } : null,
  },
  { re: /\*\*([^\n]+?)\*\*/, nest: true, text: (m) => m[1], makeMark: () => ({ type: "bold" }) },
  { re: /(?<![*\w])\*([^\n*]+?)\*(?!\*)/, nest: true, text: (m) => m[1], makeMark: () => ({ type: "italic" }) },
  { re: /(?<![_\w])_([^\n_]+?)_(?!_)/, nest: true, text: (m) => m[1], makeMark: () => ({ type: "italic" }) },
  {
    re: /==(.+?)==(?:\{(green|blue|pink|red)\})?/,
    nest: true,
    text: (m) => m[1],
    makeMark: (m) => (m[2] ? { type: "textStyle", attrs: { color: NAME_TO_HEX[m[2]] } } : { type: "highlight" }),
  },
];

// raw string -> [{ type:"text", text, marks?:[...] }]
function inlineToNodes(raw, inheritedMarks = []) {
  const s = String(raw == null ? "" : raw);
  if (!s) return [];

  let earliest = null;
  for (const tok of TOKENS) {
    const m = tok.re.exec(s);
    if (m && (!earliest || m.index < earliest.m.index)) earliest = { tok, m };
  }
  if (!earliest) return [textNode(s, inheritedMarks)];

  const { tok, m } = earliest;
  const before = s.slice(0, m.index);
  const after = s.slice(m.index + m[0].length);
  const innerText = tok.text(m);
  const mark = tok.makeMark(m);
  const out = [];

  if (before) out.push(textNode(before, inheritedMarks));

  if (!mark) {
    out.push(...inlineToNodes(innerText, inheritedMarks)); // e.g. invalid link URL
  } else {
    const marks = dedupeMarks([...inheritedMarks, mark]);
    if (tok.nest) out.push(...inlineToNodes(innerText, marks));
    else if (innerText) out.push(textNode(innerText, marks));
  }

  out.push(...inlineToNodes(after, inheritedMarks));
  return out.filter((n) => n.text !== "");
}

function textNode(text, marks) {
  const n = { type: "text", text };
  if (marks && marks.length) n.marks = marks;
  return n;
}

function dedupeMarks(marks) {
  const seen = new Set();
  const out = [];
  for (const mk of marks) {
    if (seen.has(mk.type)) continue;
    seen.add(mk.type);
    out.push(mk);
  }
  return out;
}

// [text nodes] -> raw mini-markup string
function nodesToInline(nodes) {
  return (nodes || [])
    .map((n) => {
      if (n.type === "hardBreak") return "\n";
      if (n.type === "blank") return `[[${Number(n.attrs && n.attrs.id)}]]`;
      if (n.type !== "text") return "";
      let t = String(n.text || "");
      const marks = n.marks || [];
      const has = (type) => marks.some((mk) => mk.type === type);
      const markOf = (type) => marks.find((mk) => mk.type === type);
      if (has("code")) return "`" + t + "`"; // code is literal
      if (has("bold")) t = `**${t}**`;
      if (has("italic")) t = `*${t}*`;
      if (has("textStyle") && (markOf("textStyle").attrs || {}).color) {
        const name = HEX_TO_NAME[String(markOf("textStyle").attrs.color).toLowerCase()];
        if (name) t = `==${t}=={${name}}`;
      } else if (has("highlight")) {
        t = `==${t}==`;
      }
      const link = markOf("link");
      if (link && link.attrs && link.attrs.href) t = `[${t}](${link.attrs.href})`;
      return t;
    })
    .join("");
}

module.exports = { inlineToNodes, nodesToInline, HL_COLORS, TEXT_COLORS };

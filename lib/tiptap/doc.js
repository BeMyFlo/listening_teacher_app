// Helpers for the ProseMirror/TipTap document JSON that the WYSIWYG editors
// (Theory Content + Note/Summary Completion) store. Pure data — no React, no
// TipTap imports — so it is safe to require on the server (API validation,
// migration script) as well as the client.
//
// Doc shape is standard ProseMirror JSON: { type: "doc", content: [ ...nodes ] }.
// Block nodes we use: paragraph, heading (attrs.level 1-3), bulletList /
// orderedList > listItem > paragraph, blockquote, horizontalRule.
// Inline: text nodes with marks (bold, italic, code, link{href}, highlight{color})
// plus hardBreak, and — Note editor only — an atomic `blank` node
// { type: "blank", attrs: { id: <number> } } that maps to a question id.

function isPlainObject(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

// Depth-first visit of every node in a doc (including the doc node itself).
function walkDoc(doc, visit) {
  if (!isPlainObject(doc)) return;
  visit(doc);
  const kids = Array.isArray(doc.content) ? doc.content : [];
  for (const child of kids) walkDoc(child, visit);
}

// All blank ids referenced anywhere in the doc, in document order.
function blankIdsFromDoc(doc) {
  const ids = [];
  walkDoc(doc, (n) => {
    if (n.type === "blank") {
      const id = Number(n.attrs && n.attrs.id);
      if (Number.isFinite(id)) ids.push(id);
    }
  });
  return ids;
}

// True when the doc carries no meaningful content (missing, or just blank
// paragraphs / whitespace).
function docIsEmpty(doc) {
  if (!isPlainObject(doc) || !Array.isArray(doc.content) || doc.content.length === 0) return true;
  let hasContent = false;
  walkDoc(doc, (n) => {
    if (n.type === "text" && String(n.text || "").trim()) hasContent = true;
    if (n.type === "blank" || n.type === "horizontalRule" || n.type === "image") hasContent = true;
  });
  return !hasContent;
}

// Bỏ mọi ô trống mang id này ra khỏi doc (trả về doc mới, không sửa doc cũ).
// Dùng khi giáo viên xoá câu hỏi tương ứng — nếu để ô trống ở lại, note sẽ
// có ô không ai nhập đáp án và lúc lưu bị chặn ở validateSections.
function removeBlankFromDoc(doc, id) {
  const target = Number(id);
  const strip = (node) => {
    if (!isPlainObject(node) || !Array.isArray(node.content)) return node;
    return {
      ...node,
      content: node.content
        .filter((c) => !(c.type === "blank" && Number(c.attrs && c.attrs.id) === target))
        .map(strip),
    };
  };
  return strip(doc);
}

// Đánh lại số cho các ô trống theo `idMap` (id cũ -> id mới), trả về doc mới.
// Dùng khi import thêm 1 bảng vào khung đã có sẵn câu hỏi: nội dung import
// luôn đánh số từ [[1]], phải dời sang số trống để không đè lên câu đang có.
function remapBlankIds(doc, idMap) {
  const walk = (node) => {
    if (!isPlainObject(node)) return node;
    if (node.type === "blank") {
      const old = Number(node.attrs && node.attrs.id);
      return idMap.has(old) ? { ...node, attrs: { ...node.attrs, id: idMap.get(old) } } : node;
    }
    if (!Array.isArray(node.content)) return node;
    return { ...node, content: node.content.map(walk) };
  };
  return walk(doc);
}

// Accepts anything the client might send and returns a doc object or null.
// (Deep structural validation is intentionally light — the editors only ever
// emit well-formed docs; this just guards against junk.)
function sanitizeDoc(doc) {
  if (!isPlainObject(doc) || doc.type !== "doc" || !Array.isArray(doc.content)) return null;
  return doc;
}

module.exports = { walkDoc, blankIdsFromDoc, docIsEmpty, sanitizeDoc, isPlainObject, removeBlankFromDoc, remapBlankIds };

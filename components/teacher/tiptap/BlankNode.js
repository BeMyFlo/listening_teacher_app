import { Node, mergeAttributes } from "@tiptap/core";

// Inline atomic node for a numbered answer blank in the Note/Summary Completion
// editor. Renders the same pill the student sees. The `id` attribute is the
// question id (section.fields[].id) — grading, DOM ids and review all key on it.
export const BlankNode = Node.create({
  name: "blank",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => Number(el.getAttribute("data-blank-id")) || null,
        renderHTML: (attrs) => ({ "data-blank-id": attrs.id }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-blank-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "note-preview-blank", contenteditable: "false" }),
      String(HTMLAttributes["data-blank-id"] ?? "?"),
    ];
  },

  renderText({ node }) {
    return `[[${node.attrs.id}]]`;
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("span");
      dom.className = "note-preview-blank";
      dom.contentEditable = "false";
      dom.textContent = String(node.attrs.id ?? "?");
      return { dom };
    };
  },

  addCommands() {
    return {
      insertBlank:
        (id) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { id } }),
    };
  },
});

export default BlankNode;

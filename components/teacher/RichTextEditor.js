"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { BlankNode } from "./tiptap/BlankNode";
import { TEXT_COLORS } from "@/lib/tiptap/inlineMarkup";
import { looksLikeMarkup, pasteToDoc, NOTE_RULES, THEORY_RULES } from "@/lib/tiptap/importText";

// Shared inline WYSIWYG editor for Theory Content and Note/Summary Completion.
// Stores/returns ProseMirror JSON (editor.getJSON()). `variant` picks the
// toolbar + schema restrictions.
//
// Props:
//   value            doc JSON | null
//   onChange(doc)     called with editor.getJSON() on every edit
//   variant          "theory" | "note"
//   placeholder      text
//   onRequestBlankId (note only) -> returns a new numeric id
//   onImport(rawText) replace all content from pasted AI markup; note variant
//                     also parses a trailing "Answers:" block. Enables the
//                     "Import / paste from AI" button.
export default function RichTextEditor({ value, onChange, variant = "theory", placeholder = "", onRequestBlankId, onImport }) {
  const isNote = variant === "note";
  const emitting = useRef(false);
  const editorRef = useRef(null);
  const [showImport, setShowImport] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: isNote ? [1, 2] : [1, 2, 3] },
        codeBlock: false,
        blockquote: isNote ? false : undefined,
        orderedList: isNote ? false : undefined,
      }),
      ...(isNote ? [BlankNode] : []),
      ...(isNote
        ? []
        : [
            TextStyle,
            Color,
            Highlight, // legacy content only — no toolbar button
            Link.configure({
              openOnClick: false,
              autolink: false,
              HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
            }),
          ]),
      Placeholder.configure({ placeholder }),
    ],
    content: value || { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: {
      attributes: { class: "rte-content" + (isNote ? " rte-content-note" : "") },
      // Smart paste: if the clipboard text uses our markup, convert it to
      // formatted nodes instead of dropping in raw "# ..." text.
      handlePaste: (view, event) => {
        const text = event.clipboardData && event.clipboardData.getData("text/plain");
        const ed = editorRef.current;
        if (!ed || !text || !looksLikeMarkup(text)) return false;
        try {
          const json = pasteToDoc(text, isNote);
          if (!json || !json.content || !json.content.length) return false;
          ed.chain().focus().insertContent(json.content).run();
          return true;
        } catch {
          return false;
        }
      },
    },
    onUpdate({ editor }) {
      emitting.current = true;
      onChange(editor.getJSON());
      emitting.current = false;
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Sync in external changes (e.g. lazy-converted legacy content, or an import)
  // without clobbering what the teacher is typing.
  useEffect(() => {
    if (!editor || emitting.current) return;
    const incoming = JSON.stringify(value || {});
    if (incoming === JSON.stringify(editor.getJSON())) return;
    if (editor.isFocused) return;
    editor.commands.setContent(value || { type: "doc", content: [{ type: "paragraph" }] }, false);
  }, [value, editor]);

  useEffect(() => () => editor && editor.destroy(), [editor]);

  if (!editor) return <div className="rte-shell rte-loading">Loading editor…</div>;

  const mark = (name, attrs) => editor.isActive(name, attrs);

  function addLink() {
    const prev = editor.getAttributes("link").href || "https://";
    let url;
    try {
      url = window.prompt("Link URL (https://…)", prev);
    } catch {
      url = null;
    }
    if (url == null) return;
    url = url.trim();
    if (!url) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  function insertBlank() {
    if (!onRequestBlankId) return;
    const id = onRequestBlankId();
    editor.chain().focus().insertBlank(id).run();
  }

  const hasDivider = () => {
    let found = false;
    editor.state.doc.forEach((n) => {
      if (n.type.name === "horizontalRule") found = true;
    });
    return found;
  };

  const B = ({ on, onClick, title, children, disabled }) => (
    <button
      type="button"
      className={"rte-btn" + (on ? " active" : "")}
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );

  return (
    <div className="rte-shell">
      <div className="rte-toolbar">
        <B on={mark("heading", { level: 1 })} title="Heading" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <strong>H</strong>
        </B>
        <B on={mark("heading", { level: 2 })} title="Sub-heading" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <strong>H</strong>
          <sub>2</sub>
        </B>
        {!isNote && (
          <B on={mark("heading", { level: 3 })} title="Small heading" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            <span style={{ fontSize: ".82em" }}>
              <strong>H</strong>
              <sub>3</sub>
            </span>
          </B>
        )}
        <span className="rte-sep" />

        {!isNote && (
          <>
            <B on={mark("bold")} title="Bold" onClick={() => editor.chain().focus().toggleBold().run()}>
              <b>B</b>
            </B>
            <B on={mark("italic")} title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()}>
              <i>I</i>
            </B>
            <B on={mark("code")} title="Inline code" onClick={() => editor.chain().focus().toggleCode().run()}>
              <span style={{ fontFamily: "monospace" }}>{"<>"}</span>
            </B>
            <span className="rte-sep" />
          </>
        )}

        <B on={mark("bulletList")} title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()}>
          •
        </B>
        {!isNote && (
          <>
            <B on={mark("orderedList")} title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
              1.
            </B>
            <B on={mark("blockquote")} title="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()}>
              &ldquo;
            </B>
            <B on={mark("link")} title="Link" onClick={addLink}>
              🔗
            </B>
          </>
        )}

        {isNote && (
          <B title="Insert a numbered answer blank" onClick={insertBlank}>
            + Blank
          </B>
        )}

        <B
          title={isNote ? "Divider — instructions above, notes below" : "Divider"}
          disabled={hasDivider()}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          — Divider
        </B>

        {!isNote && (
          <>
            <span className="rte-sep" />
            {TEXT_COLORS.map((c) => {
              const on = editor.isActive("textStyle", { color: c.hex });
              return (
                <button
                  key={c.name}
                  type="button"
                  className={"rte-swatch" + (on ? " active" : "")}
                  style={{ color: c.hex }}
                  title={"Text colour — " + c.name}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => (on ? editor.chain().focus().unsetColor().run() : editor.chain().focus().setColor(c.hex).run())}
                >
                  A
                </button>
              );
            })}
          </>
        )}

        {onImport && (
          <>
            <span className="rte-sep" />
            <B title="Paste content drafted by an AI" onClick={() => setShowImport(true)}>
              ⇩ Import
            </B>
          </>
        )}
      </div>
      <EditorContent editor={editor} className="rte-editorwrap" />

      {showImport && (
        <ImportDialog
          isNote={isNote}
          onClose={() => setShowImport(false)}
          onApply={(text) => {
            onImport(text);
            setShowImport(false);
          }}
        />
      )}
    </div>
  );
}

function ImportDialog({ isNote, onClose, onApply }) {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const rules = isNote ? NOTE_RULES : THEORY_RULES;

  function copyRules() {
    try {
      navigator.clipboard.writeText(rules).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    } catch {
      /* clipboard blocked — teacher can select the block manually */
    }
  }

  return (
    <div className="rte-modal-backdrop" onClick={onClose}>
      <div className="rte-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rte-modal-head">
          <strong>Import {isNote ? "Note Completion" : "Theory"} from AI</strong>
          <button type="button" className="rte-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <p className="rte-modal-hint">
          1. Give these rules to ChatGPT/Claude, together with your topic. 2. Paste what it returns
          below and press <b>Convert</b> — the formatting{isNote ? " and answers" : ""} appear
          automatically. (You can also just paste straight into the editor.)
        </p>

        <div className="rte-rules-box">
          <button type="button" className="rte-btn rte-rules-copy" onClick={copyRules}>
            {copied ? "Copied ✓" : "Copy rules"}
          </button>
          <pre>{rules}</pre>
        </div>

        <textarea
          className="rte-import-ta"
          rows={10}
          placeholder="Paste the AI's answer here…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className="rte-modal-foot">
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn" disabled={!text.trim()} onClick={() => onApply(text)}>
            Convert &amp; replace
          </button>
        </div>
      </div>
    </div>
  );
}

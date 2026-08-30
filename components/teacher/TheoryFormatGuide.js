"use client";

import { useState } from "react";

// Bảng quy định định dạng cho ô "Theory Content". Mục đích: giáo viên chụp màn
// hình / bấm "Copy rules for AI" rồi đưa cho trợ lý AI để AI viết lý thuyết
// đúng cú pháp mà lib/theoryFormat.js hiểu.

const STRUCTURE = [
  ["# Title", "Main heading"],
  ["## Section", "Section heading"],
  ["### Sub-section", "Smaller heading"],
  ["- item", "Bullet list (one item per line)"],
  ["1. item", "Numbered list"],
  ["> text", "Quote / call-out box"],
  ["---", "Horizontal divider (on its own line)"],
  ["(blank line)", "New paragraph"],
];

const EMPHASIS = [
  ["**text**", "bold", <strong key="b">bold</strong>],
  ["*text*  ·  _text_", "italic", <em key="i">italic</em>],
  ["`text`", "inline code / keyword", <code key="c">code</code>],
  ["[label](https://…)", "link — opens in a new tab", <a key="a" href="#!" onClick={(e) => e.preventDefault()}>label</a>],
];

const HIGHLIGHTS = [
  ["==text==", "yellow", "most important (default)"],
  ["==text=={green}", "green", "correct / good practice"],
  ["==text=={blue}", "blue", "definitions / key terms"],
  ["==text=={pink}", "pink", "your own convention"],
  ["==text=={red}", "red", "mistakes / warnings"],
];

const AI_RULES = `FORMATTING RULES for the theory content (a lightweight Markdown).
Use ONLY the syntax below. No raw HTML, no tables, no images.

STRUCTURE
# Title              -> main heading
## Section           -> section heading
### Sub-section      -> smaller heading
- item               -> bullet list (one item per line)
1. item              -> numbered list
> text               -> quote / call-out box
---                  -> horizontal divider (on its own line)
(blank line)         -> new paragraph

EMPHASIS
**text**             -> bold
*text*  or  _text_   -> italic
\`text\`               -> inline code / keyword
[label](https://...) -> link (opens in a new tab)

HIGHLIGHT (background colour)
==text==             -> yellow  (most important - default)
==text=={green}      -> green   (correct / good practice)
==text=={blue}       -> blue    (definitions / key terms)
==text=={pink}       -> pink
==text=={red}        -> red     (mistakes / warnings)

Keep headings short. Start each section with ## .`;

export default function TheoryFormatGuide({ onClose }) {
  const [copied, setCopied] = useState(false);

  function copyRules() {
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    try {
      navigator.clipboard.writeText(AI_RULES).then(done, done);
    } catch {
      done();
    }
  }

  return (
    <div className="theory-guide">
      <div className="theory-guide-head">
        <h4>Formatting guide</h4>
        <div className="theory-guide-actions">
          <button type="button" className="btn secondary sm" onClick={copyRules}>
            {copied ? "Copied ✓" : "Copy rules for AI"}
          </button>
          {onClose && (
            <button type="button" className="icon-btn" title="Close" onClick={onClose}>
              <svg className="icon"><use href="#icon-cross" /></svg>
            </button>
          )}
        </div>
      </div>

      <p className="theory-guide-intro">
        Write theory using this syntax — or screenshot this card / hit <b>Copy rules for AI</b> and
        paste it to your AI assistant together with your draft, so it formats the lesson your way.
      </p>

      <div className="theory-guide-grid">
        <section>
          <h5>Structure</h5>
          <table>
            <tbody>
              {STRUCTURE.map(([code, desc]) => (
                <tr key={code}>
                  <td><code>{code}</code></td>
                  <td>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h5>Emphasis</h5>
          <table>
            <tbody>
              {EMPHASIS.map(([code, desc, sample]) => (
                <tr key={code}>
                  <td><code>{code}</code></td>
                  <td>
                    {desc} <span className="theory-guide-sample">{sample}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="theory-guide-colors">
          <h5>Highlight colours</h5>
          <table>
            <tbody>
              {HIGHLIGHTS.map(([code, color, use]) => (
                <tr key={code}>
                  <td><code>{code}</code></td>
                  <td>
                    <mark className={color === "yellow" ? "" : "mk-" + color}>{color}</mark>{" "}
                    <span className="theory-guide-use">— {use}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

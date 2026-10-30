"use client";

import UnderlinedText from "@/components/student/UnderlinedText";
import { underlineModeOf, isErrorIdFormat } from "@/lib/generalFormats";

// Xem trước 1 câu hỏi (section theo shape server) dùng chung cho AiGrammarDialog,
// AiExerciseDialog và sau này là WordImport.
export default function AiQuestionPreview({ f, flag, passage, imageSrc }) {
  if (!f) return null;

  const uMode = underlineModeOf(f.formatLabel);
  const isErrorId = isErrorIdFormat(f.formatLabel);

  // Xác định text đáp án đúng
  let correctLabel = "";
  if (f.type === "choice") {
    const matched = (f.options || []).find((o) => o.value === (f.answers && f.answers[0]));
    correctLabel = matched ? matched.label : (f.answers && f.answers[0]) || "";
  } else if (f.pre) {
    // Rewrite / combine: phần mở đầu + phần học sinh gõ tiếp
    const ans = (f.answers || [])[0] || "";
    correctLabel = f.pre ? `${f.pre} ${ans}`.trim() : ans;
    if ((f.answers || []).length > 1) {
      correctLabel += ` (or: ${f.answers.slice(1).join(" / ")})`;
    }
  } else {
    correctLabel = (f.answers || []).join(" / ");
  }

  // Câu hiển thị (cho fill hoặc choice)
  const isReorder = f.type === "fill" && Array.isArray(f.tokens) && f.tokens.length > 0;
  const isRewrite = f.type === "fill" && !!f.pre;

  let sentenceNode = null;
  if (f.type === "choice") {
    if (uMode === "label") {
      sentenceNode = <UnderlinedText text={f.label} errorLetters={isErrorId} />;
    } else {
      sentenceNode = <UnderlinedText text={f.label} />;
    }
  } else if (isReorder) {
    sentenceNode = f.label ? <div>{f.label}</div> : null;
  } else if (isRewrite) {
    sentenceNode = (
      <div>
        <div>{f.label}</div>
        <div style={{ fontStyle: "italic", color: "var(--muted)", fontSize: ".84rem", marginTop: 2 }}>
          Beginning: <b>{f.pre}</b> ___
        </div>
      </div>
    );
  } else {
    // Gap fill thông thường (verb, wform, gap)
    const hintPart = f.hint ? ` ${f.hint} ` : " ";
    const text = `${f.label || ""}${hintPart}___ ${f.post || ""}`.replace(/\s+/g, " ").trim();
    sentenceNode = <UnderlinedText text={text} />;
  }

  const activeFlag = flag || f.aiFlag;

  return (
    <li className="question-preview-item" style={{ marginBottom: 10 }}>
      {passage && (
        <details style={{ margin: "4px 0 8px", fontSize: ".84rem" }}>
          <summary style={{ cursor: "pointer", color: "var(--navy)", fontWeight: 600 }}>Passage</summary>
          <div
            style={{
              whiteSpace: "pre-line",
              marginTop: 4,
              padding: "8px 12px",
              background: "var(--bg-subtle, #f8f9fa)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              maxHeight: 180,
              overflowY: "auto",
            }}
          >
            {passage}
          </div>
        </details>
      )}

      {imageSrc && (
        <div style={{ margin: "6px 0" }}>
          <img
            src={imageSrc}
            alt="Question illustration"
            style={{
              maxHeight: 120,
              maxWidth: "100%",
              borderRadius: 4,
              border: "1px solid var(--border)",
              objectFit: "contain",
              display: "block",
            }}
          />
        </div>
      )}

      <div>{sentenceNode}</div>

      {/* Mảnh sắp xếp (chip) cho câu reorder */}
      {isReorder && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "6px 0 4px" }}>
          {f.tokens.map((tok, i) => (
            <span
              key={i}
              className="chip"
              style={{
                background: "var(--bg-subtle, #f1f3f5)",
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: ".82rem",
                border: "1px solid var(--border)",
              }}
            >
              {tok}
            </span>
          ))}
        </div>
      )}

      {/* Lựa chọn cho câu choice */}
      {f.type === "choice" && Array.isArray(f.options) && f.options.length > 0 && (
        <div style={{ color: "var(--muted)", fontSize: ".82rem", marginTop: 2 }}>
          {f.options.map((o, idx) => (
            <span key={o.value || idx}>
              {idx > 0 && " · "}
              {uMode === "options" ? <UnderlinedText text={o.label} /> : o.label}
            </span>
          ))}
        </div>
      )}

      {/* Đáp án đúng + giải thích */}
      <div style={{ fontSize: ".82rem", marginTop: 2 }}>
        <b style={{ color: "var(--green)" }}>
          ✓ {uMode === "options" ? <UnderlinedText text={correctLabel} /> : correctLabel}
        </b>
        {f.explanation && <span style={{ color: "var(--muted)" }}> — {f.explanation}</span>}
      </div>

      {/* Cờ vàng cảnh báo */}
      {activeFlag && (
        <div
          style={{
            background: "#FFEBD1",
            color: "#B96C1E",
            border: "1px solid #F5DBB4",
            padding: "3px 8px",
            borderRadius: 4,
            fontSize: ".76rem",
            marginTop: 4,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span>⚠</span> <span>{activeFlag}</span>
        </div>
      )}
    </li>
  );
}

export { AiQuestionPreview as QuestionPreview };

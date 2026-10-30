"use client";

import { useState } from "react";
import { api } from "@/lib/client/api";
import { PROGRAMS, programOf } from "@/lib/curriculum";
import { GENERAL_LABELS, aiFormatsFor } from "@/lib/generalFormats";
import AiQuestionPreview from "./AiQuestionPreview";

const QUESTION_COUNTS = [5, 8, 10];
const LANGUAGES = [
  ["vi", "Vietnamese explanations"],
  ["en", "English explanations"],
];

export default function AiExerciseDialog({ context, subject = "grammar", onAdd, onClose }) {
  const aiLevel = PROGRAMS[programOf(context || {})].aiLevel;
  const availableFormats = aiFormatsFor(subject);

  const defaultLevel =
    context && context.level != null && context.level !== ""
      ? String(context.level).startsWith("Grade")
        ? String(context.level)
        : `Grade ${context.level}`
      : "";

  const [form, setForm] = useState({
    focus: (context && context.focus) || "",
    questionCount: 8,
    level: defaultLevel,
    unitName: (context && context.unitName) || "",
    textbook: (context && context.textbook) || "",
    studentLevel: (context && (context.levelName || defaultLevel)) || "",
    language: "vi",
    notes: "",
  });

  const [selectedFormats, setSelectedFormats] = useState(
    availableFormats.slice(0, Math.min(2, availableFormats.length))
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState(null); // { topics, failed, models }
  const [picked, setPicked] = useState([]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function toggleFormat(fmt) {
    if (selectedFormats.includes(fmt)) {
      setSelectedFormats(selectedFormats.filter((x) => x !== fmt));
    } else {
      if (selectedFormats.length >= 3) {
        setErr("You can choose up to 3 question types.");
        return;
      }
      setErr("");
      setSelectedFormats([...selectedFormats, fmt]);
    }
  }

  async function generate() {
    setErr("");
    if (!selectedFormats.length) return setErr("Choose 1 to 3 question types.");
    if (!form.focus.trim()) return setErr("Enter the focus of the exercise.");

    setBusy(true);
    try {
      const r = await api.teacher.aiLessonDraft({
        kind: "exercise",
        subject,
        formats: selectedFormats,
        focus: form.focus.trim(),
        questionCount: form.questionCount,
        level: form.level.trim(),
        unitName: form.unitName.trim(),
        textbook: form.textbook.trim(),
        studentLevel: form.studentLevel.trim(),
        language: form.language,
        notes: form.notes.trim(),
        program: "general",
      });
      setDraft({ topics: r.topics || [], failed: r.failed || [], models: r.models || [] });
      setPicked((r.topics || []).map(() => true));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  function handleAdd() {
    const chosen = draft.topics
      .filter((_, i) => picked[i])
      .filter((t) => (t.exerciseSections?.[0]?.fields || []).length > 0);
    if (chosen.length) onAdd(chosen);
    onClose();
  }

  const chosenCount = picked.filter(Boolean).length;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target.classList.contains("modal-overlay") && !busy && onClose()}
    >
      <div className="modal-box" style={{ maxWidth: 760, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="modal-head">
          <h3>Generate exercises with AI</h3>
          <button type="button" className="icon-btn" onClick={onClose} disabled={busy} title="Close">
            <svg className="icon"><use href="#icon-cross" /></svg>
          </button>
        </div>

        <div className="modal-body">
          {!draft ? (
            <>
              <p style={{ color: "var(--muted)", fontSize: ".86rem", marginTop: 0 }}>
                Select up to 3 question types for {subject}, set the focus, and review before adding to the builder.
              </p>

              {/* Chọn dạng bài (1–3 dạng) */}
              <div className="form-row" style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <label style={{ fontWeight: 600, fontSize: ".88rem" }}>
                    Question types ({selectedFormats.length}/3 selected)
                  </label>
                  {selectedFormats.length >= 3 && (
                    <span style={{ fontSize: ".78rem", color: "var(--amber, #b45309)" }}>Up to 3 types</span>
                  )}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: "8px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "10px 12px",
                    background: "var(--bg-subtle, #fcfcfc)",
                  }}
                >
                  {availableFormats.map((fmt) => {
                    const label = GENERAL_LABELS[fmt.replace(/^g-/, "")] || fmt;
                    const checked = selectedFormats.includes(fmt);
                    const disabled = !checked && selectedFormats.length >= 3;
                    return (
                      <label
                        key={fmt}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          cursor: disabled ? "not-allowed" : "pointer",
                          fontSize: ".84rem",
                          opacity: disabled ? 0.5 : 1,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggleFormat(fmt)}
                        />
                        <span>{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Focus (chủ điểm / từ vựng) */}
              <div className="form-row" style={{ marginBottom: 12 }}>
                <label>Focus (grammar point, vocabulary topic, or theme)</label>
                <textarea
                  rows={2}
                  maxLength={300}
                  placeholder="e.g. present perfect vs past simple; Unit 5 vocabulary: customs and traditions"
                  value={form.focus}
                  onChange={set("focus")}
                />
              </div>

              {/* Ngữ cảnh: Class / Grade + Textbook */}
              <div className="builder-2col" style={{ marginBottom: 12 }}>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <label>Class / Grade</label>
                  <input
                    type="text"
                    placeholder="e.g. Grade 8, Grade 9"
                    value={form.level}
                    onChange={set("level")}
                  />
                </div>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <label>Textbook (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Global Success 8"
                    maxLength={80}
                    value={form.textbook}
                    onChange={set("textbook")}
                  />
                </div>
              </div>

              {/* Trình độ + Ngôn ngữ giải thích */}
              <div className="builder-2col" style={{ marginBottom: 12 }}>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <label>{aiLevel.label}</label>
                  <input
                    type="text"
                    list="ai-exercise-level-suggestions"
                    placeholder={aiLevel.placeholder}
                    value={form.studentLevel}
                    onChange={set("studentLevel")}
                  />
                  <datalist id="ai-exercise-level-suggestions">
                    {aiLevel.suggestions.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </div>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <label>Explanation language</label>
                  <select value={form.language} onChange={set("language")}>
                    {LANGUAGES.map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Số câu hỏi */}
              <div className="form-row" style={{ marginBottom: 12 }}>
                <label>Questions per type</label>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  {QUESTION_COUNTS.map((n) => (
                    <label key={n} style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: ".88rem" }}>
                      <input
                        type="radio"
                        name="aiExerciseCount"
                        value={n}
                        checked={form.questionCount === n}
                        onChange={() => setForm((prev) => ({ ...prev, questionCount: n }))}
                      />
                      <span>{n} questions</span>
                    </label>
                  ))}
                  <span style={{ fontSize: ".76rem", color: "var(--muted)", marginLeft: 6 }}>
                    (Passage types like Cloze and True/False always have 5 questions)
                  </span>
                </div>
              </div>

              {/* Ghi chú thêm */}
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label>Extra requests (optional)</label>
                <textarea
                  rows={2}
                  maxLength={1000}
                  placeholder="e.g. Use everyday school situations; keep sentences short and clear."
                  value={form.notes}
                  onChange={set("notes")}
                />
              </div>

              {err && (
                <div className="notice error" style={{ marginTop: 14 }}>
                  {err}
                </div>
              )}

              <div style={{ marginTop: 16, textAlign: "right" }}>
                <button type="button" className="btn" disabled={busy} onClick={generate}>
                  <svg className="icon"><use href="#icon-sparkles" /></svg>{" "}
                  {busy ? "Generating exercises… (up to a minute)" : "Generate"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontWeight: 700, color: "var(--ink)", marginTop: 0 }}>
                {draft.topics.length} section{draft.topics.length === 1 ? "" : "s"} drafted — untick any you don&apos;t want.
              </p>

              {draft.failed.length > 0 && (
                <div className="notice error" style={{ marginTop: 0, marginBottom: 12 }}>
                  Could not write:{" "}
                  {draft.failed
                    .map(
                      (f) =>
                        `"${GENERAL_LABELS[f.topic.replace(/^g-/, "")] || f.topic}" (${f.error || "error"})`
                    )
                    .join("; ")}
                  . Go back and try again for those types.
                </div>
              )}

              <div
                style={{
                  maxHeight: 460,
                  overflowY: "auto",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "6px 14px",
                }}
              >
                {draft.topics.map((t, i) => {
                  const sec = t.exerciseSections && t.exerciseSections[0];
                  const questions = (sec && sec.fields) || [];
                  const formatName = GENERAL_LABELS[t.format.replace(/^g-/, "")] || t.format;
                  const isVerified = t.check && t.check.verified;

                  return (
                    <div
                      key={i}
                      style={{
                        padding: "12px 0",
                        borderBottom: i < draft.topics.length - 1 ? "1px solid var(--border)" : "none",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <label
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                            fontWeight: 700,
                            color: "var(--navy)",
                            cursor: "pointer",
                            fontSize: ".94rem",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={!!picked[i]}
                            onChange={(e) =>
                              setPicked((p) => p.map((v, k) => (k === i ? e.target.checked : v)))
                            }
                          />
                          <span>
                            {t.name || formatName} — {questions.length} question{questions.length === 1 ? "" : "s"}
                          </span>
                        </label>
                        <span
                          style={{
                            fontSize: ".75rem",
                            padding: "2px 6px",
                            background: "var(--bg-subtle, #f1f3f5)",
                            borderRadius: 4,
                            color: "var(--muted)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatName}
                        </span>
                      </div>

                      {/* Thông tin giám khảo */}
                      <div style={{ margin: "4px 0 6px 26px" }}>
                        {isVerified && (
                          <div style={{ fontSize: ".78rem", color: "var(--green)" }}>
                            ✓ Answer keys double-checked by a second AI pass
                            {t.check.removed && t.check.removed.length > 0 && (
                              <details style={{ color: "var(--muted)", display: "inline" }}>
                                <summary style={{ cursor: "pointer", display: "inline" }}>
                                  {" "}— {t.check.removed.length} doubtful question{t.check.removed.length === 1 ? "" : "s"} removed
                                </summary>
                                <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                                  {t.check.removed.map((r, k) => (
                                    <li key={k}>{r.text} — {r.reason}</li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </div>
                        )}
                        {t.check && !t.check.verified && (
                          <div
                            className="notice warn"
                            style={{ margin: "4px 0", padding: "4px 8px", fontSize: ".8rem" }}
                          >
                            Not verified ({t.check.error || "verifier didn't run"}) — check every answer key yourself.
                          </div>
                        )}
                      </div>

                      {/* Đoạn văn (nếu có ở Reading) */}
                      {sec && sec.passageText && (
                        <div style={{ margin: "4px 0 6px 26px" }}>
                          <details style={{ fontSize: ".84rem" }}>
                            <summary style={{ cursor: "pointer", color: "var(--navy)", fontWeight: 600 }}>
                              Reading passage
                            </summary>
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
                              {sec.passageText}
                            </div>
                          </details>
                        </div>
                      )}

                      {/* Danh sách câu hỏi preview */}
                      <div style={{ margin: "6px 0 0 26px" }}>
                        {questions.length === 0 ? (
                          <div className="notice error" style={{ margin: "4px 0 0", padding: "6px 10px", fontSize: ".82rem" }}>
                            No usable questions came back for this type — try generating again.
                          </div>
                        ) : (
                          <ol style={{ margin: 0, paddingLeft: 18 }}>
                            {questions.map((f, fi) => {
                              const flagObj = (t.flags || []).find((fl) => fl.fi === fi);
                              const flagReason = flagObj
                                ? flagObj.reason
                                : !isVerified
                                ? "Not verified — check every answer"
                                : "";
                              return (
                                <AiQuestionPreview
                                  key={f.id || fi}
                                  f={f}
                                  flag={flagReason}
                                />
                              );
                            })}
                          </ol>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p style={{ color: "var(--muted)", fontSize: ".78rem", margin: "8px 0 0" }}>
                AI-generated — please proofread and check every answer key before saving. Model:{" "}
                {draft.models.join(", ")}
              </p>

              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <button type="button" className="btn secondary" onClick={() => setDraft(null)}>
                  Back & adjust
                </button>
                <button type="button" className="btn" disabled={!chosenCount} onClick={handleAdd}>
                  Add {chosenCount} section{chosenCount === 1 ? "" : "s"} to exercise
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

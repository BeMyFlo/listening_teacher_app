"use client";

import { useState } from "react";
import { api } from "@/lib/client/api";
import { sectionsToEditor } from "@/lib/teacher/sectionTransforms";

// Chỉ là gợi ý khi bấm vào ô — giáo viên gõ gì cũng được (vd "6.5", "B2").
const LEVEL_SUGGESTIONS = [
  "3.0", "3.5", "4.0", "4.5", "5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0",
  "A1", "A2", "B1", "B2", "C1",
];

const LANGUAGES = [
  ["vi", "Vietnamese explanations, English examples"],
  ["bilingual", "Bilingual (English + Vietnamese)"],
  ["en", "English only"],
];

// Các phần giáo viên tick để AI soạn — khớp với các ô của 1 topic Grammar.
const THEORY_PARTS = [
  ["formula", "Form"],
  ["whenToUse", "When to use"],
  ["commonMistakes", "Common mistakes"],
  ["examples", "Examples"],
];

const EXERCISE_TYPES = [
  ["mcq", "Multiple choice"],
  ["fill", "Gap fill (word in brackets)"],
];

const QUESTION_COUNTS = [5, 8, 10];

function Check({ checked, onChange, children }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: ".88rem", marginRight: 14 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

// Xem trước 1 câu hỏi (section theo shape server).
function QuestionPreview({ f }) {
  const correct = f.type === "choice" ? (f.options.find((o) => o.value === f.answers[0]) || {}).label : f.answers.join(" / ");
  const sentence =
    f.type === "choice" ? f.label : `${f.label} ${f.hint ? f.hint + " " : ""}___ ${f.post}`.replace(/\s+/g, " ").trim();
  return (
    <li style={{ marginBottom: 6 }}>
      <div>{sentence}</div>
      {f.type === "choice" && (
        <div style={{ color: "var(--muted)", fontSize: ".8rem" }}>
          {f.options.map((o) => o.label).join(" · ")}
        </div>
      )}
      <div style={{ fontSize: ".8rem" }}>
        <b style={{ color: "var(--green)" }}>✓ {correct}</b>
        {f.explanation && <span style={{ color: "var(--muted)" }}> — {f.explanation}</span>}
      </div>
    </li>
  );
}

// Giáo viên mô tả lớp + chủ đề + tick các phần cần soạn -> AI soạn -> xem
// trước, chọn chủ đề muốn giữ -> thêm vào bài (chưa lưu, vẫn phải bấm Save).
export default function AiGrammarDialog({ context, onAdd, onClose }) {
  const [form, setForm] = useState({
    level: context && context.level ? `Level ${context.level}` : "",
    unitName: (context && context.unitName) || "",
    topics: "",
    studentLevel: "",
    language: "vi",
    notes: "",
  });
  const [parts, setParts] = useState(["formula", "whenToUse", "commonMistakes", "examples", "exercises"]);
  const [exerciseTypes, setExerciseTypes] = useState(["mcq", "fill"]);
  const [questionCount, setQuestionCount] = useState(8);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState(null); // { topics, failed, models }
  const [picked, setPicked] = useState([]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (list, setList, key) => (on) =>
    setList((cur) => (on ? [...new Set([...cur, key])] : cur.filter((x) => x !== key)));
  const withExercises = parts.includes("exercises");
  const allTheory = THEORY_PARTS.every(([k]) => parts.includes(k));

  async function generate() {
    setErr("");
    if (!form.topics.trim()) return setErr("Enter at least one grammar topic.");
    if (!parts.length) return setErr("Tick at least one part to generate.");
    if (withExercises && !exerciseTypes.length) return setErr("Tick at least one exercise type.");
    setBusy(true);
    try {
      const r = await api.teacher.aiLessonDraft({
        kind: "grammar",
        unitId: context && context.unitId,
        ...form,
        parts,
        exerciseTypes,
        questionCount,
      });
      setDraft({ topics: r.topics, failed: r.failed || [], models: r.models || [] });
      setPicked(r.topics.map(() => true));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  function add() {
    const chosen = draft.topics
      .filter((_, i) => picked[i])
      .map((t) => ({
        extId: "",
        name: t.name,
        lesson: t.lesson,
        exercises: t.exerciseSections.length
          ? [{ title: `${t.name} — Practice`, _sections: sectionsToEditor(t.exerciseSections) }]
          : [],
      }));
    if (chosen.length) onAdd(chosen);
    onClose();
  }

  const chosenCount = picked.filter(Boolean).length;
  const busyText = withExercises ? "Writing theory & exercises… (up to a minute)" : "Writing theory… (up to a minute)";

  return (
    <div className="modal-overlay" onClick={(e) => e.target.classList.contains("modal-overlay") && !busy && onClose()}>
      <div className="modal-box" style={{ maxWidth: 760 }}>
        <div className="modal-head">
          <h3>Create grammar lesson with AI</h3>
          <button type="button" className="icon-btn" onClick={onClose} disabled={busy}>
            <svg className="icon"><use href="#icon-cross" /></svg>
          </button>
        </div>
        <div className="modal-body">
          {!draft ? (
            <>
              <p style={{ color: "var(--muted)", fontSize: ".86rem", marginTop: 0 }}>
                Describe the class and the topics, then tick what the AI should write. You review everything before
                adding it, and can edit it afterwards.
              </p>
              <div className="builder-2col" style={{ marginBottom: 12 }}>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <label>Class / level</label>
                  <input type="text" placeholder="e.g. Level 1, Grade 7, IELTS Foundation" value={form.level} onChange={set("level")} />
                </div>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <label>Unit / lesson</label>
                  <input type="text" placeholder="e.g. Unit 3 — Education & Employment" value={form.unitName} onChange={set("unitName")} />
                </div>
              </div>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <label>Grammar topics — one per line (up to 3)</label>
                <textarea
                  rows={3}
                  placeholder={"Present simple vs present continuous\nCountable & uncountable nouns"}
                  value={form.topics}
                  onChange={set("topics")}
                />
              </div>
              <div className="builder-2col" style={{ marginBottom: 12 }}>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <label>Students&apos; level (IELTS band or CEFR)</label>
                  <input
                    type="text"
                    list="ai-grammar-level-suggestions"
                    placeholder="e.g. 6.5, 5.0–5.5, B1"
                    value={form.studentLevel}
                    onChange={set("studentLevel")}
                  />
                  <datalist id="ai-grammar-level-suggestions">
                    {LEVEL_SUGGESTIONS.map((v) => (
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

              <div className="form-row" style={{ marginBottom: 12 }}>
                <label>What should the AI write?</label>
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontWeight: 600, fontSize: ".82rem", marginBottom: 4 }}>
                    <Check
                      checked={allTheory}
                      onChange={(on) =>
                        setParts((cur) =>
                          on
                            ? [...new Set([...cur, ...THEORY_PARTS.map(([k]) => k)])]
                            : cur.filter((x) => !THEORY_PARTS.some(([k]) => k === x))
                        )
                      }
                    >
                      Theory
                    </Check>
                  </div>
                  <div style={{ paddingLeft: 22, marginBottom: 8 }}>
                    {THEORY_PARTS.map(([k, l]) => (
                      <Check key={k} checked={parts.includes(k)} onChange={toggle(parts, setParts, k)}>
                        {l}
                      </Check>
                    ))}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: ".82rem" }}>
                    <Check checked={withExercises} onChange={toggle(parts, setParts, "exercises")}>
                      Exercises
                    </Check>
                  </div>
                  {withExercises && (
                    <div style={{ paddingLeft: 22, marginTop: 4, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                      {EXERCISE_TYPES.map(([k, l]) => (
                        <Check key={k} checked={exerciseTypes.includes(k)} onChange={toggle(exerciseTypes, setExerciseTypes, k)}>
                          {l}
                        </Check>
                      ))}
                      <label style={{ fontSize: ".88rem" }}>
                        Questions per topic{" "}
                        <select value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))}>
                          {QUESTION_COUNTS.map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                  <p style={{ color: "var(--muted)", fontSize: ".76rem", margin: "8px 0 0" }}>
                    The YouTube video link isn&apos;t generated — AI tends to invent links that don&apos;t exist. Add it by hand.
                  </p>
                </div>
              </div>

              <div className="form-row" style={{ marginBottom: 0 }}>
                <label>Extra requests (optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Use examples about school life; keep it short; focus on IELTS Writing Task 2."
                  value={form.notes}
                  onChange={set("notes")}
                />
              </div>
              {err && <div className="notice error" style={{ marginTop: 14 }}>{err}</div>}
              <div style={{ marginTop: 16, textAlign: "right" }}>
                <button type="button" className="btn" disabled={busy} onClick={generate}>
                  {busy ? busyText : "Generate"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontWeight: 700, color: "var(--ink)", marginTop: 0 }}>
                {draft.topics.length} topic{draft.topics.length === 1 ? "" : "s"} drafted — untick any you don&apos;t want.
              </p>
              {draft.failed.length > 0 && (
                <div className="notice error" style={{ marginTop: 0 }}>
                  Could not write:{" "}
                  {draft.failed.map((f) => `"${f.topic}" (${f.error || "error"})`).join("; ")}. Go back and try again for
                  {draft.failed.length === 1 ? " that topic" : " those topics"}.
                </div>
              )}
              <div style={{ maxHeight: 420, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 14px" }}>
                {draft.topics.map((t, i) => {
                  const questions = t.exerciseSections.flatMap((s) => s.fields.map((f) => ({ f, section: s.name })));
                  return (
                    <div key={i} style={{ padding: "10px 0", borderBottom: i < draft.topics.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700, color: "var(--navy)", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={!!picked[i]}
                          onChange={(e) => setPicked((p) => p.map((v, k) => (k === i ? e.target.checked : v)))}
                        />
                        {t.name}
                      </label>
                      {THEORY_PARTS.map(([k, label]) =>
                        t.lesson[k] ? (
                          <div key={k} style={{ margin: "8px 0 0 24px" }}>
                            <div style={{ fontWeight: 600, fontSize: ".8rem", color: "var(--muted)" }}>{label}</div>
                            <div style={{ whiteSpace: "pre-line", fontSize: ".86rem" }}>{t.lesson[k]}</div>
                          </div>
                        ) : null
                      )}
                      {withExercises && (
                        <div style={{ margin: "10px 0 0 24px" }}>
                          <div style={{ fontWeight: 600, fontSize: ".8rem", color: "var(--muted)" }}>
                            Exercises ({questions.length} question{questions.length === 1 ? "" : "s"})
                          </div>
                          {t.check && t.check.verified && (
                            <div style={{ fontSize: ".78rem", color: "var(--green)", margin: "2px 0 4px" }}>
                              ✓ Answer keys double-checked by a second AI pass
                              {t.check.removed.length > 0 && (
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
                            <div className="notice error" style={{ margin: "4px 0" }}>
                              The answer check didn&apos;t run ({t.check.error}) — check every answer key yourself.
                            </div>
                          )}
                          {questions.length === 0 ? (
                            <div className="notice error" style={{ margin: "4px 0 0" }}>
                              No usable questions came back for this topic — try again.
                            </div>
                          ) : (
                            t.exerciseSections.map((s, si) => (
                              <div key={si} style={{ fontSize: ".86rem", marginTop: 4 }}>
                                <i>{s.name}</i>
                                <ol style={{ margin: "4px 0 0", paddingLeft: 20 }}>
                                  {s.fields.map((f) => (
                                    <QuestionPreview key={f.id} f={f} />
                                  ))}
                                </ol>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p style={{ color: "var(--muted)", fontSize: ".78rem", margin: "8px 0 0" }}>
                AI-generated — please proofread the theory and check every answer key before publishing. Model:{" "}
                {draft.models.join(", ")}
              </p>
              <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="btn secondary" onClick={() => setDraft(null)}>
                  Back & adjust
                </button>
                <button type="button" className="btn" disabled={!chosenCount} onClick={add}>
                  Add {chosenCount} topic{chosenCount === 1 ? "" : "s"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

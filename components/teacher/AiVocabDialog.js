"use client";

import { useState } from "react";
import { api } from "@/lib/client/api";
import { sectionsToEditor } from "@/lib/teacher/sectionTransforms";
import { emptyWord } from "./VocabWordTable";

const LEVEL_SUGGESTIONS = [
  "3.0", "3.5", "4.0", "4.5", "5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0",
  "A1", "A2", "B1", "B2", "C1",
];

const LANGUAGES = [
  ["vi", "Vietnamese meanings & explanations"],
  ["bilingual", "Vietnamese meanings, bilingual explanations"],
  ["en", "English only"],
];

// Cột của bảng từ (cột Word luôn có).
const COLUMNS = [
  ["partOfSpeech", "Part of speech"],
  ["ipa", "IPA"],
  ["meaning", "Meaning"],
  ["definitionEn", "Definition (EN)"],
  ["example", "Example"],
  ["collocation", "Collocation"],
  ["synonyms", "Synonyms"],
];

const EXERCISE_TYPES = [
  ["context", "Choose the word for the gap"],
  ["meaning", "Choose the meaning"],
  ["bank", "Word box (fill from a list)"],
];

const WORD_COUNTS = [8, 10, 12];
const QUESTION_COUNTS = [5, 8, 10];

function Check({ checked, onChange, children }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: ".88rem", marginRight: 14 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

function SectionPreview({ s }) {
  const box = s.matchOptions || [];
  const labelOf = (f, v) => ((f.options.length ? f.options : box).find((o) => o.value === v) || {}).label;
  return (
    <div style={{ fontSize: ".86rem", marginTop: 4 }}>
      <i>{s.name}</i>
      {box.length > 0 && (
        <div style={{ margin: "4px 0", padding: "4px 8px", border: "1px dashed var(--border)", borderRadius: 6 }}>
          {box.map((b) => b.label).join(" · ")}
        </div>
      )}
      <ol style={{ margin: "4px 0 0", paddingLeft: 20 }}>
        {s.fields.map((f) => (
          <li key={f.id} style={{ marginBottom: 6 }}>
            <div>{f.label}</div>
            {f.options.length > 0 && (
              <div style={{ color: "var(--muted)", fontSize: ".8rem" }}>{f.options.map((o) => o.label).join(" · ")}</div>
            )}
            <div style={{ fontSize: ".8rem" }}>
              <b style={{ color: "var(--green)" }}>✓ {labelOf(f, f.answers[0])}</b>
              {f.explanation && <span style={{ color: "var(--muted)" }}> — {f.explanation}</span>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CheckNote({ check }) {
  if (!check) return null;
  if (!check.verified) {
    return (
      <div className="notice error" style={{ margin: "4px 0" }}>
        The answer check didn&apos;t run ({check.error}) — check every answer key yourself.
      </div>
    );
  }
  return (
    <div style={{ fontSize: ".78rem", color: "var(--green)", margin: "2px 0 4px" }}>
      ✓ Answer keys double-checked by a second AI pass
      {check.removed.length > 0 && (
        <details style={{ color: "var(--muted)", display: "inline" }}>
          <summary style={{ cursor: "pointer", display: "inline" }}>
            {" "}— {check.removed.length} doubtful question{check.removed.length === 1 ? "" : "s"} removed
          </summary>
          <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
            {check.removed.map((r, k) => (
              <li key={k}>{r.text} — {r.reason}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// Giáo viên mô tả lớp + chủ đề + tick phần cần soạn -> AI soạn nhóm từ -> xem
// trước, chọn nhóm muốn giữ -> thêm vào bài (chưa lưu, vẫn phải bấm Save).
export default function AiVocabDialog({ context, existingWords, onAdd, onClose }) {
  const [form, setForm] = useState({
    level: context && context.level ? `Level ${context.level}` : "",
    unitName: (context && context.unitName) || "",
    topics: "",
    studentLevel: "",
    language: "vi",
    notes: "",
  });
  const [parts, setParts] = useState(["words", "exercises"]);
  const [columns, setColumns] = useState(COLUMNS.map(([k]) => k));
  const [wordCount, setWordCount] = useState(10);
  const [exerciseTypes, setExerciseTypes] = useState(EXERCISE_TYPES.map(([k]) => k));
  const [questionCount, setQuestionCount] = useState(8);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState(null);
  const [picked, setPicked] = useState([]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (setList, key) => (on) =>
    setList((cur) => (on ? [...new Set([...cur, key])] : cur.filter((x) => x !== key)));
  const withWords = parts.includes("words");
  const withExercises = parts.includes("exercises");

  async function generate() {
    setErr("");
    if (!form.topics.trim()) return setErr("Enter at least one vocabulary topic.");
    if (!parts.length) return setErr("Tick at least one part to generate.");
    if (withExercises && !exerciseTypes.length) return setErr("Tick at least one exercise type.");
    setBusy(true);
    try {
      const r = await api.teacher.aiLessonDraft({
        kind: "vocab",
        unitId: context && context.unitId,
        ...form,
        parts,
        columns,
        wordCount,
        exerciseTypes,
        questionCount,
        existingWords: existingWords || [],
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
        words: t.words.map((w) => ({ ...emptyWord(), ...w })),
        exercises: t.exerciseSections.length
          ? [{ title: `${t.name} — Practice`, _sections: sectionsToEditor(t.exerciseSections) }]
          : [],
      }));
    if (chosen.length) onAdd(chosen);
    onClose();
  }

  const chosenCount = picked.filter(Boolean).length;
  const shownCols = COLUMNS.filter(([k]) => columns.includes(k));

  return (
    <div className="modal-overlay" onClick={(e) => e.target.classList.contains("modal-overlay") && !busy && onClose()}>
      <div className="modal-box" style={{ maxWidth: 900 }}>
        <div className="modal-head">
          <h3>Create vocabulary with AI</h3>
          <button type="button" className="icon-btn" onClick={onClose} disabled={busy}>
            <svg className="icon"><use href="#icon-cross" /></svg>
          </button>
        </div>
        <div className="modal-body">
          {!draft ? (
            <>
              <p style={{ color: "var(--muted)", fontSize: ".86rem", marginTop: 0 }}>
                Describe the class and the topics, then tick what the AI should write. Words already in this unit are
                skipped. You review everything before adding it, and can edit it afterwards.
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
                <label>Vocabulary topics — one per line, one word group each (up to 3)</label>
                <textarea
                  rows={3}
                  placeholder={"Environment & pollution\nJobs and careers"}
                  value={form.topics}
                  onChange={set("topics")}
                />
              </div>
              <div className="builder-2col" style={{ marginBottom: 12 }}>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <label>Students&apos; level (IELTS band or CEFR)</label>
                  <input
                    type="text"
                    list="ai-vocab-level-suggestions"
                    placeholder="e.g. 6.5, 5.0–5.5, B1"
                    value={form.studentLevel}
                    onChange={set("studentLevel")}
                  />
                  <datalist id="ai-vocab-level-suggestions">
                    {LEVEL_SUGGESTIONS.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </div>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <label>Language</label>
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
                  <div style={{ fontWeight: 600, fontSize: ".82rem" }}>
                    <Check checked={withWords} onChange={toggle(setParts, "words")}>
                      Word list
                    </Check>
                    <label style={{ fontSize: ".88rem", fontWeight: 400 }}>
                      Words per topic{" "}
                      <select value={wordCount} onChange={(e) => setWordCount(Number(e.target.value))}>
                        {WORD_COUNTS.map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {withWords && (
                    <div style={{ paddingLeft: 22, margin: "4px 0 8px" }}>
                      <span style={{ fontSize: ".82rem", color: "var(--muted)", marginRight: 10 }}>Word +</span>
                      {COLUMNS.map(([k, l]) => (
                        <Check key={k} checked={columns.includes(k)} onChange={toggle(setColumns, k)}>
                          {l}
                        </Check>
                      ))}
                    </div>
                  )}
                  <div style={{ fontWeight: 600, fontSize: ".82rem", marginTop: 4 }}>
                    <Check checked={withExercises} onChange={toggle(setParts, "exercises")}>
                      Exercises
                    </Check>
                  </div>
                  {withExercises && (
                    <div style={{ paddingLeft: 22, marginTop: 4, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                      {EXERCISE_TYPES.map(([k, l]) => (
                        <Check key={k} checked={exerciseTypes.includes(k)} onChange={toggle(setExerciseTypes, k)}>
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
                      {!withWords && (
                        <p style={{ color: "var(--muted)", fontSize: ".76rem", margin: "2px 0 0", width: "100%" }}>
                          Without the word list, the AI still picks words for the topic to build the questions — they
                          just aren&apos;t added to the group.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-row" style={{ marginBottom: 0 }}>
                <label>Extra requests (optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Focus on collocations for IELTS Writing Task 2; include some phrasal verbs."
                  value={form.notes}
                  onChange={set("notes")}
                />
              </div>
              {err && <div className="notice error" style={{ marginTop: 14 }}>{err}</div>}
              <div style={{ marginTop: 16, textAlign: "right" }}>
                <button type="button" className="btn" disabled={busy} onClick={generate}>
                  {busy ? "Writing vocabulary… (up to a minute)" : "Generate"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontWeight: 700, color: "var(--ink)", marginTop: 0 }}>
                {draft.topics.length} word group{draft.topics.length === 1 ? "" : "s"} drafted — untick any you don&apos;t want.
              </p>
              {draft.failed.length > 0 && (
                <div className="notice error" style={{ marginTop: 0 }}>
                  Could not write: {draft.failed.map((f) => `"${f.topic}" (${f.error || "error"})`).join("; ")}. Go back
                  and try again for {draft.failed.length === 1 ? "that topic" : "those topics"}.
                </div>
              )}
              <div style={{ maxHeight: 460, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 14px" }}>
                {draft.topics.map((t, i) => {
                  const nQ = t.exerciseSections.reduce((n, s) => n + s.fields.length, 0);
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
                      {withWords && (
                        <div className="table-wrap" style={{ margin: "8px 0 0 24px" }}>
                          <table className="data-table" style={{ fontSize: ".8rem" }}>
                            <thead>
                              <tr>
                                <th>Word</th>
                                {shownCols.map(([k, l]) => (
                                  <th key={k}>{l}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {t.words.map((w, wi) => (
                                <tr key={wi}>
                                  <td><b>{w.word}</b></td>
                                  {shownCols.map(([k]) => (
                                    <td key={k}>{w[k]}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {withExercises && (
                        <div style={{ margin: "10px 0 0 24px" }}>
                          <div style={{ fontWeight: 600, fontSize: ".8rem", color: "var(--muted)" }}>
                            Exercises ({nQ} question{nQ === 1 ? "" : "s"})
                          </div>
                          <CheckNote check={t.check} />
                          {nQ === 0 ? (
                            <div className="notice error" style={{ margin: "4px 0 0" }}>
                              No usable questions came back for this topic — try again.
                            </div>
                          ) : (
                            t.exerciseSections.map((s, si) => <SectionPreview key={si} s={s} />)
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p style={{ color: "var(--muted)", fontSize: ".78rem", margin: "8px 0 0" }}>
                AI-generated — please proofread meanings{columns.includes("ipa") && withWords ? ", IPA" : ""} and every answer
                key before publishing. Model: {draft.models.join(", ")}
              </p>
              <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="btn secondary" onClick={() => setDraft(null)}>
                  Back & adjust
                </button>
                <button type="button" className="btn" disabled={!chosenCount} onClick={add}>
                  Add {chosenCount} group{chosenCount === 1 ? "" : "s"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

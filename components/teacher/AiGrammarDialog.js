"use client";

import { useState } from "react";
import { api } from "@/lib/client/api";

const PROFICIENCY = [
  ["beginner", "Beginner (A1–A2 · band 3–4)"],
  ["elementary", "Pre-intermediate (A2–B1 · band 4–5)"],
  ["intermediate", "Intermediate (B1–B2 · band 5–6)"],
  ["upper", "Upper-intermediate (B2–C1 · band 6–7+)"],
];

const LANGUAGES = [
  ["vi", "Vietnamese explanations, English examples"],
  ["bilingual", "Bilingual (English + Vietnamese)"],
  ["en", "English only"],
];

const PREVIEW_ROWS = [
  ["formula", "Form"],
  ["whenToUse", "When to use"],
  ["commonMistakes", "Common mistakes"],
  ["examples", "Examples"],
];

// Giáo viên mô tả lớp + chủ đề -> AI soạn phần lý thuyết Grammar -> xem trước,
// chọn chủ đề muốn giữ -> thêm vào bài (chưa lưu, giáo viên vẫn bấm Save).
export default function AiGrammarDialog({ context, onAdd, onClose }) {
  const [form, setForm] = useState({
    level: context && context.level ? `Level ${context.level}` : "",
    unitName: (context && context.unitName) || "",
    topics: "",
    proficiency: "elementary",
    language: "vi",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState(null); // { topics, model }
  const [picked, setPicked] = useState([]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function generate() {
    setErr("");
    if (!form.topics.trim()) {
      setErr("Enter at least one grammar topic.");
      return;
    }
    setBusy(true);
    try {
      const r = await api.teacher.aiLessonDraft({ kind: "grammar", ...form });
      setDraft({ topics: r.topics, model: r.model });
      setPicked(r.topics.map(() => true));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  function add() {
    const chosen = draft.topics.filter((_, i) => picked[i]);
    if (chosen.length) onAdd(chosen);
    onClose();
  }

  const chosenCount = picked.filter(Boolean).length;

  return (
    <div className="modal-overlay" onClick={(e) => e.target.classList.contains("modal-overlay") && !busy && onClose()}>
      <div className="modal-box" style={{ maxWidth: 760 }}>
        <div className="modal-head">
          <h3>Create grammar theory with AI</h3>
          <button type="button" className="icon-btn" onClick={onClose} disabled={busy}>
            <svg className="icon"><use href="#icon-cross" /></svg>
          </button>
        </div>
        <div className="modal-body">
          {!draft ? (
            <>
              <p style={{ color: "var(--muted)", fontSize: ".86rem", marginTop: 0 }}>
                Describe the class and the topics. The AI writes Form, When to use, Common mistakes and Examples for
                each topic — you can review it before adding, and edit anything afterwards.
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
                  <label>Students&apos; level</label>
                  <select value={form.proficiency} onChange={set("proficiency")}>
                    {PROFICIENCY.map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
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
                  {busy ? "Writing theory… (up to a minute)" : "Generate"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontWeight: 700, color: "var(--ink)", marginTop: 0 }}>
                {draft.topics.length} topic{draft.topics.length === 1 ? "" : "s"} drafted — untick any you don&apos;t want.
              </p>
              <div style={{ maxHeight: 420, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 14px" }}>
                {draft.topics.map((t, i) => (
                  <div key={i} style={{ padding: "10px 0", borderBottom: i < draft.topics.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700, color: "var(--navy)", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={!!picked[i]}
                        onChange={(e) => setPicked((p) => p.map((v, k) => (k === i ? e.target.checked : v)))}
                      />
                      {t.name}
                    </label>
                    {PREVIEW_ROWS.map(([k, label]) =>
                      t.lesson[k] ? (
                        <div key={k} style={{ margin: "8px 0 0 24px" }}>
                          <div style={{ fontWeight: 600, fontSize: ".8rem", color: "var(--muted)" }}>{label}</div>
                          <div style={{ whiteSpace: "pre-line", fontSize: ".86rem" }}>{t.lesson[k]}</div>
                        </div>
                      ) : null
                    )}
                  </div>
                ))}
              </div>
              <p style={{ color: "var(--muted)", fontSize: ".78rem", margin: "8px 0 0" }}>
                AI-generated — please proofread before publishing. Model: {draft.model}
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

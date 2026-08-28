"use client";

// Chấm Speaking: nghe audio + transcript + ghi chú theo mốc giây. AI (Gemini)
// nghe băng, gỡ transcript và đề xuất band + ghi chú. Giáo viên xem lại rồi Save.

import { useState } from "react";
import { CATEGORIES } from "@/lib/grading/annotate";

const CRIT = ["FC", "LR", "GRA", "PR"];
const CAT_LABEL = {
  grammar: "Grammar", vocabulary: "Vocabulary", spelling: "Spelling", cohesion: "Cohesion",
  punctuation: "Punctuation", task: "Task", style: "Style", other: "Other",
};
const fmtT = (s) => (s == null ? "" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);
const rid = () => Math.random().toString(36).slice(2, 10);

export default function SpeakingReview({ audioUrl, transcript, notes = [], onChange, onTranscriptChange, onAiGrade, aiBusy }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [draft, setDraft] = useState({ atSeconds: "", category: "other", criterion: "", comment: "" });

  function addNote() {
    if (!draft.comment.trim()) return;
    onChange([
      ...notes,
      {
        id: rid(),
        atSeconds: draft.atSeconds === "" ? null : Number(draft.atSeconds),
        category: draft.category,
        criterion: draft.criterion || null,
        comment: draft.comment.trim(),
        source: "teacher",
      },
    ]);
    setDraft({ atSeconds: "", category: "other", criterion: "", comment: "" });
  }
  const patch = (id, p) => onChange(notes.map((n) => (n.id === id ? { ...n, ...p } : n)));
  const remove = (id) => onChange(notes.filter((n) => n.id !== id));

  return (
    <div className="speaking-review">
      <div className="ea-bar">
        <b style={{ fontSize: ".9rem" }}>Speaking recording</b>
        {onAiGrade && (
          <button type="button" className="btn secondary ea-ai-btn" disabled={aiBusy} onClick={onAiGrade}>
            <svg className="icon"><use href="#icon-sparkles" /></svg> {aiBusy ? "Grading…" : "AI grade (Gemini)"}
          </button>
        )}
      </div>

      {audioUrl && <audio controls src={audioUrl} style={{ width: "100%", marginBottom: 10 }} />}

      <button type="button" className="rubric-showbands" onClick={() => setShowTranscript((v) => !v)}>
        {showTranscript ? "Hide transcript" : "Transcript" + (transcript ? "" : " (none yet)")}
      </button>
      {showTranscript && (
        <textarea
          className="ea-edit-ta"
          rows={6}
          style={{ width: "100%", marginTop: 6, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "inherit", fontSize: ".9rem", lineHeight: 1.6 }}
          value={transcript}
          placeholder="AI fills this in, or type what the student said…"
          onChange={(e) => onTranscriptChange(e.target.value)}
        />
      )}

      {notes.length > 0 && (
        <div className="ea-list" style={{ marginTop: 10 }}>
          {notes.map((n) => (
            <div key={n.id || n.comment} className="ea-list-item">
              {n.atSeconds != null && <span className="ea-chip">{fmtT(n.atSeconds)}</span>}
              <span className="ea-chip">{CAT_LABEL[n.category] || n.category}</span>
              <span className="ea-note" style={{ fontStyle: "normal", flex: 1, minWidth: 160 }}>{n.comment}</span>
              <select className="ea-mini" value={n.criterion || ""} onChange={(e) => patch(n.id, { criterion: e.target.value || null })}>
                <option value="">—</option>
                {CRIT.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button type="button" className="icon-btn danger" title="Remove" onClick={() => remove(n.id)}>
                <svg className="icon"><use href="#icon-trash" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="sr-addnote">
        <input type="text" placeholder="0:45" style={{ width: 56 }} value={draft.atSeconds}
          onChange={(e) => setDraft((d) => ({ ...d, atSeconds: e.target.value.replace(/[^\d.]/g, "") }))} />
        <select value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
        </select>
        <select value={draft.criterion} onChange={(e) => setDraft((d) => ({ ...d, criterion: e.target.value }))}>
          <option value="">criterion…</option>
          {CRIT.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="text" placeholder="Note…" style={{ flex: 1, minWidth: 120 }} value={draft.comment}
          onChange={(e) => setDraft((d) => ({ ...d, comment: e.target.value }))}
          onKeyDown={(e) => e.key === "Enter" && addNote()} />
        <button type="button" className="btn" style={{ padding: "6px 14px", fontSize: ".82rem" }} onClick={addNote}>Add</button>
      </div>
    </div>
  );
}

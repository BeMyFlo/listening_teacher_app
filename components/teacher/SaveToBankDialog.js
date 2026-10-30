"use client";

import { useMemo, useState } from "react";
import { api } from "@/lib/client/api";
import { usePrograms } from "@/lib/client/program";
import { PROGRAMS } from "@/lib/curriculum";
import { sectionBankInfo, sectionToBankItems, chunkItems, offsetItemError } from "@/lib/teacher/sectionToBankItems";
import BankLabelFields from "./BankLabelFields";

// Chữ thuần ngắn của đề câu để giáo viên nhận ra câu nào (bỏ thẻ <u>...</u>).
function snippet(f) {
  const t = String(f.label || f.pre || f.post || (f.tokens || []).join(" ") || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return t.length > 70 ? t.slice(0, 70) + "…" : t || "(no text)";
}

// "Save to question bank" cho 1 phần của builder. Chỉ ĐỌC section (không sửa state của builder).
export default function SaveToBankDialog({ sec, subject, program, aiContext = {}, onClose }) {
  const { levelLabel } = usePrograms();
  const levels = (PROGRAMS[program] && PROGRAMS[program].fixedLevels) || [];
  const info = useMemo(() => sectionBankInfo(sec, subject), [sec, subject]);
  const fields = sec.fields || [];

  const [ticked, setTicked] = useState(() => new Set(fields.map((_, i) => i)));
  const [keepPassage, setKeepPassage] = useState(false);
  const [labels, setLabels] = useState({
    level: levels.includes(Number(aiContext.level)) ? String(aiContext.level) : "",
    textbook: aiContext.textbook || "",
    unitLabel: aiContext.unitName || "",
    topic: "",
    difficulty: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null); // { saved, questions, skipped, error }

  const opts = (tick) => ({
    subject,
    level: Number(labels.level),
    textbook: labels.textbook.trim(),
    unitLabel: labels.unitLabel.trim(),
    topic: labels.topic.trim(),
    difficulty: labels.difficulty,
    keepPassage,
    ticked: tick,
    sourceRef: aiContext.unitName ? ("Builder: " + aiContext.unitName).slice(0, 200) : "",
  });

  // Lý do từng câu không lưu được (tính trên cả phần) -> hiện cạnh ô tick.
  const reasonByIndex = useMemo(() => {
    const full = sectionToBankItems(sec, { subject, level: 1, keepPassage });
    const byId = new Map(full.skipped.map((s) => [s.id, s.reason]));
    return fields.map((f) => byId.get(Number(f.id)) || "");
  }, [sec, subject, keepPassage, fields]);

  const asGroup = info.hasMedia && (info.needsPassage || keepPassage);
  const preview = sectionToBankItems(sec, opts([...ticked]));

  async function save() {
    if (!Number(labels.level)) {
      setErr("Choose a grade first.");
      return;
    }
    if (!preview.items.length) {
      setErr("None of the ticked questions can be saved yet. See the reasons next to each question.");
      return;
    }
    setBusy(true);
    setErr("");
    let saved = 0;
    let error = "";
    for (const batch of chunkItems(preview.items)) {
      try {
        const r = await api.teacher.createQuestionItems(program, batch);
        saved += r.created || batch.length;
      } catch (e) {
        error = offsetItemError(e.message, saved);
        const m = /^Item (\d+):/.exec(error);
        if (m && preview.names[Number(m[1]) - 1]) error += " (" + preview.names[Number(m[1]) - 1] + ")";
        break;
      }
    }
    setBusy(false);
    setResult({ saved, total: preview.items.length, questions: preview.questionCount, skipped: preview.skipped, error });
  }

  const unticked = fields.length - ticked.size;
  const toggle = (i, on) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(i);
      else next.delete(i);
      return next;
    });

  return (
    <div className="modal-overlay" onClick={(e) => e.target.classList.contains("modal-overlay") && !busy && onClose()}>
      <div className="modal-box" style={{ maxWidth: 620, width: "100%", margin: "0 auto" }}>
        <div className="modal-head">
          <h3>Save to question bank</h3>
          <button type="button" className="icon-btn" disabled={busy} onClick={onClose}>
            <svg className="icon"><use href="#icon-cross" /></svg>
          </button>
        </div>
        <div className="modal-body">
          {result ? (
            <>
              <div className={"notice " + (result.error ? "error" : "info")} style={{ marginTop: 0 }}>
                {result.error ? (
                  <>Saved {result.saved} of {result.total} item{result.total === 1 ? "" : "s"}. An error stopped the save: {result.error}</>
                ) : (
                  <>Saved {result.questions} question{result.questions === 1 ? "" : "s"} in {result.saved} item{result.saved === 1 ? "" : "s"}.</>
                )}
              </div>
              {result.skipped.length > 0 && (
                <div className="notice warn" style={{ marginTop: 10 }}>
                  <b>{result.skipped.length} question{result.skipped.length === 1 ? " was" : "s were"} not saved:</b>
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                    {result.skipped.map((s, i) => <li key={i} style={{ fontSize: ".82rem" }}>Question {s.id}: {s.reason}</li>)}
                  </ul>
                </div>
              )}
              <div style={{ marginTop: 14, textAlign: "right" }}>
                <button type="button" className="btn" onClick={onClose}>Done</button>
              </div>
            </>
          ) : (
            <>
              <div className="form-row" style={{ marginBottom: 10 }}>
                <label>Questions to save</label>
                <div style={{ maxHeight: 190, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px" }}>
                  {fields.map((f, i) => (
                    <label key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "3px 0", fontSize: ".84rem", overflowWrap: "anywhere" }}>
                      <input type="checkbox" checked={ticked.has(i)} onChange={(e) => toggle(i, e.target.checked)} style={{ marginTop: 3 }} />
                      <span>
                        <b>Q{f.id}</b> {snippet(f)}
                        {reasonByIndex[i] && <span style={{ color: "#B96C1E" }}> — cannot be saved yet: {reasonByIndex[i]}</span>}
                      </span>
                    </label>
                  ))}
                </div>
                <div style={{ fontSize: ".78rem", color: "var(--muted)", marginTop: 3 }}>
                  {ticked.size} ticked{unticked > 0 ? `, ${unticked} left out` : ""}. Questions that are not finished are skipped, not saved.
                </div>
              </div>

              {info.hasMedia && (
                <div className="form-row" style={{ marginBottom: 10 }}>
                  {info.needsPassage ? (
                    <div className="notice info" style={{ marginTop: 0 }}>
                      These question types depend on the passage, so they are saved together as one group with it.
                    </div>
                  ) : (
                    <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: ".86rem" }}>
                      <input type="checkbox" checked={keepPassage} onChange={(e) => setKeepPassage(e.target.checked)} style={{ marginTop: 3 }} />
                      <span>
                        Keep the passage with these questions (saved as one group)
                        <span style={{ display: "block", color: "var(--muted)", fontSize: ".78rem" }}>
                          {info.passage ? snippet({ label: info.passage }) : "This part has an image."} Leave unticked to save each question on its own.
                        </span>
                      </span>
                    </label>
                  )}
                </div>
              )}

              <BankLabelFields
                value={labels}
                onChange={setLabels}
                levels={levels}
                levelText={(l) => levelLabel(program, l)}
                idPrefix="sb"
              />

              <div style={{ fontSize: ".84rem", color: "var(--muted)" }}>
                {preview.items.length > 0
                  ? `Will save ${preview.questionCount} question${preview.questionCount === 1 ? "" : "s"} as ${preview.items.length} ${asGroup ? "group" : "separate item"}${preview.items.length === 1 ? "" : "s"}. Your test is not changed.`
                  : "Nothing can be saved with the current ticks."}
              </div>
              {err && <div className="notice error" style={{ marginTop: 10 }}>{err}</div>}
              <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button type="button" className="btn secondary" disabled={busy} onClick={onClose}>Cancel</button>
                <button type="button" className="btn" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save to question bank"}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

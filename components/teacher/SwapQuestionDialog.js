"use client";

// Nút "Swap" trên câu lấy từ ngân hàng + hộp nhỏ: bốc 1 câu (hoặc 1 nhóm cùng cỡ) khác cùng dạng/mức độ/chủ điểm,
// loại mọi mục đã có trong đề. Chỉ thay câu đó, giữ số câu và nhãn (G4 bước 3).
import { useState } from "react";
import { api } from "@/lib/client/api";
import { topicLabel, difficultyLabel } from "@/lib/generalTopics";
import { bankSlotOf, pickSwapCandidate, swapInSections, swapPickBody } from "@/lib/teacher/fillFromBank";

export default function SwapQuestionDialog({ swap, sections, si, fi, onApply, onClose }) {
  const f = sections[si].fields[fi];
  const slot = bankSlotOf(sections, si, fi);
  const isGroup = f.bankKind === "group";
  const [sameDifficulty, setSameDifficulty] = useState(true);
  const [sameTopic, setSameTopic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run() {
    setBusy(true);
    setMsg("");
    try {
      const body = swapPickBody({ program: swap.program, level: swap.level, sections, si, fi, excludeIds: swap.excludeIds, sameDifficulty, sameTopic });
      const r = await api.teacher.pickQuestions(body);
      const cand = pickSwapCandidate(r.items, sections, si, fi);
      if (!cand) {
        setMsg(
          isGroup
            ? `No other passage with exactly ${slot.length} question${slot.length === 1 ? "" : "s"} is available. Try loosening the filters, or add more to the bank.`
            : "No other question is available. Try loosening the filters, or add more to the bank."
        );
        return;
      }
      const res = swapInSections(sections, si, fi, cand);
      if (res.error) {
        setMsg(res.error);
        return;
      }
      onApply(res.sections, res.flags);
      onClose();
    } catch (e) {
      setMsg(e.message || "Could not reach the question bank.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target.classList.contains("modal-overlay") && !busy && onClose()}>
      <div className="modal-box" style={{ maxWidth: 460, width: "100%", margin: "0 auto" }}>
        <div className="modal-head">
          <h3>Swap {isGroup ? "passage" : "question"}</h3>
          <button type="button" className="icon-btn" disabled={busy} onClick={onClose} aria-label="Close">
            <svg className="icon"><use href="#icon-cross" /></svg>
          </button>
        </div>
        <div className="modal-body">
          <p style={{ margin: "0 0 10px", fontSize: ".9rem" }}>
            {isGroup
              ? `Replace this passage and its ${slot.length} question${slot.length === 1 ? "" : "s"} with another from the bank.`
              : "Replace this question with another from the bank."}{" "}
            Question numbers and everything else in the test stay as they are.
          </p>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 6, fontWeight: 400, marginBottom: 6 }}>
            <input type="checkbox" style={{ marginTop: 3 }} checked={sameDifficulty} disabled={!f.difficulty} onChange={(e) => setSameDifficulty(e.target.checked)} />
            <span style={{ overflowWrap: "anywhere" }}>
              Same difficulty{f.difficulty ? " (" + difficultyLabel(f.difficulty) + ")" : " — not set on this question"}
            </span>
          </label>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 6, fontWeight: 400, marginBottom: 10 }}>
            <input type="checkbox" style={{ marginTop: 3 }} checked={sameTopic} disabled={!f.topic} onChange={(e) => setSameTopic(e.target.checked)} />
            <span style={{ overflowWrap: "anywhere" }}>Same topic{f.topic ? " (" + topicLabel(f.topic) + ")" : " — not set on this question"}</span>
          </label>
          {msg && (
            <div className="notice warn" style={{ marginTop: 0, overflowWrap: "anywhere" }}>{msg}</div>
          )}
          <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn secondary" disabled={busy} onClick={onClose}>Cancel</button>
            <button type="button" className="btn" disabled={busy} onClick={run}>{busy ? "Looking…" : "Find another"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Nút nhỏ đặt trên dòng câu; chỉ hiện khi câu có bankItemId. onApply(sections mới) -> đổ vào builder.
export function SwapButton({ swap, sections, si, fi, onApply }) {
  const [open, setOpen] = useState(false);
  const f = sections[si] && sections[si].fields[fi];
  if (!swap || !f || !f.bankItemId) return null;
  if (f.bankKind === "group" && bankSlotOf(sections, si, fi)[0] !== fi) return null; // nhóm: chỉ hiện ở câu đầu
  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
        <button type="button" className="btn secondary" style={{ padding: "3px 10px", fontSize: ".78rem" }} onClick={() => setOpen(true)}>
          Swap{f.bankKind === "group" ? " passage" : ""}
        </button>
      </div>
      {open && <SwapQuestionDialog swap={swap} sections={sections} si={si} fi={fi} onApply={onApply} onClose={() => setOpen(false)} />}
    </>
  );
}

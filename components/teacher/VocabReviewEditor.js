"use client";

import { useDialog } from "@/components/ui/Dialog";
import { mergeWords } from "@/lib/teacher/vocabReviewClient";
import VocabWordTable from "./VocabWordTable";
import { VocabReviewOptions } from "./AiVocabOptions";

const EXTRA_COLS = [["context", "Context (sentence in the text)"]];

// Sub-tab "Vocab Review" của Reading / Listening: công tắc hiện cho học sinh,
// bảng từ nhập tay, và gợi ý bằng AI (kết quả hiện ngay trong tab để chọn trước
// khi thêm vào bảng — AI không ghi DB, vẫn phải bấm Save như mọi thứ khác).
//
//   review       { enabled, words, sourceHash } của skill này
//   onChange     (nextReview) => void
//   status       { state: "none"|"empty"|"stale"|"fresh", hash } — từ reviewState()
//   ai           { busy, err, draft, picked } — từ useVocabReviewAi (có thể undefined)
//   aiOptions    tuỳ chọn AI hiện tại; onAiOptionsChange(patch)
//   onGenerate   () => void  (chạy AI cho skill này)
//   onPicked / onDiscard     chọn từ trong bản nháp / bỏ bản nháp
export default function VocabReviewEditor({
  skillLabel,
  skill,
  review,
  onChange,
  status,
  ai,
  aiOptions,
  onAiOptionsChange,
  onGenerate,
  onPicked,
  onDiscard,
  hasTranscript,
}) {
  const dialog = useDialog();
  const busy = !!(ai && ai.busy);
  const draft = ai && ai.draft;
  const picked = (ai && ai.picked) || [];
  const chosen = draft ? draft.words.filter((_, i) => picked[i]) : [];
  const canGenerate = status.state !== "none" && !busy;

  // Giáo viên tự sửa bảng từ khi chưa gắn với bản bài nào (sourceHash rỗng) thì coi
  // danh sách khớp với bài hiện tại — nếu không sẽ bị hỏi "tạo từ vựng?" sau mỗi lần Save.
  function setWords(words) {
    onChange({ ...review, words, sourceHash: review.sourceHash || (words.length ? status.hash : "") });
  }

  function applyDraft(replace) {
    if (!chosen.length) return;
    const base = replace ? [] : review.words;
    const { words, dropped } = mergeWords(base, chosen);
    onChange({
      ...review,
      words,
      sourceHash: draft.hash,
      // Lần đầu có từ thì tự bật; giáo viên đã chủ động tắt khi đã có từ thì giữ nguyên.
      enabled: review.words.length ? review.enabled : true,
    });
    onDiscard();
    dialog.toast(
      dropped
        ? `Added words (limit reached — ${dropped} left out). Review, then Save`
        : `Added ${chosen.length} word${chosen.length === 1 ? "" : "s"} — review, then Save`
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Vocab Review ({review.words.length})</h3>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: ".9rem" }}>
          <input
            type="checkbox"
            checked={!!review.enabled}
            onChange={(e) => onChange({ ...review, enabled: e.target.checked })}
          />
          Show to students
        </label>
      </div>
      <p style={{ color: "var(--muted)", fontSize: ".86rem", margin: "4px 0 12px" }}>
        Words worth reviewing from the {skillLabel} exercises. Students get this as a <b>Review</b> tab once they have
        finished every {skillLabel} exercise.
        {review.enabled && !review.words.length && " Add at least one word — students see nothing until then."}
      </p>

      {status.state === "stale" && (
        <div className="notice warn" style={{ margin: "0 0 12px" }}>
          <svg className="icon"><use href="#icon-warning" /></svg> The exercises changed since this list was made.
          Generate again to pick up new words — words already in the list are kept.
        </div>
      )}
      {status.state === "none" && (
        <div className="notice info" style={{ margin: "0 0 12px" }}>
          Add {skillLabel} exercises first to let the AI suggest
          words. You can still type words in by hand.
        </div>
      )}
      {skill === "listening" && status.state !== "none" && !hasTranscript && (
        <p style={{ color: "var(--muted)", fontSize: ".82rem", margin: "0 0 12px" }}>
          Tip: add a transcript to the listening sections for better results — the AI can&apos;t hear the audio, so
          without one it only sees the questions, notes and answers.
        </p>
      )}

      <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="btn secondary" style={{ padding: "8px 14px", fontSize: ".85rem" }} disabled={!canGenerate} onClick={onGenerate}>
            <svg className="icon"><use href="#icon-sparkles" /></svg> {busy ? "Writing vocabulary… (up to a minute)" : "Generate with AI"}
          </button>
          <span style={{ color: "var(--muted)", fontSize: ".8rem" }}>
            Reads the {skillLabel} exercises as they are now (no need to save first).
          </span>
        </div>
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer", fontSize: ".86rem", color: "var(--muted)" }}>AI options</summary>
          <div style={{ marginTop: 10 }}>
            <VocabReviewOptions opts={aiOptions} onChange={onAiOptionsChange} idSuffix={"-" + skill} />
          </div>
        </details>
        {ai && ai.err && <div className="notice error" style={{ marginTop: 10 }}>{ai.err}</div>}
      </div>

      {draft && (
        <div style={{ border: "1px solid var(--blue-border)", background: "var(--blue-light)", borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
          <p style={{ fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" }}>
            {draft.words.length} word{draft.words.length === 1 ? "" : "s"} suggested — untick any you don&apos;t want.
          </p>
          <div className="table-wrap" style={{ maxHeight: 360, overflowY: "auto", background: "var(--card)" }}>
            <table className="data-table" style={{ fontSize: ".82rem" }}>
              <thead>
                <tr>
                  <th />
                  <th>Word</th>
                  <th>Meaning</th>
                  <th>In the text</th>
                </tr>
              </thead>
              <tbody>
                {draft.words.map((w, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        type="checkbox"
                        checked={!!picked[i]}
                        onChange={(e) => onPicked(picked.map((v, k) => (k === i ? e.target.checked : v)))}
                      />
                    </td>
                    <td><b>{w.word}</b></td>
                    <td>{w.meaning || w.definitionEn}</td>
                    <td style={{ color: "var(--muted)" }}>{w.context}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {draft.removed.length > 0 && (
            <details style={{ marginTop: 8, fontSize: ".8rem", color: "var(--muted)" }}>
              <summary style={{ cursor: "pointer" }}>
                Suggested but not found in the exercises ({draft.removed.length}) — left out
              </summary>
              <p style={{ margin: "4px 0 0" }}>{draft.removed.join(", ")}</p>
            </details>
          )}
          <p style={{ color: "var(--muted)", fontSize: ".78rem", margin: "8px 0 0" }}>
            AI-generated — please proofread meanings{aiOptions.columns.includes("ipa") ? ", IPA" : ""} before publishing.
            Model: {draft.model}
          </p>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn" disabled={!chosen.length} onClick={() => applyDraft(false)}>
              Add {chosen.length} to list
            </button>
            <button type="button" className="btn secondary" disabled={!chosen.length} onClick={() => applyDraft(true)}>
              Replace list
            </button>
            <button type="button" className="btn secondary" onClick={onDiscard}>
              Discard
            </button>
          </div>
        </div>
      )}

      <VocabWordTable words={review.words} extraCols={EXTRA_COLS} onChange={setWords} />
    </div>
  );
}

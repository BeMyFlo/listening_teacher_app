"use client";

// Form chỉnh "Suggested Actions" — 3 mục cố định: Priorities (đúng 3 ý),
// Topic vocabulary (5–8 từ), Improved sample. AI điền sẵn, giáo viên sửa lại
// trước khi Save. Xem components/SuggestedActionsBox.js cho bản chỉ xem.

export default function SuggestedActionsEditor({ priorities, onPrioritiesChange, topicVocabulary, onTopicVocabularyChange, improvedSample, onImprovedSampleChange, mainIssue, onMainIssueChange }) {
  const p = [priorities[0] || "", priorities[1] || "", priorities[2] || ""];

  function setPriority(i, val) {
    const next = [...p];
    next[i] = val;
    onPrioritiesChange(next);
  }

  function addVocab() {
    onTopicVocabularyChange([...topicVocabulary, { term: "", meaning: "", example: "" }]);
  }
  function patchVocab(i, patch) {
    onTopicVocabularyChange(topicVocabulary.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }
  function removeVocab(i) {
    onTopicVocabularyChange(topicVocabulary.filter((_, idx) => idx !== i));
  }

  return (
    <div className="card suggested-actions-editor" style={{ marginTop: 12 }}>
      <h4 style={{ margin: "0 0 10px" }}>
        <svg className="icon"><use href="#icon-sparkles" /></svg> Suggested Actions
      </h4>

      {onMainIssueChange && (
        <>
          <label className="sa-label">Main issue (1 câu — vấn đề chính của bài)</label>
          <input
            type="text"
            className="sa-input"
            placeholder="Vấn đề quan trọng nhất em cần sửa ở bài này..."
            value={mainIssue || ""}
            onChange={(e) => onMainIssueChange(e.target.value)}
          />
        </>
      )}

      <label className="sa-label" style={onMainIssueChange ? { marginTop: 10 } : undefined}>Priorities for next time (tối đa 3)</label>
      {[0, 1, 2].map((i) => (
        <input
          key={i}
          type="text"
          className="sa-input"
          placeholder={`Priority ${i + 1}...`}
          value={p[i]}
          onChange={(e) => setPriority(i, e.target.value)}
        />
      ))}

      <label className="sa-label" style={{ marginTop: 10 }}>Topic-specific vocabulary (0–5)</label>
      {topicVocabulary.map((v, i) => (
        <div key={i} className="sa-vocab-row">
          <input type="text" placeholder="term" style={{ width: 130 }} value={v.term} onChange={(e) => patchVocab(i, { term: e.target.value })} />
          <input type="text" placeholder="nghĩa (tiếng Việt)" style={{ flex: 1, minWidth: 120 }} value={v.meaning} onChange={(e) => patchVocab(i, { meaning: e.target.value })} />
          <input type="text" placeholder="example sentence" style={{ flex: 1, minWidth: 160 }} value={v.example} onChange={(e) => patchVocab(i, { example: e.target.value })} />
          <button type="button" className="icon-btn danger" title="Remove" onClick={() => removeVocab(i)}>
            <svg className="icon"><use href="#icon-trash" /></svg>
          </button>
        </div>
      ))}
      <button type="button" className="btn secondary" style={{ padding: "6px 12px", marginTop: 4 }} onClick={addVocab}>
        + Add word
      </button>

      <label className="sa-label" style={{ marginTop: 10 }}>Improved sample answer</label>
      <textarea
        className="sa-input"
        rows={5}
        placeholder="A realistic rewrite of the student's own answer..."
        value={improvedSample}
        onChange={(e) => onImprovedSampleChange(e.target.value)}
      />
    </div>
  );
}

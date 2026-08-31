"use client";

// Box "Suggested Actions" — chỉ xem, hiện cùng bảng điểm (Writing/Speaking).
// 3 mục cố định: Priorities, Topic vocabulary, Improved sample answer.
export default function SuggestedActionsBox({ priorities = [], topicVocabulary = [], improvedSample = "", mainIssue = "" }) {
  const hasPriorities = priorities.some((p) => p && p.trim());
  const hasVocab = topicVocabulary.length > 0;
  const hasSample = !!(improvedSample && improvedSample.trim());
  const hasMainIssue = !!(mainIssue && mainIssue.trim());
  if (!hasPriorities && !hasVocab && !hasSample && !hasMainIssue) return null;

  return (
    <div className="suggested-actions-box">
      <h4 style={{ margin: "0 0 10px" }}>
        <svg className="icon"><use href="#icon-sparkles" /></svg> Suggested Actions
      </h4>

      {hasPriorities && (
        <>
          <div className="sa-section-title">Priorities for next time</div>
          <ol className="sa-priorities">
            {priorities.filter((p) => p && p.trim()).map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ol>
        </>
      )}

      {hasVocab && (
        <>
          <div className="sa-section-title">Topic-specific vocabulary</div>
          <ul className="sa-vocab-list">
            {topicVocabulary.map((v, i) => (
              <li key={i}>
                <b>{v.term}</b>
                {v.meaning ? <> — {v.meaning}</> : null}
                {v.example ? <div className="sa-vocab-example">"{v.example}"</div> : null}
              </li>
            ))}
          </ul>
        </>
      )}

      {(hasMainIssue || hasSample) && (
        <>
          <div className="sa-section-title">Improved Sample Answer</div>
          {hasMainIssue && (
            <p className="sa-main-issue"><b>Main issue:</b> {mainIssue}</p>
          )}
          {hasSample && <p className="sa-sample">{improvedSample}</p>}
        </>
      )}
    </div>
  );
}

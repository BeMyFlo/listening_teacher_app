// Bảng "By topic": Topic · Questions · Correct %. Chủ điểm yếu nhất lên đầu. Rỗng -> không hiện gì.
export default function TopicStatsTable({ topicStats }) {
  if (!topicStats || !topicStats.length) return null;
  return (
    <div style={{ margin: "16px 0" }}>
      <h4 style={{ margin: "0 0 8px" }}>By topic</h4>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Topic</th>
              <th>Questions</th>
              <th>Correct %</th>
            </tr>
          </thead>
          <tbody>
            {topicStats.map((t) => (
              <tr key={t.topic}>
                <td style={{ wordBreak: "break-word" }}>{t.label}</td>
                <td>{t.questions}</td>
                <td>{t.pct == null ? "—" : `${t.pct}% (${t.correct}/${t.attempts})`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Bảng "By part": Part · Questions · Correct · Score /10. Dùng chung trang học sinh + giáo viên.
import { tenPoint } from "@/lib/tenPoint";

export default function PartResultsTable({ parts }) {
  if (!parts || !parts.length) return null;
  return (
    <div style={{ margin: "16px 0" }}>
      <h4 style={{ margin: "0 0 8px" }}>By part</h4>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Part</th>
              <th>Questions</th>
              <th>Correct</th>
              <th>Score /10</th>
            </tr>
          </thead>
          <tbody>
            {parts.map((p, i) => {
              const t = tenPoint(p.score, p.maxScore);
              return (
                <tr key={i}>
                  <td>{p.name}</td>
                  <td>{p.range.replace(/^Questions? /, "")}</td>
                  <td>{p.correct} / {p.total}</td>
                  <td>{t == null ? "—" : t}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

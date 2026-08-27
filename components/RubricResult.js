"use client";

import { getRubric } from "@/lib/grading/rubric";

// Hiển thị kết quả chấm theo rubric IELTS: điểm tổng + bảng 4 tiêu chí
// (band + mô tả + ghi chú). Dùng cho cả giáo viên (bản tóm tắt đã chấm) lẫn
// học sinh. Nếu submission cũ không có `criteria`, chỉ hiện điểm tổng.
export default function RubricResult({
  rubricVariant,
  criteria = [],
  manualScore,
  manualFeedback,
  showDescriptors = true,
  showFeedback = true,
}) {
  const rubric = rubricVariant ? getRubric(rubricVariant) : null;
  const byKey = {};
  (rubric?.criteria || []).forEach((c) => (byKey[c.key] = c));

  return (
    <div className="rubric-result">
      <div className="rubric-result-band">
        Band <span>{manualScore != null ? manualScore : "—"}</span>
        {rubric && <small>{rubric.label}</small>}
      </div>

      {criteria.length > 0 && (
        <table>
          <tbody>
            {criteria.map((c) => {
              const meta = byKey[c.key];
              const bd = meta && meta.bands ? meta.bands[String(c.band)] : null;
              return (
                <tr key={c.key}>
                  <td className="b">{c.band}</td>
                  <td>
                    <div className="crit">
                      {meta ? meta.label : c.key} <span style={{ color: "var(--muted)", fontWeight: 500 }}>({c.key})</span>
                    </div>
                    {showDescriptors && bd && (
                      <div className="note">
                        {bd.en}
                        {bd.vi ? " — " + bd.vi : ""}
                      </div>
                    )}
                    {c.comment && (
                      <div className="note">
                        <b>Note:</b> {c.comment}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {showFeedback && manualFeedback && (
        <p style={{ marginTop: 8 }}>
          <b>Feedback:</b> {manualFeedback}
        </p>
      )}
    </div>
  );
}

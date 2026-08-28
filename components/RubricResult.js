"use client";

import { getRubric } from "@/lib/grading/rubric";
import AnnotatedEssay from "@/components/AnnotatedEssay";

// Hiển thị kết quả chấm theo rubric IELTS: điểm tổng + bảng 4 tiêu chí
// (band + mô tả + ghi chú). Dùng cho cả giáo viên (bản tóm tắt đã chấm) lẫn
// học sinh. Nếu submission cũ không có `criteria`, chỉ hiện điểm tổng.
const CAT_LABEL = {
  grammar: "Grammar", vocabulary: "Vocabulary", spelling: "Spelling", cohesion: "Cohesion",
  punctuation: "Punctuation", task: "Task", style: "Style", other: "Other",
};
const fmtT = (s) => (s == null ? "" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);

export default function RubricResult({
  rubricVariant,
  criteria = [],
  manualScore,
  manualFeedback,
  essayText,
  annotations,
  audioUrl,
  transcript,
  speakingNotes,
  showDescriptors = true,
  showFeedback = true,
}) {
  const rubric = rubricVariant ? getRubric(rubricVariant) : null;
  const byKey = {};
  (rubric?.criteria || []).forEach((c) => (byKey[c.key] = c));

  return (
    <div className="rubric-result">
      {essayText && annotations && annotations.length > 0 && (
        <AnnotatedEssay essayText={essayText} annotations={annotations} />
      )}
      {audioUrl && (
        <div className="annotated-essay">
          <audio controls src={audioUrl} style={{ width: "100%" }} />
          {transcript && (
            <details className="sr-transcript">
              <summary>Transcript</summary>
              <p>{transcript}</p>
            </details>
          )}
          {speakingNotes && speakingNotes.length > 0 && (
            <ul className="ea-readlist">
              {speakingNotes.map((n, i) => (
                <li key={i}>
                  <span className="pill pill-info">{n.criterion || CAT_LABEL[n.category] || n.category}</span>{" "}
                  {n.atSeconds != null ? <b>{fmtT(n.atSeconds)} · </b> : null}
                  {n.comment}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
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

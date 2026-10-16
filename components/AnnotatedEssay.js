"use client";

// Hiển thị bài viết đã được chấm inline (chỉ đọc): chữ thêm = xanh, chữ xoá =
// đỏ gạch, đoạn có ghi chú = gạch chân xanh dương, bấm vào hiện popup ghi chú. Kèm danh sách ghi chú theo
// tiêu chí. Dùng ở màn kết quả của giáo viên và học sinh.
// Chỗ sửa (replace/delete/insert) có kèm comment cũng bấm được để xem ghi chú —
// học sinh không có danh sách lỗi bên dưới nên đây là chỗ duy nhất các em đọc được.

import { useEffect, useMemo, useState } from "react";
import { buildSegments, normalizeAnnotation } from "@/lib/grading/annotate";

const CAT_LABEL = {
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  spelling: "Spelling",
  cohesion: "Cohesion",
  punctuation: "Punctuation",
  idea: "Idea/Logic",
  task: "Idea/Logic",
  style: "Vocabulary",
  other: "Other",
};

export default function AnnotatedEssay({ essayText = "", annotations = [], showList = true, showText = true, showListPill = true }) {
  const anns = useMemo(
    () => (annotations || []).map((a) => normalizeAnnotation(a, essayText)),
    [annotations, essayText]
  );
  const segments = useMemo(() => buildSegments(essayText, anns), [essayText, anns]);
  const [pop, setPop] = useState(null); // { x, y, marks }
  useEffect(() => {
    if (!pop) return;
    const close = () => setPop(null);
    const onKey = (e) => e.key === "Escape" && close();
    document.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [pop]);
  if (!essayText) return null;

  return (
    <div className="annotated-essay">
      {showText && (
      <div className="essay-annot readonly">
        {segments.map((seg, i) => {
          const marks = seg.marks || [];
          const fixNote = seg.ann && seg.ann.comment ? [seg.ann] : [];
          const popMarks = [...fixNote, ...marks];
          const Tag = seg.kind === "ins" ? "ins" : seg.kind === "del" ? "del" : "span";
          const cls =
            (seg.kind === "ins" ? "ea-add" : seg.kind === "del" ? "ea-del" : "") +
            (marks.length ? " ea-hl" : "") +
            (fixNote.length ? " ea-has-note" : "");
          const onClick = popMarks.length
            ? (e) => {
                e.stopPropagation();
                const r = e.currentTarget.getBoundingClientRect();
                setPop({ x: Math.max(8, Math.min(r.left, window.innerWidth - 316)), y: r.bottom + 6, marks: popMarks });
              }
            : undefined;
          return (
            <Tag key={i} className={cls.trim() || undefined} onClick={onClick} title={fixNote.length ? "Click to see the teacher's note" : undefined}>
              {seg.text}
            </Tag>
          );
        })}
      </div>
      )}
      {pop && (
        <div className="ea-pop" style={{ left: pop.x, top: pop.y }} onClick={(e) => e.stopPropagation()}>
          {pop.marks.map((m, i) => (
            <div key={i} className="ea-pop-item">
              <div className="ea-pop-tag">{[m.criterion, CAT_LABEL[m.category]].filter(Boolean).join(" · ")}</div>
              {m.comment || <i>No note</i>}
            </div>
          ))}
        </div>
      )}

      {showList && anns.length > 0 && (
        <ul className="ea-readlist">
          {anns.map((a) => (
            <li key={a.id}>
              {showListPill && (
                <>
                  <span className={"pill " + (a.action === "delete" ? "pill-danger" : a.action === "comment" ? "pill-info" : "pill-ok")}>
                    {a.criterion || CAT_LABEL[a.category]}
                  </span>{" "}
                </>
              )}
              <span className="ea-quote">
                “{a.quote || "∅"}”{a.insertText ? <> → <b>{a.insertText.trim()}</b></> : null}
              </span>
              {a.comment ? <> — {a.comment}</> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

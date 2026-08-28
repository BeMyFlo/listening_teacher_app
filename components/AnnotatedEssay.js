"use client";

// Hiển thị bài viết đã được chấm inline (chỉ đọc): chữ thêm = xanh, chữ xoá =
// đỏ gạch, đoạn có ghi chú = highlight + tooltip. Kèm danh sách ghi chú theo
// tiêu chí. Dùng ở màn kết quả của giáo viên và học sinh.

import { useMemo } from "react";
import { buildSegments, normalizeAnnotation } from "@/lib/grading/annotate";

const CAT_LABEL = {
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  spelling: "Spelling",
  cohesion: "Cohesion",
  punctuation: "Punctuation",
  task: "Task",
  style: "Style",
  other: "Other",
};

export default function AnnotatedEssay({ essayText = "", annotations = [], showList = true }) {
  const anns = useMemo(
    () => (annotations || []).map((a) => normalizeAnnotation(a, essayText)),
    [annotations, essayText]
  );
  const segments = useMemo(() => buildSegments(essayText, anns), [essayText, anns]);
  if (!essayText) return null;

  return (
    <div className="annotated-essay">
      <div className="essay-annot readonly">
        {segments.map((seg, i) => {
          if (seg.kind === "ins") return <ins key={i} className="ea-add">{seg.text}</ins>;
          const marks = seg.marks || [];
          const title = marks.map((m) => `${m.criterion || "—"} · ${CAT_LABEL[m.category]}: ${m.comment}`).join("\n");
          const cls = (seg.kind === "del" ? "ea-del" : "") + (marks.length ? " ea-hl" : "");
          const Tag = seg.kind === "del" ? "del" : "span";
          return (
            <Tag key={i} className={cls.trim() || undefined} data-cat={marks[0] ? marks[0].category : undefined} title={title || undefined}>
              {seg.text}
            </Tag>
          );
        })}
      </div>

      {showList && anns.length > 0 && (
        <ul className="ea-readlist">
          {anns.map((a) => (
            <li key={a.id}>
              <span className={"pill " + (a.action === "delete" ? "pill-danger" : a.action === "comment" ? "pill-info" : "pill-ok")}>
                {a.criterion || CAT_LABEL[a.category]}
              </span>{" "}
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

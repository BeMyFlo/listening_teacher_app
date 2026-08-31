"use client";

// Hiển thị bài viết đã được chấm inline (chỉ đọc): chữ thêm = xanh, chữ xoá =
// đỏ gạch, đoạn có ghi chú = highlight + tooltip. Kèm danh sách ghi chú theo
// tiêu chí. Dùng ở màn kết quả của giáo viên và học sinh.

import { useMemo } from "react";
import { buildSegments, normalizeAnnotation, colorGroup } from "@/lib/grading/annotate";

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
  if (!essayText) return null;

  return (
    <div className="annotated-essay">
      {showText && (
      <div className="essay-annot readonly">
        {segments.map((seg, i) => {
          if (seg.kind === "ins") return <ins key={i} className="ea-add">{seg.text}</ins>;
          const marks = seg.marks || [];
          const title = marks.map((m) => `${m.criterion || "—"} · ${CAT_LABEL[m.category]}: ${m.comment}`).join("\n");
          const cls = (seg.kind === "del" ? "ea-del" : "") + (marks.length ? " ea-hl" : "");
          const Tag = seg.kind === "del" ? "del" : "span";
          // Màu ưu tiên ghi chú (comment) đè lên màu của lỗi gạch ngang khi cả
          // hai cùng che 1 đoạn; bình thường mỗi đoạn chỉ có 1 trong 2.
          const cat = marks[0] ? marks[0].category : seg.ann ? seg.ann.category : null;
          return (
            <Tag key={i} className={cls.trim() || undefined} data-cat={cat ? colorGroup(cat) : undefined} title={title || undefined}>
              {seg.text}
            </Tag>
          );
        })}
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

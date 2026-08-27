"use client";

import { youTubeId } from "@/lib/lessonImport";

const ROWS = [
  ["formula", "Công thức"],
  ["whenToUse", "Khi nào dùng"],
  ["commonMistakes", "Lỗi hay gặp"],
  ["examples", "Ví dụ"],
];

export default function GrammarTopicView({ topic }) {
  const lesson = topic.lesson || {};
  const vid = youTubeId(lesson.videoUrl);
  const hasAny = ROWS.some(([k]) => (lesson[k] || "").trim()) || vid;

  if (!hasAny) return <div className="empty-state">Chủ điểm này chưa có lý thuyết.</div>;

  return (
    <div className="lesson-block" style={{ marginTop: 4 }}>
      {ROWS.map(([k, label]) =>
        (lesson[k] || "").trim() ? (
          <div key={k} style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, color: "var(--navy)", marginBottom: 4 }}>{label}</div>
            <div className="lesson-text" style={{ whiteSpace: "pre-line" }}>
              {lesson[k]}
            </div>
          </div>
        ) : null
      )}

      {vid && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 700, color: "var(--navy)", marginBottom: 6 }}>Video</div>
          <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, maxWidth: 640 }}>
            <iframe
              src={"https://www.youtube.com/embed/" + vid}
              title="Video bài học"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, borderRadius: 8 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

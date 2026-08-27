"use client";

import { useState } from "react";
import SectionsEditor from "./SectionsEditor";
import LessonImport from "./LessonImport";

function emptyTopic() {
  return {
    extId: "",
    name: "",
    lesson: { formula: "", whenToUse: "", commonMistakes: "", examples: "", videoUrl: "" },
    exercises: [],
  };
}

const LESSON_FIELDS = [
  ["formula", "Công thức"],
  ["whenToUse", "Khi nào dùng"],
  ["commonMistakes", "Lỗi hay gặp"],
  ["examples", "Ví dụ"],
];

export default function GrammarTopicsEditor({ topics, media, onChange }) {
  const [importing, setImporting] = useState(false);
  const [open, setOpen] = useState(0);

  function patch(mut) {
    const draft = structuredClone(topics);
    mut(draft);
    onChange(draft);
  }

  function applyImport(items) {
    const draft = structuredClone(topics);
    items.forEach((it) => {
      const idx = it.extId ? draft.findIndex((t) => t.extId && t.extId === it.extId) : -1;
      const topic = {
        extId: it.extId || "",
        name: it.name || "",
        lesson: { formula: "", whenToUse: "", commonMistakes: "", examples: "", videoUrl: "", ...(it.lesson || {}) },
        exercises: it.exercises || [],
      };
      if (idx >= 0) {
        // Ghi đè: giữ _id cũ, cập nhật nội dung
        topic._id = draft[idx]._id;
        // giữ lý thuyết cũ nếu file bài tập không kèm bài học
        if (!it.lesson) topic.lesson = draft[idx].lesson;
        draft[idx] = topic;
      } else {
        draft.push(topic);
      }
    });
    onChange(draft);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Chủ điểm ngữ pháp ({topics.length})</h3>
        <button
          type="button"
          className="btn secondary"
          style={{ padding: "8px 14px", fontSize: ".85rem" }}
          onClick={() => setImporting(true)}
        >
          <svg className="icon"><use href="#icon-upload" /></svg> Import từ file
        </button>
      </div>

      {topics.length === 0 && (
        <div className="empty-state" style={{ marginTop: 12 }}>
          Chưa có chủ điểm nào. Import từ file hoặc thêm thủ công.
        </div>
      )}

      <div style={{ marginTop: 12 }} className="lesson-topics-list">
        {topics.map((t, i) => (
          <div className="builder-section" key={i}>
            <div className="builder-section-head">
              <input
                type="text"
                className="sec-name"
                placeholder="Tên chủ điểm (VD: Câu điều kiện loại 2)"
                style={{ flex: 1 }}
                value={t.name}
                onChange={(e) => patch((d) => (d[i].name = e.target.value))}
              />
              <button
                type="button"
                className="icon-btn"
                title={open === i ? "Thu gọn" : "Mở"}
                onClick={() => setOpen(open === i ? -1 : i)}
              >
                <svg className="icon"><use href={open === i ? "#icon-chevron-down" : "#icon-chevron-right"} /></svg>
              </button>
              <button
                type="button"
                className="icon-btn danger"
                title="Xoá chủ điểm"
                onClick={() => {
                  if (window.confirm("Xoá chủ điểm này?")) patch((d) => d.splice(i, 1));
                }}
              >
                <svg className="icon"><use href="#icon-trash" /></svg>
              </button>
            </div>

            {open === i && (
              <>
                <h4 style={{ margin: "14px 0 8px" }}>Lý thuyết</h4>
                {LESSON_FIELDS.map(([k, label]) => (
                  <div className="form-row" key={k} style={{ marginBottom: 10 }}>
                    <label>{label}</label>
                    <textarea
                      rows={k === "whenToUse" || k === "commonMistakes" ? 3 : 2}
                      value={t.lesson[k] || ""}
                      onChange={(e) => patch((d) => (d[i].lesson[k] = e.target.value))}
                    />
                  </div>
                ))}
                <div className="form-row" style={{ marginBottom: 10 }}>
                  <label>Link video YouTube (tuỳ chọn)</label>
                  <input
                    type="text"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={t.lesson.videoUrl || ""}
                    onChange={(e) => patch((d) => (d[i].lesson.videoUrl = e.target.value))}
                  />
                </div>

                <h4 style={{ margin: "18px 0 8px" }}>Bài tập</h4>
                <TopicExercises
                  exercises={t.exercises}
                  media={media}
                  subject="grammar"
                  onChange={(next) => patch((d) => (d[i].exercises = next))}
                />
              </>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        className="dashed-add-btn"
        style={{ marginTop: 10 }}
        onClick={() => {
          onChange([...topics, emptyTopic()]);
          setOpen(topics.length);
        }}
      >
        <svg className="icon"><use href="#icon-plus" /></svg> Thêm chủ điểm
      </button>

      {importing && (
        <LessonImport
          mode="grammar"
          existing={topics.flatMap((t) => t.exercises.flatMap((e) => e._sections || []))}
          onImport={applyImport}
          onClose={() => setImporting(false)}
        />
      )}
    </div>
  );
}

// Bài tập của 1 topic/group — mỗi exercise có title + _sections (SectionsEditor).
export function TopicExercises({ exercises, media, subject, onChange }) {
  function patch(mut) {
    const draft = structuredClone(exercises);
    mut(draft);
    onChange(draft);
  }
  return (
    <>
      {exercises.map((ex, i) => (
        <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div className="builder-section-head">
            <input
              type="text"
              className="ex-title"
              placeholder="Tên bài tập"
              style={{ flex: 1 }}
              value={ex.title}
              onChange={(e) => patch((d) => (d[i].title = e.target.value))}
            />
            <button
              type="button"
              className="icon-btn danger"
              title="Xoá bài tập"
              onClick={() => {
                if (window.confirm("Xoá bài tập này?")) patch((d) => d.splice(i, 1));
              }}
            >
              <svg className="icon"><use href="#icon-trash" /></svg>
            </button>
          </div>
          <div style={{ marginTop: 10 }}>
            <SectionsEditor
              sections={ex._sections || []}
              subject={subject}
              media={media}
              onChange={(next) => patch((d) => (d[i]._sections = next))}
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        className="dashed-add-btn"
        onClick={() => onChange([...exercises, { title: "", _sections: [] }])}
      >
        <svg className="icon"><use href="#icon-plus" /></svg> Thêm bài tập
      </button>
    </>
  );
}

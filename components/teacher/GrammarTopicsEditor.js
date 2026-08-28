"use client";

import { useState } from "react";
import SectionsEditor from "./SectionsEditor";
import LessonImport from "./LessonImport";
import { useDialog } from "@/components/ui/Dialog";

function emptyTopic() {
  return {
    extId: "",
    name: "",
    lesson: { formula: "", whenToUse: "", commonMistakes: "", examples: "", videoUrl: "" },
    exercises: [],
  };
}

const LESSON_FIELDS = [
  ["formula", "Form"],
  ["whenToUse", "When to use"],
  ["commonMistakes", "Common mistakes"],
  ["examples", "Examples"],
];

export default function GrammarTopicsEditor({ topics, media, onChange }) {
  const dialog = useDialog();
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
        <h3 style={{ margin: 0 }}>Grammar topics ({topics.length})</h3>
        <button
          type="button"
          className="btn secondary"
          style={{ padding: "8px 14px", fontSize: ".85rem" }}
          onClick={() => setImporting(true)}
        >
          <svg className="icon"><use href="#icon-upload" /></svg> Import from file
        </button>
      </div>

      {topics.length === 0 && (
        <div className="empty-state" style={{ marginTop: 12 }}>
          No topics yet. Import from a file or add them manually.
        </div>
      )}

      <div style={{ marginTop: 12 }} className="lesson-topics-list">
        {topics.map((t, i) => (
          <div className="builder-section" key={i}>
            <div className="builder-section-head">
              <input
                type="text"
                className="sec-name"
                placeholder="Topic name (e.g. Second conditional)"
                style={{ flex: 1 }}
                value={t.name}
                onChange={(e) => patch((d) => (d[i].name = e.target.value))}
              />
              <button
                type="button"
                className="icon-btn"
                title={open === i ? "Collapse" : "Expand"}
                onClick={() => setOpen(open === i ? -1 : i)}
              >
                <svg className="icon"><use href={open === i ? "#icon-chevron-down" : "#icon-chevron-right"} /></svg>
              </button>
              <button
                type="button"
                className="icon-btn danger"
                title="Delete topic"
                onClick={async () => {
                  if (await dialog.confirmDelete("Delete this topic?")) patch((d) => d.splice(i, 1));
                }}
              >
                <svg className="icon"><use href="#icon-trash" /></svg>
              </button>
            </div>

            {open === i && (
              <>
                <h4 style={{ margin: "14px 0 8px" }}>Theory</h4>
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
                  <label>YouTube video link (optional)</label>
                  <input
                    type="text"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={t.lesson.videoUrl || ""}
                    onChange={(e) => patch((d) => (d[i].lesson.videoUrl = e.target.value))}
                  />
                </div>

                <h4 style={{ margin: "18px 0 8px" }}>Exercises</h4>
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
        <svg className="icon"><use href="#icon-plus" /></svg> Add topic
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
  const dialog = useDialog();
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
              placeholder="Exercise title"
              style={{ flex: 1 }}
              value={ex.title}
              onChange={(e) => patch((d) => (d[i].title = e.target.value))}
            />
            <button
              type="button"
              className="icon-btn danger"
              title="Delete exercise"
              onClick={async () => {
                if (await dialog.confirmDelete("Delete this exercise?")) patch((d) => d.splice(i, 1));
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
        <svg className="icon"><use href="#icon-plus" /></svg> Add exercise
      </button>
    </>
  );
}

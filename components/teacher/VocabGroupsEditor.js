"use client";

import { useState } from "react";
import LessonImport from "./LessonImport";
import VocabWordTable from "./VocabWordTable";
import { TopicExercises } from "./GrammarTopicsEditor";
import { useDialog } from "@/components/ui/Dialog";

function emptyGroup() {
  return { extId: "", name: "", words: [], exercises: [] };
}

export default function VocabGroupsEditor({ groups, media, onChange }) {
  const dialog = useDialog();
  const [importing, setImporting] = useState(false);
  const [open, setOpen] = useState(0);

  function patch(mut) {
    const draft = structuredClone(groups);
    mut(draft);
    onChange(draft);
  }

  function applyImport(items) {
    const draft = structuredClone(groups);
    items.forEach((it) => {
      const idx = it.extId ? draft.findIndex((g) => g.extId && g.extId === it.extId) : -1;
      const group = {
        extId: it.extId || "",
        name: it.name || "",
        words: it.words && it.words.length ? it.words : idx >= 0 ? draft[idx].words : [],
        exercises: it.exercises || [],
      };
      if (idx >= 0) {
        group._id = draft[idx]._id;
        draft[idx] = group;
      } else {
        draft.push(group);
      }
    });
    onChange(draft);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Vocabulary groups ({groups.length})</h3>
        <button
          type="button"
          className="btn secondary"
          style={{ padding: "8px 14px", fontSize: ".85rem" }}
          onClick={() => setImporting(true)}
        >
          <svg className="icon"><use href="#icon-upload" /></svg> Import from file
        </button>
      </div>

      {groups.length === 0 && (
        <div className="empty-state" style={{ marginTop: 12 }}>
          No word groups yet. Import from a file or add them manually.
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        {groups.map((g, i) => (
          <div className="builder-section" key={i}>
            <div className="builder-section-head">
              <input
                type="text"
                className="sec-name"
                placeholder="Group name (e.g. Environment)"
                style={{ flex: 1 }}
                value={g.name}
                onChange={(e) => patch((d) => (d[i].name = e.target.value))}
              />
              <button
                type="button"
                className="icon-btn"
                onClick={() => setOpen(open === i ? -1 : i)}
              >
                <svg className="icon"><use href={open === i ? "#icon-chevron-down" : "#icon-chevron-right"} /></svg>
              </button>
              <button
                type="button"
                className="icon-btn danger"
                title="Delete group"
                onClick={async () => {
                  if (await dialog.confirmDelete("Delete this group?")) patch((d) => d.splice(i, 1));
                }}
              >
                <svg className="icon"><use href="#icon-trash" /></svg>
              </button>
            </div>

            {open === i && (
              <>
                <h4 style={{ margin: "14px 0 8px" }}>Word list ({g.words.length})</h4>
                <VocabWordTable words={g.words} onChange={(next) => patch((d) => (d[i].words = next))} />

                <h4 style={{ margin: "18px 0 8px" }}>Exercises</h4>
                <TopicExercises
                  exercises={g.exercises}
                  media={media}
                  subject="vocabulary"
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
          onChange([...groups, emptyGroup()]);
          setOpen(groups.length);
        }}
      >
        <svg className="icon"><use href="#icon-plus" /></svg> Add group
      </button>

      {importing && (
        <LessonImport
          mode="vocab"
          existing={groups.flatMap((g) => g.exercises.flatMap((e) => e._sections || []))}
          onImport={applyImport}
          onClose={() => setImporting(false)}
        />
      )}
    </div>
  );
}

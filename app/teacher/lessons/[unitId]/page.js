"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { useMediaLibraries } from "@/lib/teacher/useMediaLibraries";
import { sectionsToEditor, sectionsToPayload, refId } from "@/lib/teacher/sectionTransforms";
import { toDatetimeLocal } from "@/lib/teacher/testBuilder";
import { LESSON_CATS, PROMPT_CATS } from "@/lib/student/constants";
import SectionsEditor from "@/components/teacher/SectionsEditor";
import PromptsEditor from "@/components/teacher/PromptsEditor";
import TheoryEditor from "@/components/teacher/TheoryEditor";
import GrammarTopicsEditor from "@/components/teacher/GrammarTopicsEditor";
import VocabGroupsEditor from "@/components/teacher/VocabGroupsEditor";

// Grammar & Vocabulary dùng danh sách chủ điểm / nhóm từ thay cho
// theory + exercises phẳng.
const LESSON_LIST_CATS = ["grammar", "vocabulary"];

const CAT_LABELS = Object.fromEntries(LESSON_CATS.map((c) => [c.key, c.label]));
const CAT_ICONS = Object.fromEntries(LESSON_CATS.map((c) => [c.key, c.icon]));
const CAT_COLORS = Object.fromEntries(LESSON_CATS.map((c) => [c.key, c.color]));

function toEditorUnit(u) {
  return {
    _id: u._id,
    name: u.name || "",
    level: u.level,
    status: u.status,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    classIds: (u.classIds || []).map((x) => refId(x)).filter(Boolean),
    // { [classId]: "<datetime-local>" } — dễ bind vào input, đổi lại mảng khi lưu.
    deadlines: Object.fromEntries(
      (u.deadlines || [])
        .map((d) => [refId(d.classId), toDatetimeLocal(d.dueAt)])
        .filter(([id, v]) => id && v)
    ),
    categories: (u.categories || []).map((c) => ({
      _id: c._id,
      key: c.key,
      theory: {
        html: (c.theory && c.theory.html) || "",
        audioId: refId(c.theory && c.theory.audioId),
        imageId: refId(c.theory && c.theory.imageId),
      },
      exercises: (c.exercises || []).map((ex) => ({
        _id: ex._id,
        title: ex.title || "",
        _sections: sectionsToEditor(ex.sections),
      })),
      prompts: (c.prompts || []).map((p) => ({
        _id: p._id,
        title: p.title || "",
        instructions: p.instructions || "",
        imageId: refId(p.imageId),
        writingTask: p.writingTask || "task2",
      })),
      topics: (c.topics || []).map((t) => ({
        _id: t._id,
        extId: t.extId || "",
        name: t.name || "",
        lesson: {
          formula: (t.lesson && t.lesson.formula) || "",
          whenToUse: (t.lesson && t.lesson.whenToUse) || "",
          commonMistakes: (t.lesson && t.lesson.commonMistakes) || "",
          examples: (t.lesson && t.lesson.examples) || "",
          videoUrl: (t.lesson && t.lesson.videoUrl) || "",
        },
        exercises: (t.exercises || []).map((ex) => ({
          _id: ex._id,
          title: ex.title || "",
          _sections: sectionsToEditor(ex.sections),
        })),
      })),
      groups: (c.groups || []).map((g) => ({
        _id: g._id,
        extId: g.extId || "",
        name: g.name || "",
        words: (g.words || []).map((w) => ({ ...w })),
        exercises: (g.exercises || []).map((ex) => ({
          _id: ex._id,
          title: ex.title || "",
          _sections: sectionsToEditor(ex.sections),
        })),
      })),
    })),
  };
}

function catHasContent(c) {
  return !!(
    (c && (c.theory.html || "").trim()) ||
    (c && c.exercises.length) ||
    (c && c.prompts.length) ||
    (c && (c.topics || []).length) ||
    (c && (c.groups || []).length)
  );
}

function toPayload(unit, status) {
  const body = {
    name: unit.name.trim(),
    classIds: unit.classIds || [],
    deadlines: Object.entries(unit.deadlines || {})
      .filter(([, v]) => v && !isNaN(new Date(v).getTime()))
      .map(([classId, v]) => ({ classId, dueAt: new Date(v).toISOString() })),
    categories: unit.categories.map((cat) => ({
      _id: cat._id,
      key: cat.key,
      theory: { html: cat.theory.html, audioId: cat.theory.audioId || null, imageId: cat.theory.imageId || null },
      exercises: cat.exercises.map((ex) => ({
        _id: ex._id,
        title: ex.title,
        sections: sectionsToPayload(ex._sections, cat.key),
      })),
      prompts: cat.prompts.map((p) => ({
        _id: p._id,
        title: p.title,
        instructions: p.instructions,
        imageId: p.imageId || null,
        writingTask: p.writingTask || "task2",
      })),
      topics: (cat.topics || []).map((t) => ({
        _id: t._id,
        extId: t.extId,
        name: t.name,
        lesson: t.lesson,
        exercises: t.exercises.map((ex) => ({
          _id: ex._id,
          title: ex.title,
          sections: sectionsToPayload(ex._sections, cat.key),
        })),
      })),
      groups: (cat.groups || []).map((g) => ({
        _id: g._id,
        extId: g.extId,
        name: g.name,
        words: g.words,
        exercises: g.exercises.map((ex) => ({
          _id: ex._id,
          title: ex.title,
          sections: sectionsToPayload(ex._sections, cat.key),
        })),
      })),
    })),
  };
  if (status) body.status = status;
  return body;
}

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export default function UnitEditorPage() {
  const { unitId } = useParams();
  const router = useRouter();
  const media = useMediaLibraries();
  const [unit, setUnit] = useState(null);
  const [err, setErr] = useState("");
  const [activeTab, setActiveTab] = useState("settings"); // "settings" | "content"
  const [catKey, setCatKey] = useState("grammar");
  const [subTab, setSubTab] = useState("theory");
  const [saveErr, setSaveErr] = useState("");
  const [stats, setStats] = useState(null);
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    api.teacher
      .getUnit(unitId)
      .then((d) => setUnit(toEditorUnit(d.unit)))
      .catch((e) => setErr(e.message));
    api.teacher.listClasses().then((d) => setClasses(d.rows || [])).catch(() => {});
    Promise.all([api.teacher.listStudents().catch(() => ({ rows: [] })), api.teacher.listSubmissions().catch(() => ({ rows: [] }))])
      .then(([s, sub]) => setStats({ students: s.rows || [], subs: sub.rows || [] }));
  }, [unitId]);

  function toggleClass(id) {
    setUnit((u) => {
      const has = (u.classIds || []).includes(id);
      return { ...u, classIds: has ? u.classIds.filter((x) => x !== id) : [...(u.classIds || []), id] };
    });
  }

  function setDeadline(classId, value) {
    setUnit((u) => {
      const next = { ...(u.deadlines || {}) };
      if (value) next[classId] = value;
      else delete next[classId];
      return { ...u, deadlines: next };
    });
  }

  function updateCat(mut) {
    setUnit((u) => {
      const draft = structuredClone(u);
      mut(draft.categories.find((c) => c.key === catKey), draft);
      return draft;
    });
  }

  async function save(status) {
    if (!unit.name.trim()) {
      setActiveTab("settings");
      setSaveErr("Please enter a Unit name.");
      return;
    }
    setSaveErr("");
    try {
      await api.teacher.updateUnit(unit._id, toPayload(unit, status));
      router.push("/teacher/lessons");
    } catch (e) {
      setSaveErr(e.message);
    }
  }

  if (err)
    return (
      <div className="tab-panel active">
        <div className="card">
          <div className="notice error">
            <svg className="icon"><use href="#icon-warning" /></svg> Failed to load Unit: {err}
          </div>
          <button type="button" className="btn secondary" onClick={() => router.push("/teacher/lessons")}>
            Back
          </button>
        </div>
      </div>
    );
  if (!unit) return <div className="tab-panel active"><div className="notice info">Loading...</div></div>;

  const cat = unit.categories.find((c) => c.key === catKey);
  const isPrompt = PROMPT_CATS.includes(catKey);
  const levelClasses = classes.filter((c) => c.level === unit.level);

  // unit overview stats
  let ov = { totalStudents: 0, totalSubmissions: 0, avgCompletionPct: 0, avgScorePct: null };
  if (stats) {
    const totalStudents = stats.students.filter((s) => s.level === unit.level).length;
    const unitSubs = stats.subs.filter(
      (s) => s.kind !== "test" && s.unitId && String(s.unitId) === String(unit._id)
    );
    const uniqueStudents = new Set(unitSubs.map((s) => String(s.studentId))).size;
    const exSubs = unitSubs.filter((s) => s.kind === "exercise" && s.total > 0);
    ov = {
      totalStudents,
      totalSubmissions: unitSubs.length,
      avgCompletionPct: totalStudents ? Math.round((uniqueStudents / totalStudents) * 100) : 0,
      avgScorePct: exSubs.length
        ? Math.round(exSubs.reduce((sum, s) => sum + (s.score / s.total) * 100, 0) / exSubs.length)
        : null,
    };
  }
  const totalItems = unit.categories.reduce((n, c) => n + c.exercises.length + c.prompts.length, 0);

  return (
    <div className="tab-panel active">
      <div className="card" id="unitEditor">
        <div className="builder-toolbar">
          <h3 id="unitEditorHeading">Edit Unit: {unit.name}</h3>
        </div>

        <div id="unitOverviewCard">
          <div className="unit-overview">
            <div className="unit-overview-main">
              <div className="unit-overview-icon"><svg className="icon"><use href="#icon-book-open" /></svg></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: "0 0 6px" }}>{unit.name || "(untitled unit)"}</h3>
                <div className="unit-overview-badges">
                  {LESSON_CATS.map((c) => {
                    const cc = unit.categories.find((x) => x.key === c.key);
                    const has = catHasContent(cc);
                    return has ? (
                      <span key={c.key} className="cat-badge" style={{ background: CAT_COLORS[c.key] + "22", color: CAT_COLORS[c.key] }}>
                        {CAT_LABELS[c.key]}
                      </span>
                    ) : (
                      <span key={c.key} className="cat-badge cat-badge-empty">
                        {CAT_LABELS[c.key]}
                      </span>
                    );
                  })}
                </div>
                <p className="unit-overview-meta">
                  Level {unit.level} · Created {fmtDate(unit.createdAt)} · Updated {fmtDate(unit.updatedAt)} · {totalItems}{" "}
                  item(s)
                </p>
              </div>
            </div>
            <div className="unit-overview-stats">
              <div className="unit-overview-stat"><span className="value">{ov.totalStudents}</span><span className="label">Students (Level {unit.level})</span></div>
              <div className="unit-overview-stat"><span className="value">{ov.totalSubmissions}</span><span className="label">Total Submissions</span></div>
              <div className="unit-overview-stat"><span className="value">{ov.avgCompletionPct}%</span><span className="label">Avg Completion</span></div>
              <div className="unit-overview-stat"><span className="value">{ov.avgScorePct != null ? ov.avgScorePct + "%" : "—"}</span><span className="label">Avg Score</span></div>
            </div>
          </div>
        </div>

        <div className="unit-cat-tabs" id="unitCatTabs">
          <button
            type="button"
            className={"unit-cat-tab" + (activeTab === "settings" ? " active" : "")}
            onClick={() => setActiveTab("settings")}
          >
            <svg className="icon"><use href="#icon-settings" /></svg> Settings
          </button>
          {LESSON_CATS.map((c) => {
            const cc = unit.categories.find((x) => x.key === c.key);
            return (
              <button
                key={c.key}
                type="button"
                className={
                  "unit-cat-tab" + (activeTab === "content" && c.key === catKey ? " active" : "")
                }
                onClick={() => {
                  setActiveTab("content");
                  setCatKey(c.key);
                  setSubTab("theory");
                }}
              >
                <svg className="icon"><use href={"#icon-" + CAT_ICONS[c.key]} /></svg> {CAT_LABELS[c.key]}
                {catHasContent(cc) && (
                  <span className="cat-done"><svg className="icon"><use href="#icon-check" /></svg></span>
                )}
              </button>
            );
          })}
        </div>

        {activeTab === "settings" ? (
          <div className="settings-list" id="unitSettings">
            <div className="settings-row">
              <div className="settings-row-icon"><svg className="icon"><use href="#icon-edit" /></svg></div>
              <div className="settings-row-label">
                <div className="settings-row-title">Unit Name</div>
                <div className="settings-row-desc">Enter a clear and concise name for this unit.</div>
              </div>
              <div className="settings-row-control">
                <input
                  type="text"
                  className="unit-name-input"
                  value={unit.name}
                  onChange={(e) => setUnit((u) => ({ ...u, name: e.target.value }))}
                />
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-row-icon"><svg className="icon"><use href="#icon-student" /></svg></div>
              <div className="settings-row-label">
                <div className="settings-row-title">Assign to classes</div>
                <div className="settings-row-desc">Select the classes that will use this unit.</div>
              </div>
              <div className="settings-row-control">
                {levelClasses.length === 0 ? (
                  <p className="settings-hint">No classes at Level {unit.level} yet.</p>
                ) : (
                  <>
                    <div className="settings-check-group">
                      {levelClasses.map((c) => (
                        <label key={c._id}>
                          <input
                            type="checkbox"
                            checked={(unit.classIds || []).includes(String(c._id))}
                            onChange={() => toggleClass(String(c._id))}
                          />
                          {c.name}
                        </label>
                      ))}
                    </div>
                    <p className="settings-hint">(None checked = every student at Level {unit.level})</p>
                  </>
                )}
              </div>
            </div>

            {levelClasses.length > 0 && (
              <div className="settings-row">
                <div className="settings-row-icon"><svg className="icon"><use href="#icon-calendar" /></svg></div>
                <div className="settings-row-label">
                  <div className="settings-row-title">
                    Submission deadlines{" "}
                    <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional)</span>
                  </div>
                  <div className="settings-row-desc">Leave blank if no deadline is required.</div>
                </div>
                <div className="settings-row-control">
                  {levelClasses.map((c) => {
                    const val = (unit.deadlines || {})[String(c._id)] || "";
                    return (
                      <div className="settings-deadline-row" key={c._id}>
                        <span>{c.name}</span>
                        <div className="settings-deadline-input">
                          <input
                            type="datetime-local"
                            value={val}
                            onChange={(e) => setDeadline(String(c._id), e.target.value)}
                          />
                          {val && (
                            <button
                              type="button"
                              className="icon-btn danger"
                              title="Clear deadline"
                              onClick={() => setDeadline(String(c._id), "")}
                            >
                              <svg className="icon"><use href="#icon-cross" /></svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <p className="settings-note">
                    <svg className="icon"><use href="#icon-info" /></svg>
                    <span>
                      Students can still submit after the deadline, but their work is flagged <b>Late</b>.
                    </span>
                  </p>
                  <p className="settings-note">
                    <svg className="icon"><use href="#icon-info" /></svg>
                    <span>
                      Each student gets a reminder in their notification bell <b>24 hours</b> before
                      the deadline.
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {!LESSON_LIST_CATS.includes(catKey) && (
              <div className="unit-subtabs" id="unitSubTabs">
                <button type="button" className={"unit-subtab" + (subTab === "theory" ? " active" : "")} onClick={() => setSubTab("theory")}>
                  Theory
                </button>
                <button
                  type="button"
                  className={"unit-subtab" + (subTab === "practice" ? " active" : "")}
                  onClick={() => setSubTab("practice")}
                >
                  {isPrompt ? "Prompts" : "Exercises"}
                </button>
              </div>
            )}

            <div id="unitCatContent">
              {catKey === "grammar" ? (
            <GrammarTopicsEditor
              topics={cat.topics || []}
              media={media}
              onChange={(next) => updateCat((c) => (c.topics = next))}
            />
          ) : catKey === "vocabulary" ? (
            <VocabGroupsEditor
              groups={cat.groups || []}
              media={media}
              onChange={(next) => updateCat((c) => (c.groups = next))}
            />
          ) : subTab === "theory" ? (
            <TheoryEditor
              theory={cat.theory}
              media={media}
              catLabel={CAT_LABELS[catKey]}
              onChange={(next) => updateCat((c) => (c.theory = next))}
            />
          ) : isPrompt ? (
            <PromptsEditor prompts={cat.prompts} media={media} skill={catKey} onChange={(next) => updateCat((c) => (c.prompts = next))} />
          ) : (
            <ExercisesEditor cat={cat} media={media} onChange={(next) => updateCat((c) => (c.exercises = next))} />
          )}
            </div>
          </>
        )}

        {saveErr && (
          <p className="notice error" style={{ marginTop: 16 }}>
            <svg className="icon"><use href="#icon-warning" /></svg> {saveErr}
          </p>
        )}

        <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="btn" onClick={() => save(null)}>
            Save
          </button>
          <button type="button" className="btn" onClick={() => save("published")}>
            Save &amp; Publish
          </button>
          <button type="button" className="btn secondary" onClick={() => router.push("/teacher/lessons")}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ExercisesEditor({ cat, media, onChange }) {
  function patch(mut) {
    const draft = structuredClone(cat.exercises);
    mut(draft);
    onChange(draft);
  }
  return (
    <>
      {cat.exercises.map((ex, i) => (
        <div className="builder-section" key={i}>
          <div className="builder-section-head">
            <input
              type="text"
              className="ex-title"
              placeholder="Exercise Title (e.g. Exercise 1)"
              style={{ flex: 1 }}
              value={ex.title}
              onChange={(e) => patch((d) => (d[i].title = e.target.value))}
            />
            <button
              type="button"
              className="icon-btn danger"
              title="Delete exercise"
              onClick={() => {
                if (window.confirm("Delete this exercise?")) patch((d) => d.splice(i, 1));
              }}
            >
              <svg className="icon"><use href="#icon-trash" /></svg>
            </button>
          </div>
          <div className="ex-sections">
            <SectionsEditor
              sections={ex._sections}
              subject={cat.key}
              media={media}
              onChange={(next) => patch((d) => (d[i]._sections = next))}
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        className="dashed-add-btn"
        style={{ marginTop: 10 }}
        onClick={() => onChange([...cat.exercises, { title: "", _sections: [] }])}
      >
        <svg className="icon"><use href="#icon-plus" /></svg> Add Exercise
      </button>
    </>
  );
}

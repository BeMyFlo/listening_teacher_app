"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { useMediaLibraries } from "@/lib/teacher/useMediaLibraries";
import {
  TEST_SKILLS,
  emptyBuilder,
  testToBuilder,
  builderToPayload,
  skillHasContent,
} from "@/lib/teacher/testBuilder";
import SectionsEditor from "@/components/teacher/SectionsEditor";
import PromptsEditor from "@/components/teacher/PromptsEditor";

export default function TestBuilderPage() {
  const { testId } = useParams();
  const router = useRouter();
  const isNew = testId === "new";
  const media = useMediaLibraries();

  const [b, setB] = useState(isNew ? emptyBuilder() : null);
  const [err, setErr] = useState("");
  const [active, setActive] = useState("listening");
  const [saveErr, setSaveErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    api.teacher.listClasses().then((d) => setClasses(d.rows || [])).catch(() => {});
    if (isNew) return;
    api.teacher
      .getTest(testId)
      .then((d) => setB(testToBuilder(d.test)))
      .catch((e) => setErr(e.message));
  }, [testId, isNew]);

  function toggleClass(id) {
    setB((prev) => {
      const has = (prev.classIds || []).includes(id);
      return { ...prev, classIds: has ? prev.classIds.filter((x) => x !== id) : [...(prev.classIds || []), id] };
    });
  }

  function setField(k, v) {
    setB((p) => ({ ...p, [k]: v }));
  }
  function updateSkill(key, mut) {
    setB((p) => {
      const draft = structuredClone(p);
      mut(draft.skills[key]);
      return draft;
    });
  }

  async function save(status) {
    if (!b.title.trim()) {
      setSaveErr("Please enter a test title.");
      return;
    }
    if (b.opensAt && b.closesAt && new Date(b.opensAt) >= new Date(b.closesAt)) {
      setSaveErr("Opening time must be before closing time.");
      return;
    }
    setSaving(true);
    setSaveErr("");
    try {
      const payload = builderToPayload(b);
      const saved = isNew ? await api.teacher.createTest(payload) : await api.teacher.updateTest(testId, payload);
      const id = isNew ? saved.test._id : testId;
      await api.teacher.updateTest(id, { status });
      router.push("/teacher/tests");
    } catch (e) {
      setSaveErr(e.message);
      setSaving(false);
    }
  }

  if (err)
    return (
      <div className="tab-panel active">
        <div className="card">
          <div className="notice error">
            <svg className="icon"><use href="#icon-warning" /></svg> Failed to load mock test: {err}
          </div>
          <button type="button" className="btn secondary" onClick={() => router.push("/teacher/tests")}>
            Back
          </button>
        </div>
      </div>
    );
  if (!b) return <div className="tab-panel active"><div className="notice info">Loading...</div></div>;

  const skillMeta = TEST_SKILLS.find((s) => s.key === active);
  const skill = b.skills[active];

  return (
    <div className="tab-panel active">
      <div className="card" id="testBuilder">
        <div className="builder-toolbar">
          <h3 id="builderHeading">{isNew ? "Create New Test" : "Edit Mock Test"}</h3>
        </div>

        <div className="form-row">
          <label>Test Title</label>
          <input type="text" placeholder="e.g. Full Mock Test 2A" value={b.title} onChange={(e) => setField("title", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Unit (optional)</label>
          <input type="text" placeholder="e.g. Unit 2" value={b.unit} onChange={(e) => setField("unit", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Level</label>
          <input
            type="number"
            min="1"
            step="1"
            style={{ width: 120, padding: "11px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: "1rem" }}
            value={b.level}
            onChange={(e) => setField("level", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label>Assign to classes (none checked = every student at Level {b.level})</label>
          {classes.filter((c) => c.level === Number(b.level)).length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: ".85rem", margin: 0 }}>
              No classes at Level {b.level}.
            </p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {classes
                .filter((c) => c.level === Number(b.level))
                .map((c) => (
                  <label key={c._id} style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400 }}>
                    <input
                      type="checkbox"
                      checked={(b.classIds || []).includes(String(c._id))}
                      onChange={() => toggleClass(String(c._id))}
                    />
                    {c.name}
                  </label>
                ))}
            </div>
          )}
        </div>

        <h4 style={{ marginTop: 22 }}>Schedule (optional)</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <label>Opening Time</label>
            <input type="datetime-local" value={b.opensAt} onChange={(e) => setField("opensAt", e.target.value)} />
          </div>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <label>Closing Time</label>
            <input type="datetime-local" value={b.closesAt} onChange={(e) => setField("closesAt", e.target.value)} />
          </div>
        </div>
        <p style={{ color: "var(--muted)", fontSize: ".82rem", marginTop: 6 }}>
          Leave blank = open indefinitely. All 4 skills open/close together on this schedule. Students can only view and
          submit within the active window.
        </p>

        <h4 style={{ marginTop: 22 }}>Skills</h4>
        <div className="subject-toggle" id="tbSkillTabs">
          {TEST_SKILLS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={s.key === active ? "active" : ""}
              onClick={() => setActive(s.key)}
            >
              <svg className="icon"><use href={"#icon-" + s.icon} /></svg> {s.label}
              {skillHasContent(b, s.key) && (
                <span className="cat-done"><svg className="icon"><use href="#icon-check" /></svg></span>
              )}
            </button>
          ))}
        </div>

        <div id="tbSkillPanels" style={{ marginTop: 14 }}>
          <div className="builder-2col">
            <div className="form-row" style={{ marginBottom: 0 }}>
              <label>{skillMeta.label} instructions</label>
              <input
                type="text"
                className="skill-instructions"
                placeholder="e.g. Listen to the conversation and fill in the blanks..."
                value={skill.instructions}
                onChange={(e) => updateSkill(active, (s) => (s.instructions = e.target.value))}
              />
            </div>
            <div className="form-row" style={{ marginBottom: 0 }}>
              <label>Time limit for this skill (minutes)</label>
              <input
                type="number"
                className="skill-duration"
                min="1"
                step="1"
                placeholder="Unlimited"
                value={skill.durationMinutes}
                onChange={(e) => updateSkill(active, (s) => (s.durationMinutes = e.target.value))}
              />
            </div>
          </div>

          {skillMeta.kind === "sections" ? (
            <>
              <h4 style={{ marginTop: 22 }}>Sections</h4>
              <SectionsEditor
                sections={skill.sections}
                subject={active}
                media={media}
                onChange={(next) => updateSkill(active, (s) => (s.sections = next))}
              />
            </>
          ) : (
            <>
              <h4 style={{ marginTop: 22 }}>Prompts</h4>
              <PromptsEditor
                prompts={skill.prompts}
                media={media}
                skill={active}
                onChange={(next) => updateSkill(active, (s) => (s.prompts = next))}
              />
            </>
          )}
        </div>

        {saveErr && (
          <p className="notice error" style={{ marginTop: 16 }}>
            <svg className="icon"><use href="#icon-warning" /></svg> {saveErr}
          </p>
        )}

        <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="btn secondary" disabled={saving} onClick={() => save("draft")}>
            Save Draft
          </button>
          <button type="button" className="btn" disabled={saving} onClick={() => save("published")}>
            Save &amp; Publish
          </button>
          <button type="button" className="btn secondary" onClick={() => router.push("/teacher/tests")}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

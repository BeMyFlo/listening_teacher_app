"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client/api";
import { PROGRAMS, PROGRAM_KEYS, programOf, levelWordOf } from "@/lib/curriculum";
import { programParam, usePrograms } from "@/lib/client/program";
import ProgramBadge from "@/components/ProgramBadge";
import { useMediaLibraries } from "@/lib/teacher/useMediaLibraries";
import {
  TEST_SKILLS,
  emptyBuilder,
  testToBuilder,
  builderToPayload,
  skillHasContent,
  testSkillsFor,
  defaultDurationsFor,
} from "@/lib/teacher/testBuilder";
import SectionsEditor from "@/components/teacher/SectionsEditor";
import PromptsEditor from "@/components/teacher/PromptsEditor";
import { toeicPromptsError } from "@/lib/toeicStandardSet";
import { findGeneralSectionError } from "@/lib/generalFormats";

// Đổi chương trình của đề mới: bỏ lớp đã tick (thuộc chương trình cũ) và đổi thời lượng
// còn nguyên giá trị mặc định của chương trình cũ sang mặc định của chương trình mới.
function withProgram(prev, k) {
  const before = defaultDurationsFor(prev.program);
  const after = defaultDurationsFor(k);
  const skills = { ...prev.skills };
  Object.keys(skills).forEach((key) => {
    if (skills[key].durationMinutes === (before[key] || "")) {
      skills[key] = { ...skills[key], durationMinutes: after[key] || "" };
    }
  });
  return { ...prev, program: k, classIds: [], skills };
}

function TestBuilderInner() {
  const { testId } = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const { isMulti, loaded } = usePrograms();
  const isNew = testId === "new";
  const paramProgram = programParam(search);
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

  // Đề mới + workspace nhiều chương trình: lấy chương trình từ chip của trang
  // Mock Tests (?program=). Đang ở "All" thì để trống, giáo viên phải chọn.
  useEffect(() => {
    if (!isNew || !loaded || !isMulti || !paramProgram) return;
    setB((p) => (p && !p.program ? withProgram(p, paramProgram) : p));
  }, [isNew, loaded, isMulti, paramProgram]);

  function chooseProgram(k) {
    // Lớp đã tick thuộc chương trình cũ -> bỏ, tránh giao nhầm.
    setB((p) => withProgram(p, k));
    // Kỹ năng đang mở có thể không có ở chương trình mới.
    if (!testSkillsFor(k).some((s) => s.key === active)) setActive("listening");
  }

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
    if (isNew && isMulti && !b.program) {
      setSaveErr("Please choose a program for this test.");
      return;
    }
    if (b.opensAt && b.closesAt && new Date(b.opensAt) >= new Date(b.closesAt)) {
      setSaveErr("Opening time must be before closing time.");
      return;
    }
    if (b.program === "toeic") {
      for (const key of ["writing", "speaking"]) {
        const e = toeicPromptsError(b.skills[key].prompts, key);
        if (e) {
          setActive(key);
          setSaveErr(e);
          return;
        }
      }
    }
    // Câu hỏi General (reorder thiếu mảnh/đáp án, Error id sai số lựa chọn): chặn lưu, báo lỗi rõ, nhảy tới câu.
    for (const key of ["reading", "listening"]) {
      const skill = b.skills[key];
      if (skill && skill.sections) {
        const err = findGeneralSectionError(skill.sections);
        if (err) {
          setActive(key);
          setSaveErr(err.message);
          setTimeout(() => {
            const rows = Array.from(document.querySelectorAll(".question-row"));
            const target = rows.find((r) => r.querySelector(".f-id")?.value === String(err.fieldId));
            if (target) {
              target.scrollIntoView({ behavior: "smooth", block: "center" });
              const input = target.querySelector(".f-label, .f-answers, input");
              if (input) input.focus();
            }
          }, 100);
          return;
        }
      }
    }
    if (status === "published" && !(b.classIds || []).length) {
      setSaveErr("Chọn ít nhất 1 lớp trước khi Publish — không tick lớp nào thì không học sinh nào thấy bài.");
      return;
    }
    setSaving(true);
    setSaveErr("");
    try {
      const payload = builderToPayload(b);
      // Workspace 1 chương trình: không gửi gì, đề là IELTS như trước.
      if (isNew && isMulti && b.program) payload.program = b.program;
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

  // Lớp hiện trong ô "Assign": cùng level, và cùng chương trình khi đã biết chương trình.
  const levelClasses = classes.filter(
    (c) => c.level === Number(b.level) && (!b.program || programOf(c) === b.program)
  );
  // Tab kỹ năng theo chương trình của đề (IELTS = đủ 4 như cũ).
  const skillTabs = testSkillsFor(b.program);
  const activeKey = skillTabs.some((s) => s.key === active) ? active : skillTabs[0].key;
  const skillMeta = skillTabs.find((s) => s.key === activeKey) || TEST_SKILLS.find((s) => s.key === activeKey);
  const skill = b.skills[activeKey];

  return (
    <div className="tab-panel active">
      <div className="card" id="testBuilder">
        <div className="builder-toolbar">
          <h3 id="builderHeading">
            {isNew ? "Create New Test" : "Edit Mock Test"}
            {!isNew && <ProgramBadge program={b.program} isMulti={isMulti} />}
          </h3>
        </div>

        {isNew && isMulti && (
          <div className="form-row">
            <label>Program (required)</label>
            <div className="program-radios" role="radiogroup" aria-label="Program">
              {PROGRAM_KEYS.map((k) => (
                <label key={k}>
                  <input
                    type="radio"
                    name="testProgram"
                    value={k}
                    checked={b.program === k}
                    onChange={() => chooseProgram(k)}
                  />
                  {PROGRAMS[k].label}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="form-row">
          <label>Test Title</label>
          <input type="text" placeholder="e.g. Full Mock Test 2A" value={b.title} onChange={(e) => setField("title", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Unit (optional)</label>
          <input type="text" placeholder="e.g. Unit 2" value={b.unit} onChange={(e) => setField("unit", e.target.value)} />
        </div>
        <div className="form-row">
          <label>{levelWordOf(b.program)}</label>
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
          <label>Assign to classes (required — không tick lớp nào thì không học sinh nào thấy bài)</label>
          {levelClasses.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: ".85rem", margin: 0 }}>
              No classes at {levelWordOf(b.program)} {b.level}.
            </p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {levelClasses
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
          Leave blank = open indefinitely. All {skillTabs.length} skills open/close together on this schedule. Students can only view and
          submit within the active window.
        </p>

        <h4 style={{ marginTop: 22 }}>Skills</h4>
        <div className="subject-toggle" id="tbSkillTabs">
          {skillTabs.map((s) => (
            <button
              key={s.key}
              type="button"
              className={s.key === activeKey ? "active" : ""}
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
                onChange={(e) => updateSkill(activeKey, (s) => (s.instructions = e.target.value))}
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
                onChange={(e) => updateSkill(activeKey, (s) => (s.durationMinutes = e.target.value))}
              />
            </div>
          </div>

          {skillMeta.kind === "sections" ? (
            <>
              <h4 style={{ marginTop: 22 }}>Sections</h4>
              <SectionsEditor
                sections={skill.sections}
                subject={activeKey}
                program={b.program || undefined}
                firstId={b.program === "toeic" && activeKey === "reading" ? 101 : 1}
                media={media}
                aiContext={{
                  testId: b._id,
                  unitName: b.title || "",
                  program: b.program,
                  level: b.level || "",
                }}
                onChange={(next) => updateSkill(activeKey, (s) => (s.sections = next))}
              />
            </>
          ) : (
            <>
              <h4 style={{ marginTop: 22 }}>Prompts</h4>
              <PromptsEditor
                prompts={skill.prompts}
                media={media}
                skill={activeKey}
                program={b.program || undefined}
                standardSet
                onChange={(next) => updateSkill(activeKey, (s) => (s.prompts = next))}
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

export default function TestBuilderPage() {
  return (
    <Suspense fallback={<div className="tab-panel active"><div className="notice info">Loading...</div></div>}>
      <TestBuilderInner />
    </Suspense>
  );
}

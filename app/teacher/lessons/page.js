"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client/api";

function LessonsInner() {
  const router = useRouter();
  const search = useSearchParams();
  const levelParam = search.get("level");
  const level = levelParam ? Number(levelParam) : null;

  const [units, setUnits] = useState(null);
  const [classes, setClasses] = useState([]);
  const [listErr, setListErr] = useState("");

  // create form
  const [name, setName] = useState("");
  const [formLevel, setFormLevel] = useState(1);
  const [formClassIds, setFormClassIds] = useState([]);
  const [status, setStatus] = useState(null);

  // filter
  const [classFilter, setClassFilter] = useState("all");

  function load() {
    Promise.all([api.teacher.listUnits(), api.teacher.listClasses().catch(() => ({ rows: [] }))])
      .then(([u, c]) => {
        setUnits(u.rows || []);
        setClasses(c.rows || []);
      })
      .catch((e) => setListErr(e.message));
  }
  useEffect(load, []);
  useEffect(() => {
    if (level) setFormLevel(level);
    setFormClassIds([]);
    setClassFilter("all");
  }, [level]);

  const classById = useMemo(() => Object.fromEntries(classes.map((c) => [String(c._id), c])), [classes]);

  // Danh sách level: gộp từ lớp + unit, luôn có ít nhất 1..maxLevel.
  const levels = useMemo(() => {
    const set = new Set();
    classes.forEach((c) => set.add(c.level));
    (units || []).forEach((u) => set.add(u.level));
    if (!set.size) set.add(1);
    return [...set].sort((a, b) => a - b);
  }, [classes, units]);

  const classesAtLevel = (lvl) => classes.filter((c) => c.level === lvl);

  async function create() {
    if (!name.trim()) {
      setStatus({ cls: "error", msg: "Please enter a Unit name." });
      return;
    }
    setStatus(null);
    try {
      const d = await api.teacher.createUnit({
        name: name.trim(),
        level: Number(formLevel) || 1,
        classIds: formClassIds,
      });
      router.push("/teacher/lessons/" + d.unit._id);
    } catch (e) {
      setStatus({ cls: "error", msg: e.message });
    }
  }

  async function del(u) {
    if (!window.confirm(`Delete Unit "${u.name}"? This action cannot be undone.`)) return;
    try {
      await api.teacher.deleteUnit(u._id);
      load();
    } catch (e) {
      window.alert("Failed to delete Unit: " + e.message);
    }
  }

  const head = (
    <div className="page-head">
      <div className="head-left">
        <div className="page-head-icon"><svg className="icon"><use href="#icon-book-open" /></svg></div>
        <div>
          <h1>Lessons</h1>
          <p className="page-sub">
            Units by level — Grammar, Vocabulary, Listening, Reading, Writing, Speaking
          </p>
        </div>
      </div>
    </div>
  );

  // ---------- Màn 1: chọn level ----------
  if (!level) {
    return (
      <div className="tab-panel active">
        {head}
        {listErr && (
          <div className="notice error">
            <svg className="icon"><use href="#icon-warning" /></svg> {listErr}
          </div>
        )}
        {!units && !listErr && <div className="notice info">Loading...</div>}
        {units && (
          <div id="unitsList" style={{ marginTop: 4 }}>
            {levels.map((lvl) => {
              const nUnits = units.filter((u) => u.level === lvl).length;
              const nClasses = classesAtLevel(lvl).length;
              return (
                <div
                  className="unit-list-row"
                  key={lvl}
                  onClick={() => router.push("/teacher/lessons?level=" + lvl)}
                >
                  <div className="unit-list-num">{String(lvl).padStart(2, "0")}</div>
                  <div className="unit-list-meta">
                    <h4>Level {lvl}</h4>
                    <p>
                      <span className="meta-icon">
                        <svg className="icon"><use href="#icon-book-open" /></svg> {nUnits} unit{nUnits === 1 ? "" : "s"}
                      </span>
                      <span className="meta-icon">
                        <svg className="icon"><use href="#icon-student" /></svg> {nClasses} class{nClasses === 1 ? "" : "es"}
                      </span>
                    </p>
                  </div>
                  <button type="button" className="icon-btn unit-list-goto">
                    <svg className="icon"><use href="#icon-chevron-right" /></svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ---------- Màn 2: unit của 1 level ----------
  const levelUnits = (units || []).filter((u) => u.level === level);
  const filtered = levelUnits.filter((u) => {
    if (classFilter === "all") return true;
    if (classFilter === "__none__") return !u.classIds || u.classIds.length === 0;
    return (u.classIds || []).map(String).includes(classFilter);
  });
  const levelClasses = classesAtLevel(level);

  function toggleFormClass(id) {
    setFormClassIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="tab-panel active">
      {head}

      <p className="back-link" onClick={() => router.push("/teacher/lessons")}>
        <svg className="icon"><use href="#icon-arrow-left" /></svg> All levels
      </p>

      <div className="card" id="unitListCard">
        <h3>Create New Unit — Level {level}</h3>
        <div className="form-row">
          <label>Unit Name</label>
          <input type="text" placeholder="e.g. UNIT 1" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-row">
          <label>Level</label>
          <input type="number" min="1" step="1" value={formLevel} onChange={(e) => setFormLevel(e.target.value)} />
        </div>
        <div className="form-row">
          <label>Assign to classes (leave all unchecked = every student at this level)</label>
          {classesAtLevel(Number(formLevel)).length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: ".85rem", margin: 0 }}>
              No classes at Level {formLevel} yet.
            </p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {classesAtLevel(Number(formLevel)).map((c) => (
                <label key={c._id} style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400 }}>
                  <input
                    type="checkbox"
                    checked={formClassIds.includes(String(c._id))}
                    onChange={() => toggleFormClass(String(c._id))}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          )}
        </div>
        <button type="button" className="btn" style={{ marginTop: 4 }} onClick={create}>
          <svg className="icon"><use href="#icon-plus" /></svg> Create Unit
        </button>
        {status && (
          <p className={"notice " + status.cls} style={{ marginTop: 14 }}>
            {status.msg}
          </p>
        )}

        <div className="page-head" style={{ marginTop: 24 }}>
          <div className="head-left">
            <h3 style={{ margin: 0 }}>Units — Level {level}</h3>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <select className="select-inline" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="all">All units</option>
              <option value="__none__">Assigned to all students</option>
              {levelClasses.map((c) => (
                <option key={c._id} value={String(c._id)}>
                  Class: {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {listErr && (
          <div className="notice error">
            <svg className="icon"><use href="#icon-warning" /></svg> {listErr}
          </div>
        )}
        {!units && !listErr && <div className="notice info">Loading...</div>}
        <div id="unitsList" style={{ marginTop: 14 }}>
          {units && filtered.length === 0 && (
            <div className="empty-state">No units for this filter.</div>
          )}
          {filtered.map((u) => {
            const assigned = (u.classIds || []).map((id) => classById[String(id)]?.name).filter(Boolean);
            const ex = (u.categories || []).reduce((n, c) => n + (c.exercises || []).length, 0);
            const pr = (u.categories || []).reduce((n, c) => n + (c.prompts || []).length, 0);
            return (
              <div className="test-item" key={u._id}>
                <div className="meta">
                  <h4>
                    {u.name} <span className={"status-pill " + u.status}>{u.status === "published" ? "Published" : "Draft"}</span>
                  </h4>
                  <p>
                    {assigned.length ? "Classes: " + assigned.join(", ") : "All students at Level " + u.level} · {ex}{" "}
                    exercises · {pr} prompts
                  </p>
                </div>
                <div className="actions">
                  <button
                    type="button"
                    className="btn secondary"
                    style={{ padding: "6px 12px", fontSize: ".8rem" }}
                    onClick={() => router.push("/teacher/lessons/" + u._id + "/submissions")}
                  >
                    <svg className="icon"><use href="#icon-list" /></svg> Submissions
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Edit"
                    onClick={() => router.push("/teacher/lessons/" + u._id)}
                  >
                    <svg className="icon"><use href="#icon-edit" /></svg>
                  </button>
                  <button type="button" className="icon-btn danger" title="Delete" onClick={() => del(u)}>
                    <svg className="icon"><use href="#icon-trash" /></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function TeacherLessonsPage() {
  return (
    <Suspense fallback={<div className="tab-panel active"><div className="notice info">Loading...</div></div>}>
      <LessonsInner />
    </Suspense>
  );
}

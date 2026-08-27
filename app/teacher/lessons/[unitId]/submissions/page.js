"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client/api";

const CATS = [
  { key: "grammar", label: "Grammar" },
  { key: "vocabulary", label: "Vocab" },
  { key: "listening", label: "Listening" },
  { key: "reading", label: "Reading" },
  { key: "writing", label: "Writing" },
  { key: "speaking", label: "Speaking" },
];

const STATUS = {
  not_started: { label: "Not started", cls: "pill-muted" },
  in_progress: { label: "In progress", cls: "pill-info" },
  needs_grading: { label: "Needs grading", cls: "pill-warn" },
};

function CatCell({ c }) {
  if (!c) return <td style={{ color: "var(--muted)" }}>—</td>;
  if (c.kind === "prompt") {
    if (!c.submitted) return <td style={{ color: "var(--muted)" }}>—</td>;
    if (c.submitted > c.graded)
      return <td><span className="pill pill-warn">Pending</span></td>;
    return <td><b>{c.avgScore != null ? c.avgScore : "✓"}</b></td>;
  }
  if (!c.done) return <td style={{ color: "var(--muted)" }}>—</td>;
  return (
    <td>
      <b>{c.score}</b>/{c.total}
      {c.itemsTotal > 1 && (
        <span style={{ color: "var(--muted)", fontSize: ".8rem" }}> ({c.done}/{c.itemsTotal})</span>
      )}
    </td>
  );
}

function Inner() {
  const { unitId } = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const classId = search.get("classId");

  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setData(null);
    setErr("");
    api.teacher
      .unitSubmissions(unitId)
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [unitId]);

  const pendingByClass = useMemo(() => {
    const m = {};
    (data?.students || []).forEach((s) => {
      if (s.anyPending) m[String(s.classId)] = (m[String(s.classId)] || 0) + 1;
    });
    return m;
  }, [data]);

  const back = (
    <p className="back-link" onClick={() => router.push("/teacher/lessons?level=" + (data?.unit?.level ?? ""))}>
      <svg className="icon"><use href="#icon-arrow-left" /></svg> Back to units
    </p>
  );

  const head = (
    <div className="page-head">
      <div className="head-left">
        <div className="page-head-icon"><svg className="icon"><use href="#icon-list" /></svg></div>
        <div>
          <h1>Submissions{data ? " — " + data.unit.name : ""}</h1>
          <p className="page-sub">Whole unit · 6 skills · graded per student</p>
        </div>
      </div>
    </div>
  );

  if (err)
    return (
      <div className="tab-panel active">
        {head}
        {back}
        <div className="notice error">
          <svg className="icon"><use href="#icon-warning" /></svg> {err}
        </div>
      </div>
    );
  if (!data)
    return (
      <div className="tab-panel active">
        {head}
        <div className="notice info">Loading...</div>
      </div>
    );

  // ---------- Class picker ----------
  if (!classId) {
    return (
      <div className="tab-panel active">
        {head}
        {back}
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Choose a class</h3>
          {data.students.length > 0 && (
            <div className="unit-list-row" onClick={() => router.push(`/teacher/lessons/${unitId}/submissions?classId=__all__`)}>
              <div className="unit-list-num"><svg className="icon"><use href="#icon-student" /></svg></div>
              <div className="unit-list-meta">
                <h4>All students</h4>
                <p><span className="meta-icon">{data.students.length} students</span></p>
              </div>
              <button type="button" className="icon-btn unit-list-goto">
                <svg className="icon"><use href="#icon-chevron-right" /></svg>
              </button>
            </div>
          )}
          {data.classes.length === 0 && (
            <div className="empty-state">No classes assigned to this unit yet.</div>
          )}
          {data.classes.map((c) => {
            const pending = pendingByClass[String(c._id)] || 0;
            return (
              <div
                className="unit-list-row"
                key={c._id}
                onClick={() => router.push(`/teacher/lessons/${unitId}/submissions?classId=${c._id}`)}
              >
                <div className="unit-list-num"><svg className="icon"><use href="#icon-student" /></svg></div>
                <div className="unit-list-meta">
                  <h4>
                    {c.name}{" "}
                    {pending > 0 && <span className="pill pill-warn">{pending} to grade</span>}
                  </h4>
                  <p><span className="meta-icon">{c.studentCount} students</span></p>
                </div>
                <button type="button" className="icon-btn unit-list-goto">
                  <svg className="icon"><use href="#icon-chevron-right" /></svg>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ---------- Student list for a class ----------
  const cls = data.classes.find((c) => String(c._id) === String(classId));
  const students =
    classId === "__all__"
      ? data.students
      : data.students.filter((s) => String(s.classId) === String(classId));

  return (
    <div className="tab-panel active">
      {head}
      <p className="back-link" onClick={() => router.push(`/teacher/lessons/${unitId}/submissions`)}>
        <svg className="icon"><use href="#icon-arrow-left" /></svg> All classes
      </p>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>
          {classId === "__all__" ? "All students" : cls ? cls.name : "Class"}{" "}
          <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: ".9rem" }}>
            · {students.length} students
          </span>
        </h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                {CATS.map((c) => <th key={c.key}>{c.label}</th>)}
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 && (
                <tr><td colSpan={CATS.length + 3} style={{ textAlign: "center", color: "var(--muted)" }}>No students</td></tr>
              )}
              {students.map((s) => {
                const st = STATUS[s.status] || STATUS.not_started;
                return (
                  <tr
                    key={s._id}
                    style={{ cursor: "pointer" }}
                    onClick={() => router.push(`/teacher/lessons/${unitId}/submissions/${s._id}`)}
                  >
                    <td><b>{s.name}</b><br /><span style={{ color: "var(--muted)", fontSize: ".8rem" }}>{s.username}</span></td>
                    {CATS.map((c) => <CatCell key={c.key} c={s.categories[c.key]} />)}
                    <td><span className={"pill " + st.cls}>{st.label}</span></td>
                    <td><svg className="icon"><use href="#icon-chevron-right" /></svg></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function UnitSubmissionsPage() {
  return (
    <Suspense fallback={<div className="tab-panel active"><div className="notice info">Loading...</div></div>}>
      <Inner />
    </Suspense>
  );
}

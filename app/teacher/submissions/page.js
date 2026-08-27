"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client/api";

const KIND_LABELS = { test: "Mock Test", exercise: "Lesson Exercise", writing: "Writing", speaking: "Speaking" };

export default function SubmissionsPage() {
  const [rows, setRows] = useState(null);
  const [loadStatus, setLoadStatus] = useState("Loading data...");
  const [tests, setTests] = useState([]);
  const [filterKind, setFilterKind] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterTest, setFilterTest] = useState("");
  const [search, setSearch] = useState("");

  function load() {
    setRows(null);
    setLoadStatus("Loading data...");
    const params = {};
    if (filterTest) params.testId = filterTest;
    if (filterKind) params.kind = filterKind;
    api.teacher
      .listSubmissions(params)
      .then((d) => setRows(d.rows || []))
      .catch((e) => setLoadStatus(e.message));
  }

  useEffect(() => {
    api.teacher.listTests().then((d) => setTests(d.rows || [])).catch(() => {});
  }, []);
  useEffect(load, [filterKind, filterTest]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows || []).filter((r) => {
      // This page is Mock Tests only — lesson-unit work is reviewed per unit
      // under Lessons → (unit) → Submissions.
      const isMockTest = r.kind === "test" || ((r.kind === "writing" || r.kind === "speaking") && r.testId);
      if (!isMockTest) return false;
      if (q && !String(r.studentName || "").toLowerCase().includes(q)) return false;
      if (filterSubject) {
        if (r.testSkill) return r.testSkill === filterSubject;
        if (r.categoryKey) return r.categoryKey === filterSubject;
        return false;
      }
      return true;
    });
  }, [rows, search, filterSubject]);

  const summary = useMemo(() => {
    if (!filtered.length) return "No student submissions found.";
    const uniq = new Set(filtered.map((r) => r.studentName)).size;
    const avg =
      filtered.reduce((sum, r) => sum + (Number(r.score) / Math.max(Number(r.total), 1)) * 100, 0) /
      filtered.length;
    return `Total submissions: ${filtered.length} · Unique students: ${uniq} · Average score: ${avg.toFixed(0)}%`;
  }, [filtered]);

  return (
    <div className="tab-panel active">
      <div className="page-head">
        <div className="head-left">
          <div className="page-head-icon"><svg className="icon"><use href="#icon-list" /></svg></div>
          <div>
            <h1>Mock Test Results</h1>
            <p className="page-sub">Mock test submissions and scores · lesson work is reviewed per unit</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select className="select-inline" value={filterKind} onChange={(e) => setFilterKind(e.target.value)}>
            <option value="">All Submission Types</option>
            <option value="test">Listening / Reading</option>
            <option value="writing">Writing (Manual Grading)</option>
            <option value="speaking">Speaking (Manual Grading)</option>
          </select>
          <select className="select-inline" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
            <option value="">All Skills</option>
            <option value="listening">Listening</option>
            <option value="reading">Reading</option>
            <option value="writing">Writing</option>
            <option value="speaking">Speaking</option>
          </select>
          <select className="select-inline" value={filterTest} onChange={(e) => setFilterTest(e.target.value)}>
            <option value="">All Mock Tests</option>
            {tests.map((t) => (
              <option key={t._id} value={t._id}>
                {(t.unit ? t.unit + " · " : "") + t.title}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Search student name..."
            style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" className="btn secondary" onClick={load}>
            <svg className="icon"><use href="#icon-refresh" /></svg> Refresh
          </button>
        </div>
      </div>

      <div id="summaryBox" style={{ marginTop: 0, marginBottom: 14, color: "var(--muted)", fontSize: ".9rem" }}>
        {rows ? summary : ""}
      </div>

      <div className="card">
        {!rows && <div className="notice info">{loadStatus}</div>}
        {rows && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Student Name</th>
                  <th>Test / Exercise</th>
                  <th>Type</th>
                  <th>Score</th>
                  <th>Listen Count</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "var(--muted)" }}>
                      No data available
                    </td>
                  </tr>
                )}
                {filtered.map((r) => (
                  <SubmissionRows key={r._id} r={r} onGraded={load} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SubmissionRows({ r, onGraded }) {
  const [open, setOpen] = useState(false);
  const kind = r.kind || "test";
  const time = r.submittedAt ? new Date(r.submittedAt).toLocaleString("en-US") : "";
  const title =
    kind === "test"
      ? r.testTitle || ""
      : kind === "exercise"
      ? r.exerciseTitle || ""
      : r.testTitle
      ? `${r.testTitle} — ${kind === "writing" ? "Writing" : "Speaking"} Prompt`
      : kind === "writing"
      ? "Writing Prompt"
      : "Speaking Prompt";
  const isManual = kind === "writing" || kind === "speaking";

  return (
    <>
      <tr>
        <td>{time}</td>
        <td>{r.studentName}</td>
        <td>{title}</td>
        <td><span className="pill pill-muted">{KIND_LABELS[kind] || kind}</span></td>
        <td>
          {isManual ? (
            r.gradingStatus === "graded" ? (
              <b>{r.manualScore}</b>
            ) : (
              <span className="pill pill-warn">Pending Review</span>
            )
          ) : (
            <>
              <b>{r.score}</b> / {r.total}
            </>
          )}
        </td>
        <td>{kind === "test" && r.replayCount != null ? r.replayCount : "-"}</td>
        <td>
          <button
            type="button"
            className="btn secondary"
            style={{ padding: "6px 12px", fontSize: ".8rem" }}
            onClick={() => setOpen((v) => !v)}
          >
            Details
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} style={{ background: "#fafcfe" }}>
            <DetailBody r={r} onGraded={onGraded} />
          </td>
        </tr>
      )}
    </>
  );
}

function DetailBody({ r, onGraded }) {
  const kind = r.kind || "test";

  if (kind === "writing") {
    return (
      <div style={{ padding: "10px 14px" }}>
        <b>Student Essay:</b>
        <div
          style={{
            whiteSpace: "pre-wrap",
            margin: "8px 0 12px",
            padding: 10,
            background: "#fff",
            border: "1px solid var(--border)",
            borderRadius: 6,
          }}
        >
          {r.essayText || "(empty)"}
        </div>
        <GradingForm r={r} onGraded={onGraded} />
      </div>
    );
  }
  if (kind === "speaking") {
    return (
      <div style={{ padding: "10px 14px" }}>
        <b>Student Audio Recording:</b>
        <div style={{ margin: "8px 0 12px" }}>
          <audio controls src={r.audioUrl || ""} />
        </div>
        <GradingForm r={r} onGraded={onGraded} />
      </div>
    );
  }

  let obj = r.answers;
  if (typeof obj === "string") {
    try {
      obj = JSON.parse(obj);
    } catch {
      return <div style={{ padding: "10px 14px" }}>{obj}</div>;
    }
  }
  if (!obj) return <div style={{ padding: "10px 14px" }}><em>No details available</em></div>;
  return (
    <div style={{ padding: "10px 14px" }}>
      {Object.keys(obj).map((k) => (
        <div key={k}>
          <b>Question {k}:</b> {Array.isArray(obj[k]) ? obj[k].join(", ") : obj[k] || "(blank)"}
        </div>
      ))}
    </div>
  );
}

function GradingForm({ r, onGraded }) {
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  if (r.gradingStatus === "graded") {
    return (
      <>
        <div className="pill pill-ok">Graded: {r.manualScore} pts</div>
        <div style={{ marginTop: 6, color: "var(--muted)" }}>Feedback: {r.manualFeedback || "(none)"}</div>
      </>
    );
  }

  async function save() {
    if (score === "") {
      window.alert("Please enter a score.");
      return;
    }
    setBusy(true);
    try {
      await api.teacher.gradeSubmission(r._id, { manualScore: Number(score), manualFeedback: feedback });
      onGraded && onGraded();
    } catch (e) {
      window.alert("Failed to save grade: " + e.message);
      setBusy(false);
    }
  }

  return (
    <div className="grading-form">
      <input
        type="number"
        className="grade-score"
        step="0.5"
        min="0"
        placeholder="Score"
        style={{ width: 90 }}
        value={score}
        onChange={(e) => setScore(e.target.value)}
      />
      <textarea
        className="grade-feedback"
        rows={2}
        placeholder="Feedback for student..."
        style={{ flex: 1, minWidth: 200 }}
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
      />
      <button type="button" className="btn btn-grade-save" style={{ padding: "8px 16px" }} disabled={busy} onClick={save}>
        Save Grade
      </button>
    </div>
  );
}

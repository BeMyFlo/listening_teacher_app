"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client/api";
import RubricGrader from "@/components/teacher/RubricGrader";
import RubricResult from "@/components/RubricResult";
import { useDialog } from "@/components/ui/Dialog";
import { pollAiGrade } from "@/lib/client/aiGrade";

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
            ) : r.gradingStatus === "draft" || r.gradingStatus === "ai_draft" ? (
              <span className="pill pill-muted">Draft — not published</span>
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
          <td colSpan={7} style={{ background: "#FFF7FB" }}>
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
        <GradingForm r={r} onGraded={onGraded} />
      </div>
    );
  }
  if (kind === "speaking") {
    return (
      <div style={{ padding: "10px 14px" }}>
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
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(r.gradingStatus !== "graded");

  if (r.gradingStatus === "graded" && !editing) {
    return (
      <>
        <RubricResult
          rubricVariant={r.rubricVariant}
          criteria={r.criteria}
          manualScore={r.manualScore}
          manualFeedback={r.manualFeedback}
          essayText={r.essayText}
          annotations={r.annotations}
          audioUrl={r.audioUrl}
          transcript={r.transcript}
          speakingNotes={r.speakingNotes}
          priorities={r.priorities}
          topicVocabulary={r.topicVocabulary}
          improvedSample={r.improvedSample}
          mainIssue={r.mainIssue}
          showDescriptors={false}
        />
        <button
          type="button"
          className="btn secondary"
          style={{ marginTop: 8, padding: "6px 12px" }}
          onClick={() => setEditing(true)}
        >
          Edit grade
        </button>
      </>
    );
  }

  async function save(payload) {
    if (payload.publish === false && r.gradingStatus === "graded") {
      const ok = await dialog.confirm({
        title: "Move back to draft?",
        message: "This grade is live for the student. Saving a draft will hide it from them until you publish again.",
        confirmText: "Save draft",
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await api.teacher.gradeSubmission(r._id, payload);
      setEditing(false);
      dialog.toast(payload.publish === false ? "Draft saved — not visible to the student" : "Published to the student");
      onGraded && onGraded();
    } catch (e) {
      dialog.alert({ tone: "error", title: "Failed to save grade", message: e.message });
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      <RubricGrader
        submission={{
          kind: r.kind,
          submissionId: r._id,
          gradingStatus: r.gradingStatus,
          rubricVariant: r.rubricVariant,
          criteria: r.criteria,
          manualScore: r.manualScore,
          manualFeedback: r.manualFeedback,
          essayText: r.essayText,
          annotations: r.annotations,
          audioUrl: r.audioUrl,
          transcript: r.transcript,
          speakingNotes: r.speakingNotes,
          gradeSource: r.gradeSource,
          priorities: r.priorities,
          topicVocabulary: r.topicVocabulary,
          improvedSample: r.improvedSample,
          mainIssue: r.mainIssue,
        }}
        busy={busy}
        onSave={save}
        onAiGrade={
          (r.kind === "writing" && r.essayText) || (r.kind === "speaking" && r.audioUrl)
            ? (onTick) => pollAiGrade(r._id, { onTick })
            : undefined
        }
      />
    </div>
  );
}

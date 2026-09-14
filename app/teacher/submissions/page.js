"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";

// This page is just a "pick a mock test" landing — the real review flow lives
// under /teacher/tests/[testId]/submissions (class -> student -> per-skill
// detail), same shape as Lessons -> unit -> Submissions. We used to dump every
// Listening/Reading/Writing/Speaking submission into one flat table sorted by
// date, with a meaningless "average score" mixing raw points and IELTS bands —
// this instead groups by test so a teacher can see, per test, who's done and
// who still needs grading.
export default function SubmissionsLandingPage() {
  const router = useRouter();
  const [tests, setTests] = useState(null);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");

  function load() {
    setTests(null);
    setRows(null);
    Promise.all([api.teacher.listTests(), api.teacher.listSubmissions()])
      .then(([t, s]) => {
        setTests(t.rows || []);
        setRows(s.rows || []);
      })
      .catch((e) => setErr(e.message));
  }
  useEffect(load, []);

  const statsByTest = useMemo(() => {
    const m = {};
    (rows || []).forEach((r) => {
      const isMockTest = r.kind === "test" || ((r.kind === "writing" || r.kind === "speaking") && r.testId);
      if (!isMockTest || !r.testId) return;
      const k = String(r.testId);
      if (!m[k]) m[k] = { total: 0, students: new Set(), pending: 0, lastSubmittedAt: null };
      const stat = m[k];
      stat.total += 1;
      stat.students.add(String(r.studentId));
      if ((r.kind === "writing" || r.kind === "speaking") && r.gradingStatus !== "graded") stat.pending += 1;
      const t = new Date(r.submittedAt);
      if (!stat.lastSubmittedAt || t > stat.lastSubmittedAt) stat.lastSubmittedAt = t;
    });
    return m;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (tests || [])
      .filter((t) => !q || (t.title + " " + (t.unit || "")).toLowerCase().includes(q))
      .map((t) => ({ t, stat: statsByTest[String(t._id)] || null }))
      .sort((a, b) => {
        const pa = a.stat ? a.stat.pending : 0;
        const pb = b.stat ? b.stat.pending : 0;
        if (pa !== pb) return pb - pa;
        const ta = a.stat && a.stat.lastSubmittedAt ? +a.stat.lastSubmittedAt : 0;
        const tb = b.stat && b.stat.lastSubmittedAt ? +b.stat.lastSubmittedAt : 0;
        return tb - ta;
      });
  }, [tests, statsByTest, search]);

  return (
    <div className="tab-panel active">
      <div className="page-head">
        <div className="head-left">
          <div className="page-head-icon"><svg className="icon"><use href="#icon-list" /></svg></div>
          <div>
            <h1>Mock Test Results</h1>
            <p className="page-sub">Pick a mock test to review submissions by class and student</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search mock tests..."
            style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" className="btn secondary" onClick={load}>
            <svg className="icon"><use href="#icon-refresh" /></svg> Refresh
          </button>
        </div>
      </div>

      {err && (
        <div className="notice error">
          <svg className="icon"><use href="#icon-warning" /></svg> {err}
        </div>
      )}

      <div className="card">
        {!tests && !err && <div className="notice info">Loading...</div>}
        {tests && filtered.length === 0 && <div className="empty-state">No mock tests found.</div>}
        <div id="testResultsList" style={{ marginTop: 4 }}>
          {filtered.map(({ t, stat }) => (
            <div className="test-item" key={t._id}>
              <div className="meta">
                <h4>
                  {(t.unit ? t.unit + " · " : "") + t.title}{" "}
                  <span className={"status-pill " + t.status}>{t.status === "published" ? "Published" : "Draft"}</span>
                </h4>
                <p>
                  Level {t.level != null ? t.level : "-"} ·{" "}
                  {stat ? (
                    <>
                      {stat.total} submission{stat.total === 1 ? "" : "s"} · {stat.students.size} student
                      {stat.students.size === 1 ? "" : "s"}
                      {stat.pending > 0 && (
                        <>
                          {" · "}
                          <span className="pill pill-warn">{stat.pending} to grade</span>
                        </>
                      )}
                    </>
                  ) : (
                    "No submissions yet"
                  )}
                </p>
              </div>
              <div className="actions">
                <button
                  type="button"
                  className="btn secondary"
                  style={{ padding: "6px 12px", fontSize: ".8rem" }}
                  onClick={() => router.push("/teacher/tests/" + t._id + "/submissions")}
                >
                  <svg className="icon"><use href="#icon-list" /></svg> View Submissions
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

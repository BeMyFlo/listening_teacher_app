"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { setBadge } from "@/lib/client/shellBadges";

function initials(name) {
  const parts = String(name || "?").trim().split(/\s+/);
  return (parts[parts.length - 1] || "?").slice(0, 2);
}

function ScorePill({ pct }) {
  const n = Number(pct) || 0;
  const tone = n >= 70 ? "pill-ok" : n >= 40 ? "pill-warn" : "pill-danger";
  return <span className={"pill " + tone}>{n}%</span>;
}

function StatCard({ icon, value, label, sub, tone, navKey, featured }) {
  const router = useRouter();
  return (
    <div className={"stat-card-v2" + (tone ? " tone-" + tone : "") + (featured ? " featured" : "")}>
      <div className="stat-top">
        <span className="label">{label}</span>
        <span className="stat-icon"><svg className="icon"><use href={"#icon-" + icon} /></svg></span>
      </div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
      {navKey && (
        <button type="button" className="stat-link" onClick={() => router.push(navKey)}>
          View details <svg className="icon flip"><use href="#icon-arrow-left" /></svg>
        </button>
      )}
    </div>
  );
}

export default function OverviewPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.teacher
      .dashboard()
      .then((d) => {
        setData(d);
        const s = d.summary || {};
        setBadge("/teacher/lessons", s.totalUnits ?? 0);
        setBadge("/teacher/tests", s.totalTests ?? 0);
        setBadge("/teacher/submissions", s.pendingGrading ?? 0, true);
      })
      .catch((e) => setErr(e.message));
  }, []);

  const s = data && data.summary ? data.summary : {};

  return (
    <div className="tab-panel active">
      <div className="hero-banner">
        <div className="hero-banner-text">
          <div className="hero-banner-greet">
            Welcome back, <span>Teacher</span>! 👋
          </div>
          <h2>Today is a great day to make a difference!</h2>
          <p>Track student learning progress and inspire your class.</p>
          <button type="button" className="btn" onClick={() => router.push("/teacher/tests/new")}>
            <svg className="icon"><use href="#icon-plus" /></svg> Create New
          </button>
        </div>
        <div className="hero-illustration">
          <svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <g fill="#ffd35c"><path d="M172 18l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" /></g>
            <g fill="#9b8afb"><path d="M18 108l2.5 5.5 5.5 2.5-5.5 2.5-2.5 5.5-2.5-5.5-5.5-2.5 5.5-2.5z" /></g>
            <g transform="translate(10,22) rotate(-9)">
              <rect width="50" height="42" rx="10" fill="#fff" stroke="#e3e7fb" />
              <rect x="10" y="24" width="6" height="10" rx="2" fill="#8b7cf6" />
              <rect x="19" y="18" width="6" height="16" rx="2" fill="#6a5bd6" />
              <rect x="28" y="12" width="6" height="22" rx="2" fill="#4b3fc4" />
            </g>
            <g transform="translate(138,88) rotate(8)">
              <rect width="50" height="42" rx="10" fill="#fff" stroke="#e3e7fb" />
              <circle cx="25" cy="21" r="13" fill="#e6f6ea" />
              <path d="M18 21l5 5 9-10" stroke="#1e8e3e" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <ellipse cx="100" cy="150" rx="44" ry="7" fill="#4b3fc4" opacity=".12" />
            <path d="M64 150c0-40 12-58 36-58s36 18 36 58z" fill="#4b3fc4" />
            <path d="M80 150c0-30 8-42 20-42s20 12 20 42z" fill="#6a5bd6" />
            <rect x="90" y="118" width="20" height="14" rx="2" fill="#fff" opacity=".9" />
            <circle cx="100" cy="64" r="24" fill="#ffd9b0" />
            <path d="M76 60a24 24 0 0 1 48 0c0-16-11-26-24-26s-24 10-24 26z" fill="#2b2440" />
          </svg>
        </div>
      </div>

      {err && (
        <div className="notice error">
          <svg className="icon"><use href="#icon-warning" /></svg> {err}
        </div>
      )}
      {!data && !err && <div className="notice info">Loading stats...</div>}

      {data && (
        <div id="overviewContent">
          <div className="stat-card-grid" id="statGrid">
            <StatCard icon="clipboard" value={s.publishedTests + "/" + s.totalTests} label="Published Mock Tests" navKey="/teacher/tests" />
            <StatCard icon="book-open" value={s.totalUnits ?? 0} label="Lesson Units" tone="teal" navKey="/teacher/lessons" />
            <StatCard icon="headphones" value={s.totalAudio} label="Audio Library Tracks" tone="sky" navKey="/teacher/audio" />
            <StatCard icon="list" value={s.totalSubmissions} label="Total Submissions" tone="pink" navKey="/teacher/submissions" />
            <StatCard icon="clock" value={s.submissionsThisWeek ?? 0} label="Submissions (7 Days)" tone="warn" navKey="/teacher/submissions" />
            <StatCard icon="trophy" value={s.uniqueStudents} label="Active Students" tone="success" navKey="/teacher/students" />
            {(s.pendingGrading ?? 0) > 0 ? (
              <StatCard icon="warning" value={s.pendingGrading} label="Pending Review" sub="Requires manual grading" tone="warn" navKey="/teacher/submissions" featured />
            ) : (
              <StatCard icon="check-circle" value={0} label="Pending Review" sub="All graded" tone="success" navKey="/teacher/submissions" featured />
            )}
            <StatCard icon="chart-bar" value={(s.avgScorePct ?? 0) + "%"} label="Average Score" tone="success" navKey="/teacher/submissions" featured />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, alignItems: "start" }}>
            <div className="card">
              <div className="card-head-v2">
                <div className="head-left">
                  <span className="icon-chip"><svg className="icon"><use href="#icon-clipboard" /></svg></span>
                  <h3>By Mock Test</h3>
                </div>
              </div>
              {data.byTest && data.byTest.length > 0 ? (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Test Title</th>
                        <th>Skill</th>
                        <th>Submissions</th>
                        <th>Avg Score</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byTest.map((r, i) => (
                        <tr key={i}>
                          <td><span className="cell-title">{r.testTitle}</span></td>
                          <td>
                            <span className="pill pill-info">
                              {r.testSkill ? r.testSkill[0].toUpperCase() + r.testSkill.slice(1) : "—"}
                            </span>
                          </td>
                          <td>{r.submissions}</td>
                          <td><ScorePill pct={r.avgScorePct} /></td>
                          <td>
                            <button
                              type="button"
                              className="icon-btn"
                              title="View submissions"
                              onClick={() => router.push("/teacher/submissions")}
                            >
                              <svg className="icon"><use href="#icon-external" /></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state-v2">
                  <div className="empty-icon-circle"><svg className="icon"><use href="#icon-inbox" /></svg></div>
                  <h4>No data available</h4>
                  <p>Create and publish tests to view statistics here.</p>
                  <button type="button" className="btn" onClick={() => router.push("/teacher/tests/new")}>
                    Create Test
                  </button>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-head-v2">
                <div className="head-left">
                  <span className="icon-chip"><svg className="icon"><use href="#icon-clock" /></svg></span>
                  <h3>Recent Submissions</h3>
                </div>
                <a
                  href="#"
                  className="view-all"
                  onClick={(e) => {
                    e.preventDefault();
                    router.push("/teacher/submissions");
                  }}
                >
                  View All <svg className="icon flip"><use href="#icon-arrow-left" /></svg>
                </a>
              </div>
              <div id="recentList">
                {!data.recent || data.recent.length === 0 ? (
                  <div className="empty-state-v2">
                    <div className="empty-icon-circle"><svg className="icon"><use href="#icon-send" /></svg></div>
                    <h4>No submissions yet</h4>
                    <p>Student submissions will appear here once submitted.</p>
                  </div>
                ) : (
                  data.recent.map((r, i) => (
                    <div className="list-item" key={i}>
                      <div className="meta">
                        <div className="avatar">{initials(r.studentName)}</div>
                        <div className="meta-text">
                          <h4>{r.studentName}</h4>
                          <p>
                            {r.testTitle || r.exerciseTitle || r.kind} ·{" "}
                            {r.submittedAt ? new Date(r.submittedAt).toLocaleString("en-US") : ""}
                          </p>
                        </div>
                      </div>
                      <div className="list-value">
                        <ScorePill pct={r.total ? Math.round((r.score / r.total) * 100) : 0} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

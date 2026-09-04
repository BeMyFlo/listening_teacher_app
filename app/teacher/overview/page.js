"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { readSession } from "@/lib/client/session";
import { setBadge } from "@/lib/client/shellBadges";

function initials(name) {
  const parts = String(name || "?").trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] || "") + (parts[parts.length - 1][0] || "");
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function classCode(name) {
  const first = String(name || "").trim().split(/[\s–-]+/)[0];
  return (first || "?").slice(0, 3);
}

function fmtDue(d) {
  if (!d) return "";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function timeAgo(d) {
  if (!d) return "";
  const s = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
  const day = Math.floor(h / 24);
  return `${day} day${day > 1 ? "s" : ""} ago`;
}

const CAT_ICON = {
  writing: "writing",
  speaking: "mic",
  listening: "headphones",
  reading: "book-open",
  grammar: "grammar",
  vocabulary: "vocabulary",
};
const catIcon = (k) => CAT_ICON[k] || "clipboard";

function DashStat({ icon, value, label, linkLabel, tone, onClick }) {
  return (
    <div className={"dash-stat" + (tone ? " tone-" + tone : "")}>
      <div className="dash-stat-top">
        <span className="dash-stat-ico"><svg className="icon"><use href={"#icon-" + icon} /></svg></span>
        <span className="dash-stat-label">{label}</span>
      </div>
      <div className="dash-stat-value">{value}</div>
      <button type="button" className="dash-stat-link" onClick={onClick}>
        {linkLabel} <svg className="icon flip"><use href="#icon-arrow-left" /></svg>
      </button>
    </div>
  );
}

function CardHead({ icon, title, actionLabel, onAction }) {
  return (
    <div className="card-head-v2">
      <div className="head-left">
        <span className="icon-chip"><svg className="icon"><use href={"#icon-" + icon} /></svg></span>
        <h3>{title}</h3>
      </div>
      {onAction && (
        <a href="#" className="view-all" onClick={(e) => { e.preventDefault(); onAction(); }}>
          {actionLabel || "View all"} <svg className="icon flip"><use href="#icon-arrow-left" /></svg>
        </a>
      )}
    </div>
  );
}

function Empty({ icon, title, text }) {
  return (
    <div className="dash-empty">
      <span className="dash-empty-ico"><svg className="icon"><use href={"#icon-" + icon} /></svg></span>
      <div>
        <h4>{title}</h4>
        <p>{text}</p>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const router = useRouter();
  const go = (p) => router.push(p);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    const sess = readSession("teacher");
    setName((sess && sess.name) || "Teacher");
    api.teacher
      .dashboard()
      .then((d) => {
        setData(d);
        const s = d.summary || {};
        setBadge("/teacher/lessons", s.totalUnits ?? 0);
        setBadge("/teacher/tests", s.totalTests ?? 0);
        setBadge("/teacher/grading", s.pendingGrading ?? 0, true);
      })
      .catch((e) => setErr(e.message));
  }, []);

  const s = (data && data.summary) || {};

  return (
    <div className="tab-panel active">
      <div className="hero-banner">
        <div className="hero-banner-text">
          <div className="hero-banner-greet">{greeting()}, <span>{name}</span>! 👋</div>
          <h2>Here&apos;s what&apos;s happening with your classes</h2>
          <p>Plan your day, track progress, and help your students grow.</p>
          <button type="button" className="btn" onClick={() => go("/teacher/tests/new")}>
            <svg className="icon"><use href="#icon-plus" /></svg> Create New
          </button>
        </div>
        <div className="hero-illustration">
          <svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <g fill="#FFD27A"><path d="M172 18l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" /></g>
            <g fill="#FF7FAE"><path d="M18 108l2.5 5.5 5.5 2.5-5.5 2.5-2.5 5.5-2.5-5.5-5.5-2.5 5.5-2.5z" /></g>
            <g transform="translate(10,22) rotate(-9)">
              <rect width="50" height="42" rx="10" fill="#fff" stroke="#DCEFFF" />
              <rect x="10" y="24" width="6" height="10" rx="2" fill="#5BB4EE" />
              <rect x="19" y="18" width="6" height="16" rx="2" fill="#3D97D6" />
              <rect x="28" y="12" width="6" height="22" rx="2" fill="#245F8F" />
            </g>
            <g transform="translate(138,88) rotate(8)">
              <rect width="50" height="42" rx="10" fill="#fff" stroke="#DCEFFF" />
              <circle cx="25" cy="21" r="13" fill="#DFF7E9" />
              <path d="M18 21l5 5 9-10" stroke="#2FA36B" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <g fill="#F2669C"><path d="M150 132l2.5 5.5 5.5 2.5-5.5 2.5-2.5 5.5-2.5-5.5-5.5-2.5 5.5-2.5z" /></g>
            <circle cx="104" cy="86" r="6" fill="#A9DBFF" />
            <circle cx="60" cy="40" r="4" fill="#FFB4D2" />
          </svg>
        </div>
      </div>

      {err && (
        <div className="notice error">
          <svg className="icon"><use href="#icon-warning" /></svg> {err}
        </div>
      )}
      {!data && !err && <div className="notice info">Loading dashboard...</div>}

      {data && (
        <div id="overviewContent">
          <div className="dash-stats">
            <DashStat icon="student" value={s.totalClasses ?? 0} label="Total Classes" linkLabel="View classes" onClick={() => go("/teacher/classes")} />
            <DashStat icon="inbox" value={s.pendingGrading ?? 0} label="Waiting to Grade" linkLabel="Open grading queue" tone="amber" onClick={() => go("/teacher/grading")} />
            <DashStat icon="clipboard" value={s.activeAssignments ?? 0} label="Active Assignments" linkLabel="View assignments" tone="pink" onClick={() => go("/teacher/lessons")} />
            <DashStat icon="clock" value={s.needAttentionStudents ?? 0} label="Students Needing Attention" linkLabel="View students" tone="danger" onClick={() => go("/teacher/students")} />
          </div>

          <div className="dash-row-2">
            <div className="card">
              <CardHead icon="student" title="Class Overview" actionLabel="View all classes" onAction={() => go("/teacher/classes")} />
              {(!data.classes || data.classes.length === 0) ? (
                <Empty icon="student" title="No classes yet" text="Create a class to start tracking progress." />
              ) : (
                data.classes.map((c) => (
                  <div className="list-item" key={c._id}>
                    <div className="meta">
                      <span className="dash-badge">{classCode(c.name)}</span>
                      <div className="meta-text">
                        <h4>{c.name}</h4>
                        <p>{c.studentCount} student{c.studentCount === 1 ? "" : "s"}</p>
                      </div>
                    </div>
                    <div className="dash-completion">
                      <div className="pct">{c.progressPct}%</div>
                      <div className="progress-bar"><div className="progress-bar-fill" style={{ width: c.progressPct + "%" }} /></div>
                      <div className="lbl">Avg. completion</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="dash-col">
              <div className="card">
                <CardHead icon="calendar" title="Upcoming Deadlines" actionLabel="View calendar" onAction={() => go("/teacher/lessons")} />
                {(!data.upcoming || data.upcoming.length === 0) ? (
                  <Empty icon="calendar" title="Nothing due this week" text="Deadlines in the next 7 days appear here." />
                ) : (
                  data.upcoming.map((u, i) => {
                    const dt = new Date(u.dueAt);
                    return (
                      <div className="list-item" key={i}>
                        <div className="meta">
                          <span className="dash-datechip">
                            <span className="m">{dt.toLocaleString("en-US", { month: "short" })}</span>
                            <span className="d">{dt.getDate()}</span>
                          </span>
                          <div className="meta-text">
                            <h4>{u.label}</h4>
                            <p>{u.className}</p>
                          </div>
                        </div>
                        <div className="list-value">
                          <span className={"pill " + (u.daysLeft <= 2 ? "pill-warn" : "pill-info")}>
                            {u.daysLeft === 0 ? "Due today" : `Due in ${u.daysLeft} day${u.daysLeft > 1 ? "s" : ""}`}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="card">
                <CardHead icon="user" title="Students Needing Attention" actionLabel="View all" onAction={() => go("/teacher/students")} />
                {(!data.watch || data.watch.length === 0) ? (
                  <Empty icon="trophy" title="Everyone's on track" text="No students are overdue, inactive, or dropping in score." />
                ) : (
                  data.watch.map((w) => (
                    <div className="list-item" key={w.studentId}>
                      <div className="meta">
                        <div className="avatar">{initials(w.name)}</div>
                        <div className="meta-text">
                          <h4>{w.name}</h4>
                          <p>{w.summary}</p>
                        </div>
                      </div>
                      <div className="list-value">
                        <button type="button" className="dash-review-btn" onClick={() => go("/teacher/students")}>
                          <svg className="icon"><use href="#icon-sparkles" /></svg> Review
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="dash-row-3">
            <div className="card">
              <CardHead icon="clipboard" title="Recent Assignments" actionLabel="View all" onAction={() => go("/teacher/lessons")} />
              {(!data.recentAssignments || data.recentAssignments.length === 0) ? (
                <Empty icon="inbox" title="No assignments yet" text="Set a deadline on a lesson unit to create one." />
              ) : (
                data.recentAssignments.map((a, i) => (
                  <div className="list-item" key={i}>
                    <div className="meta">
                      <span className="dash-ico-circle"><svg className="icon"><use href={"#icon-" + catIcon(a.categoryKey)} /></svg></span>
                      <div className="meta-text">
                        <h4>{a.label}</h4>
                        <p>{a.className}{a.dueAt ? " · Due " + fmtDue(a.dueAt) : ""}</p>
                      </div>
                    </div>
                    <div className="list-value">
                      <div className="dash-submitted">{a.submitted}/{a.classSize}</div>
                      <div className="dash-submitted-label">Submitted</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="card">
              <CardHead icon="chart-bar" title="Grading Queue" actionLabel="Open queue" onAction={() => go("/teacher/grading")} />
              {(!data.gradingQueue || data.gradingQueue.length === 0) ? (
                <Empty icon="check-circle" title="Grading is up to date" text="No submissions are waiting to be graded." />
              ) : (
                <>
                  {data.gradingQueue.map((q, i) => (
                    <div className="list-item" key={i} style={{ cursor: "pointer" }} onClick={() => go("/teacher/grading")}>
                      <div className="meta">
                        <div className="meta-text">
                          <h4>{q.label}</h4>
                          <p>{q.className}</p>
                        </div>
                      </div>
                      <div className="list-value"><span className="dash-count">{q.toGrade}</span></div>
                    </div>
                  ))}
                  <button type="button" className="dash-queue-foot" onClick={() => go("/teacher/grading")}>
                    Open grading queue
                  </button>
                </>
              )}
            </div>

            <div className="card">
              <CardHead icon="clock" title="Recent Activity" actionLabel="View all" onAction={() => go("/teacher/submissions")} />
              {(!data.recent || data.recent.length === 0) ? (
                <Empty icon="send" title="No activity yet" text="Student submissions will show up here." />
              ) : (
                data.recent.map((r, i) => (
                  <div className="list-item" key={i}>
                    <div className="meta">
                      <span className="dash-ico-circle ok"><svg className="icon"><use href={"#icon-" + (r.kind === "speaking" ? "mic" : r.kind === "listening" ? "headphones" : "check-circle")} /></svg></span>
                      <div className="meta-text">
                        <h4>{r.studentName} submitted {r.testTitle || r.exerciseTitle || r.kind}</h4>
                        <p>{timeAgo(r.submittedAt)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { readSession } from "@/lib/client/session";
import { useMySubmissions } from "@/lib/client/useMySubmissions";
import { buildStudentHome } from "@/lib/student/dashboard";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function initials(name) {
  const parts = String(name || "?").trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return ((parts[0][0] || "") + (parts[parts.length - 1][0] || "")).toUpperCase();
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

const barColor = (pct) => (pct < 50 ? "var(--red)" : pct < 70 ? "var(--amber)" : "var(--green)");

function DashStat({ icon, value, label, hint, tone }) {
  return (
    <div className={"dash-stat" + (tone ? " tone-" + tone : "")}>
      <div className="dash-stat-top">
        <span className="dash-stat-ico"><svg className="icon"><use href={"#icon-" + icon} /></svg></span>
        <span className="dash-stat-label">{label}</span>
      </div>
      <div className="dash-stat-value">{value}</div>
      {hint && <div style={{ fontSize: ".78rem", color: "var(--muted)", fontWeight: 600 }}>{hint}</div>}
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
      <div><h4>{title}</h4><p>{text}</p></div>
    </div>
  );
}

export default function StudentDashboard() {
  const router = useRouter();
  const go = (p) => router.push(p);
  const { subs, loaded } = useMySubmissions();
  const [units, setUnits] = useState(null);
  const [extra, setExtra] = useState(null); // { streak, leaderboard, className }
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const sess = readSession("student");
    setName((sess && sess.name) || "there");
    api.student.listUnits().then((d) => setUnits(d.rows || [])).catch((e) => setErr(e.message));
    api.student.dashboard().then(setExtra).catch(() => setExtra({ streak: { current: 0 }, leaderboard: { rows: [], myRank: null } }));
  }, []);

  const home = useMemo(
    () => (units ? buildStudentHome({ units, subs, now: new Date() }) : null),
    [units, subs]
  );

  const streak = (extra && extra.streak) || { current: 0 };
  const lb = (extra && extra.leaderboard) || { rows: [], myRank: null };
  const ready = home && loaded;

  return (
    <div className="tab-panel active">
      <div className="hero-banner">
        <div className="hero-banner-text">
          <div className="hero-banner-greet">{greeting()}, <span>{name}</span>! 👋</div>
          <h2>Ready to learn today?</h2>
          <p>Pick up where you left off, and keep your on-time streak going.</p>
        </div>
        <div className="streak-chip" title="Assignments finished on time in a row">
          <svg className="icon"><use href="#icon-flame" /></svg>
          {streak.current > 0 ? (
            <span><b>{streak.current}</b> on-time streak</span>
          ) : (
            <span>Build your streak</span>
          )}
        </div>
      </div>

      {err && (
        <div className="notice error">
          <svg className="icon"><use href="#icon-warning" /></svg> {err}
        </div>
      )}
      {!ready && !err && <div className="notice info">Loading your dashboard...</div>}

      {ready && (
        <>
          {home.featured && (
            <div className="unit-featured-card" style={{ marginBottom: 18 }}>
              <div className="unit-featured-icon"><svg className="icon"><use href="#icon-book-open" /></svg></div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <h3 style={{ margin: "0 0 4px" }}>Continue: {home.featured.unit.name}</h3>
                <p className="page-sub" style={{ margin: 0 }}>
                  {home.featured.completed}/{home.featured.totalItems} completed · {home.featured.pct}%
                </p>
              </div>
              <div className="unit-featured-progress">
                <span className="pct">{home.featured.pct}%</span>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: home.featured.pct + "%" }} />
                </div>
              </div>
              <button
                type="button"
                className="btn unit-featured-cta"
                onClick={() => go("/student/lessons/" + home.featured.unit.id)}
              >
                <svg className="icon"><use href="#icon-play" /></svg>{" "}
                {home.featured.pct === 0 ? "Start" : home.featured.pct === 100 ? "Review" : "Continue"}
              </button>
            </div>
          )}

          <div className="dash-stats">
            <DashStat icon="book-open" value={home.stats.unitCount} label="Units for your level" />
            <DashStat icon="flame" value={streak.current} label="On-time streak" tone="amber"
              hint={streak.longest ? `Best: ${streak.longest}` : undefined} />
            <DashStat icon="trophy" value={lb.myRank ? "#" + lb.myRank : "—"} label="Class rank" tone="pink"
              hint={extra && extra.className ? extra.className : undefined} />
            <DashStat icon="warning" value={home.stats.pendingReview} label="Awaiting feedback"
              tone={home.stats.pendingReview > 0 ? "danger" : ""} />
          </div>

          <div className="dash-row-2">
            <div className="card">
              <CardHead icon="chart-bar" title="Strengths & Weaknesses" />
              {home.skills.length === 0 ? (
                <Empty icon="chart-bar" title="No scores yet" text="Finish some exercises and get work graded to see this." />
              ) : (
                home.skills.map((s) => (
                  <div className="skillbar" key={s.key}>
                    <span className="skillbar-label">
                      {s.label}
                      {home.focusSkill && home.focusSkill.key === s.key && (
                        <span className="pill pill-warn" style={{ marginLeft: 6 }}>Focus</span>
                      )}
                    </span>
                    <div className="progress-bar">
                      <div className="progress-bar-fill" style={{ width: s.pct + "%", background: barColor(s.pct) }} />
                    </div>
                    <span className="skillbar-val">{s.band != null ? "Band " + s.band : s.pct + "%"}</span>
                  </div>
                ))
              )}
            </div>

            <div className="dash-col">
              <div className="card">
                <CardHead icon="trophy" title="Class Leaderboard" />
                {(!lb.rows || lb.rows.length === 0) ? (
                  <Empty icon="trophy" title="No ranking yet" text="Ranking appears once your class has some graded work." />
                ) : (
                  lb.rows.map((r) => (
                    <div className={"rank-row" + (r.isMe ? " me" : "")} key={r.studentId}>
                      <span className="rank-pos">#{r.rank}</span>
                      <div className="avatar">{initials(r.name)}</div>
                      <div className="meta-text" style={{ flex: 1, minWidth: 0 }}>
                        <h4>{r.isMe ? `${r.name} (you)` : r.name}</h4>
                      </div>
                      <span className="rank-pts">{r.points} pts</span>
                    </div>
                  ))
                )}
              </div>

              <div className="card">
                <CardHead icon="check-circle" title="Your tasks" />
                {home.todos.length === 0 ? (
                  <Empty icon="check-circle" title="All caught up" text="Nothing overdue and no feedback waiting on you." />
                ) : (
                  home.todos.map((t, i) => (
                    <div
                      className="list-item"
                      key={i}
                      style={{ cursor: "pointer" }}
                      onClick={() => go(t.href)}
                    >
                      <div className="meta">
                        <span className={"dash-ico-circle" + (t.tone === "danger" ? "" : " ok")}>
                          <svg className="icon"><use href={"#icon-" + t.icon} /></svg>
                        </span>
                        <div className="meta-text">
                          <h4>{t.title}</h4>
                          <p>{t.subtitle}</p>
                        </div>
                      </div>
                      <svg className="icon flip" style={{ color: "var(--muted)" }}><use href="#icon-arrow-left" /></svg>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <CardHead icon="clock" title="Recent activity" actionLabel="All lessons" onAction={() => go("/student/lessons")} />
            {home.recent.length === 0 ? (
              <Empty icon="send" title="Nothing yet" text="Your submissions and graded work will show up here." />
            ) : (
              home.recent.map((r, i) => (
                <div className="list-item" key={i} style={{ cursor: "pointer" }} onClick={() => go(r.href)}>
                  <div className="meta">
                    <span className="dash-ico-circle ok"><svg className="icon"><use href={"#icon-" + r.icon} /></svg></span>
                    <div className="meta-text">
                      <h4>{r.title}</h4>
                      <p>{[r.subtitle, timeAgo(r.at)].filter(Boolean).join(" · ")}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

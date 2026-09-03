"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { readSession } from "@/lib/client/session";
import { DashStat, CardHead, Empty, timeAgo } from "@/components/dash/DashKit";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function AdminDashboard() {
  const router = useRouter();
  const go = (p) => router.push(p);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    const s = readSession("admin");
    setName((s && s.name) || "Admin");
    api.admin.dashboard().then(setData).catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="tab-panel active">
      <div className="hero-banner">
        <div className="hero-banner-text">
          <div className="hero-banner-greet">{greeting()}, <span>{name}</span>! 👋</div>
          <h2>System administration</h2>
          <p>Manage accounts, watch activity, and keep an eye on storage.</p>
        </div>
      </div>

      {err && (
        <div className="notice error">
          <svg className="icon"><use href="#icon-warning" /></svg> {err}
        </div>
      )}
      {!data && !err && <div className="notice info">Loading…</div>}

      {data && (
        <>
          <div className="dash-stats">
            <DashStat icon="user" value={data.users.student} label="Students"
              hint={`${data.users.teacher} teachers · ${data.users.admin} admins`} onClick={() => go("/admin/users")} />
            <DashStat icon="student" value={data.classes} label="Classes" tone="pink" onClick={() => go("/admin/classes")} />
            <DashStat icon="book-open" value={data.units.published} label="Published units"
              hint={`${data.units.draft} draft`} />
            <DashStat icon="warning" value={data.submissions.pendingGrading} label="Awaiting grading"
              tone={data.submissions.pendingGrading > 0 ? "amber" : ""} />
          </div>

          <div className="dash-stats">
            <DashStat icon="clipboard" value={data.tests.published} label="Published tests" hint={`${data.tests.draft} draft`} />
            <DashStat icon="send" value={data.submissions.total} label="Submissions (all time)"
              hint={`${data.submissions.week} this week`} />
            <DashStat icon="bell" value={data.notifications24h} label="Notifications (24h)" />
            <DashStat icon="chart-bar" value="—" label="Storage" hint="see Database & Storage" onClick={() => go("/admin/storage")} />
          </div>

          <div className="dash-row-2">
            <div className="card">
              <CardHead icon="list" title="Recent activity" actionLabel="Full log" onAction={() => go("/admin/audit")} />
              {(!data.recentAudit || data.recentAudit.length === 0) ? (
                <Empty icon="list" title="No activity yet" text="Changes across the app appear here (kept 3 days)." />
              ) : (
                data.recentAudit.map((a, i) => (
                  <div className="list-item" key={i}>
                    <div className="meta">
                      <div className="meta-text">
                        <h4>{a.action} <span style={{ color: "var(--muted)", fontWeight: 400 }}>· {a.actorName || a.actorRole}</span></h4>
                        <p>{a.path} — {a.status}</p>
                      </div>
                    </div>
                    <div className="list-value" style={{ fontSize: ".78rem", color: "var(--muted)" }}>{timeAgo(a.at)}</div>
                  </div>
                ))
              )}
            </div>

            <div className="card">
              <CardHead icon="clock" title="Recent submissions" />
              {(!data.recentSubmissions || data.recentSubmissions.length === 0) ? (
                <Empty icon="send" title="Nothing yet" text="Student submissions appear here." />
              ) : (
                data.recentSubmissions.map((r, i) => (
                  <div className="list-item" key={i}>
                    <div className="meta">
                      <span className="dash-ico-circle ok"><svg className="icon"><use href={"#icon-" + (r.kind === "speaking" ? "mic" : r.kind === "writing" ? "writing" : "check-circle")} /></svg></span>
                      <div className="meta-text">
                        <h4>{r.studentName} — {r.testTitle || r.exerciseTitle || r.kind}</h4>
                        <p>
                          {r.kind === "writing" || r.kind === "speaking"
                            ? (r.gradingStatus === "graded" ? `Band ${r.manualScore ?? "?"}` : r.gradingStatus)
                            : `${r.score}/${r.total}`}
                          {" · "}{timeAgo(r.submittedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

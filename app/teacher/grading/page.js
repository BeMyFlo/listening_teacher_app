"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { timeAgo } from "@/components/dash/DashKit";

const KIND_LABEL = { writing: "Writing", speaking: "Speaking" };
const STATUS_PILL = {
  submitted: ["pill-warn", "Pending review"],
  ai_draft: ["pill-info", "AI draft"],
  draft: ["pill-muted", "Draft"],
};

export default function GradingQueuePage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [source, setSource] = useState("");
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    api.teacher.gradingQueue().then(setData).catch((e) => setErr(e.message));
  }, []);

  const rows = useMemo(() => {
    let r = data?.rows || [];
    if (source) r = r.filter((x) => x.source === source);
    if (kind) r = r.filter((x) => x.kind === kind);
    if (q) {
      const s = q.trim().toLowerCase();
      r = r.filter((x) => x.studentName.toLowerCase().includes(s) || x.where.toLowerCase().includes(s));
    }
    return r;
  }, [data, source, kind, q]);

  return (
    <div className="tab-panel active">
      <div className="page-head">
        <div className="head-left">
          <div className="page-head-icon"><svg className="icon"><use href="#icon-check-circle" /></svg></div>
          <div>
            <h1>Grading Queue</h1>
            <p className="page-sub">
              {data
                ? `${data.counts.pending} pending · ${data.counts.drafts} draft · ${data.counts.lesson} lesson · ${data.counts.mock} mock test`
                : "Writing & Speaking waiting to be graded"}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select className="select-inline" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All sources</option>
            <option value="lesson">Lesson</option>
            <option value="mock">Mock test</option>
          </select>
          <select className="select-inline" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">Writing + Speaking</option>
            <option value="writing">Writing</option>
            <option value="speaking">Speaking</option>
          </select>
          <input className="select-inline" placeholder="Search student / unit" value={q}
            onChange={(e) => setQ(e.target.value)} style={{ minWidth: 200 }} />
        </div>
      </div>

      {err && <div className="notice error"><svg className="icon"><use href="#icon-warning" /></svg> {err}</div>}
      {!data && !err && <div className="notice info">Loading…</div>}

      {data && (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr><th>Student</th><th>Where</th><th>Task</th><th>Status</th><th>Submitted</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const [pcls, plabel] = STATUS_PILL[r.gradingStatus] || ["pill-muted", r.gradingStatus];
                return (
                  <tr key={r._id} style={{ cursor: "pointer" }} onClick={() => router.push(r.href)}>
                    <td><b>{r.studentName}</b></td>
                    <td>
                      <span className={"pill " + (r.source === "lesson" ? "pill-muted" : "pill-info")} style={{ marginRight: 6 }}>{r.source}</span>
                      {r.where}
                    </td>
                    <td>
                      {KIND_LABEL[r.kind]}{r.promptTitle ? ` — ${r.promptTitle}` : ""}
                      {r.attemptNumber > 1 && <span className="pill pill-warn" style={{ marginLeft: 6 }}>Lần {r.attemptNumber}</span>}
                    </td>
                    <td><span className={"pill " + pcls}>{plabel}</span>{r.isLate && <span className="pill pill-danger" style={{ marginLeft: 4 }}>Late</span>}</td>
                    <td style={{ whiteSpace: "nowrap", fontSize: ".82rem", color: "var(--muted)" }}>{timeAgo(r.submittedAt)}</td>
                    <td style={{ textAlign: "right" }}>
                      <button type="button" className="btn secondary sm" onClick={(e) => { e.stopPropagation(); router.push(r.href); }}>
                        Grade →
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: 20 }}>Nothing waiting — all caught up.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { timeAgo } from "@/components/dash/DashKit";

const ROLE_PILL = { admin: "pill-danger", teacher: "pill-info", student: "pill-muted", system: "pill-muted" };

export default function AdminAuditPage() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [actorRole, setActorRole] = useState("");
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    api.admin
      .audit({ ...(actorRole ? { actorRole } : {}), ...(action ? { action } : {}), ...(q ? { q } : {}), page })
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [actorRole, action, q, page]);

  const rows = data?.rows || [];
  const pages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <section>
      <div className="page-head">
        <div className="head-left">
          <div className="page-head-icon"><svg className="icon"><use href="#icon-list" /></svg></div>
          <div>
            <h1>Activity Log</h1>
            <p className="page-sub">
              Every change across the app. Auto-deleted after {data?.retentionDays ?? 3} days
              {data?.oldest ? ` · oldest entry ${timeAgo(data.oldest)}` : ""}.
            </p>
          </div>
        </div>
      </div>

      {err && <div className="notice error"><svg className="icon"><use href="#icon-warning" /></svg> {err}</div>}

      <div className="page-head" style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select className="select-inline" value={actorRole} onChange={(e) => { setActorRole(e.target.value); setPage(0); }}>
            <option value="">All actors</option>
            <option value="admin">Admin</option>
            <option value="teacher">Teacher</option>
            <option value="student">Student</option>
            <option value="system">System</option>
          </select>
          <input className="select-inline" placeholder="action prefix (e.g. users.)" value={action}
            onChange={(e) => { setAction(e.target.value); setPage(0); }} />
          <input className="select-inline" placeholder="path contains…" value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0); }} style={{ minWidth: 200 }} />
        </div>
      </div>

      {!data && !err && <div className="notice info">Loading…</div>}

      {data && (
        <>
          <div className="card" style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr><th>When</th><th>Actor</th><th>Action</th><th>Method</th><th>Path</th><th>Status</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id}>
                    <td style={{ whiteSpace: "nowrap" }} title={new Date(r.at).toLocaleString()}>{timeAgo(r.at)}</td>
                    <td>
                      <span className={"pill " + (ROLE_PILL[r.actorRole] || "pill-muted")}>{r.actorRole}</span>{" "}
                      {r.actorName}
                      {r.impBy && <span style={{ fontSize: ".72rem", color: "var(--red)" }}> (via admin)</span>}
                    </td>
                    <td><code>{r.action}</code></td>
                    <td>{r.method}</td>
                    <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.path}>{r.path}</td>
                    <td style={{ color: r.status >= 400 ? "var(--red)" : "var(--green)", fontWeight: 700 }}>{r.status}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: 20 }}>No entries.</td></tr>}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
              <button className="btn secondary sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</button>
              <span style={{ fontSize: ".85rem", color: "var(--muted)" }}>Page {page + 1} / {pages} · {data.total} entries</span>
              <button className="btn secondary sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

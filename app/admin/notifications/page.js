"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { timeAgo } from "@/components/dash/DashKit";

const EMAIL_PILL = { sent: "pill-ok", failed: "pill-danger", skipped: "pill-muted", pending: "pill-warn", none: "pill-muted" };

export default function AdminNotificationsLogPage() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [type, setType] = useState("");
  const [recipient, setRecipient] = useState("");
  const [emailStatus, setEmailStatus] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    api.admin
      .notificationsLog({ ...(type ? { type } : {}), ...(recipient ? { recipient } : {}), ...(emailStatus ? { emailStatus } : {}), page })
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [type, recipient, emailStatus, page]);

  const rows = data?.rows || [];
  const pages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <section>
      <div className="page-head">
        <div className="head-left">
          <div className="page-head-icon"><svg className="icon"><use href="#icon-bell" /></svg></div>
          <div>
            <h1>Notifications Log</h1>
            <p className="page-sub">
              {data ? Object.entries(data.byType).map(([k, v]) => `${k}: ${v}`).join(" · ") : "Every notification ever sent."}
            </p>
          </div>
        </div>
      </div>

      {err && <div className="notice error"><svg className="icon"><use href="#icon-warning" /></svg> {err}</div>}

      <div className="page-head" style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select className="select-inline" value={type} onChange={(e) => { setType(e.target.value); setPage(0); }}>
            <option value="">All types</option>
            <option value="deadline_soon">deadline_soon</option>
            <option value="deadline_assigned">deadline_assigned</option>
            <option value="submission_late">submission_late</option>
            <option value="submission_received">submission_received</option>
            <option value="submission_graded">submission_graded</option>
          </select>
          <select className="select-inline" value={recipient} onChange={(e) => { setRecipient(e.target.value); setPage(0); }}>
            <option value="">Any recipient</option>
            <option value="student">Students</option>
            <option value="teacher">Teachers</option>
          </select>
          <select className="select-inline" value={emailStatus} onChange={(e) => { setEmailStatus(e.target.value); setPage(0); }}>
            <option value="">Any email status</option>
            <option value="sent">sent</option>
            <option value="failed">failed</option>
            <option value="skipped">skipped</option>
            <option value="none">none</option>
          </select>
        </div>
      </div>

      {!data && !err && <div className="notice info">Loading…</div>}

      {data && (
        <>
          <div className="card" style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr><th>When</th><th>Type</th><th>Recipient</th><th>Title</th><th>In-app</th><th>Email</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id}>
                    <td style={{ whiteSpace: "nowrap" }}>{timeAgo(r.createdAt)}</td>
                    <td><code>{r.type}</code></td>
                    <td>{r.recipientName} <span style={{ color: "var(--muted)", fontSize: ".76rem" }}>({r.recipientRole})</span></td>
                    <td style={{ maxWidth: 280 }}>{r.title}</td>
                    <td><span className={"pill " + (r.inappRead ? "pill-muted" : "pill-info")}>{r.inappRead ? "read" : "unread"}</span></td>
                    <td>
                      <span className={"pill " + (EMAIL_PILL[r.emailStatus] || "pill-muted")}>{r.emailStatus}</span>
                      {r.emailError && <div style={{ fontSize: ".72rem", color: "var(--red)" }}>{r.emailError}</div>}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: 20 }}>No notifications.</td></tr>}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
              <button className="btn secondary sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</button>
              <span style={{ fontSize: ".85rem", color: "var(--muted)" }}>Page {page + 1} / {pages} · {data.total}</span>
              <button className="btn secondary sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

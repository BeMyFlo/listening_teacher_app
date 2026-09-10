"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import {
  KIND_LABEL,
  PRIORITY_LABEL,
  STATUS_LABEL,
  STATUS_PILL,
  timeAgo,
} from "@/components/tickets/ticketMeta";

const STATUSES = ["open", "in_progress", "resolved", "closed"];

export default function AdminTicketsPage() {
  const [tab, setTab] = useState("student"); // student | teacher
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState(null); // ticket đầy đủ
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const threadRef = useRef(null);

  const load = useCallback(() => {
    api.admin
      .tickets({ reporterRole: tab, ...(status ? { status } : {}), ...(kind ? { kind } : {}), ...(q ? { q } : {}) })
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [tab, status, kind, q]);

  useEffect(load, [load]);
  useEffect(() => {
    if (sel && threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [sel]);

  function openTicket(id) {
    api.admin.getTicket(id).then((d) => setSel(d.ticket)).catch((e) => setErr(e.message));
  }

  async function apply(patch) {
    setBusy(true);
    setErr("");
    try {
      const d = await api.admin.updateTicket(sel._id, patch);
      setSel(d.ticket);
      setReply("");
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const rows = data?.rows || [];
  const sum = data?.summary || { student: {}, teacher: {} };

  return (
    <section>
      <div className="page-head">
        <div className="head-left">
          <div className="page-head-icon"><svg className="icon"><use href="#icon-inbox" /></svg></div>
          <div>
            <h1>Support Tickets</h1>
            <p className="page-sub">
              Students: {sum.student.open || 0} open / {sum.student.total || 0} ·
              {" "}Teachers: {sum.teacher.open || 0} open / {sum.teacher.total || 0}
            </p>
          </div>
        </div>
      </div>

      {err && <div className="notice error">{err}</div>}

      <div className="tkt-tabs">
        {["student", "teacher"].map((r) => (
          <button
            key={r}
            type="button"
            className={"tkt-tab" + (tab === r ? " active" : "")}
            onClick={() => { setTab(r); setSel(null); }}
          >
            {r === "student" ? "From students" : "From teachers"}
            {sum[r] && sum[r].open ? <span className="tkt-tab-n">{sum[r].open}</span> : null}
          </button>
        ))}
      </div>

      <div className="page-head" style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select className="select-inline" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <select className="select-inline" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">All types</option>
            <option value="bug">Bug</option>
            <option value="feature">Feature request</option>
          </select>
          <input
            type="search"
            placeholder="Search title / reporter…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ minWidth: 200 }}
          />
        </div>
      </div>

      <div className="tkt-admin-grid">
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr><th>Title</th><th>Type</th><th>Status</th><th>Updated</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>No tickets.</td></tr>
              )}
              {rows.map((r) => (
                <tr
                  key={r._id}
                  className={"tkt-row" + (sel && sel._id === r._id ? " sel" : "") + (r.adminUnread ? " unread" : "")}
                  onClick={() => openTicket(r._id)}
                >
                  <td>
                    {r.adminUnread && <span className="tkt-dot" />}
                    {r.title}
                    <div className="tkt-sub">{r.reporterName || "(unknown)"} · {timeAgo(r.createdAt)}</div>
                  </td>
                  <td>{KIND_LABEL[r.kind]}</td>
                  <td><span className={"pill " + STATUS_PILL[r.status]}>{STATUS_LABEL[r.status]}</span></td>
                  <td style={{ whiteSpace: "nowrap" }}>{timeAgo(r.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sel && (
          <div className="card tkt-detail">
            <div className="tkt-detail-head">
              <div>
                <h3 style={{ margin: 0 }}>{sel.title}</h3>
                <p className="tkt-sub">
                  {sel.reporterName} ({sel.reporterRole}) · {KIND_LABEL[sel.kind]}
                  {sel.pageUrl ? " · " + sel.pageUrl : ""}
                </p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setSel(null)} title="Close">
                <svg className="icon"><use href="#icon-cross" /></svg>
              </button>
            </div>

            <div className="tkt-controls">
              <label>
                Status
                <select
                  className="select-inline"
                  value={sel.status}
                  disabled={busy}
                  onChange={(e) => apply({ status: e.target.value })}
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </label>
              <label>
                Priority
                <select
                  className="select-inline"
                  value={sel.priority}
                  disabled={busy}
                  onChange={(e) => apply({ priority: e.target.value })}
                >
                  {["low", "normal", "high"].map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
                </select>
              </label>
            </div>

            <div className="tkt-thread" ref={threadRef}>
              <Bubble msg={{ authorRole: sel.reporterRole, authorName: sel.reporterName, body: sel.body, images: sel.images, createdAt: sel.createdAt }} />
              {sel.messages.map((m) => <Bubble key={m._id} msg={m} />)}
            </div>

            <form
              className="tkt-reply"
              onSubmit={(e) => { e.preventDefault(); if (reply.trim()) apply({ reply: reply.trim() }); }}
            >
              <textarea rows={2} placeholder="Reply to reporter…" value={reply} onChange={(e) => setReply(e.target.value)} />
              <button type="submit" className="btn" disabled={busy || !reply.trim()}>
                <svg className="icon"><use href="#icon-send" /></svg> Send
              </button>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}

function Bubble({ msg }) {
  const admin = msg.authorRole === "admin";
  return (
    <div className={"tkt-bubble" + (admin ? " mine" : "")}>
      <div className="tkt-bubble-head">
        <b>{admin ? "Support" : msg.authorName || msg.authorRole}</b> <span>{timeAgo(msg.createdAt)}</span>
      </div>
      {msg.body && <div className="tkt-bubble-body">{msg.body}</div>}
      {msg.images && msg.images.length > 0 && (
        <div className="tkt-shots">
          {msg.images.map((im) => (
            <a className="tkt-shot" key={im.url} href={im.url} target="_blank" rel="noreferrer">
              <img src={im.url} alt="" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

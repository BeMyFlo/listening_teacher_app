"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { useDialog } from "@/components/ui/Dialog";
import { timeAgo } from "@/components/dash/DashKit";

const STATUSES = ["new", "contacted", "accepted", "rejected"];
const LABEL = { new: "New", contacted: "Contacted", accepted: "Accepted", rejected: "Rejected" };
const PILL = { new: "pill-info", contacted: "pill-muted", accepted: "pill-success", rejected: "pill-danger" };

export default function AdminSignupRequestsPage() {
  const dialog = useDialog();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState(null);

  function load() {
    api.admin
      .signupRequests(status ? { status } : {})
      .then(setData)
      .catch((e) => setErr(e.message));
  }
  useEffect(load, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function setRowStatus(r, next) {
    setBusyId(r._id);
    try {
      await api.admin.updateSignupRequest(r._id, { status: next });
      load();
    } catch (e) {
      dialog.toast(e.message, "error");
    } finally {
      setBusyId(null);
    }
  }

  async function editNote(r) {
    const note = await dialog.prompt({ title: "Internal note", message: `About ${r.name}`, initialValue: r.note || "" });
    if (note == null) return;
    setBusyId(r._id);
    try {
      await api.admin.updateSignupRequest(r._id, { note });
      load();
    } catch (e) {
      dialog.toast(e.message, "error");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(r) {
    const ok = await dialog.confirm({
      title: "Delete this request?",
      message: `${r.name} (${r.email}) will be removed permanently. This cannot be undone.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    setBusyId(r._id);
    try {
      await api.admin.deleteSignupRequest(r._id);
      dialog.toast("Request deleted");
      load();
    } catch (e) {
      dialog.toast(e.message, "error");
    } finally {
      setBusyId(null);
    }
  }

  const rows = data?.rows || [];
  const summary = data?.summary || {};

  return (
    <section>
      <div className="page-head">
        <div className="head-left">
          <div className="page-head-icon"><svg className="icon"><use href="#icon-user-plus" /></svg></div>
          <div>
            <h1>Sign-up requests</h1>
            <p className="page-sub">
              Trial requests from the public landing page. Nothing is created automatically — create the workspace in
              Users when you accept one. These contain personal data: delete them when you no longer need them.
            </p>
          </div>
        </div>
      </div>

      {err && <div className="notice error"><svg className="icon"><use href="#icon-warning" /></svg> {err}</div>}

      <div className="page-head" style={{ marginBottom: 10 }}>
        <select className="select-inline" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]} ({summary[s] ?? 0})</option>)}
        </select>
      </div>

      {!data && !err && <div className="notice info">Loading…</div>}

      {data && (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr><th>When</th><th>Who</th><th>Contact</th><th>Message</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  <td style={{ whiteSpace: "nowrap" }} title={new Date(r.createdAt).toLocaleString()}>{timeAgo(r.createdAt)}</td>
                  <td>
                    <strong>{r.name}</strong>
                    {r.organization && <div style={{ fontSize: ".8rem", color: "var(--muted)" }}>{r.organization}</div>}
                  </td>
                  <td>
                    <a href={"mailto:" + r.email}>{r.email}</a>
                    {r.phone && <div style={{ fontSize: ".8rem" }}>{r.phone}</div>}
                  </td>
                  <td style={{ maxWidth: 320, whiteSpace: "pre-wrap" }}>
                    {r.message || <span style={{ color: "var(--muted)" }}>—</span>}
                    {r.note && <div style={{ fontSize: ".8rem", color: "var(--muted)", marginTop: 4 }}>Note: {r.note}</div>}
                  </td>
                  <td>
                    <select
                      className="select-inline"
                      value={r.status}
                      disabled={busyId === r._id}
                      onChange={(e) => setRowStatus(r, e.target.value)}
                      aria-label={"Status of " + r.name}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
                    </select>{" "}
                    <span className={"pill " + PILL[r.status]}>{LABEL[r.status]}</span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn secondary sm" disabled={busyId === r._id} onClick={() => editNote(r)}>Note</button>{" "}
                    <button className="btn secondary sm" disabled={busyId === r._id} onClick={() => remove(r)}>Delete</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: 20 }}>No requests yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

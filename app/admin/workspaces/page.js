"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { useDialog } from "@/components/ui/Dialog";

export default function AdminWorkspacesPage() {
  const dialog = useDialog();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");

  function load() {
    api.admin
      .listWorkspaces()
      .then((d) => setRows(d.rows))
      .catch((e) => setErr(e.message));
  }
  useEffect(load, []);

  async function patch(w, body, okMsg) {
    setBusyId(w._id);
    try {
      await api.admin.updateWorkspace(w._id, body);
      dialog.toast(okMsg);
      setEditId(null);
      load();
    } catch (e) {
      dialog.alert({ tone: "error", title: "Update failed", message: e.message });
    } finally {
      setBusyId(null);
    }
  }

  async function toggle(w) {
    const suspend = w.status !== "suspended";
    const ok = await dialog.confirm({
      title: `${suspend ? "Suspend" : "Activate"} ${w.name}?`,
      message: suspend
        ? "All teachers and students of this workspace will lose access within a minute."
        : "Teachers and students of this workspace will be able to sign in and work again.",
      confirmText: suspend ? "Suspend" : "Activate",
      danger: suspend,
    });
    if (!ok) return;
    patch(w, { status: suspend ? "suspended" : "active" }, suspend ? "Workspace suspended" : "Workspace activated");
  }

  return (
    <section>
      <div className="page-head">
        <div className="head-left">
          <div className="page-head-icon"><svg className="icon"><use href="#icon-shield" /></svg></div>
          <div>
            <h1>Workspaces</h1>
            <p className="page-sub">Each workspace is one teaching center with its own teachers, students and content.</p>
          </div>
        </div>
      </div>

      {err && <div className="notice error"><svg className="icon"><use href="#icon-warning" /></svg> {err}</div>}
      {!rows && !err && <div className="notice info">Loading…</div>}

      {rows && (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th><th>Slug</th><th>Owner</th><th>Teachers</th><th>Students</th>
                <th>Classes</th><th>Status</th><th>Created</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w._id} style={w.status === "suspended" ? { opacity: 0.6 } : undefined}>
                  <td>
                    {editId === w._id ? (
                      <span style={{ display: "flex", gap: 6 }}>
                        <input type="text" value={editName} maxLength={140} onChange={(e) => setEditName(e.target.value)} />
                        <button type="button" className="btn sm" disabled={busyId === w._id || !editName.trim()}
                          onClick={() => patch(w, { name: editName }, "Workspace renamed")}>Save</button>
                        <button type="button" className="btn secondary sm" onClick={() => setEditId(null)}>Cancel</button>
                      </span>
                    ) : (
                      <b>{w.name}</b>
                    )}
                  </td>
                  <td><code>{w.slug}</code></td>
                  <td>
                    {w.owner.name || "—"}
                    {w.owner.username && <div style={{ fontSize: ".78rem", color: "var(--muted)" }}>{w.owner.username}</div>}
                  </td>
                  <td>{w.teachers}</td>
                  <td>{w.students}</td>
                  <td>{w.classes}</td>
                  <td>
                    <span className={"pill " + (w.status === "suspended" ? "pill-danger" : "pill-ok")}>{w.status}</span>
                  </td>
                  <td style={{ fontSize: ".8rem", color: "var(--muted)", whiteSpace: "nowrap" }}>
                    {new Date(w.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                    <button type="button" className="btn secondary sm" disabled={busyId === w._id}
                      onClick={() => { setEditId(w._id); setEditName(w.name); }}>Rename</button>{" "}
                    <button type="button" className="btn secondary sm" disabled={busyId === w._id} onClick={() => toggle(w)}>
                      {w.status === "suspended" ? "Activate" : "Suspend"}
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--muted)", padding: 20 }}>No workspaces.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

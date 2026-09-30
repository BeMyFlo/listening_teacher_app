"use client";

import { Fragment, useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { useDialog } from "@/components/ui/Dialog";

export default function AdminClassesPage() {
  const dialog = useDialog();
  const [rows, setRows] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [students, setStudents] = useState(null);
  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState({ name: "", level: "" });
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ workspaceId: "", name: "", level: "1" });

  function load() {
    api.admin
      .listClasses(workspaceId ? { workspaceId } : {})
      .then((d) => { setErr(""); setRows(d.rows); })
      .catch((e) => setErr(e.message));
  }
  useEffect(load, [workspaceId]);
  useEffect(() => {
    api.admin.listWorkspaces().then((d) => setWorkspaces(d.rows)).catch(() => {});
  }, []);

  async function toggleStudents(c) {
    if (openId === c._id) return setOpenId(null);
    setOpenId(c._id);
    setStudents(null);
    try {
      const d = await api.admin.getClass(c._id);
      setStudents(d.students);
    } catch (e) {
      setOpenId(null);
      dialog.alert({ tone: "error", title: "Could not load students", message: e.message });
    }
  }

  async function saveEdit(c) {
    setBusyId(c._id);
    try {
      await api.admin.updateClass(c._id, { name: edit.name, level: Number(edit.level) });
      dialog.toast("Class updated");
      setEditId(null);
      load();
    } catch (e) {
      dialog.alert({ tone: "error", title: "Update failed", message: e.message });
    } finally {
      setBusyId(null);
    }
  }

  async function create(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.admin.createClass({ ...form, level: Number(form.level) });
      dialog.toast("Class created");
      setShowCreate(false);
      setForm({ workspaceId: "", name: "", level: "1" });
      load();
    } catch (e2) {
      setErr(e2.message);
    }
  }

  return (
    <section>
      <div className="page-head">
        <div className="head-left">
          <div className="page-head-icon"><svg className="icon"><use href="#icon-student" /></svg></div>
          <div>
            <h1>Classes</h1>
            <p className="page-sub">
              Classes are managed by each workspace's teacher. View them here, or create one on a
              teacher's behalf when asked.
            </p>
          </div>
        </div>
        <button type="button" className="btn secondary" onClick={() => setShowCreate((v) => !v)}>
          <svg className="icon"><use href="#icon-plus" /></svg> Create class for a teacher
        </button>
      </div>

      {err && <div className="notice error"><svg className="icon"><use href="#icon-warning" /></svg> {err}</div>}

      {showCreate && (
        <div className="card" style={{ marginBottom: 14 }}>
          <form onSubmit={create} style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
            <label>Workspace
              <select value={form.workspaceId} onChange={(e) => setForm((f) => ({ ...f, workspaceId: e.target.value }))} required>
                <option value="">— select —</option>
                {workspaces.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
              </select>
            </label>
            <label>Class name<input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></label>
            <label>Level
              <input type="number" min="1" step="1" value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))} required />
            </label>
            <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
              <button type="submit" className="btn">Create</button>
              <button type="button" className="btn secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="page-head" style={{ marginBottom: 10 }}>
        <select className="select-inline" value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)}>
          <option value="">All workspaces</option>
          {workspaces.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
        </select>
      </div>

      {!rows && !err && <div className="notice info">Loading…</div>}

      {rows && (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr><th>Class</th><th>Level</th><th>Workspace</th><th>Students</th><th>Created</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <Fragment key={c._id}>
                  <tr>
                    {editId === c._id ? (
                      <>
                        <td><input value={edit.name} onChange={(e) => setEdit((x) => ({ ...x, name: e.target.value }))} /></td>
                        <td><input type="number" min="1" step="1" style={{ width: 70 }} value={edit.level} onChange={(e) => setEdit((x) => ({ ...x, level: e.target.value }))} /></td>
                      </>
                    ) : (
                      <>
                        <td><b>{c.name}</b></td>
                        <td>L{c.level}</td>
                      </>
                    )}
                    <td>{c.workspaceName || "—"}</td>
                    <td>{c.studentCount}</td>
                    <td style={{ fontSize: ".8rem", color: "var(--muted)", whiteSpace: "nowrap" }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                      {editId === c._id ? (
                        <>
                          <button type="button" className="btn sm" disabled={busyId === c._id || !edit.name.trim()} onClick={() => saveEdit(c)}>Save</button>{" "}
                          <button type="button" className="btn secondary sm" onClick={() => setEditId(null)}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="btn secondary sm" onClick={() => toggleStudents(c)}>
                            {openId === c._id ? "Hide students" : "Students"}
                          </button>{" "}
                          <button type="button" className="btn secondary sm" onClick={() => { setEditId(c._id); setEdit({ name: c.name, level: String(c.level) }); }}>Edit</button>
                        </>
                      )}
                    </td>
                  </tr>
                  {openId === c._id && (
                    <tr>
                      <td colSpan={6} style={{ background: "var(--bg, transparent)" }}>
                        {!students && <span style={{ color: "var(--muted)" }}>Loading…</span>}
                        {students && students.length === 0 && <span style={{ color: "var(--muted)" }}>No students in this class.</span>}
                        {students && students.length > 0 && (
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {students.map((s) => (
                              <li key={s._id}>{s.name} <span style={{ color: "var(--muted)", fontSize: ".8rem" }}>· {s.username}</span></li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: 20 }}>No classes.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

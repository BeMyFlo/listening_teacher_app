"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { setTeacherToken } from "@/lib/client/session";
import { useDialog } from "@/components/ui/Dialog";
import { timeAgo } from "@/components/dash/DashKit";

const ROLE_PILL = { admin: "pill-danger", teacher: "pill-info", student: "pill-muted" };

export default function AdminUsersPage() {
  const router = useRouter();
  const dialog = useDialog();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [role, setRole] = useState("");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ role: "student", name: "", username: "", password: "", email: "", classId: "" });

  function load() {
    api.admin
      .listUsers({ ...(role ? { role } : {}), ...(q ? { q } : {}) })
      .then(setData)
      .catch((e) => setErr(e.message));
  }
  useEffect(load, [role, q]);

  const classes = data?.classes || [];
  const rows = data?.rows || [];
  const counts = useMemo(() => {
    const c = { admin: 0, teacher: 0, student: 0 };
    rows.forEach((r) => (c[r.role] = (c[r.role] || 0) + 1));
    return c;
  }, [rows]);

  async function create(e) {
    e.preventDefault();
    setErr("");
    try {
      const body = { ...form };
      if (form.role !== "student") delete body.classId;
      await api.admin.createUser(body);
      setShowCreate(false);
      setForm({ role: "student", name: "", username: "", password: "", email: "", classId: "" });
      dialog.toast("Account created");
      load();
    } catch (e2) {
      setErr(e2.message);
    }
  }

  async function patch(id, body, okMsg) {
    setBusyId(id);
    try {
      await api.admin.updateUser(id, body);
      dialog.toast(okMsg || "Saved");
      load();
    } catch (e) {
      dialog.alert({ tone: "error", title: "Update failed", message: e.message });
    } finally {
      setBusyId(null);
    }
  }

  async function resetPw(u) {
    const pw = await dialog.prompt({
      title: `Reset password — ${u.name}`,
      label: "New password (min 4 chars)",
      type: "text",
    });
    if (pw == null) return;
    patch(u._id, { password: pw }, "Password reset");
  }

  async function del(u) {
    const ok = await dialog.confirm({
      title: `Delete ${u.name}?`,
      message:
        u.role === "student"
          ? "The account and its profile are removed. Submission history is kept."
          : "The account and its profile are removed.",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    setBusyId(u._id);
    try {
      await api.admin.deleteUser(u._id);
      dialog.toast("Deleted");
      load();
    } catch (e) {
      dialog.alert({ tone: "error", title: "Delete failed", message: e.message });
    } finally {
      setBusyId(null);
    }
  }

  async function loginAs(u) {
    setBusyId(u._id);
    try {
      const r = await api.admin.impersonate(u._id);
      setTeacherToken(r.token, false);
      localStorage.setItem("impersonating", JSON.stringify({ name: r.name, since: Date.now() }));
      router.push("/teacher/overview");
    } catch (e) {
      dialog.alert({ tone: "error", title: "Cannot log in as this user", message: e.message });
      setBusyId(null);
    }
  }

  return (
    <section>
      <div className="page-head">
        <div className="head-left">
          <div className="page-head-icon"><svg className="icon"><use href="#icon-user" /></svg></div>
          <div>
            <h1>Users</h1>
            <p className="page-sub">{counts.admin} admins · {counts.teacher} teachers · {counts.student} students</p>
          </div>
        </div>
        <button type="button" className="btn" onClick={() => setShowCreate((v) => !v)}>
          <svg className="icon"><use href="#icon-plus" /></svg> New account
        </button>
      </div>

      {err && <div className="notice error"><svg className="icon"><use href="#icon-warning" /></svg> {err}</div>}

      {showCreate && (
        <div className="card" style={{ marginBottom: 14 }}>
          <form onSubmit={create} style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
            <label>Role
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label>Full name<input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></label>
            <label>Username<input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} required /></label>
            <label>Password<input type="text" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required /></label>
            <label>Email (optional)<input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></label>
            {form.role === "student" && (
              <label>Class
                <select value={form.classId} onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))} required>
                  <option value="">— select —</option>
                  {classes.map((c) => <option key={c._id} value={c._id}>{c.name} (L{c.level})</option>)}
                </select>
              </label>
            )}
            <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
              <button type="submit" className="btn">Create</button>
              <button type="button" className="btn secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="page-head" style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select className="select-inline" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            <option value="admin">Admins</option>
            <option value="teacher">Teachers</option>
            <option value="student">Students</option>
          </select>
          <input className="select-inline" placeholder="Search name / username / email"
            value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 240 }} />
        </div>
      </div>

      {!data && !err && <div className="notice info">Loading…</div>}

      {data && (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th><th>Role</th><th>Username</th><th>Class</th>
                <th>Last login</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u._id} style={u.active ? undefined : { opacity: 0.5 }}>
                  <td>
                    <b>{u.name}</b>
                    {u.email && <div style={{ fontSize: ".78rem", color: "var(--muted)" }}>{u.email}</div>}
                    {u.role === "student" && <div style={{ fontSize: ".78rem", color: "var(--muted)" }}>{u.submissionCount} submissions</div>}
                  </td>
                  <td><span className={"pill " + (ROLE_PILL[u.role] || "pill-muted")}>{u.role}</span></td>
                  <td>{u.username}</td>
                  <td>
                    {u.role === "student" ? (
                      <select
                        value={u.classId || ""}
                        disabled={busyId === u._id}
                        onChange={(e) => patch(u._id, { classId: e.target.value || null }, "Class updated")}
                      >
                        <option value="">— none —</option>
                        {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                      </select>
                    ) : u.role === "teacher" ? (
                      <span style={{ fontSize: ".8rem", color: "var(--muted)" }}>
                        {u.teacherClassIds.length ? `${u.teacherClassIds.length} class(es)` : "all classes"}
                      </span>
                    ) : "—"}
                  </td>
                  <td style={{ fontSize: ".8rem", color: "var(--muted)" }}>{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "never"}</td>
                  <td>
                    <button
                      type="button"
                      className={"pill " + (u.active ? "pill-ok" : "pill-danger")}
                      disabled={busyId === u._id}
                      onClick={() => patch(u._id, { active: !u.active }, u.active ? "Disabled" : "Enabled")}
                      style={{ cursor: "pointer", border: "none" }}
                    >
                      {u.active ? "active" : "disabled"}
                    </button>
                  </td>
                  <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                    {u.role === "teacher" && (
                      <button type="button" className="btn secondary sm" disabled={busyId === u._id} onClick={() => loginAs(u)}>
                        Log in as
                      </button>
                    )}{" "}
                    <button type="button" className="btn secondary sm" disabled={busyId === u._id} onClick={() => resetPw(u)}>Reset pw</button>{" "}
                    <button type="button" className="btn secondary sm" disabled={busyId === u._id} onClick={() => del(u)}>Delete</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--muted)", padding: 20 }}>No users match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

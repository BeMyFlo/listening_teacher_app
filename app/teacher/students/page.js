"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";

export default function StudentsPage() {
  const [rows, setRows] = useState(null);
  const [classes, setClasses] = useState([]);
  const [listErr, setListErr] = useState("");
  const [form, setForm] = useState({ name: "", username: "", password: "", classId: "" });
  const [status, setStatus] = useState(null);

  function load() {
    Promise.all([api.teacher.listStudents(), api.teacher.listClasses().catch(() => ({ rows: [] }))])
      .then(([s, c]) => {
        setRows(s.rows || []);
        setClasses(c.rows || []);
      })
      .catch((e) => setListErr(e.message));
  }
  useEffect(load, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function create() {
    setStatus(null);
    if (!form.classId) {
      setStatus({ cls: "error", msg: "Please select a class." });
      return;
    }
    try {
      await api.teacher.createStudent({
        name: form.name.trim(),
        username: form.username.trim(),
        password: form.password,
        classId: form.classId,
      });
      setStatus({ cls: "success", msg: "Student account created successfully." });
      setForm({ name: "", username: "", password: "", classId: "" });
      load();
    } catch (e) {
      setStatus({ cls: "error", msg: e.message });
    }
  }

  async function changeClass(s, classId) {
    try {
      await api.teacher.updateStudent(s._id, { classId: classId || null });
      load();
    } catch (e) {
      window.alert("Failed: " + e.message);
    }
  }

  async function resetPw(s) {
    const pw = window.prompt(`Enter new password for student ${s.name} (minimum 6 characters):`);
    if (pw === null) return;
    if (pw.trim().length < 6) return window.alert("New password is too short.");
    try {
      await api.teacher.resetStudentPassword(s._id, pw.trim());
      window.alert("Password reset successfully.");
    } catch (e) {
      window.alert("Failed to reset password: " + e.message);
    }
  }

  async function del(s) {
    if (!window.confirm(`Delete student account for ${s.name}? All submission history will be lost and cannot be restored.`))
      return;
    try {
      await api.teacher.deleteStudent(s._id);
      load();
    } catch (e) {
      window.alert("Failed to delete student: " + e.message);
    }
  }

  return (
    <div className="tab-panel active">
      <div className="page-head">
        <div className="head-left">
          <div className="page-head-icon"><svg className="icon"><use href="#icon-user" /></svg></div>
          <div>
            <h1>Students</h1>
            <p className="page-sub">Create student accounts and assign them to classes</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Create New Student Account</h3>
        {classes.length === 0 && (
          <p className="notice info">Create a class first (Classes tab) — every student must belong to a class.</p>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <label>Full Name</label>
            <input type="text" placeholder="e.g. John Doe" value={form.name} onChange={set("name")} />
          </div>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <label>Username</label>
            <input
              type="text"
              placeholder="lowercase, numbers, ._ (3-30 chars)"
              value={form.username}
              onChange={set("username")}
            />
          </div>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <label>Password</label>
            <input type="text" placeholder="At least 4 characters" value={form.password} onChange={set("password")} />
          </div>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <label>Class</label>
            <select className="select-inline" value={form.classId} onChange={set("classId")}>
              <option value="">— Select a class —</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} (Level {c.level})
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="button" className="btn" style={{ marginTop: 14 }} onClick={create}>
          <svg className="icon"><use href="#icon-user-plus" /></svg> Create Student
        </button>
        {status && (
          <p className={"notice " + status.cls} style={{ marginTop: 14 }}>
            {status.msg}
          </p>
        )}
      </div>

      <div className="card">
        <h3>Student Account List</h3>
        {listErr && (
          <div className="notice error">
            <svg className="icon"><use href="#icon-warning" /></svg> {listErr}
          </div>
        )}
        {!rows && !listErr && <div className="notice info">Loading...</div>}
        {rows && rows.length === 0 && <div className="notice info">No student accounts found.</div>}
        {rows && rows.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Username</th>
                  <th>Class</th>
                  <th>Registered</th>
                  <th>Submissions</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s._id}>
                    <td>{s.name}</td>
                    <td>{s.username}</td>
                    <td>
                      <select
                        className="select-inline"
                        value={s.classId ? String(s.classId) : ""}
                        onChange={(e) => changeClass(s, e.target.value)}
                      >
                        <option value="">— Unassigned —</option>
                        {classes.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{s.createdAt ? new Date(s.createdAt).toLocaleDateString("en-US") : "-"}</td>
                    <td>{s.submissionCount ?? 0}</td>
                    <td>
                      <button
                        type="button"
                        className="btn secondary"
                        style={{ padding: "4px 8px", fontSize: ".8rem", marginRight: 6 }}
                        onClick={() => resetPw(s)}
                      >
                        Reset Password
                      </button>
                      <button
                        type="button"
                        className="btn secondary danger"
                        style={{ padding: "4px 8px", fontSize: ".8rem", borderColor: "var(--red)", color: "var(--red)" }}
                        onClick={() => del(s)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

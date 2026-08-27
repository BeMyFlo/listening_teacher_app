"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";

export default function ClassesPage() {
  const router = useRouter();
  const [rows, setRows] = useState(null);
  const [listErr, setListErr] = useState("");
  const [name, setName] = useState("");
  const [level, setLevel] = useState(1);
  const [status, setStatus] = useState(null);

  function load() {
    api.teacher
      .listClasses()
      .then((d) => setRows(d.rows || []))
      .catch((e) => setListErr(e.message));
  }
  useEffect(load, []);

  async function create() {
    if (!name.trim()) {
      setStatus({ cls: "error", msg: "Please enter a class name." });
      return;
    }
    setStatus(null);
    try {
      await api.teacher.createClass({ name: name.trim(), level: Number(level) || 1 });
      setStatus({ cls: "success", msg: "Class created." });
      setName("");
      setLevel(1);
      load();
    } catch (e) {
      setStatus({ cls: "error", msg: e.message });
    }
  }

  async function del(c) {
    if (!window.confirm(`Delete class "${c.name}"? Students stay but become unassigned; the class is removed from any assigned lessons/tests.`))
      return;
    try {
      await api.teacher.deleteClass(c._id);
      load();
    } catch (e) {
      window.alert("Failed to delete: " + e.message);
    }
  }

  return (
    <div className="tab-panel active">
      <div className="page-head">
        <div className="head-left">
          <div className="page-head-icon"><svg className="icon"><use href="#icon-student" /></svg></div>
          <div>
            <h1>Classes</h1>
            <p className="page-sub">Group students into classes — students in a class share a level</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Create New Class</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <label>Class Name</label>
            <input type="text" placeholder="e.g. IELTS 6.0 – Evening A" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <label>Level</label>
            <input type="number" min="1" step="1" value={level} onChange={(e) => setLevel(e.target.value)} />
          </div>
        </div>
        <button type="button" className="btn" style={{ marginTop: 14 }} onClick={create}>
          <svg className="icon"><use href="#icon-plus" /></svg> Create Class
        </button>
        {status && (
          <p className={"notice " + status.cls} style={{ marginTop: 14 }}>
            {status.msg}
          </p>
        )}

        <h3 style={{ marginTop: 24 }}>Class List</h3>
        {listErr && (
          <div className="notice error">
            <svg className="icon"><use href="#icon-warning" /></svg> {listErr}
          </div>
        )}
        {!rows && !listErr && <div className="notice info">Loading...</div>}
        <div style={{ marginTop: 14 }}>
          {rows && rows.length === 0 && (
            <div className="empty-state">No classes yet. Create one using the form above.</div>
          )}
          {(rows || []).map((c) => (
            <div className="test-item" key={c._id}>
              <div className="meta">
                <h4>{c.name}</h4>
                <p>
                  Level {c.level} · {c.studentCount} student{c.studentCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="actions">
                <button
                  type="button"
                  className="icon-btn"
                  title="Manage roster"
                  onClick={() => router.push("/teacher/classes/" + c._id)}
                >
                  <svg className="icon"><use href="#icon-edit" /></svg>
                </button>
                <button type="button" className="icon-btn danger" title="Delete" onClick={() => del(c)}>
                  <svg className="icon"><use href="#icon-trash" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

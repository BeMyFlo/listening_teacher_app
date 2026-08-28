"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";

export default function TeacherNotificationsSettingsPage() {
  const [rows, setRows] = useState(null);
  const [classes, setClasses] = useState([]);
  const [listErr, setListErr] = useState("");
  const [draft, setDraft] = useState({}); // id -> { email, classIds }
  const [savingId, setSavingId] = useState(null);
  const [status, setStatus] = useState(null);

  function load() {
    api.teacher
      .listTeachers()
      .then((d) => {
        setRows(d.rows || []);
        setClasses(d.classes || []);
        const dr = {};
        (d.rows || []).forEach((t) => (dr[t._id] = { email: t.email, classIds: t.classIds }));
        setDraft(dr);
      })
      .catch((e) => setListErr(e.message));
  }
  useEffect(load, []);

  function setEmail(id, v) {
    setDraft((d) => ({ ...d, [id]: { ...d[id], email: v } }));
  }
  function toggleClass(id, cid) {
    setDraft((d) => {
      const cur = d[id].classIds || [];
      const next = cur.includes(cid) ? cur.filter((x) => x !== cid) : [...cur, cid];
      return { ...d, [id]: { ...d[id], classIds: next } };
    });
  }

  async function save(id) {
    setSavingId(id);
    setStatus(null);
    try {
      await api.teacher.updateTeacher(id, {
        email: draft[id].email.trim(),
        classIds: draft[id].classIds,
      });
      setStatus({ cls: "success", msg: "Saved." });
      load();
    } catch (e) {
      setStatus({ cls: "error", msg: e.message });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="tab-panel active">
      <div className="page-head">
        <div className="head-left">
          <div className="page-head-icon"><svg className="icon"><use href="#icon-bell" /></svg></div>
          <div>
            <h1>Notifications</h1>
            <p className="page-sub">
              Set each teacher's email and the classes they cover. Teachers get an in-app and email
              alert when a student in one of their classes submits Writing or Speaking. A teacher with
              no classes selected receives alerts for every class.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <p className="notice info">
          Email sending requires the <code>GMAIL_USER</code> and <code>GMAIL_APP_PASSWORD</code>{" "}
          environment variables. Without them, only in-app bell notifications are delivered.
        </p>

        {listErr && (
          <div className="notice error">
            <svg className="icon"><use href="#icon-warning" /></svg> {listErr}
          </div>
        )}
        {rows === null && !listErr && <p>Loading…</p>}
        {rows && rows.length === 0 && <p>No teacher accounts.</p>}

        {rows &&
          rows.map((t) => (
            <div key={t._id} className="card" style={{ marginTop: 12 }}>
              <h3 style={{ marginTop: 0 }}>
                {t.name} <span style={{ color: "var(--muted)", fontWeight: 400 }}>@{t.username}</span>
              </h3>
              <div className="form-row">
                <label>Email</label>
                <input
                  type="email"
                  placeholder="teacher@example.com"
                  value={draft[t._id]?.email ?? ""}
                  onChange={(e) => setEmail(t._id, e.target.value)}
                />
              </div>
              <div className="form-row">
                <label>Classes covered</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {classes.length === 0 && <span style={{ color: "var(--muted)" }}>No classes yet.</span>}
                  {classes.map((c) => (
                    <label key={c._id} style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400 }}>
                      <input
                        type="checkbox"
                        checked={(draft[t._id]?.classIds || []).includes(c._id)}
                        onChange={() => toggleClass(t._id, c._id)}
                      />
                      {c.name} (L{c.level})
                    </label>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="btn"
                disabled={savingId === t._id}
                onClick={() => save(t._id)}
              >
                {savingId === t._id ? "Saving…" : "Save"}
              </button>
            </div>
          ))}

        {status && (
          <p className={"notice " + status.cls} style={{ marginTop: 14 }}>
            {status.msg}
          </p>
        )}
      </div>
    </div>
  );
}

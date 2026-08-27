"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/client/api";

export default function ClassDetailPage() {
  const { classId } = useParams();
  const router = useRouter();
  const [cls, setCls] = useState(null);
  const [roster, setRoster] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [err, setErr] = useState("");
  const [addId, setAddId] = useState("");
  const [name, setName] = useState("");
  const [level, setLevel] = useState(1);
  const [saveMsg, setSaveMsg] = useState(null);

  function load() {
    Promise.all([api.teacher.getClass(classId), api.teacher.listStudents()])
      .then(([c, s]) => {
        setCls(c.class);
        setName(c.class.name);
        setLevel(c.class.level);
        setRoster(c.students || []);
        setAllStudents(s.rows || []);
      })
      .catch((e) => setErr(e.message));
  }
  useEffect(load, [classId]);

  async function saveMeta() {
    setSaveMsg(null);
    try {
      await api.teacher.updateClass(classId, { name: name.trim(), level: Number(level) || 1 });
      setSaveMsg({ cls: "success", msg: "Saved." });
      load();
    } catch (e) {
      setSaveMsg({ cls: "error", msg: e.message });
    }
  }

  async function addStudent() {
    if (!addId) return;
    try {
      await api.teacher.updateStudent(addId, { classId });
      setAddId("");
      load();
    } catch (e) {
      window.alert("Failed: " + e.message);
    }
  }

  async function removeStudent(s) {
    if (!window.confirm(`Remove ${s.name} from this class? They will have no class (and no lessons) until reassigned.`))
      return;
    try {
      await api.teacher.updateStudent(s._id, { classId: null });
      load();
    } catch (e) {
      window.alert("Failed: " + e.message);
    }
  }

  const back = (
    <p className="back-link" onClick={() => router.push("/teacher/classes")}>
      <svg className="icon"><use href="#icon-arrow-left" /></svg> Back to classes
    </p>
  );

  if (err)
    return (
      <div className="tab-panel active">
        <div className="card">
          {back}
          <div className="notice error">
            <svg className="icon"><use href="#icon-warning" /></svg> {err}
          </div>
        </div>
      </div>
    );
  if (!cls) return <div className="tab-panel active"><div className="notice info">Loading...</div></div>;

  const rosterIds = new Set(roster.map((s) => String(s._id)));
  const candidates = allStudents.filter((s) => !rosterIds.has(String(s._id)));

  return (
    <div className="tab-panel active">
      <div className="card">
        {back}
        <h2>{cls.name}</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <label>Class Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <label>Level (applies to all students in this class)</label>
            <input type="number" min="1" step="1" value={level} onChange={(e) => setLevel(e.target.value)} />
          </div>
        </div>
        <button type="button" className="btn" style={{ marginTop: 14 }} onClick={saveMeta}>
          Save
        </button>
        {saveMsg && (
          <p className={"notice " + saveMsg.cls} style={{ marginTop: 14 }}>
            {saveMsg.msg}
          </p>
        )}

        <h3 style={{ marginTop: 24 }}>Roster ({roster.length})</h3>
        <div className="form-row" style={{ maxWidth: 420 }}>
          <label>Add a student to this class</label>
          <div style={{ display: "flex", gap: 8 }}>
            <select className="select-inline" style={{ flex: 1 }} value={addId} onChange={(e) => setAddId(e.target.value)}>
              <option value="">— Select a student —</option>
              {candidates.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.username}){s.className ? ` — currently in ${s.className}` : ""}
                </option>
              ))}
            </select>
            <button type="button" className="btn" onClick={addStudent} disabled={!addId}>
              Add
            </button>
          </div>
        </div>

        {roster.length === 0 ? (
          <div className="empty-state">No students in this class yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Username</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((s) => (
                  <tr key={s._id}>
                    <td>{s.name}</td>
                    <td>{s.username}</td>
                    <td>
                      <button
                        type="button"
                        className="btn secondary danger"
                        style={{ padding: "4px 8px", fontSize: ".8rem", borderColor: "var(--red)", color: "var(--red)" }}
                        onClick={() => removeStudent(s)}
                      >
                        Remove
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

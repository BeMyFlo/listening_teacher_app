"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client/api";
import { useDialog } from "@/components/ui/Dialog";
import AttendanceTab from "@/components/teacher/AttendanceTab";
import ProgramField from "@/components/teacher/ProgramField";
import LevelField from "@/components/teacher/LevelField";
import ProgramBadge from "@/components/ProgramBadge";
import { DEFAULT_PROGRAM, PROGRAMS, programOf } from "@/lib/curriculum";
import { usePrograms } from "@/lib/client/program";

export default function ClassDetailPage() {
  const dialog = useDialog();
  const { classId } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isMulti, refresh, levelLabel } = usePrograms();
  const [tab, setTab] = useState(searchParams.get("tab") === "attendance" ? "attendance" : "students");
  const [cls, setCls] = useState(null);
  const [roster, setRoster] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [err, setErr] = useState("");
  const [addId, setAddId] = useState("");
  const [name, setName] = useState("");
  const [level, setLevel] = useState(null);
  const [program, setProgram] = useState(DEFAULT_PROGRAM);
  const [saveMsg, setSaveMsg] = useState(null);

  function load() {
    Promise.all([api.teacher.getClass(classId), api.teacher.listStudents()])
      .then(([c, s]) => {
        setCls(c.class);
        setName(c.class.name);
        setLevel(c.class.level);
        setProgram(c.class.program || DEFAULT_PROGRAM);
        setRoster(c.students || []);
        setAllStudents(s.rows || []);
      })
      .catch((e) => setErr(e.message));
  }
  useEffect(load, [classId]);

  function switchTab(next) {
    setTab(next);
    const qs = next === "attendance" ? "?tab=attendance" : "";
    router.replace("/teacher/classes/" + classId + qs);
  }

  async function saveMeta() {
    setSaveMsg(null);
    try {
      // Chỉ gửi program khi thật sự đổi (server trả 409 nếu lớp đã có bài giao).
      const body = { name: name.trim(), level: Number(level) };
      if (program !== (cls.program || DEFAULT_PROGRAM)) body.program = program;
      await api.teacher.updateClass(classId, body);
      setSaveMsg({ cls: "success", msg: "Saved." });
      load();
      refresh(); // đổi chương trình có thể làm workspace thành/không còn 2 chương trình
    } catch (e) {
      setSaveMsg({ cls: "error", msg: e.message });
    }
  }

  async function addStudent() {
    if (!addId) return;
    const st = allStudents.find((x) => String(x._id) === String(addId));
    if (st && st.classId && st.program && st.program !== programOf(cls)) {
      const ok = await dialog.confirm({
        title: "Move to a different program?",
        message: `${st.name} is currently in ${st.className} (${PROGRAMS[st.program].label}). Adding them here moves them to ${cls.name} (${PROGRAMS[programOf(cls)].label}): they will leave ${st.className} and stop seeing its lessons and tests. Their past submissions are kept. A student can only be in one class at a time.`,
        confirmText: "Move student",
        cancelText: "Cancel",
      });
      if (!ok) return;
    }
    try {
      await api.teacher.updateStudent(addId, { classId });
      setAddId("");
      dialog.toast("Student added");
      load();
    } catch (e) {
      dialog.alert({ tone: "error", title: "Failed to add student", message: e.message });
    }
  }

  async function removeStudent(s) {
    const ok = await dialog.confirm({
      title: "Remove from class",
      message: `Remove ${s.name} from this class? They will have no class (and no lessons) until reassigned.`,
      confirmText: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.teacher.updateStudent(s._id, { classId: null });
      dialog.toast("Student removed");
      load();
    } catch (e) {
      dialog.alert({ tone: "error", title: "Failed to remove student", message: e.message });
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
        <p className="page-sub" style={{ marginTop: -4 }}>
          {levelLabel(programOf(cls), cls.level)} · {roster.length} student{roster.length === 1 ? "" : "s"}
          <ProgramBadge program={cls.program} isMulti={isMulti} />
        </p>

        <div className="unit-subtabs" style={{ marginTop: 14 }}>
          <button
            type="button"
            className={"unit-subtab" + (tab === "students" ? " active" : "")}
            onClick={() => switchTab("students")}
          >
            Students
          </button>
          <button
            type="button"
            className={"unit-subtab" + (tab === "attendance" ? " active" : "")}
            onClick={() => switchTab("attendance")}
          >
            Attendance
          </button>
        </div>

        {tab === "students" ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label>Class Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <ProgramField
                name="classProgram"
                value={program}
                onChange={setProgram}
                locked={!!cls.programLocked}
              />
              <LevelField
                program={program}
                value={level}
                onChange={setLevel}
                keepLevels={programOf(cls) === program ? [cls.level] : []}
                label="Level (applies to all students in this class)"
              />
            </div>
            <button type="button" className="btn" style={{ marginTop: 14 }} onClick={saveMeta} disabled={!level || !name.trim()}>
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
          </>
        ) : (
          <AttendanceTab classId={classId} rosterCount={roster.length} />
        )}
      </div>
    </div>
  );
}

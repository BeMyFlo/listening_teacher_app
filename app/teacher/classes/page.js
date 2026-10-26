"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client/api";
import { useDialog } from "@/components/ui/Dialog";
import { DEFAULT_PROGRAM, programOf } from "@/lib/curriculum";
import { programParam, usePrograms } from "@/lib/client/program";
import ProgramChips, { ProgramEmpty } from "@/components/teacher/ProgramChips";
import ProgramField from "@/components/teacher/ProgramField";
import LevelField from "@/components/teacher/LevelField";
import LevelsManager from "@/components/teacher/LevelsManager";
import ProgramBadge from "@/components/ProgramBadge";

function ClassesInner() {
  const dialog = useDialog();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const tab = search.get("tab") === "levels" ? "levels" : "classes"; // ?tab=levels = link thẳng tới tab Levels
  const program = programParam(search); // null = All
  const { isMulti, refresh, levelLabel } = usePrograms();
  const [rows, setRows] = useState(null);
  const [listErr, setListErr] = useState("");
  const [name, setName] = useState("");
  const [level, setLevel] = useState(null); // LevelField tự chọn level đầu tiên; null = chưa có level nào để chọn
  // Program của lớp mới: mặc định = chip đang lọc, không có thì IELTS.
  const [formProgram, setFormProgram] = useState(program || DEFAULT_PROGRAM);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    setFormProgram(program || DEFAULT_PROGRAM);
  }, [program]);

  function load() {
    api.teacher
      .listClasses()
      .then((d) => setRows(d.rows || []))
      .catch((e) => setListErr(e.message));
  }
  useEffect(load, []);

  function switchTab(next) {
    const p = new URLSearchParams(search ? search.toString() : "");
    if (next === "levels") p.set("tab", "levels");
    else p.delete("tab");
    const qs = p.toString();
    router.replace(pathname + (qs ? "?" + qs : ""), { scroll: false });
  }

  async function create() {
    if (!name.trim()) {
      setStatus({ cls: "error", msg: "Please enter a class name." });
      return;
    }
    if (!level) {
      setStatus({ cls: "error", msg: "Please choose a level (create one first if there are none)." });
      return;
    }
    setStatus(null);
    try {
      await api.teacher.createClass({ name: name.trim(), level: Number(level), program: formProgram });
      setStatus({ cls: "success", msg: "Class created." });
      setName("");
      setLevel(null);
      setFormProgram(program || DEFAULT_PROGRAM);
      load();
      refresh(); // lớp TOEIC đầu tiên -> chip/nhãn TOEIC hiện ngay
    } catch (e) {
      setStatus({ cls: "error", msg: e.message });
    }
  }

  async function del(c) {
    const ok = await dialog.confirm({
      title: "Delete class",
      message: `Delete class "${c.name}"? Students stay but become unassigned; the class is removed from any assigned lessons/tests.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.teacher.deleteClass(c._id);
      dialog.toast("Class deleted");
      load();
      refresh();
    } catch (e) {
      dialog.alert({ tone: "error", title: "Failed to delete", message: e.message });
    }
  }

  const visible = (rows || []).filter((c) => !program || programOf(c) === program);

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

      <div className="unit-subtabs" style={{ marginBottom: 14 }}>
        <button type="button" className={"unit-subtab" + (tab === "classes" ? " active" : "")} onClick={() => switchTab("classes")}>
          Classes
        </button>
        <button type="button" className={"unit-subtab" + (tab === "levels" ? " active" : "")} onClick={() => switchTab("levels")}>
          Levels
        </button>
      </div>

      {tab === "levels" ? (
        <LevelsManager />
      ) : (
      <>
      <ProgramChips />

      <div className="card">
        <h3>Create New Class</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <label>Class Name</label>
            <input type="text" placeholder="e.g. IELTS 6.0 – Evening A" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <ProgramField name="newClassProgram" value={formProgram} onChange={setFormProgram} />
          <LevelField program={formProgram} value={level} onChange={setLevel} />
        </div>
        <button type="button" className="btn" style={{ marginTop: 14 }} onClick={create} disabled={!level}>
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
          {rows && rows.length === 0 && !program && (
            <div className="empty-state">No classes yet. Create one using the form above.</div>
          )}
          {rows && visible.length === 0 && program && <ProgramEmpty program={program} what="classes yet" />}
          {visible.map((c) => (
            <div className="test-item" key={c._id}>
              <div className="meta">
                <h4>
                  {c.name}
                  <ProgramBadge program={programOf(c)} isMulti={isMulti} />
                </h4>
                <p>
                  {levelLabel(programOf(c), c.level)} · {c.studentCount} student{c.studentCount === 1 ? "" : "s"}
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
      </>
      )}
    </div>
  );
}

export default function ClassesPage() {
  return (
    <Suspense fallback={<div className="tab-panel active"><div className="notice info">Loading...</div></div>}>
      <ClassesInner />
    </Suspense>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { useDialog } from "@/components/ui/Dialog";

const STEPS = ["Name your workspace", "Create your first class", "Add your students"];

export default function OnboardingPage() {
  const router = useRouter();
  const dialog = useDialog();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [cls, setCls] = useState({ name: "", level: "1" });
  const [createdClass, setCreatedClass] = useState(null); // { _id, name }
  const [stu, setStu] = useState({ name: "", username: "", password: "" });
  const [added, setAdded] = useState([]);

  useEffect(() => {
    api.teacher
      .workspaceSettings()
      .then((d) => {
        setName(d.workspace.name);
        setSavedName(d.workspace.name);
        setCanEdit(d.canEdit);
      })
      .catch(() => {});
  }, []);

  const finish = () => router.push("/teacher/overview");

  async function run(fn) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      dialog.alert({ tone: "error", title: "Something went wrong", message: e.message });
    } finally {
      setBusy(false);
    }
  }

  const saveName = () =>
    run(async () => {
      if (canEdit && name.trim() && name.trim() !== savedName) {
        await api.teacher.saveWorkspaceSettings({ name });
        setSavedName(name.trim());
      }
      setStep(1);
    });

  const createClass = (e) => {
    e.preventDefault();
    run(async () => {
      const r = await api.teacher.createClass({ name: cls.name, level: Number(cls.level) });
      setCreatedClass({ _id: r.class._id, name: r.class.name });
      setStep(2);
    });
  };

  const addStudent = (e) => {
    e.preventDefault();
    run(async () => {
      const r = await api.teacher.createStudent({ ...stu, classId: createdClass._id });
      setAdded((a) => [...a, r.student]);
      setStu({ name: "", username: "", password: "" });
      dialog.toast("Student added");
    });
  };

  return (
    <div className="tab-panel active">
      <div className="page-head">
        <div className="head-left">
          <div className="page-head-icon"><svg className="icon"><use href="#icon-sparkles" /></svg></div>
          <div>
            <h1>Set up your workspace</h1>
            <p className="page-sub">Step {step + 1} of {STEPS.length} — {STEPS[step]}. You can skip any step and come back later.</p>
          </div>
        </div>
        <button type="button" className="btn secondary" onClick={finish}>Skip setup</button>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        {step === 0 && (
          <div style={{ display: "grid", gap: 12 }}>
            <label>Workspace name
              <input value={name} maxLength={140} disabled={!canEdit} onChange={(e) => setName(e.target.value)} />
            </label>
            {!canEdit && <p className="notice info">Only the workspace owner can rename it.</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn" disabled={busy || (canEdit && !name.trim())} onClick={saveName}>Next</button>
              <button type="button" className="btn secondary" onClick={() => setStep(1)}>Skip this step</button>
            </div>
          </div>
        )}

        {step === 1 && (
          <form onSubmit={createClass} style={{ display: "grid", gap: 12 }}>
            <label>Class name
              <input value={cls.name} placeholder="e.g. IELTS 6.5 — Evening" required onChange={(e) => setCls((c) => ({ ...c, name: e.target.value }))} />
            </label>
            <label>Level
              <input type="number" min="1" step="1" value={cls.level} required onChange={(e) => setCls((c) => ({ ...c, level: e.target.value }))} />
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn" disabled={busy || !cls.name.trim()}>Create class</button>
              <button type="button" className="btn secondary" onClick={() => setStep(2)}>Skip this step</button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div style={{ display: "grid", gap: 12 }}>
            {!createdClass ? (
              <>
                <p className="notice info">Students belong to a class. Create a class first, or finish now and add students later.</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="btn" onClick={() => setStep(1)}>Create a class</button>
                  <button type="button" className="btn secondary" onClick={finish}>Finish</button>
                </div>
              </>
            ) : (
              <>
                <p className="page-sub" style={{ margin: 0 }}>Adding students to <b>{createdClass.name}</b>.</p>
                <form onSubmit={addStudent} style={{ display: "grid", gap: 10 }}>
                  <label>Full name
                    <input value={stu.name} required onChange={(e) => setStu((s) => ({ ...s, name: e.target.value }))} />
                  </label>
                  <label>Username
                    <input value={stu.username} required onChange={(e) => setStu((s) => ({ ...s, username: e.target.value }))} />
                  </label>
                  <label>Password (min 4 characters)
                    <input type="text" value={stu.password} required minLength={4} onChange={(e) => setStu((s) => ({ ...s, password: e.target.value }))} />
                  </label>
                  <div>
                    <button type="submit" className="btn" disabled={busy}>Add student</button>
                  </div>
                </form>
                {added.length > 0 && (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {added.map((s) => (
                      <li key={s._id}>{s.name} <span style={{ color: "var(--muted)", fontSize: ".8rem" }}>· {s.username}</span></li>
                    ))}
                  </ul>
                )}
                <div>
                  <button type="button" className="btn secondary" onClick={finish}>
                    {added.length ? "Done" : "Finish without adding students"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

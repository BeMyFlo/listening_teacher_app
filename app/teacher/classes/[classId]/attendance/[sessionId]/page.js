"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { useDialog } from "@/components/ui/Dialog";
import { ATT_STATUSES, ATT_META, fmtAttDate } from "@/lib/attendance";

export default function AttendanceSheetPage() {
  const dialog = useDialog();
  const { classId, sessionId } = useParams();
  const router = useRouter();

  const [session, setSession] = useState(null);
  const [rows, setRows] = useState([]); // { studentId, name, username, status, note }
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    api.teacher
      .getAttendanceSession(sessionId)
      .then((d) => {
        setSession(d.session);
        setDate(d.session.date);
        setNote(d.session.note || "");
        setRows(d.roster || []);
      })
      .catch((e) => setErr(e.message));
  }, [sessionId]);

  function setStatus(studentId, status) {
    setRows((r) => r.map((x) => (x.studentId === studentId ? { ...x, status } : x)));
    setDirty(true);
  }
  function markAll(status) {
    setRows((r) => r.map((x) => ({ ...x, status })));
    setDirty(true);
  }

  const counts = useMemo(() => {
    const t = { present: 0, late: 0, excused: 0, absent: 0 };
    for (const r of rows) if (t[r.status] != null) t[r.status]++;
    return t;
  }, [rows]);

  async function save() {
    setSaving(true);
    try {
      await api.teacher.updateAttendanceSession(sessionId, {
        date,
        note,
        records: rows.map((r) => ({ studentId: r.studentId, status: r.status, note: r.note || "" })),
      });
      setDirty(false);
      dialog.toast("Attendance saved");
      router.push(`/teacher/classes/${classId}?tab=attendance`);
    } catch (e) {
      setSaving(false);
      dialog.alert({ tone: "error", title: "Failed to save", message: e.message });
    }
  }

  const back = (
    <p className="back-link" onClick={() => router.push(`/teacher/classes/${classId}?tab=attendance`)}>
      <svg className="icon"><use href="#icon-arrow-left" /></svg> Back to attendance
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
  if (!session) return <div className="tab-panel active"><div className="notice info">Loading…</div></div>;

  return (
    <div className="tab-panel active">
      <div className="card">
        {back}
        <h2 style={{ marginBottom: 2 }}>
          Session {session.number}
          <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: "1rem" }}> · {session.className}</span>
        </h2>
        <p className="page-sub" style={{ marginTop: 0 }}>{fmtAttDate(date)}</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 10 }}>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <label>Session date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setDirty(true);
              }}
            />
          </div>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <label>Note (optional) — e.g. lesson topic</label>
            <input
              type="text"
              value={note}
              placeholder="Unit 3 — Listening"
              onChange={(e) => {
                setNote(e.target.value);
                setDirty(true);
              }}
            />
          </div>
        </div>

        <div className="att-summary">
          {ATT_STATUSES.map((k) => (
            <span key={k} className={"att-chip " + ATT_META[k].cls}>
              {ATT_META[k].label}: <strong>{counts[k]}</strong>
            </span>
          ))}
          <button type="button" className="btn secondary sm" onClick={() => markAll("present")}>
            Mark all present
          </button>
          <button type="button" className="btn secondary sm" onClick={() => markAll("absent")}>
            Mark all absent
          </button>
        </div>

        {rows.length === 0 ? (
          <div className="empty-state">This class has no students.</div>
        ) : (
          <div className="att-sheet">
            {rows.map((r, i) => (
              <div key={r.studentId} className="att-row">
                <div className="att-row-name">
                  <span className="att-row-idx">{i + 1}</span>
                  <div>
                    <strong>{r.name}</strong>
                    <span className="att-row-user">{r.username}</span>
                  </div>
                </div>
                <div className="att-seg" role="group" aria-label={"Attendance for " + r.name}>
                  {ATT_STATUSES.map((k) => (
                    <button
                      key={k}
                      type="button"
                      className={"att-seg-btn " + ATT_META[k].cls + (r.status === k ? " active" : "")}
                      onClick={() => setStatus(r.studentId, k)}
                      title={ATT_META[k].label}
                    >
                      <span className="att-seg-short">{ATT_META[k].short}</span>
                      <span className="att-seg-label">{ATT_META[k].label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="att-savebar">
          <span className="att-savebar-hint">
            {dirty ? "Unsaved changes" : "All changes saved"}
          </span>
          <button type="button" className="btn" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save attendance"}
          </button>
        </div>
      </div>
    </div>
  );
}

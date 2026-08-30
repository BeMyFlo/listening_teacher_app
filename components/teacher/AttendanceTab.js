"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { useDialog } from "@/components/ui/Dialog";
import { ATT_META, fmtAttDate } from "@/lib/attendance";

export default function AttendanceTab({ classId, rosterCount }) {
  const dialog = useDialog();
  const router = useRouter();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api.teacher
      .listAttendance(classId)
      .then((d) => setRows(d.rows || []))
      .catch((e) => setErr(e.message));
  }, [classId]);
  useEffect(load, [load]);

  async function createSession() {
    if (rosterCount === 0) {
      dialog.alert({
        tone: "error",
        title: "No students yet",
        message: "Add students to this class before taking attendance.",
      });
      return;
    }
    setCreating(true);
    try {
      const { session } = await api.teacher.createAttendanceSession({ classId });
      router.push(`/teacher/classes/${classId}/attendance/${session._id}`);
    } catch (e) {
      setCreating(false);
      dialog.alert({ tone: "error", title: "Could not create session", message: e.message });
    }
  }

  async function del(s) {
    const ok = await dialog.confirm({
      title: "Delete session",
      message: `Delete "Session ${s.number}" (${fmtAttDate(s.date)})? Attendance for this session will be lost.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.teacher.deleteAttendanceSession(s._id);
      dialog.toast("Session deleted");
      load();
    } catch (e) {
      dialog.alert({ tone: "error", title: "Failed to delete", message: e.message });
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
        <h3 style={{ margin: 0 }}>Attendance sessions</h3>
        <button type="button" className="btn" onClick={createSession} disabled={creating}>
          <svg className="icon"><use href="#icon-plus" /></svg> {creating ? "Creating…" : "New session"}
        </button>
      </div>

      {err && (
        <div className="notice error" style={{ marginTop: 12 }}>
          <svg className="icon"><use href="#icon-warning" /></svg> {err}
        </div>
      )}
      {!rows && !err && <div className="notice info" style={{ marginTop: 12 }}>Loading…</div>}

      {rows && rows.length === 0 && (
        <div className="empty-state" style={{ marginTop: 14 }}>
          No sessions yet. Click <b>New session</b> to take attendance for today.
        </div>
      )}

      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {(rows || []).map((s) => {
          const present = s.counts.present + s.counts.late;
          return (
            <div
              key={s._id}
              className="att-session-row"
              onClick={() => router.push(`/teacher/classes/${classId}/attendance/${s._id}`)}
            >
              <div className="att-session-num">
                <span>Session</span>
                <strong>{s.number}</strong>
              </div>
              <div className="att-session-meta">
                <h4>{fmtAttDate(s.date)}</h4>
                <p>
                  {s.note ? s.note + " · " : ""}
                  {present}/{s.marked || 0} present
                </p>
              </div>
              <div className="att-session-chips">
                {["present", "late", "excused", "absent"].map((k) =>
                  s.counts[k] ? (
                    <span key={k} className={"att-chip " + ATT_META[k].cls} title={ATT_META[k].label}>
                      {ATT_META[k].short} {s.counts[k]}
                    </span>
                  ) : null
                )}
              </div>
              <button
                type="button"
                className="icon-btn danger"
                title="Delete session"
                onClick={(e) => {
                  e.stopPropagation();
                  del(s);
                }}
              >
                <svg className="icon"><use href="#icon-trash" /></svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

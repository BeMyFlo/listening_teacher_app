"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { readSession } from "@/lib/client/session";
import ChatRoom from "@/components/chat/ChatRoom";

export default function TeacherMessagesPage() {
  const [rows, setRows] = useState(null);
  const [active, setActive] = useState(null);
  const [err, setErr] = useState("");
  const sess = readSession("teacher");
  const me = { id: sess?.payload?.teacherId, role: "teacher" };

  useEffect(() => {
    api.chat
      .conversations()
      .then((d) => {
        setRows(d.rows || []);
        setActive((a) => a || (d.rows && d.rows[0] ? String(d.rows[0].classId) : null));
      })
      .catch((e) => setErr(e.message));
  }, []);

  const activeRow = rows && rows.find((r) => String(r.classId) === String(active));

  return (
    <div className="tab-panel active">
      <div className="page-head">
        <div className="head-left">
          <div className="page-head-icon"><svg className="icon"><use href="#icon-chat" /></svg></div>
          <div>
            <h1>Messages</h1>
            <p className="page-sub">Group chat with each of your classes</p>
          </div>
        </div>
      </div>

      {err && (
        <div className="notice error">
          <svg className="icon"><use href="#icon-warning" /></svg> {err}
        </div>
      )}

      <div className="chat-layout card">
        <div className="chat-rooms">
          {rows === null && <div className="chat-empty">Loading…</div>}
          {rows && rows.length === 0 && <div className="chat-empty">No classes yet.</div>}
          {rows &&
            rows.map((r) => (
              <button
                key={r.classId}
                type="button"
                className={"chat-room-item" + (String(r.classId) === String(active) ? " active" : "")}
                onClick={() => setActive(String(r.classId))}
              >
                <div className="chat-room-name">{r.name}</div>
                <div className="chat-room-preview">{r.lastMessagePreview || "No messages"}</div>
              </button>
            ))}
        </div>
        <div className="chat-pane">
          {activeRow ? (
            <ChatRoom
              key={activeRow.classId}
              classId={String(activeRow.classId)}
              className={activeRow.name}
              me={me}
              canModerate
            />
          ) : (
            <div className="chat-empty">Select a class</div>
          )}
        </div>
      </div>
    </div>
  );
}

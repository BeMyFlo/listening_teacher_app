"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { readSession } from "@/lib/client/session";
import ChatRoom from "@/components/chat/ChatRoom";

export default function StudentMessagesPage() {
  const [row, setRow] = useState(undefined); // undefined = loading, null = no class
  const [err, setErr] = useState("");
  const sess = readSession("student");
  const me = { id: sess?.payload?.studentId, role: "student" };

  useEffect(() => {
    api.chat
      .conversations()
      .then((d) => setRow((d.rows && d.rows[0]) || null))
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <section>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Class chat</h2>
        {err && (
          <div className="notice error">
            <svg className="icon"><use href="#icon-warning" /></svg> {err}
          </div>
        )}
        {row === undefined && !err && <div className="notice info">Loading…</div>}
        {row === null && (
          <div className="notice info">
            You&apos;re not in a class yet — your class chat will appear here once your teacher assigns you.
          </div>
        )}
        {row && (
          <div className="chat-layout card" style={{ padding: 0 }}>
            <div className="chat-pane">
              <ChatRoom classId={String(row.classId)} className={row.name} me={me} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

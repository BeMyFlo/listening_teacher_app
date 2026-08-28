"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { useChatRoom } from "@/lib/client/chatSocket";
import { useDialog } from "@/components/ui/Dialog";
import Composer from "./Composer";

function initials(n) {
  const p = String(n || "?").trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?";
}
const dayKey = (d) => new Date(d).toDateString();
const fmtDay = (d) => {
  const t = new Date(d);
  const today = new Date().toDateString();
  const yest = new Date(Date.now() - 86400000).toDateString();
  if (t.toDateString() === today) return "Today";
  if (t.toDateString() === yest) return "Yesterday";
  return t.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};
const fmtTime = (d) => new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export default function ChatRoom({ classId, me, className, canModerate }) {
  const dialog = useDialog();
  const [msgs, setMsgs] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);
  const listRef = useRef(null);
  const atBottom = useRef(true);

  const upsert = useCallback((m) => {
    setMsgs((prev) => {
      if (prev.some((x) => String(x._id) === String(m._id))) {
        return prev.map((x) => (String(x._id) === String(m._id) ? m : x));
      }
      return [...prev, m];
    });
  }, []);

  const loadInitial = useCallback(() => {
    setLoading(true);
    api.chat
      .messages(classId)
      .then((d) => {
        setMsgs(d.rows || []);
        setHasMore(d.hasMore);
      })
      .catch((e) => dialog.toast(e.message, "error"))
      .finally(() => {
        setLoading(false);
        atBottom.current = true;
      });
  }, [classId]); // eslint-disable-line

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // Realtime
  const { connected } = useChatRoom(classId, {
    onMessage: upsert,
    onDeleted: (p) => setMsgs((prev) => prev.map((x) => (String(x._id) === String(p._id) ? { ...x, deletedAt: new Date(), text: "", attachments: [] } : x))),
    onReconnect: loadInitial,
  });

  // Polling dự phòng khi chưa/không realtime
  useEffect(() => {
    if (connected) return;
    const iv = setInterval(() => {
      api.chat.messages(classId).then((d) => {
        setMsgs((prev) => {
          const byId = new Map(prev.map((m) => [String(m._id), m]));
          (d.rows || []).forEach((m) => byId.set(String(m._id), m));
          return [...byId.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        });
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(iv);
  }, [connected, classId]);

  // Auto-scroll
  useEffect(() => {
    const el = listRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  function onScroll(e) {
    const el = e.currentTarget;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 60 && hasMore && !loading) {
      const oldest = msgs[0];
      const keepH = el.scrollHeight;
      setLoading(true);
      api.chat.messages(classId, oldest._id).then((d) => {
        setMsgs((prev) => [...(d.rows || []), ...prev]);
        setHasMore(d.hasMore);
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight - keepH;
        });
      }).finally(() => setLoading(false));
    }
  }

  async function send(text, attachments) {
    const d = await api.chat.send(classId, text, attachments);
    upsert(d.message);
    atBottom.current = true;
  }

  async function del(m) {
    if (!(await dialog.confirmDelete("Delete this message?"))) return;
    try {
      await api.chat.remove(m._id);
      setMsgs((prev) => prev.map((x) => (x._id === m._id ? { ...x, deletedAt: new Date(), text: "", attachments: [] } : x)));
    } catch (e) {
      dialog.alert({ tone: "error", title: "Failed to delete", message: e.message });
    }
  }

  let lastDay = null;
  let lastSender = null;

  return (
    <div className="chat-room">
      <div className="chat-room-head">
        <div>
          <b>{className}</b>
          <span className={"chat-live" + (connected ? " on" : "")}>{connected ? "live" : "reconnecting…"}</span>
        </div>
      </div>

      <div className="chat-list" ref={listRef} onScroll={onScroll}>
        {hasMore && <div className="chat-loadmore">{loading ? "Loading…" : "Scroll up for older messages"}</div>}
        {!loading && msgs.length === 0 && <div className="chat-empty">No messages yet — say hello 👋</div>}

        {msgs.map((m) => {
          const mine = String(m.senderId) === String(me.id);
          const showDay = dayKey(m.createdAt) !== lastDay;
          lastDay = dayKey(m.createdAt);
          const grouped = !showDay && lastSender === String(m.senderId);
          lastSender = String(m.senderId);
          return (
            <div key={m._id}>
              {showDay && <div className="chat-day">{fmtDay(m.createdAt)}</div>}
              <div className={"chat-msg" + (mine ? " mine" : "") + (grouped ? " grouped" : "")}>
                {!mine && !grouped && <div className="chat-avatar">{initials(m.senderName)}</div>}
                {!mine && grouped && <div className="chat-avatar spacer" />}
                <div className="chat-bubble-wrap">
                  {!mine && !grouped && (
                    <div className="chat-sender">
                      {m.senderName}
                      {m.senderRole === "teacher" && <span className="chat-role">Teacher</span>}
                    </div>
                  )}
                  <div className={"chat-bubble" + (m.deletedAt ? " deleted" : "")}>
                    {m.deletedAt ? (
                      <i>message deleted</i>
                    ) : (
                      <>
                        {(m.attachments || []).map((a, i) => (
                          <div className="chat-att" key={i}>
                            {a.type === "video" ? (
                              <video src={a.url} controls preload="metadata" />
                            ) : (
                              <img src={a.url} alt="" loading="lazy" onClick={() => setLightbox(a.url)} />
                            )}
                          </div>
                        ))}
                        {m.text && <div className="chat-text">{m.text}</div>}
                      </>
                    )}
                    <span className="chat-time">{fmtTime(m.createdAt)}</span>
                  </div>
                </div>
                {!m.deletedAt && (mine || canModerate) && (
                  <button type="button" className="chat-del" title="Delete" onClick={() => del(m)}>
                    <svg className="icon"><use href="#icon-trash" /></svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Composer classId={classId} onSend={send} />

      {lightbox && (
        <div className="chat-lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" />
        </div>
      )}
    </div>
  );
}

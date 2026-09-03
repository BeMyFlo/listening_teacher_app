"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/client/api";

const POLL_MS = 60000;

function timeAgo(d) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.floor(h / 24);
  return `${day}d ago`;
}

export default function NotificationBell({ role }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [unread, setUnread] = useState(0);
  const boxRef = useRef(null);

  // Cả student và teacher đều có chuông; chỉ khác endpoint.
  const feed = role === "teacher" ? api.teacher : role === "student" ? api.student : null;

  const load = useCallback(() => {
    if (!feed) return;
    feed
      .notifications()
      .then((d) => {
        setRows(d.rows || []);
        setUnread(d.unreadCount || 0);
      })
      .catch(() => {});
  }, [feed]);

  // Poll + refresh on route change (catches "entered the 24h window" without a reload).
  useEffect(() => {
    if (!feed) return;
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [feed, load, pathname]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  function toggle(e) {
    e.stopPropagation();
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      setRows((r) => r.map((n) => ({ ...n, read: true })));
      feed.markNotifications({ markAllRead: true }).catch(() => {});
    }
  }

  function openItem(n) {
    setOpen(false);
    const dest = n.link || (n.unitId ? "/student/lessons/" + n.unitId : "");
    if (dest) router.push(dest);
  }

  // Admin không có chuông thông báo.
  if (!feed) return null;

  return (
    <div className="topbar-bell-wrap" ref={boxRef}>
      <button
        type="button"
        className={"icon-btn topbar-bell" + (open ? " open" : "")}
        title="Notifications"
        onClick={toggle}
      >
        <svg className="icon"><use href="#icon-bell" /></svg>
        {unread > 0 && <span className="notify-dot" />}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-panel-head">Notifications</div>
          <div className="notif-panel-body">
            {rows.length === 0 ? (
              <div className="notif-empty">You're all caught up.</div>
            ) : (
              rows.map((n) => (
                <button
                  key={n._id}
                  type="button"
                  className={"notif-item" + (n.read ? "" : " unread")}
                  onClick={() => openItem(n)}
                >
                  <div className="notif-item-title">{n.title}</div>
                  <div className="notif-item-body">{n.body}</div>
                  <div className="notif-item-time">{timeAgo(n.createdAt)}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

// Kết nối realtime tới chat-server. Singleton cho cả app. Có polling dự phòng
// khi socket rớt (chat-server ngủ / mạng lỗi).

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { getTeacherToken, getStudentToken } from "./session";

const URL = process.env.NEXT_PUBLIC_CHAT_SERVER_URL || "";
let socket = null;

function token() {
  return getTeacherToken() || getStudentToken() || "";
}

export function getChatSocket() {
  if (!URL) return null;
  if (!socket) {
    socket = io(URL, {
      auth: { token: token() },
      transports: ["websocket"],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return socket;
}

// Nghe tin của 1 lớp. onMessage / onDeleted đã lọc theo classId.
// Trả { connected } để UI biết đang realtime hay polling.
export function useChatRoom(classId, { onMessage, onDeleted, onReconnect } = {}) {
  const [connected, setConnected] = useState(false);
  const cb = useRef({});
  cb.current = { onMessage, onDeleted, onReconnect };

  useEffect(() => {
    if (!classId) return;
    const s = getChatSocket();
    if (!s) return; // không cấu hình -> UI tự polling

    const sameClass = (p) => p && String(p.classId) === String(classId);
    const onMsg = (p) => sameClass(p) && cb.current.onMessage && cb.current.onMessage(p);
    const onDel = (p) => sameClass(p) && cb.current.onDeleted && cb.current.onDeleted(p);
    const onConn = () => setConnected(true);
    const onDisc = () => setConnected(false);
    const onReconn = () => {
      setConnected(true);
      cb.current.onReconnect && cb.current.onReconnect();
    };

    s.on("message", onMsg);
    s.on("message-deleted", onDel);
    s.on("connect", onConn);
    s.on("disconnect", onDisc);
    s.io.on("reconnect", onReconn);
    if (s.connected) setConnected(true);

    return () => {
      s.off("message", onMsg);
      s.off("message-deleted", onDel);
      s.off("connect", onConn);
      s.off("disconnect", onDisc);
      s.io.off("reconnect", onReconn);
    };
  }, [classId]);

  return { connected };
}

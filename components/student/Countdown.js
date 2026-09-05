"use client";

import { useEffect, useRef, useState } from "react";

// Đếm ngược client-side; hết giờ gọi onExpire(). Khớp #testTimer / .urgent.
//
// `storageKey` (tuỳ chọn) neo đồng hồ vào 1 mốc hết giờ tuyệt đối lưu trong
// localStorage — nếu học sinh rời trang (Back to test list / đóng tab / mất
// mạng) rồi quay lại, đồng hồ KHÔNG được đếm lại từ đầu; nó đọc lại đúng mốc
// hết giờ cũ. Không có storageKey thì giữ hành vi cũ (đếm từ đầu mỗi lần mount).
function loadDeadline(key, minutes) {
  const fallback = Date.now() + Math.max(1, minutes) * 60000;
  if (!key || typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    const stored = raw ? Number(raw) : NaN;
    if (Number.isFinite(stored)) return stored;
    localStorage.setItem(key, String(fallback));
  } catch {}
  return fallback;
}

export function clearCountdown(storageKey) {
  if (!storageKey || typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey);
  } catch {}
}

export default function Countdown({ minutes, onExpire, storageKey }) {
  const deadlineRef = useRef(loadDeadline(storageKey, minutes));
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000))
  );
  const expiredRef = useRef(remaining <= 0);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (expiredRef.current) {
      onExpireRef.current && onExpireRef.current();
      return;
    }
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        clearInterval(id);
        onExpireRef.current && onExpireRef.current();
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const m = String(Math.floor(remaining / 60)).padStart(2, "0");
  const s = String(remaining % 60).padStart(2, "0");

  return (
    <div className={"test-timer" + (remaining <= 60 ? " urgent" : "")} style={{ display: "flex" }}>
      <svg className="icon"><use href="#icon-clock" /></svg> Time remaining: {m}:{s}
    </div>
  );
}

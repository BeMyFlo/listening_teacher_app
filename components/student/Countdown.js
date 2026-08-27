"use client";

import { useEffect, useRef, useState } from "react";

// Đếm ngược client-side; hết giờ gọi onExpire(). Khớp #testTimer / .urgent.
export default function Countdown({ minutes, onExpire }) {
  const [remaining, setRemaining] = useState(Math.max(1, minutes) * 60);
  const expiredRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1 && !expiredRef.current) {
          expiredRef.current = true;
          clearInterval(id);
          onExpire && onExpire();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [onExpire]);

  const m = String(Math.floor(remaining / 60)).padStart(2, "0");
  const s = String(remaining % 60).padStart(2, "0");

  return (
    <div className={"test-timer" + (remaining <= 60 ? " urgent" : "")} style={{ display: "flex" }}>
      <svg className="icon"><use href="#icon-clock" /></svg> Time remaining: {m}:{s}
    </div>
  );
}

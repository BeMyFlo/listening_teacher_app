"use client";

import { useEffect, useState } from "react";

// Tiêu đề hero: "Một nơi để" + một dòng tự đổi lần lượt qua các việc chính.
// - Mọi cụm được xếp chồng trong cùng 1 ô grid nên khung luôn cao bằng cụm dài
//   nhất: đổi chữ không làm trang nhảy.
// - Trình đọc màn hình / máy tìm kiếm đọc 1 câu đầy đủ (lp-sr), phần chữ chạy
//   là aria-hidden.
// - prefers-reduced-motion: đứng yên ở cụm đầu.
const INTERVAL_MS = 2600;

export default function HeroRotator({ prefix, items }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    let reduce = false;
    try {
      reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {}
    if (reduce || items.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % items.length), INTERVAL_MS);
    return () => clearInterval(t);
  }, [items.length]);

  const full = `${prefix} ${items.map((s) => s.replace(/\.$/, "")).join(", ")}.`;

  return (
    <h1 className="lp-rot">
      <span className="lp-sr">{full}</span>
      <span aria-hidden="true">
        {prefix}
        <span className="lp-rot-stack">
          {items.map((s, k) => (
            <span key={s} className={"lp-rot-item" + (k === i ? " is-on" : "")}>
              <span className="lp-mark">{s}</span>
            </span>
          ))}
        </span>
      </span>
    </h1>
  );
}

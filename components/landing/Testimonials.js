"use client";

import { useEffect, useRef, useState } from "react";

// Băng chuyền lời nhận xét. Chỉ được render khi lib/landing.js TESTIMONIALS có nội dung thật
// (Landing.js kiểm tra trước khi dùng). Cuộn ngang bằng scroll-snap; hai nút chỉ là tiện ích thêm.
export default function Testimonials({ items }) {
  const track = useRef(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  function update() {
    const el = track.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [items.length]);

  function go(dir) {
    const el = track.current;
    if (!el) return;
    let smooth = true;
    try { smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch {}
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: smooth ? "smooth" : "auto" });
  }

  return (
    <section id="cam-nhan" className="lp-section lp-testi">
      <div className="lp-wrap">
        <div className="lp-testi-head">
          <h2>Giáo viên nói gì về BeMyFlo</h2>
          {(canPrev || canNext) && (
            <div className="lp-testi-nav">
              <button type="button" className="lp-circle-btn" onClick={() => go(-1)} disabled={!canPrev} aria-label="Xem lời nhận xét trước">‹</button>
              <button type="button" className="lp-circle-btn" onClick={() => go(1)} disabled={!canNext} aria-label="Xem lời nhận xét tiếp theo">›</button>
            </div>
          )}
        </div>
        <ul className="lp-testi-track" ref={track} onScroll={update} tabIndex={0} aria-label="Lời nhận xét của giáo viên">
          {items.map((t) => (
            <li key={t.name + t.quote.slice(0, 20)} className="lp-testi-card">
              <blockquote>“{t.quote}”</blockquote>
              <div className="lp-testi-who">
                <span className="lp-testi-av" aria-hidden="true">{String(t.name).trim().charAt(0).toUpperCase()}</span>
                <span>
                  <strong>{t.name}</strong>
                  {t.role && <small>{t.role}</small>}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

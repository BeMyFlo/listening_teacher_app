"use client";

import { useEffect, useState } from "react";

// Mascot trợ lý thông báo — chú ngựa-robot đội mũ tốt nghiệp.
//
// Thân là ảnh render 3D theo TƯ THẾ (public/assistant/<pose>.webp, nền trong
// suốt, mặt kính để trống); MẮT là SVG đặt đúng lên mặt kính nên đổi BIỂU CẢM
// và chớp mắt không cần thêm ảnh. Toạ độ mặt kính (% của ảnh) đo tự động khi
// cắt ảnh — đổi ảnh thì phải đo lại `visor`.
// Chuyển động: styles/legacy.css, tiền tố asst-.
const POSES = {
  // aspect = rộng / cao của ảnh; visor = {l,t,w,h} theo %.
  idle: { aspect: 392 / 489, visor: { l: 35.71, t: 25.77, w: 56.12, h: 29.24 }, ring: true },
  greet: { aspect: 505 / 529, visor: { l: 26.73, t: 27.6, w: 45.94, h: 29.11 } },
  celebrate: { aspect: 329 / 327, visor: { l: 29.79, t: 24.47, w: 42.55, h: 29.67 }, ring: true },
  read: { aspect: 537 / 520, visor: { l: 27.19, t: 29.04, w: 44.51, h: 29.42 } },
};

export const MASCOT_POSES = Object.keys(POSES);

const EYE = "#6FF5DA";
const PINK = "#FF7E9D";

// viewBox mặt kính 100 x 64; hai mắt quanh (36,30) và (64,30).
function Face({ expression }) {
  const cheeks = (
    <g className="asst-cheeks" fill={PINK} fillOpacity="0.75">
      <ellipse cx="22" cy="42" rx="5" ry="2.6" />
      <ellipse cx="78" cy="42" rx="5" ry="2.6" />
    </g>
  );
  const stroke = { stroke: EYE, strokeWidth: 5, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };

  switch (expression) {
    case "happy":
      return (
        <>
          <g {...stroke}>
            <path d="M28 34 Q36 22 44 34" />
            <path d="M56 34 Q64 22 72 34" />
          </g>
          {cheeks}
        </>
      );
    case "excited":
      return (
        <>
          <g {...stroke} className="asst-eyes-pulse">
            <path d="M30 23 L41 30 L30 37" />
            <path d="M70 23 L59 30 L70 37" />
          </g>
          <path d="M44 44 Q50 51 56 44 Z" fill={EYE} />
          {cheeks}
        </>
      );
    case "surprised":
      return (
        <g {...stroke} strokeWidth="4">
          <circle cx="36" cy="29" r="6.5" />
          <circle cx="64" cy="29" r="6.5" />
          <circle cx="50" cy="46" r="3.2" />
        </g>
      );
    case "love":
      return (
        <>
          <g fill={PINK} className="asst-eyes-pulse">
            <path d="M36 38 C26 31 27 22 32 21 C34.5 20.5 36 22.5 36 24 C36 22.5 37.5 20.5 40 21 C45 22 46 31 36 38 Z" />
            <path d="M64 38 C54 31 55 22 60 21 C62.5 20.5 64 22.5 64 24 C64 22.5 65.5 20.5 68 21 C73 22 74 31 64 38 Z" />
          </g>
          {cheeks}
        </>
      );
    case "sleepy":
      return (
        <g {...stroke}>
          <path d="M29 30 Q36 37 43 30" />
          <path d="M57 30 Q64 37 71 30" />
        </g>
      );
    case "wink":
      return (
        <>
          <rect x="31.5" y="21" width="9" height="17" rx="4.5" fill={EYE} />
          <path d="M70 24 L60 30 L70 36" {...stroke} />
          {cheeks}
        </>
      );
    case "thinking":
      return (
        <g fill={EYE}>
          <rect x="29" y="17" width="9" height="15" rx="4.5" />
          <rect x="57" y="17" width="9" height="15" rx="4.5" />
          <path d="M45 45 L55 43" {...stroke} strokeWidth="3.5" />
        </g>
      );
    default: // neutral — chớp mắt định kỳ
      return (
        <g className="asst-blink" fill={EYE}>
          <rect x="31.5" y="20" width="9" height="19" rx="4.5" />
          <rect x="59.5" y="20" width="9" height="19" rx="4.5" />
        </g>
      );
  }
}

// Ký hiệu nổi cạnh đầu: "!" (excited/surprised), "?" (thinking), "z z" (sleepy).
function Accent({ expression }) {
  if (expression === "excited" || expression === "surprised") {
    return (
      <svg className="asst-accent asst-accent-pop" viewBox="0 0 30 30" aria-hidden="true">
        <g stroke="#F5B82E" strokeWidth="4" strokeLinecap="round">
          <path d="M6 18 L3 6" />
          <path d="M15 16 L16 3" />
          <path d="M23 19 L28 9" />
        </g>
      </svg>
    );
  }
  if (expression === "thinking") {
    return (
      <svg className="asst-accent asst-accent-bob" viewBox="0 0 30 30" aria-hidden="true">
        <text x="15" y="25" textAnchor="middle" fontSize="26" fontWeight="800" fill="#194B80">?</text>
      </svg>
    );
  }
  if (expression === "sleepy") {
    return (
      <svg className="asst-accent asst-accent-zz" viewBox="0 0 30 30" aria-hidden="true">
        <text x="6" y="26" fontSize="13" fontWeight="800" fill="#194B80">z</text>
        <text x="16" y="15" fontSize="16" fontWeight="800" fill="#194B80">z</text>
      </svg>
    );
  }
  return null;
}

const FADE_MS = 380;
let preloaded = false;

// Đổi tư thế = 2 lớp ảnh chồng nhau mờ dần chéo (không remount giật cục).
// Khung giữ cố định theo `boxAspect` (mặc định = tỉ lệ ảnh của tư thế đầu
// tiên) để đổi sang ảnh rộng/hẹp hơn không làm cả nút nhảy kích thước.
export default function AssistantMascot({ pose = "idle", expression = "neutral", size = 96, boxAspect, className = "" }) {
  const cur = POSES[pose] ? pose : "idle";
  const [layers, setLayers] = useState([cur]);

  // Tải trước mọi ảnh 1 lần để lúc chuyển không bị chớp trắng.
  useEffect(() => {
    if (preloaded || typeof window === "undefined") return;
    preloaded = true;
    for (const k of MASCOT_POSES) {
      const img = new window.Image();
      img.src = `/assistant/${k}.webp`;
    }
  }, []);

  useEffect(() => {
    setLayers((prev) => (prev[prev.length - 1] === cur ? prev : [...prev.filter((x) => x !== cur), cur].slice(-2)));
    const t = setTimeout(() => setLayers([cur]), FADE_MS);
    return () => clearTimeout(t);
  }, [cur]);

  const ar = boxAspect || POSES[cur].aspect;
  return (
    <span
      className={`asst-figure asst-pose-${cur} asst-expr-${expression} ${className}`}
      style={{ "--asst-h": size + "px", "--asst-ar": ar }}
      aria-hidden="true"
    >
      <span className={"asst-ring" + (POSES[cur].ring ? "" : " is-off")} />
      <span className="asst-floater">
        {layers.map((k) => {
          const p = POSES[k];
          const v = p.visor;
          return (
            <span
              key={k}
              className={`asst-layer asst-layer-${k}` + (k === cur ? " is-in" : " is-out")}
              style={{ width: `calc(var(--asst-h) * ${p.aspect})` }}
            >
              <img src={`/assistant/${k}.webp`} alt="" draggable="false" />
              <svg
                className="asst-face"
                viewBox="0 0 100 64"
                style={{ left: v.l + "%", top: v.t + "%", width: v.w + "%", height: v.h + "%" }}
              >
                <Face expression={expression} />
              </svg>
              <Accent expression={expression} />
            </span>
          );
        })}
      </span>
    </span>
  );
}

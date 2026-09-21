"use client";

import { useRef, useState } from "react";

// Trình phát audio cho bài thi Listening: phát MỘT lần, không thanh điều
// khiển, không tua, không tạm dừng, không nghe lại. Trạng thái (`phase`) được
// nâng lên component cha để khi học sinh quay lại xem một Part cũ thì vẫn nhớ
// là Part đó đã phát xong (không cho phát lại).
//
//   phase: "idle" | "playing" | "done"

function fmt(s) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const ss = String(Math.floor(s % 60)).padStart(2, "0");
  return `${m}:${ss}`;
}

export default function ExamAudioPlayer({ src, partLabel, phase = "idle", onPhase, warn = false }) {
  const audioRef = useRef(null);
  // Mốc thời gian xa nhất đã thực sự nghe tới — dùng để kéo con trỏ về nếu
  // học sinh cố tua bằng phím mũi tên / phím media.
  const playedRef = useRef(0);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [starting, setStarting] = useState(false);
  const [needsResume, setNeedsResume] = useState(false);

  // .play() PHẢI gọi đồng bộ ngay trong handler click (iOS Safari huỷ quyền
  // phát nếu có await xen vào) — nên không hỏi qua dialog, chỉ cảnh báo bằng
  // chữ phía trên nút.
  function start() {
    if (starting || phase !== "idle") return;
    const el = audioRef.current;
    if (!el) return;
    setStarting(true);
    const p = el.play();
    if (p && p.then) {
      p.then(() => {
        onPhase && onPhase("playing");
        setStarting(false);
      }).catch(() => setStarting(false)); // để nút nguyên trạng cho bấm lại
    } else {
      onPhase && onPhase("playing");
      setStarting(false);
    }
  }

  function resume() {
    const el = audioRef.current;
    if (!el) return;
    const p = el.play();
    if (p && p.catch) p.catch(() => {});
    setNeedsResume(false);
  }

  function onTimeUpdate(e) {
    const t = e.target.currentTime;
    if (t > playedRef.current) playedRef.current = t;
    setCur(t);
  }

  function onSeeking(e) {
    const el = e.target;
    if (Math.abs(el.currentTime - playedRef.current) > 0.5) el.currentTime = playedRef.current;
  }

  function onPause(e) {
    // Không cho tạm dừng khi băng chưa hết. Thử phát tiếp ngay; nếu trình
    // duyệt chặn (vd iOS sau cuộc gọi đến) thì hiện nút "Tiếp tục nghe".
    const el = e.target;
    if (phase === "playing" && !el.ended) {
      const p = el.play();
      if (p && p.catch) p.catch(() => setNeedsResume(true));
    }
  }

  const pct = dur ? Math.min(100, (cur / dur) * 100) : 0;

  return (
    <div className={"exam-audio phase-" + (phase || "idle")}>
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        onLoadedMetadata={(e) => setDur(e.target.duration || 0)}
        onTimeUpdate={onTimeUpdate}
        onSeeking={onSeeking}
        onPause={onPause}
        onEnded={() => onPhase && onPhase("done")}
        onContextMenu={(e) => e.preventDefault()}
        controlsList="nodownload noplaybackrate"
      />

      {phase === "idle" && (
        <>
          {warn && (
            <p className="exam-audio-warn">
              <svg className="icon"><use href="#icon-warning" /></svg>
              Băng ghi âm chỉ phát <b>một lần</b>. Không thể tạm dừng, tua lại hay nghe lại. Chuẩn bị tai nghe / loa
              trước khi bắt đầu.
            </p>
          )}
          <button type="button" className="btn exam-audio-start" onClick={start} disabled={starting}>
            <svg className="icon"><use href="#icon-play" /></svg>
            {starting ? "Đang tải…" : `Bắt đầu nghe ${partLabel}`}
          </button>
        </>
      )}

      {phase === "playing" && (
        <div className="exam-audio-now">
          <svg className="icon"><use href="#icon-headphones" /></svg>
          <div className="exam-audio-bar">
            <span style={{ width: pct + "%" }} />
          </div>
          <span className="exam-audio-time">
            {fmt(cur)} / {fmt(dur)}
          </span>
          {needsResume && (
            <button type="button" className="btn secondary exam-audio-resume" onClick={resume}>
              <svg className="icon"><use href="#icon-play" /></svg> Tiếp tục nghe
            </button>
          )}
        </div>
      )}

      {phase === "done" && (
        <div className="exam-audio-done">
          <svg className="icon"><use href="#icon-check-circle" /></svg>
          Đã phát xong {partLabel} — không thể nghe lại
        </div>
      )}
    </div>
  );
}

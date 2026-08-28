"use client";

// Popup kết quả nộp bài cho học sinh.
//   variant="prompt"   : Writing / Speaking — có card chi tiết (Assignment / Deadline / Status)
//   variant="exercise" : bài tự chấm — gọn, chỉ hiện điểm + cờ Late
//
// Dùng: <SubmissionResultModal open variant="prompt" isLate dueAt itemLabel skill onClose={...} />

import { useEffect } from "react";
import { createPortal } from "react-dom";

const TZ = "Asia/Ho_Chi_Minh";

function fmt(d) {
  if (!d) return "No deadline";
  try {
    return new Date(d).toLocaleString("en-US", {
      timeZone: TZ,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return String(d);
  }
}

function BellIllustration({ late }) {
  return (
    <div className="srm-illus">
      <div className="srm-blob" />
      <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <g transform="translate(18 12)">
          <path
            d="M42 8c0-3.3-2.7-6-6-6s-6 2.7-6 6C18 11 12 21 12 40c0 12-6 16-6 16h60s-6-4-6-16c0-19-6-29-18-32Z"
            fill="#FF7FAE"
          />
          <path d="M28 62a8 8 0 0 0 16 0Z" fill="#F2669C" />
          <circle cx="55" cy="10" r="4" fill="#FFD1E4" />
          <path d="M64 4l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#FFD1E4" />
        </g>
        {late ? (
          <g transform="translate(74 66)">
            <circle cx="18" cy="18" r="18" fill="#fff" />
            <circle cx="18" cy="18" r="14" fill="#F2669C" />
            <path d="M18 10v9l6 4" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ) : (
          <g transform="translate(74 66)">
            <circle cx="18" cy="18" r="18" fill="#fff" />
            <circle cx="18" cy="18" r="14" fill="#2FA36B" />
            <path d="M11 18l5 5 10-11" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
      </svg>
    </div>
  );
}

function Row({ icon, label, children }) {
  return (
    <div className="srm-row">
      <span className="srm-row-ico"><svg className="icon"><use href={"#icon-" + icon} /></svg></span>
      <div>
        <div className="srm-row-label">{label}</div>
        <div className="srm-row-value">{children}</div>
      </div>
    </div>
  );
}

export default function SubmissionResultModal({
  open,
  onClose,
  variant = "prompt",
  itemLabel,
  skill = "writing",
  dueAt,
  isLate = false,
  score,
  total,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const isExercise = variant === "exercise";
  const workWord = isExercise ? "answers have" : skill === "speaking" ? "recording has" : "writing has";

  return createPortal(
    <div
      className="modal-overlay ui-dialog-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-box srm">
        <button type="button" className="srm-close" aria-label="Close" onClick={onClose}>
          <svg className="icon"><use href="#icon-cross" /></svg>
        </button>

        <BellIllustration late={isLate} />

        <h3 className="srm-title">
          {isExercise ? "Answers submitted!" : "Assignment submitted!"}
        </h3>
        <p className="srm-sub">
          Your {workWord} been successfully submitted{" "}
          {isLate ? (
            <>after the <b className="txt-late">deadline</b>.</>
          ) : (
            <>on time.</>
          )}
        </p>

        {isExercise ? (
          <div className="srm-score">
            <span className="srm-score-num">
              {typeof score === "number" ? `${score}/${total}` : "Submitted"}
            </span>
            <span className="srm-score-cap">correct</span>
            {isLate && <span className="pill pill-danger" style={{ marginTop: 8 }}>Late</span>}
          </div>
        ) : (
          <div className="srm-detail">
            <Row icon="calendar" label="Assignment">
              {itemLabel || (skill === "speaking" ? "Speaking Practice" : "Writing Practice")}
            </Row>
            <Row icon="clock" label="Deadline">{fmt(dueAt)}</Row>
            <Row icon="warning" label="Status">
              {isLate ? (
                <span className="pill pill-danger">Late</span>
              ) : (
                <span className="pill pill-ok">On time</span>
              )}
            </Row>
          </div>
        )}

        {isLate && !isExercise && (
          <div className="srm-late-bar">
            <svg className="icon"><use href="#icon-info" /></svg>
            <span>You can still submit, but your work will be marked <b>Late</b>.</span>
          </div>
        )}

        <button type="button" className="btn srm-btn" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>,
    document.body
  );
}

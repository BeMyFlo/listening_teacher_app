"use client";

// Stepper 3 bước cho trang Bài nộp: Bài đã chấm -> Reflection Log -> Nộp lại.
// step: index bước hiện tại (0,1,2); done: mảng bool đã hoàn thành từng bước.
export default function SubmissionStepper({ labels, done, current }) {
  return (
    <div className="sub-stepper">
      {labels.map((label, i) => (
        <div className="sub-stepper-item" key={i}>
          <div
            className={
              "sub-stepper-dot" +
              (done[i] ? " done" : i === current ? " active" : "")
            }
          >
            {done[i] ? (
              <svg className="icon"><use href="#icon-check" /></svg>
            ) : (
              i + 1
            )}
          </div>
          <span className="sub-stepper-label">{label}</span>
          {i < labels.length - 1 && <div className="sub-stepper-line" />}
        </div>
      ))}
    </div>
  );
}

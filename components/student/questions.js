"use client";

import { useCallback, useState } from "react";
import ReadingPassage from "@/components/student/ReadingPassage";

// ---------- State câu trả lời ----------
// initial: câu trả lời đã nộp trước đó (last.answers) — để mở lại bài đã làm
// (review) vẫn thấy đúng lựa chọn cũ, không phải ô trống.
export function useAnswers(initial) {
  const [answers, setAnswers] = useState(() => initial || {});
  const getValue = useCallback(
    (f) => {
      const v = answers[f.id];
      if (v != null) return v;
      return Number(f.selectCount) > 1 ? [] : "";
    },
    [answers]
  );
  const setValue = useCallback((id, v) => setAnswers((p) => ({ ...p, [id]: v })), []);
  const reset = useCallback(() => setAnswers({}), []);
  const collect = useCallback(
    (sections) => {
      const out = {};
      (sections || []).forEach((sec) =>
        (sec.fields || []).forEach((f) => {
          const v = answers[f.id];
          out[f.id] = v != null ? v : Number(f.selectCount) > 1 ? [] : "";
        })
      );
      return out;
    },
    [answers]
  );
  return { answers, getValue, setValue, collect, reset };
}

function fieldOptions(field, section) {
  return field.options && field.options.length ? field.options : section.matchOptions || [];
}

export function answerLabel(field, value, section) {
  const options = fieldOptions(field, section);
  if (Array.isArray(value)) {
    if (!value.length) return "";
    return value.map((val) => (options.find((o) => o.value === val) || {}).label || val).join(", ");
  }
  if (field.type === "choice") {
    const opt = options.find((o) => o.value === value);
    return opt ? opt.label : value;
  }
  return value;
}

// ---------- 1 câu hỏi (khớp .field-row của legacy) ----------
export function QuestionField({ field, section, value, onChange, review }) {
  const isChoice = field.type === "choice";
  const selectCount = Number(field.selectCount) || 1;
  const options = fieldOptions(field, section);
  const rowCls =
    "field-row" + (review ? (review.correct ? " correct" : " wrong") : "");

  // "Correct answer" lưu ở DB là VALUE nội bộ của lựa chọn (VD "o3_2"), không
  // phải chữ học sinh đọc được — map qua option để hiện đúng nhãn.
  const labelForValue = (v) => {
    const opt = options.find((o) => o.value === v);
    return opt ? opt.label : v;
  };
  const correctAnswerLabel = review
    ? selectCount > 1
      ? String(review.answer || "")
          .split(",")
          .map((v) => labelForValue(v.trim()))
          .join(", ")
      : labelForValue(review.answer || "")
    : "";

  if (isChoice) {
    return (
      <div className={rowCls} id={"row-" + field.id}>
        <span className="num">{field.id}.</span>
        <div style={{ flex: 1 }}>
          <div className="label" style={{ marginBottom: 6 }}>
            {field.label}
            {selectCount > 1 && (
              <span className="select-hint"> (Select up to {selectCount} answers)</span>
            )}
            {field.hint && <span className="field-hint"> {field.hint}</span>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {options.map((o) => {
              const checked =
                selectCount > 1
                  ? Array.isArray(value) && value.includes(o.value)
                  : value === o.value;
              const atLimit =
                selectCount > 1 && Array.isArray(value) && value.length >= selectCount && !checked;
              return (
                <label
                  key={o.value}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400 }}
                >
                  <input
                    type={selectCount > 1 ? "checkbox" : "radio"}
                    name={"ans-" + field.id}
                    checked={checked}
                    disabled={!!review || atLimit}
                    onChange={() => {
                      if (review) return;
                      if (selectCount > 1) {
                        const arr = Array.isArray(value) ? value : [];
                        onChange(checked ? arr.filter((x) => x !== o.value) : [...arr, o.value]);
                      } else onChange(o.value);
                    }}
                  />
                  {o.label}
                </label>
              );
            })}
          </div>
        </div>
        {review && (
          <span className={"result-mark " + (review.correct ? "correct" : "wrong")}>
            <svg className="icon"><use href={review.correct ? "#icon-check" : "#icon-cross"} /></svg>
          </span>
        )}
        {review && !review.correct && (
          <div className="correct-answer-note">Correct answer: {correctAnswerLabel}</div>
        )}
      </div>
    );
  }

  return (
    <div className={rowCls} id={"row-" + field.id}>
      <span className="num">{field.id}.</span>
      <span className="label">
        {field.label}
        {field.pre ? ": " + field.pre : ""}
        {field.hint && <span className="field-hint"> {field.hint}</span>}
      </span>
      <input
        type="text"
        id={"ans-" + field.id}
        autoComplete="off"
        value={typeof value === "string" ? value : ""}
        disabled={!!review}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="tail">{field.post || ""}</span>
      {review && (
        <span className={"result-mark " + (review.correct ? "correct" : "wrong")}>
          <svg className="icon"><use href={review.correct ? "#icon-check" : "#icon-cross"} /></svg>
        </span>
      )}
      {review && !review.correct && (
        <div className="correct-answer-note">Correct answer: {review.answer || ""}</div>
      )}
    </div>
  );
}

function DiagramImage({ section, center }) {
  const style = center ? { margin: "0 auto 16px" } : undefined;
  if (!section.labelPoints || !section.labelPoints.length) {
    return <img src={section.imageUrl} alt="" className="diagram-image" style={style} />;
  }
  return (
    <div className="diagram-pin-wrap" style={style}>
      <img src={section.imageUrl} alt="" className="diagram-image" />
      {section.labelPoints.map((lp, i) => (
        <span key={i} className="pin-marker" style={{ left: lp.x + "%", top: lp.y + "%" }}>
          {lp.fieldId}
        </span>
      ))}
    </div>
  );
}

// ---------- 1 section (khớp renderSectionBlock của legacy) ----------
export function SectionBlock({ section, secIdx, skill, answersApi, reviewById, onReplay }) {
  const [replays, setReplays] = useState(0);
  const isReading = skill === "reading";

  const fields = (section.fields || []).map((f) => (
    <QuestionField
      key={f.id}
      field={f}
      section={section}
      value={answersApi.getValue(f)}
      onChange={(v) => answersApi.setValue(f.id, v)}
      review={reviewById ? reviewById[f.id] : null}
    />
  ));

  if (isReading) {
    return (
      <div className="reading-layout" style={{ marginBottom: 30 }}>
        <div className="passage-pane">
          <h3 style={{ color: "var(--navy)", marginTop: 0 }}>{section.name}</h3>
          {section.imageUrl && <DiagramImage section={section} />}
          {section.passageText && (
            <ReadingPassage
              text={section.passageText}
              storageKey={(section.name || "") + ":" + secIdx}
            />
          )}
        </div>
        <div className="questions-pane">{fields}</div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 30 }}>
      <div className="section-title">{section.name}</div>
      {section.audioUrl && (
        <div className="player">
          <svg className="icon"><use href="#icon-speaker" /></svg>
          <audio
            controls
            src={section.audioUrl}
            onPlay={() => {
              setReplays((n) => n + 1);
              onReplay && onReplay();
            }}
          />
          <span className="replay-count">Listened: {replays} times</span>
        </div>
      )}
      {section.imageUrl && <DiagramImage section={section} center />}
      {fields}
    </div>
  );
}

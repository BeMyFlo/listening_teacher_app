"use client";

import { useState } from "react";

// P2 · Reflection Log — 3 câu hỏi cố định (xem lib/grading/reflection.js).
// Chỉ nhập được khi chưa nộp; đã nộp thì hiển thị read-only.
export default function ReflectionLogForm({ questions, value, busy, onSubmit }) {
  const [mistake, setMistake] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");

  const qByKey = {};
  (questions || []).forEach((q) => (qByKey[q.key] = q));

  if (value) {
    return (
      <div className="card reflog-card">
        <div className="page-head" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>P2 · Reflection Log</h3>
          <span className="pill pill-ok">Đã nộp</span>
        </div>
        <div className="reflog-field">
          <label>1. {qByKey.mistake ? qByKey.mistake.label : "Lỗi mắc nhiều nhất"}</label>
          <div className="reflog-answer">{value.mistake}</div>
        </div>
        <div className="reflog-field">
          <label>2. {qByKey.focusTags ? qByKey.focusTags.label : "Cần luyện thêm"}</label>
          <div className="reflog-tags">
            {(value.focusTags || []).map((t, i) => (
              <span className="pill pill-info" key={i}>{t}</span>
            ))}
          </div>
        </div>
        <div className="reflog-field">
          <label>3. {qByKey.nextAction ? qByKey.nextAction.label : "Lần sau em sẽ..."}</label>
          <div className="reflog-answer">{value.nextAction}</div>
        </div>
      </div>
    );
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  }
  function removeTag(t) {
    setTags(tags.filter((x) => x !== t));
  }

  const canSubmit = mistake.trim() && nextAction.trim() && !busy;

  return (
    <div className="card reflog-card">
      <div className="page-head" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>P2 · Reflection Log</h3>
        <span className="pill pill-muted">Học sinh điền</span>
      </div>

      <div className="reflog-field">
        <label>1. {qByKey.mistake ? qByKey.mistake.label : "Lỗi mắc nhiều nhất"}</label>
        <textarea
          className="reflog-input"
          rows={2}
          value={mistake}
          onChange={(e) => setMistake(e.target.value)}
        />
      </div>

      <div className="reflog-field">
        <label>2. {qByKey.focusTags ? qByKey.focusTags.label : "Cần luyện thêm"}</label>
        <div className="reflog-tags">
          {tags.map((t) => (
            <span className="pill pill-info reflog-tag" key={t}>
              {t}
              <button type="button" className="reflog-tag-remove" onClick={() => removeTag(t)}>
                &times;
              </button>
            </span>
          ))}
        </div>
        <div className="reflog-tag-add">
          <input
            className="reflog-input"
            placeholder="Nhập từ vựng rồi nhấn Enter..."
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
          />
          <button type="button" className="btn secondary" onClick={addTag}>
            + Thêm
          </button>
        </div>
      </div>

      <div className="reflog-field">
        <label>3. {qByKey.nextAction ? qByKey.nextAction.label : "Lần sau em sẽ..."}</label>
        <textarea
          className="reflog-input"
          rows={2}
          value={nextAction}
          onChange={(e) => setNextAction(e.target.value)}
        />
      </div>

      <button
        type="button"
        className="btn"
        disabled={!canSubmit}
        onClick={() => onSubmit({ mistake: mistake.trim(), focusTags: tags, nextAction: nextAction.trim() })}
      >
        Nộp Reflection Log
      </button>
    </div>
  );
}

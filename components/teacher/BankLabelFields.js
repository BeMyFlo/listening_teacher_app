"use client";

import { GENERAL_TOPICS, DIFFICULTIES, topicLabel } from "@/lib/generalTopics";

// Ô nhãn của ngân hàng câu hỏi, dùng chung cho trang ngân hàng, hộp "Save to question bank" và sửa nhãn nhiều mục.
// value: { level, textbook, unitLabel, topic, difficulty } (chuỗi). show: chọn ô nào hiện.
// Chủ điểm: gợi ý từ GENERAL_TOPICS nhưng gõ tự do được (datalist).
export default function BankLabelFields({
  value,
  onChange,
  levels = [],
  levelText,
  show = { level: true, textbook: true, unitLabel: true, topic: true, difficulty: true },
  idPrefix = "bl",
  blankLabel = "Not set",
}) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const listId = idPrefix + "-topics";
  return (
    <>
      {show.level && (
        <div className="form-row" style={{ marginBottom: 10 }}>
          <label>Grade</label>
          <select className="select-inline" style={{ width: "100%" }} value={value.level} onChange={(e) => set("level", e.target.value)}>
            <option value="">— Choose a grade —</option>
            {levels.map((l) => (
              <option key={l} value={l}>{levelText ? levelText(l) : "Grade " + l}</option>
            ))}
          </select>
        </div>
      )}
      {show.textbook && (
        <div className="form-row" style={{ marginBottom: 10 }}>
          <label>Textbook (optional)</label>
          <input type="text" maxLength={120} value={value.textbook} placeholder="e.g. Global Success 10"
            onChange={(e) => set("textbook", e.target.value)} />
        </div>
      )}
      {show.unitLabel && (
        <div className="form-row" style={{ marginBottom: 10 }}>
          <label>Unit (optional)</label>
          <input type="text" maxLength={120} value={value.unitLabel} placeholder="e.g. Unit 3"
            onChange={(e) => set("unitLabel", e.target.value)} />
        </div>
      )}
      {show.topic && (
        <div className="form-row" style={{ marginBottom: 10 }}>
          <label>Topic (optional — pick one or type your own)</label>
          <input type="text" maxLength={80} list={listId} value={value.topic} placeholder="e.g. Passive voice"
            onChange={(e) => set("topic", e.target.value)} />
          <datalist id={listId}>
            {GENERAL_TOPICS.map((g) =>
              g.topics.map((t) => (
                <option key={t.key} value={t.key}>{g.label}: {t.label}</option>
              ))
            )}
          </datalist>
          {value.topic && topicLabel(value.topic) !== value.topic && (
            <div style={{ fontSize: ".78rem", color: "var(--muted)", marginTop: 3 }}>{topicLabel(value.topic)}</div>
          )}
        </div>
      )}
      {show.difficulty && (
        <div className="form-row" style={{ marginBottom: 10 }}>
          <label>Difficulty (optional)</label>
          <select className="select-inline" style={{ width: "100%" }} value={value.difficulty} onChange={(e) => set("difficulty", e.target.value)}>
            <option value="">{blankLabel}</option>
            {DIFFICULTIES.map((d) => (
              <option key={d.key} value={d.key}>{d.label}</option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}

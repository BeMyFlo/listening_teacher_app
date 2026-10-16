"use client";

import { useState } from "react";

const BACK_ROWS = [
  ["partOfSpeech", "Part of speech"],
  ["meaning", "Meaning"],
  ["definitionEn", "Definition"],
  ["example", "Example"],
  ["collocation", "Collocation"],
  ["synonyms", "Synonyms"],
];

// Câu gốc trong bài, tô đậm từ đang học (kể cả dạng biến đổi: mitigate -> mitigating;
// cụm nhiều từ thì tô từng thành phần). Không dùng lookbehind để chạy cả trên Safari cũ.
function MarkedSentence({ text, word }) {
  const stems = (String(word || "").toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
    .filter((t) => t.length >= 3)
    .map((t) => (t.length <= 3 ? t : t.slice(0, Math.max(4, t.length - 3))));
  const parts = [];
  let last = 0;
  const re = /[\p{L}\p{N}]+/gu;
  let m;
  while ((m = re.exec(text))) {
    const lw = m[0].toLowerCase();
    if (stems.some((s) => lw.startsWith(s))) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      parts.push(<b key={m.index}>{m[0]}</b>);
      last = m.index + m[0].length;
    }
  }
  if (last < text.length) parts.push(text.slice(last));
  return <i>{parts}</i>;
}

// showContext: thêm dòng "In the text" (Vocab Review) — từ có `context`.
export function VocabFlashcards({ words, showContext = false }) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  if (!words.length) return <div className="empty-state">This group has no words yet.</div>;

  const w = words[Math.min(i, words.length - 1)];
  const go = (d) => {
    setFlipped(false);
    setI((x) => (x + d + words.length) % words.length);
  };

  return (
    <div>
      <div
        onClick={() => setFlipped((f) => !f)}
        style={{
          border: "1px solid var(--border)",
          borderRadius: 12,
          background: "var(--card)",
          boxShadow: "var(--shadow-sm)",
          minHeight: 200,
          padding: 24,
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: flipped ? "flex-start" : "center",
          textAlign: flipped ? "left" : "center",
        }}
      >
        {!flipped ? (
          <>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--navy)" }}>{w.word}</div>
            {w.ipa && <div style={{ color: "var(--muted)", marginTop: 6 }}>{w.ipa}</div>}
            <div style={{ color: "var(--muted)", fontSize: ".8rem", marginTop: 14 }}>tap to flip</div>
          </>
        ) : (
          <div style={{ width: "100%" }}>
            <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--navy)", marginBottom: 10 }}>
              {w.word} <span style={{ color: "var(--muted)", fontWeight: 400 }}>{w.ipa}</span>
            </div>
            {BACK_ROWS.map(([k, label]) =>
              (w[k] || "").trim() ? (
                <div key={k} style={{ marginBottom: 6 }}>
                  <b>{label}:</b> {w[k]}
                </div>
              ) : null
            )}
            {showContext && (w.context || "").trim() && (
              <div style={{ marginBottom: 6 }}>
                <b>In the text:</b> <MarkedSentence text={w.context} word={w.word} />
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 12 }}>
        <button type="button" className="btn secondary" onClick={() => go(-1)}>
          ◀
        </button>
        <span style={{ color: "var(--muted)" }}>
          {(i % words.length) + 1} / {words.length}
        </span>
        <button type="button" className="btn secondary" onClick={() => go(1)}>
          ▶
        </button>
      </div>
    </div>
  );
}

export function VocabWordList({ words, showContext = false }) {
  if (!words.length) return <div className="empty-state">This group has no words yet.</div>;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Word</th>
            <th>IPA</th>
            <th>Type</th>
            <th>Meaning</th>
            <th>Example</th>
            <th>Collocation</th>
            <th>Synonyms</th>
            {showContext && <th>In the text</th>}
          </tr>
        </thead>
        <tbody>
          {words.map((w, i) => (
            <tr key={i}>
              <td><b>{w.word}</b></td>
              <td>{w.ipa}</td>
              <td>{w.partOfSpeech}</td>
              <td>{w.meaning}</td>
              <td>{w.example}</td>
              <td>{w.collocation}</td>
              <td>{w.synonyms}</td>
              {showContext && <td>{w.context ? <MarkedSentence text={w.context} word={w.word} /> : null}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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

export function VocabFlashcards({ words }) {
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

export function VocabWordList({ words }) {
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

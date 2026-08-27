"use client";

const COLS = [
  ["word", "Word"],
  ["partOfSpeech", "Part of speech"],
  ["ipa", "IPA"],
  ["meaning", "Meaning"],
  ["definitionEn", "Definition (EN)"],
  ["example", "Example"],
  ["collocation", "Collocation"],
  ["synonyms", "Synonyms"],
];

export function emptyWord() {
  return {
    word: "",
    partOfSpeech: "",
    ipa: "",
    meaning: "",
    definitionEn: "",
    example: "",
    collocation: "",
    synonyms: "",
  };
}

export default function VocabWordTable({ words, onChange }) {
  function patch(mut) {
    const draft = structuredClone(words);
    mut(draft);
    onChange(draft);
  }

  return (
    <div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {COLS.map(([k, label]) => (
                <th key={k}>{label}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {words.length === 0 && (
              <tr>
                <td colSpan={COLS.length + 1} style={{ textAlign: "center", color: "var(--muted)" }}>
                  No words yet.
                </td>
              </tr>
            )}
            {words.map((w, i) => (
              <tr key={i}>
                {COLS.map(([k]) => (
                  <td key={k}>
                    <input
                      className="select-inline"
                      style={{ width: k === "example" || k === "definitionEn" ? 220 : 120 }}
                      value={w[k] || ""}
                      onChange={(e) => patch((d) => (d[i][k] = e.target.value))}
                    />
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className="icon-btn danger"
                    title="Delete word"
                    onClick={() => patch((d) => d.splice(i, 1))}
                  >
                    <svg className="icon"><use href="#icon-trash" /></svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="btn secondary"
        style={{ marginTop: 8, padding: "6px 12px", fontSize: ".85rem" }}
        onClick={() => onChange([...words, emptyWord()])}
      >
        <svg className="icon"><use href="#icon-plus" /></svg> Add word
      </button>
    </div>
  );
}

"use client";

// Phần form tuỳ chọn AI dùng chung cho các hộp thoại/tab soạn từ vựng bằng AI
// (AiVocabDialog, Vocab Review): trình độ học sinh, ngôn ngữ, cột của bảng từ,
// ghi chú. Mỗi nơi tự ghép các mảnh này theo bố cục của mình.

export const LEVEL_SUGGESTIONS = [
  "3.0", "3.5", "4.0", "4.5", "5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0",
  "A1", "A2", "B1", "B2", "C1",
];

export const LANGUAGES = [
  ["vi", "Vietnamese meanings & explanations"],
  ["bilingual", "Vietnamese meanings, bilingual explanations"],
  ["en", "English only"],
];

// Cột của bảng từ (cột Word luôn có).
export const COLUMNS = [
  ["partOfSpeech", "Part of speech"],
  ["ipa", "IPA"],
  ["meaning", "Meaning"],
  ["definitionEn", "Definition (EN)"],
  ["example", "Example"],
  ["collocation", "Collocation"],
  ["synonyms", "Synonyms"],
];

// Bật/tắt một key trong mảng state: toggle(setList, key)(on).
export const toggle = (setList, key) => (on) =>
  setList((cur) => (on ? [...new Set([...cur, key])] : cur.filter((x) => x !== key)));

export function Check({ checked, onChange, children }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: ".88rem", marginRight: 14 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

// Trình độ học sinh + ngôn ngữ, 2 cột. `studentLevel` / `language` / `onChange(key, value)`.
export function LevelLanguageFields({ studentLevel, language, onChange, languages = LANGUAGES, listId = "ai-vocab-level-suggestions" }) {
  return (
    <div className="builder-2col" style={{ marginBottom: 12 }}>
      <div className="form-row" style={{ marginBottom: 0 }}>
        <label>Students&apos; level (IELTS band or CEFR)</label>
        <input
          type="text"
          list={listId}
          placeholder="e.g. 6.5, 5.0–5.5, B1"
          value={studentLevel}
          onChange={(e) => onChange("studentLevel", e.target.value)}
        />
        <datalist id={listId}>
          {LEVEL_SUGGESTIONS.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      </div>
      <div className="form-row" style={{ marginBottom: 0 }}>
        <label>Language</label>
        <select value={language} onChange={(e) => onChange("language", e.target.value)}>
          {languages.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// Hàng tick cột: "Word + [x] Part of speech [x] IPA ...". `columns` = mảng key đang tick.
export function ColumnChecks({ columns, onToggle }) {
  return (
    <>
      <span style={{ fontSize: ".82rem", color: "var(--muted)", marginRight: 10 }}>Word +</span>
      {COLUMNS.map(([k, l]) => (
        <Check key={k} checked={columns.includes(k)} onChange={onToggle(k)}>
          {l}
        </Check>
      ))}
    </>
  );
}

export function NotesField({ value, onChange, placeholder }) {
  return (
    <div className="form-row" style={{ marginBottom: 0 }}>
      <label>Extra requests (optional)</label>
      <textarea rows={2} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

// Form tuỳ chọn của Vocab Review: trình độ, ngôn ngữ, số từ, cột, ghi chú.
// `opts` = { studentLevel, language, wordCount, columns, notes }; `onChange(patch)`.
const REVIEW_LANGUAGES = [
  ["vi", "Vietnamese meanings"],
  ["en", "English only"],
];
const WORD_COUNTS = [10, 15, 20];

export function VocabReviewOptions({ opts, onChange, idSuffix = "" }) {
  const setCols = (updater) => onChange({ columns: typeof updater === "function" ? updater(opts.columns) : updater });
  return (
    <div>
      <LevelLanguageFields
        studentLevel={opts.studentLevel}
        language={opts.language === "en" ? "en" : "vi"}
        languages={REVIEW_LANGUAGES}
        listId={"ai-review-level-suggestions" + idSuffix}
        onChange={(k, v) => onChange({ [k]: v })}
      />
      <div className="form-row" style={{ marginBottom: 12 }}>
        <label>What should the AI write?</label>
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontWeight: 600, fontSize: ".82rem" }}>
            <label style={{ fontSize: ".88rem", fontWeight: 400 }}>
              Number of words{" "}
              <select value={opts.wordCount} onChange={(e) => onChange({ wordCount: Number(e.target.value) })}>
                {WORD_COUNTS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ margin: "6px 0 0" }}>
            <ColumnChecks columns={opts.columns} onToggle={(k) => toggle(setCols, k)} />
          </div>
        </div>
      </div>
      <NotesField
        value={opts.notes}
        onChange={(v) => onChange({ notes: v })}
        placeholder="e.g. Focus on collocations and words that the questions paraphrase."
      />
    </div>
  );
}

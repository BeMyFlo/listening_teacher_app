"use client";

// Hàng đếm theo mức độ cho từng dạng của 1 phần khuôn (Any + NB/TH/VD/VDC), kèm số câu sẵn có trong ngân hàng.
// Phần có đoạn văn: chỉ chọn mức độ của 1 nhóm (nhóm bốc nguyên, số câu của phần = số câu của nhóm).
// Dùng trong TemplatePicker (G4 bước 3).
import { DIFFICULTIES } from "@/lib/generalTopics";
import { GENERAL_ALL_FORMATS } from "@/lib/teacher/questionFormats";
import { defaultMatrixCell, DIFF_KEYS } from "@/lib/teacher/fillFromBank";

const fmtLabel = (key) => (GENERAL_ALL_FORMATS.find((f) => f.key === key) || { label: key }).label;
const tiny = { fontSize: ".74rem", color: "var(--muted)" };

export default function BankMatrix({ sk, pi, part, counts, matrix, setMatrix, setCell, available, loaded }) {
  const cs = (counts[sk] || [])[pi] || [];
  const num = (qi) => (Number.isFinite(cs[qi]) ? cs[qi] : 0);

  if (part.passage && sk === "reading") {
    const qi = part.questions.findIndex((_q, i) => num(i) > 0);
    if (qi < 0) return null;
    const key = sk + ":" + pi + ":" + qi;
    const cur = String(matrix[key] || "");
    const n = available(part.questions[qi].format, cur || "any", true);
    return (
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400, fontSize: ".84rem" }}>
          Passage difficulty
          <select className="select-inline" value={cur} onChange={(e) => setMatrix((prev) => ({ ...prev, [key]: e.target.value }))}>
            <option value="">Any</option>
            {DIFFICULTIES.map((d) => (
              <option key={d.key} value={d.key}>{d.short}</option>
            ))}
          </select>
        </label>
        <span style={tiny}>{loaded ? (n === 1 ? "1 passage" : n + " passages") + " in the bank" : "…"}</span>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      {part.questions.map((q, qi) => {
        const total = num(qi);
        if (!(total > 0)) return null;
        const key = sk + ":" + pi + ":" + qi;
        const cell = matrix[key] || defaultMatrixCell(total);
        return (
          <div key={qi} style={{ marginBottom: 6 }}>
            {part.questions.length > 1 && <div style={{ ...tiny, marginBottom: 2 }}>{fmtLabel(q.format)}</div>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {["any", ...DIFF_KEYS].map((dk) => {
                const av = available(q.format, dk, false);
                const want = Number(cell[dk]) || 0;
                const short = loaded && av != null && want > av;
                const diff = DIFFICULTIES.find((d) => d.key === dk);
                return (
                  <label key={dk} style={{ display: "flex", flexDirection: "column", gap: 2, fontWeight: 400, width: 62 }}>
                    <span style={{ fontSize: ".74rem" }}>{diff ? diff.short : "Any"}</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      aria-label={`${part.name}${part.questions.length > 1 ? " — " + fmtLabel(q.format) : ""}: ${diff ? diff.label : "any difficulty"}`}
                      style={{ width: "100%", padding: "5px 6px", border: "1px solid var(--border)", borderRadius: 6 }}
                      value={cell[dk]}
                      onChange={(e) => setCell(key, total, dk, e.target.value)}
                    />
                    <span style={{ ...tiny, color: short ? "var(--danger, #b42318)" : "var(--muted)" }}>{loaded ? av + " in bank" : "…"}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

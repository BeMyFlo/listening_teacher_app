"use client";

// Khối "Start from a template" của builder đề mới (Phase 12 G2, mục 2.3).
// Chỉ hiện khi chương trình có testTemplates (registry). Chọn khuôn, chỉnh số câu từng phần,
// bấm "Use this template" -> gọi onUse(template đã resolve, khung dựng sẵn). Không lưu gì.
import { useMemo, useState } from "react";
import { templatesFor, resolveTemplate, TEMPLATES } from "@/lib/generalTemplates";
import { GENERAL_ALL_FORMATS } from "@/lib/teacher/questionFormats";
import { buildSkeleton } from "@/lib/teacher/templateSkeleton";

const SKILL_TITLE = { listening: "Listening", reading: "Reading" };
const fmtLabel = (key) => (GENERAL_ALL_FORMATS.find((f) => f.key === key) || { label: key }).label;

export default function TemplatePicker({ program, defaultOpen = false, onUse }) {
  const templates = templatesFor(program);
  const [open, setOpen] = useState(defaultOpen);
  const [key, setKey] = useState("");
  const [edits, setEdits] = useState({}); // "skill:part:type" -> chuỗi trong ô nhập
  const [includeListening, setIncludeListening] = useState(false);

  const base = key && TEMPLATES[key] && templates.some((t) => t.key === key) ? TEMPLATES[key] : null;

  // Số câu đang nhập -> counts cho resolveTemplate (ô trống / sai -> NaN để báo lỗi).
  const { resolved, error } = useMemo(() => {
    if (!base) return { resolved: null, error: "" };
    const counts = {};
    for (const [sk, def] of Object.entries(base.skills)) {
      counts[sk] = def.parts.map((p, pi) =>
        p.questions.map((q, qi) => {
          const raw = edits[`${sk}:${pi}:${qi}`];
          if (raw === undefined) return q.count;
          return raw.trim() === "" ? NaN : Number(raw);
        })
      );
    }
    const res = resolveTemplate(base.key, { counts, includeListening });
    return { resolved: res.template, error: res.error || "" };
  }, [base, edits, includeListening]);

  if (!templates.length) return null;

  function pick(k) {
    setKey(k);
    setEdits({});
    setIncludeListening(false);
  }

  const optionalSkills = base ? Object.entries(base.skills).filter(([, d]) => d.optional) : [];

  return (
    <div className="form-row" style={{ marginBottom: 16 }}>
      {!open ? (
        <button type="button" className="btn secondary" onClick={() => setOpen(true)}>
          <svg className="icon"><use href="#icon-clipboard" /></svg> Start from a template
        </button>
      ) : (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <strong>Start from a template</strong>
            <button type="button" className="btn secondary sm" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <div className="program-radios" role="radiogroup" aria-label="Template" style={{ marginTop: 10, flexWrap: "wrap" }}>
            {templates.map((t) => (
              <label key={t.key}>
                <input type="radio" name="testTemplate" value={t.key} checked={key === t.key} onChange={() => pick(t.key)} />
                {t.label}
              </label>
            ))}
          </div>

          {base && (
            <>
              <p style={{ color: "var(--muted)", fontSize: ".84rem", margin: "10px 0 4px" }}>{base.note}</p>
              <p style={{ color: "var(--muted)", fontSize: ".78rem", margin: "0 0 10px" }}>Source: {base.source}</p>

              {optionalSkills.map(([sk]) => (
                <label key={sk} style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400, marginBottom: 10 }}>
                  <input type="checkbox" checked={includeListening} onChange={(e) => setIncludeListening(e.target.checked)} />
                  Include {SKILL_TITLE[sk].toLowerCase()}
                </label>
              ))}

              {Object.entries(base.skills)
                .filter(([, d]) => !d.optional || includeListening)
                .map(([sk, def]) => (
                  <div key={sk} style={{ marginBottom: 10 }}>
                    <h4 style={{ margin: "6px 0" }}>
                      {SKILL_TITLE[sk]} · {def.durationMinutes} min
                    </h4>
                    {def.parts.map((p, pi) => (
                      <div key={pi} style={{ borderTop: "1px solid var(--border)", padding: "8px 0" }}>
                        <div style={{ fontWeight: 600, fontSize: ".9rem" }}>{p.name}</div>
                        <div style={{ color: "var(--muted)", fontSize: ".8rem", margin: "2px 0 6px" }}>{p.instruction}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                          {p.questions.map((q, qi) => {
                            const id = `${sk}:${pi}:${qi}`;
                            return (
                              <label
                                key={qi}
                                style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400, fontSize: ".84rem", minWidth: 0 }}
                              >
                                <input
                                  type="number"
                                  min="0"
                                  max="60"
                                  step="1"
                                  aria-label={`${p.name}: number of questions${p.questions.length > 1 ? " — " + fmtLabel(q.format) : ""}`}
                                  style={{ width: 70, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6 }}
                                  value={edits[id] !== undefined ? edits[id] : String(q.count)}
                                  onChange={(e) => setEdits((prev) => ({ ...prev, [id]: e.target.value }))}
                                />
                                <span style={{ overflowWrap: "anywhere" }}>
                                  {p.questions.length > 1 ? fmtLabel(q.format) : "questions"}
                                  {p.passage && qi === 0 ? " · with passage" : ""}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

              <p style={{ color: "var(--muted)", fontSize: ".78rem", margin: "4px 0" }}>0 removes a question type or a whole part.</p>
              {error ? (
                <p className="notice error" style={{ marginTop: 8 }}>
                  <svg className="icon"><use href="#icon-warning" /></svg> {error}
                </p>
              ) : (
                resolved && <p style={{ fontSize: ".9rem", margin: "8px 0" }}>Total: {resolved.totalQuestions} questions</p>
              )}
              <button
                type="button"
                className="btn"
                disabled={!resolved}
                onClick={() => resolved && onUse(resolved, buildSkeleton(resolved))}
              >
                Use this template
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

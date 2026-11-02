"use client";

// Khối "Start from a template" của builder đề mới (Phase 12 G2, mục 2.3).
// Chỉ hiện khi chương trình có testTemplates (registry). Chọn khuôn, chỉnh số câu từng phần,
// bấm "Use this template" -> gọi onUse(template đã resolve, khung dựng sẵn). Không lưu gì.
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client/api";
import { PROGRAMS } from "@/lib/curriculum";
import BankMatrix from "./BankMatrix";
import { buildFillPlan, planToPickRows, fillSkeletonFromBank, describeFill, defaultMatrixCell } from "@/lib/teacher/fillFromBank";
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
  // Ngân hàng câu hỏi (G4 bước 3)
  const canBank = !!(PROGRAMS[program] && PROGRAMS[program].questionBank);
  const [useBank, setUseBank] = useState(false);
  const [grade, setGrade] = useState("");
  const [allowPartSize, setAllowPartSize] = useState(false);
  const [matrix, setMatrix] = useState({}); // "skill:part:type" -> ô { any, nb, th, vd, vdc } (phần có đoạn văn: chuỗi mức độ)
  const [bankCounts, setBankCounts] = useState(null); // [{ format, difficulty, items, questions }]
  const [bankErr, setBankErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState(null); // { lines, warn }

  const base = key && TEMPLATES[key] && templates.some((t) => t.key === key) ? TEMPLATES[key] : null;

  // Số câu đang nhập -> counts cho resolveTemplate (ô trống / sai -> NaN để báo lỗi).
  const counts = useMemo(() => {
    const counts = {};
    if (!base) return counts;
    for (const [sk, def] of Object.entries(base.skills)) {
      counts[sk] = def.parts.map((p, pi) =>
        p.questions.map((q, qi) => {
          const raw = edits[`${sk}:${pi}:${qi}`];
          if (raw === undefined) return q.count;
          return raw.trim() === "" ? NaN : Number(raw);
        })
      );
    }
    return counts;
  }, [base, edits]);
  const { resolved, error } = useMemo(() => {
    if (!base) return { resolved: null, error: "" };
    const res = resolveTemplate(base.key, { counts, includeListening });
    return { resolved: res.template, error: res.error || "" };
  }, [base, counts, includeListening]);

  const gradeNum = Number(grade || (base && base.defaultGrade) || 0);
  const bankOn = canBank && useBank && !!base;
  const skillKeys = base ? Object.keys(base.skills).filter((sk) => !base.skills[sk].optional || includeListening) : [];
  const plan = useMemo(
    () => (bankOn && resolved ? buildFillPlan(base, counts, skillKeys, matrix) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bankOn, resolved, base, counts, includeListening, matrix]
  );

  // Số câu sẵn có trong ngân hàng của khối đang chọn (chỉ tải khi bật tuỳ chọn).
  useEffect(() => {
    if (!bankOn || !gradeNum) return undefined;
    let dead = false;
    setBankCounts(null);
    setBankErr("");
    api.teacher
      .questionBankCounts({ program, level: String(gradeNum) })
      .then((r) => !dead && setBankCounts(r.counts || []))
      .catch((e) => !dead && setBankErr(e.message || "Could not load the question bank."));
    return () => {
      dead = true;
    };
  }, [bankOn, gradeNum, program]);

  if (!templates.length) return null;

  // Số câu có sẵn cho (dạng, mức độ): "any" cộng mọi mức độ (kể cả chưa gắn nhãn). groups = đếm mục thay vì câu.
  function available(format, dk, groups) {
    if (!bankCounts) return null;
    return bankCounts
      .filter((c) => c.format === format && (dk === "any" || c.difficulty === dk))
      .reduce((n, c) => n + (groups ? c.items : c.questions), 0);
  }

  function pick(k) {
    setKey(k);
    setEdits({});
    setIncludeListening(false);
    setMatrix({});
    setGrade("");
    setSummary(null);
  }

  function setCell(key2, total, dk, value) {
    setMatrix((prev) => ({ ...prev, [key2]: { ...(prev[key2] || defaultMatrixCell(total)), [dk]: value } }));
  }

  // Bốc câu (chia lượt tối đa 50 hàng, loại mục đã bốc), đổ vào khung rồi giao cho builder.
  async function useIt() {
    if (!resolved) return;
    const built = buildSkeleton(resolved);
    if (!bankOn) {
      onUse(resolved, built);
      return;
    }
    if (!plan || plan.errors.length || !plan.rows.length) return;
    setBusy(true);
    setSummary(null);
    setBankErr("");
    try {
      const byId = new Map();
      const picked = [];
      const taken = [];
      const rows = planToPickRows(plan.rows);
      for (let i = 0; i < rows.length; i += 50) {
        const r = await api.teacher.pickQuestions({ program, level: gradeNum, rows: rows.slice(i, i + 50), excludeIds: taken });
        for (const it of r.items || []) byId.set(String(it._id), it);
        for (const row of r.rows || []) {
          picked.push((row.itemIds || []).map((id) => byId.get(String(id))).filter(Boolean));
          taken.push(...(row.itemIds || []).map(String));
        }
      }
      const res = fillSkeletonFromBank(built, plan.rows, picked, { allowPartSize });
      const ok = await onUse(resolved, { skills: res.skills, durations: built.durations }, { grade: gradeNum });
      if (ok !== false) setSummary({ lines: describeFill(res), warn: res.shortages.length > 0 || res.flags.length > 0 });
    } catch (e) {
      setBankErr(e.message || "Could not pick questions.");
    } finally {
      setBusy(false);
    }
  }

  const bankLevels = (PROGRAMS[program] && PROGRAMS[program].fixedLevels) || [];

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
                        {bankOn && (
                          <BankMatrix
                            sk={sk}
                            pi={pi}
                            part={p}
                            counts={counts}
                            matrix={matrix}
                            setMatrix={setMatrix}
                            setCell={setCell}
                            available={available}
                            loaded={!!bankCounts}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ))}

              <p style={{ color: "var(--muted)", fontSize: ".78rem", margin: "4px 0" }}>0 removes a question type or a whole part.</p>
              {canBank && (
                <div style={{ margin: "10px 0", padding: "8px 0", borderTop: "1px solid var(--border)" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                    <input type="checkbox" checked={useBank} onChange={(e) => setUseBank(e.target.checked)} />
                    Fill from question bank
                  </label>
                  {useBank && (
                    <div style={{ marginTop: 8 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 400, flexWrap: "wrap" }}>
                        Grade
                        <select className="select-inline" value={String(gradeNum)} onChange={(e) => setGrade(e.target.value)}>
                          {bankLevels.map((l) => (
                            <option key={l} value={l}>
                              Grade {l}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label style={{ display: "flex", alignItems: "flex-start", gap: 6, fontWeight: 400, fontSize: ".84rem", marginTop: 8 }}>
                        <input type="checkbox" style={{ marginTop: 3 }} checked={allowPartSize} onChange={(e) => setAllowPartSize(e.target.checked)} />
                        <span>Allow part size to follow the passage (a part with a passage may end up with a different number of questions)</span>
                      </label>
                      <p style={{ color: "var(--muted)", fontSize: ".78rem", margin: "6px 0 0" }}>
                        Set how many questions of each difficulty to pick under each question type. Questions are copied into the test; missing ones stay blank.
                      </p>
                      {bankErr && (
                        <p className="notice error" style={{ marginTop: 8 }}>
                          <svg className="icon"><use href="#icon-warning" /></svg> {bankErr}
                        </p>
                      )}
                      {plan && plan.errors.length > 0 && (
                        <div className="notice error" style={{ marginTop: 8 }}>
                          {plan.errors.map((m, i) => (
                            <div key={i} style={{ overflowWrap: "anywhere" }}>{m}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
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
                disabled={!resolved || busy || (bankOn && (!plan || plan.errors.length > 0))}
                onClick={useIt}
              >
                {busy ? "Picking questions…" : bankOn ? "Use this template and fill it" : "Use this template"}
              </button>
              {summary && (
                <div className={"notice " + (summary.warn ? "warn" : "info")} style={{ marginTop: 10 }}>
                  {summary.lines.map((l, i) => (
                    <div key={i} style={{ overflowWrap: "anywhere" }}>{l}</div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

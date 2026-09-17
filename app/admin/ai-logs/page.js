"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { DashStat, timeAgo } from "@/components/dash/DashKit";

const PURPOSE_LABEL = {
  "grading.writing": "Grading · Writing",
  "grading.speaking": "Grading · Speaking",
  "generate.grammar": "Generate · Grammar theory",
  unknown: "Unknown",
};
const purposeLabel = (p) => PURPOSE_LABEL[p] || p;
const purposePill = (p) => (String(p).startsWith("grading") ? "pill-info" : String(p).startsWith("generate") ? "pill-ok" : "pill-muted");

const fmtNum = (n) => Number(n || 0).toLocaleString("en-US");
const fmtMs = (ms) => (ms == null ? "—" : ms >= 1000 ? (ms / 1000).toFixed(1) + "s" : Math.round(ms) + "ms");
const fmtBytes = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.round((b || 0) / 1024) + " KB");

// "Ở đâu": Unit/Mock Test + đề + học sinh (chấm bài) hoặc chủ đề (soạn bài).
function Where({ c }) {
  if (!c) return null;
  const place = c.unitName || c.testTitle || "";
  const kind = c.testTitle ? "Mock test" : c.unitName ? "Unit" : "";
  return (
    <div style={{ lineHeight: 1.35 }}>
      {place ? (
        <div>
          <span style={{ color: "var(--muted)", fontSize: ".74rem" }}>{kind}{c.level ? ` · L${c.level}` : ""} </span>
          {place}
        </div>
      ) : (
        <span style={{ color: "var(--muted)" }}>—</span>
      )}
      {(c.promptTitle || c.studentName) && (
        <div style={{ fontSize: ".76rem", color: "var(--muted)" }}>
          {c.promptTitle}
          {c.promptTitle && c.studentName ? " · " : ""}
          {c.studentName}
          {c.attemptNumber > 1 ? ` (attempt ${c.attemptNumber})` : ""}
        </div>
      )}
      {Array.isArray(c.topics) && c.topics.length > 0 && (
        <div style={{ fontSize: ".76rem", color: "var(--muted)" }}>{c.topics.join(" · ")}</div>
      )}
    </div>
  );
}

function Block({ title, text, note }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h4 style={{ margin: 0 }}>
          {title} <span style={{ color: "var(--muted)", fontWeight: 500, fontSize: ".78rem" }}>{fmtNum(text.length)} chars{note ? ` · ${note}` : ""}</span>
        </h4>
        <button
          type="button"
          className="btn secondary sm"
          onClick={() => {
            navigator.clipboard?.writeText(text).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            });
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        style={{
          margin: "6px 0 0",
          maxHeight: 320,
          overflow: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 10,
          fontSize: ".78rem",
        }}
      >
        {text}
      </pre>
    </div>
  );
}

// Response là JSON thô -> in đẹp cho dễ đọc; không parse được thì giữ nguyên.
function pretty(s) {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

function LogDetail({ id, onClose }) {
  const [log, setLog] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api.admin.aiLog(id).then((r) => setLog(r.log)).catch((e) => setErr(e.message));
  }, [id]);

  return (
    <div className="modal-overlay" onClick={(e) => e.target.classList.contains("modal-overlay") && onClose()}>
      <div className="modal-box" style={{ maxWidth: 900 }}>
        <div className="modal-head">
          <h3>AI call {log ? `· ${purposeLabel(log.purpose)}` : ""}</h3>
          <button type="button" className="icon-btn" onClick={onClose}>
            <svg className="icon"><use href="#icon-cross" /></svg>
          </button>
        </div>
        <div className="modal-body">
          {err && <div className="notice error">{err}</div>}
          {!log && !err && <div className="notice info">Loading…</div>}
          {log && (
            <>
              {!log.ok && (
                <div className="notice error" style={{ marginTop: 0 }}>
                  <svg className="icon"><use href="#icon-warning" /></svg> {log.error || "Failed"}
                </div>
              )}
              <table className="admin-table">
                <tbody>
                  <tr><th style={{ width: 150 }}>When</th><td>{new Date(log.at).toLocaleString()}</td></tr>
                  <tr>
                    <th>Who</th>
                    <td>
                      <span className="pill pill-muted">{log.actorRole}</span> {log.actorName || "—"}
                      {log.impBy && <span style={{ color: "var(--red)", fontSize: ".78rem" }}> (admin acting as this user)</span>}
                    </td>
                  </tr>
                  <tr><th>Called from</th><td><code>{log.source || "—"}</code></td></tr>
                  <tr><th>Where</th><td><Where c={log.context} /></td></tr>
                  <tr>
                    <th>Model</th>
                    <td>
                      <code>{log.model || "—"}</code>
                      {log.attempts && log.attempts.length > 0 && (
                        <div style={{ marginTop: 4, fontSize: ".78rem" }}>
                          {log.attempts.map((a, i) => (
                            <div key={i} style={{ color: a.ok ? "var(--green)" : "var(--red)" }}>
                              {i + 1}. {a.model} — {a.ok ? "OK" : `failed${a.httpStatus ? ` (${a.httpStatus})` : ""}`} · {fmtMs(a.ms)}
                              {a.error ? ` · ${a.error}` : ""}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <th>Tokens</th>
                    <td>
                      {fmtNum(log.totalTokens)} total · {fmtNum(log.promptTokens)} input · {fmtNum(log.outputTokens)} output
                      {log.thoughtsTokens ? ` · ${fmtNum(log.thoughtsTokens)} thinking` : ""}
                    </td>
                  </tr>
                  <tr><th>Duration</th><td>{fmtMs(log.durationMs)}</td></tr>
                  {log.audio && (
                    <tr><th>Audio sent</th><td>{log.audio.mimeType} · {fmtBytes(log.audio.bytes)} (file not stored)</td></tr>
                  )}
                </tbody>
              </table>

              <Block title="Response" text={pretty(log.response)} />
              <Block title="Prompt" text={log.prompt} />
              <Block title="System instruction" text={log.systemInstruction} note="same text is shared by every call that uses it" />
              {log.context && Object.keys(log.context).length > 0 && (
                <Block title="Context" text={JSON.stringify(log.context, null, 2)} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminAiLogsPage() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [days, setDays] = useState("7");
  const [purpose, setPurpose] = useState("");
  const [status, setStatus] = useState("");
  const [model, setModel] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const params = { days, page };
      if (purpose) params.purpose = purpose;
      if (status) params.status = status;
      if (model) params.model = model;
      if (q.trim()) params.q = q.trim();
      api.admin
        .aiLogs(params)
        .then((r) => {
          setData(r);
          setErr("");
        })
        .catch((e) => setErr(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [days, purpose, status, model, q, page]);

  const reset = (fn) => (e) => {
    fn(e.target.value);
    setPage(0);
  };

  const rows = data?.rows || [];
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const tot = data?.stats?.totals;

  return (
    <section>
      <div className="page-head">
        <div className="head-left">
          <div className="page-head-icon"><svg className="icon"><use href="#icon-sparkles" /></svg></div>
          <div>
            <h1>AI Log</h1>
            <p className="page-sub">
              Every call to the AI model — who made it, for which lesson, prompt, response, tokens, time and errors.
              Kept for {data?.retentionDays ?? 30} days.
            </p>
          </div>
        </div>
      </div>

      {err && <div className="notice error"><svg className="icon"><use href="#icon-warning" /></svg> {err}</div>}

      <div className="page-head" style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select className="select-inline" value={days} onChange={reset(setDays)}>
            <option value="1">Last 24 hours</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
          <select className="select-inline" value={purpose} onChange={reset(setPurpose)}>
            <option value="">All purposes</option>
            <option value="grading">All grading</option>
            <option value="generate">All generation</option>
            {(data?.purposes || []).map((p) => (
              <option key={p} value={p}>{purposeLabel(p)}</option>
            ))}
          </select>
          <select className="select-inline" value={status} onChange={reset(setStatus)}>
            <option value="">Any status</option>
            <option value="ok">Succeeded</option>
            <option value="error">Failed</option>
          </select>
          <select className="select-inline" value={model} onChange={reset(setModel)}>
            <option value="">All models</option>
            {(data?.models || []).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <input
            className="select-inline"
            placeholder="Search teacher, unit, test, student, error…"
            value={q}
            onChange={reset(setQ)}
            style={{ minWidth: 240 }}
          />
        </div>
      </div>

      {!data && !err && <div className="notice info">Loading…</div>}

      {data && tot && (
        <>
          <div className="dash-stats">
            <DashStat icon="sparkles" value={fmtNum(tot.calls)} label="AI calls" hint={`${fmtNum(tot.fallbacks)} needed a fallback model`} />
            <DashStat
              icon="warning"
              value={fmtNum(tot.errors)}
              label="Failed"
              tone={tot.errors > 0 ? "pink" : ""}
              hint={tot.calls ? `${Math.round((tot.errors / tot.calls) * 100)}% of calls` : ""}
              onClick={tot.errors > 0 ? () => { setStatus("error"); setPage(0); } : undefined}
            />
            <DashStat
              icon="chart-bar"
              value={fmtNum(tot.totalTokens)}
              label="Tokens"
              hint={`${fmtNum(tot.promptTokens)} in · ${fmtNum(tot.outputTokens)} out`}
            />
            <DashStat icon="clock" value={fmtMs(tot.avgMs)} label="Avg time" hint={`slowest ${fmtMs(tot.maxMs)}`} />
          </div>

          {(data.stats.byPurpose.length > 1 || data.stats.byModel.length > 1) && (
            <div className="card" style={{ overflowX: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
                {[
                  ["By purpose", data.stats.byPurpose, purposeLabel],
                  ["By model", data.stats.byModel, (m) => m || "—"],
                ].map(([title, list, label]) => (
                  <div key={title}>
                    <h4 style={{ margin: "0 0 6px" }}>{title}</h4>
                    <table className="admin-table">
                      <thead>
                        <tr><th></th><th>Calls</th><th>Failed</th><th>Tokens</th><th>Avg</th></tr>
                      </thead>
                      <tbody>
                        {list.map((r) => (
                          <tr key={r._id || "none"}>
                            <td>{label(r._id)}</td>
                            <td>{fmtNum(r.calls)}</td>
                            <td style={{ color: r.errors ? "var(--red)" : undefined }}>{fmtNum(r.errors)}</td>
                            <td>{fmtNum(r.totalTokens)}</td>
                            <td>{fmtMs(r.avgMs)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card" style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Purpose</th>
                  <th>Who</th>
                  <th>Where</th>
                  <th>Model</th>
                  <th style={{ textAlign: "right" }}>Tokens</th>
                  <th style={{ textAlign: "right" }}>Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id} onClick={() => setOpenId(r._id)} style={{ cursor: "pointer" }}>
                    <td style={{ whiteSpace: "nowrap" }} title={new Date(r.at).toLocaleString()}>{timeAgo(r.at)}</td>
                    <td><span className={"pill " + purposePill(r.purpose)}>{purposeLabel(r.purpose)}</span></td>
                    <td>
                      {r.actorName || <span style={{ color: "var(--muted)" }}>—</span>}
                      <div style={{ fontSize: ".74rem", color: "var(--muted)" }}>
                        {r.actorRole}
                        {r.impBy ? " · via admin" : ""}
                      </div>
                    </td>
                    <td style={{ maxWidth: 300 }}><Where c={r.context} /></td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <code style={{ fontSize: ".76rem" }}>{r.model || "—"}</code>
                      {r.attempts && r.attempts.length > 1 && (
                        <div style={{ fontSize: ".72rem", color: "var(--muted)" }}>after {r.attempts.length - 1} fallback{r.attempts.length > 2 ? "s" : ""}</div>
                      )}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{r.totalTokens ? fmtNum(r.totalTokens) : "—"}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{fmtMs(r.durationMs)}</td>
                    <td>
                      {r.ok ? (
                        <span className="pill pill-ok">OK</span>
                      ) : (
                        <span className="pill pill-danger" title={r.error}>Failed</span>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--muted)", padding: 20 }}>No AI calls in this range.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
              <button className="btn secondary sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</button>
              <span style={{ fontSize: ".85rem", color: "var(--muted)" }}>Page {page + 1} / {pages} · {fmtNum(data.total)} calls</span>
              <button className="btn secondary sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}

      {openId && <LogDetail id={openId} onClose={() => setOpenId(null)} />}
    </section>
  );
}

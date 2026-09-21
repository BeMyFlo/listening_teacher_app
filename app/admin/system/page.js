"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { useDialog } from "@/components/ui/Dialog";
import { CardHead } from "@/components/dash/DashKit";
import { BudgetBar, fmtVnd } from "@/components/admin/AiBudget";

function Flag({ on, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
      <span className={"pill " + (on ? "pill-ok" : "pill-danger")}>{on ? "configured" : "missing"}</span>
      <span style={{ fontSize: ".9rem" }}>{label}</span>
    </div>
  );
}

const priceStr = (v) => (v == null ? "" : String(v));

function AiBudgetCard({ budget, chain, onSaved }) {
  const dialog = useDialog();
  const [limit, setLimit] = useState(budget.monthlyLimitUsd == null ? "" : String(budget.monthlyLimitUsd));
  const [rate, setRate] = useState(String(budget.usdToVnd));
  // Model có giá + model đang nằm trong chuỗi chấm bài mà chưa có giá.
  const ids = [...new Set([...Object.keys(budget.prices), ...chain])];
  const [prices, setPrices] = useState(() =>
    Object.fromEntries(
      ids.map((id) => {
        const p = budget.prices[id] || {};
        return [id, { input: priceStr(p.input), audio: priceStr(p.audio), output: priceStr(p.output) }];
      })
    )
  );
  const [busy, setBusy] = useState(false);

  const setPrice = (id, k, v) => setPrices((ps) => ({ ...ps, [id]: { ...ps[id], [k]: v } }));
  const resetPrice = (id) => {
    const d = budget.defaultPrices[id];
    if (d) setPrices((ps) => ({ ...ps, [id]: { input: priceStr(d.input), audio: priceStr(d.audio), output: priceStr(d.output) } }));
  };
  const bump = (usd) => {
    const cur = limit === "" ? budget.spend.costUsd : Number(limit) || 0;
    setLimit(String(Math.round((cur + usd) * 100) / 100));
  };

  async function save() {
    setBusy(true);
    try {
      const out = {};
      for (const [id, p] of Object.entries(prices)) {
        if (p.input === "" && p.output === "") continue; // chưa nhập giá -> dùng giá cao nhất
        out[id] = { input: p.input, audio: p.audio === "" ? p.input : p.audio, output: p.output };
      }
      await api.admin.saveAiBudget({ monthlyLimitUsd: limit.trim() === "" ? null : limit, usdToVnd: rate, prices: out });
      dialog.toast("AI budget saved");
      onSaved();
    } catch (e) {
      dialog.alert({ tone: "error", title: "Save failed", message: e.message });
    } finally {
      setBusy(false);
    }
  }

  const cell = { width: 72, padding: "4px 6px", fontSize: ".82rem" };
  return (
    <div className="card">
      <CardHead icon="chart-bar" title="AI budget & pricing" />
      <BudgetBar
        spentUsd={budget.spend.costUsd}
        limitUsd={budget.monthlyLimitUsd}
        usdToVnd={budget.usdToVnd}
        month={budget.spend.month}
        blocked={budget.spend.blocked}
      />
      <p style={{ fontSize: ".78rem", color: "var(--muted)", margin: "6px 0 12px" }}>
        {budget.spend.calls} AI call{budget.spend.calls === 1 ? "" : "s"} this month. Cost is estimated from token usage
        at Google&apos;s paid-tier prices below — if the API key is on the free tier, the real bill is lower.
      </p>

      <div className="builder-2col" style={{ marginBottom: 10 }}>
        <div className="form-row" style={{ marginBottom: 0 }}>
          <label>Monthly limit (USD) — empty = no limit</label>
          <input type="number" min="0" step="0.5" placeholder="No limit" value={limit} onChange={(e) => setLimit(e.target.value)} />
          {limit !== "" && Number(limit) >= 0 && (
            <span style={{ fontSize: ".78rem", color: "var(--muted)" }}>≈ {fmtVnd(Number(limit), Number(rate))}</span>
          )}
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            {[1, 5, 10].map((v) => (
              <button key={v} type="button" className="btn secondary sm" onClick={() => bump(v)}>+${v}</button>
            ))}
          </div>
        </div>
        <div className="form-row" style={{ marginBottom: 0 }}>
          <label>Exchange rate (VND per 1 USD)</label>
          <input type="number" min="1" step="100" value={rate} onChange={(e) => setRate(e.target.value)} />
          <span style={{ fontSize: ".78rem", color: "var(--muted)" }}>Only used to show amounts in VND.</span>
        </div>
      </div>

      <details>
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: ".86rem" }}>Prices per model (USD per 1M tokens)</summary>
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table className="admin-table">
            <thead>
              <tr><th>Model</th><th>Input</th><th>Audio in</th><th>Output*</th><th></th></tr>
            </thead>
            <tbody>
              {ids.map((id) => {
                const p = prices[id];
                const d = budget.defaultPrices[id];
                const custom = budget.overridden.includes(id);
                const missing = !budget.prices[id];
                return (
                  <tr key={id}>
                    <td>
                      <code style={{ fontSize: ".78rem" }}>{id}</code>
                      {custom && <span className="pill pill-info" style={{ marginLeft: 6 }}>custom</span>}
                      {missing && <span className="pill pill-warn" style={{ marginLeft: 6 }}>no price — counted at the highest rate</span>}
                    </td>
                    <td><input type="number" min="0" step="0.01" style={cell} value={p.input} onChange={(e) => setPrice(id, "input", e.target.value)} /></td>
                    <td><input type="number" min="0" step="0.01" style={cell} value={p.audio} onChange={(e) => setPrice(id, "audio", e.target.value)} /></td>
                    <td><input type="number" min="0" step="0.01" style={cell} value={p.output} onChange={(e) => setPrice(id, "output", e.target.value)} /></td>
                    <td>{d && custom && <button type="button" className="btn secondary sm" onClick={() => resetPrice(id)}>Reset</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: ".76rem", color: "var(--muted)", margin: "6px 0 0" }}>
          *Output includes &quot;thinking&quot; tokens. Defaults from ai.google.dev/gemini-api/docs/pricing (checked Sep 2026).
        </p>
      </details>

      <button className="btn" style={{ marginTop: 12 }} disabled={busy} onClick={save}>Save budget</button>
    </div>
  );
}

export default function AdminSystemPage() {
  const dialog = useDialog();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [models, setModels] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    api.admin.system().then((d) => { setData(d); setModels((d.ai.models || []).join("\n")); }).catch((e) => setErr(e.message));
  }
  useEffect(load, []);

  async function saveModels() {
    setBusy(true);
    try {
      await api.admin.saveAiModels(models.split("\n").map((s) => s.trim()).filter(Boolean));
      dialog.toast("AI model chain saved");
      load();
    } catch (e) {
      dialog.alert({ tone: "error", title: "Save failed", message: e.message });
    } finally { setBusy(false); }
  }

  async function runScan() {
    setBusy(true);
    try {
      const r = await api.admin.runDeadlineScan();
      dialog.alert({ title: "Deadline scan finished", message: `Scanned ${r.scan?.scanned ?? "?"} students, ${r.scan?.ok ?? "?"} ok. Email jobs: ${JSON.stringify(r.jobs)}` });
    } catch (e) {
      dialog.alert({ tone: "error", title: "Scan failed", message: e.message });
    } finally { setBusy(false); }
  }

  const ig = data?.integrations || {};

  return (
    <section>
      <div className="page-head">
        <div className="head-left">
          <div className="page-head-icon"><svg className="icon"><use href="#icon-settings" /></svg></div>
          <div>
            <h1>System</h1>
            <p className="page-sub">Integration status, AI grading models, AI budget, maintenance.</p>
          </div>
        </div>
      </div>

      {err && <div className="notice error"><svg className="icon"><use href="#icon-warning" /></svg> {err}</div>}
      {!data && !err && <div className="notice info">Loading…</div>}

      {data && (
        <div className="dash-row-2">
          <div className="card">
            <CardHead icon="shield" title="Integrations" />
            <Flag on={ig.mongodb} label="MongoDB (MONGODB_URI)" />
            <Flag on={ig.jwtSecret} label="JWT secret" />
            <Flag on={ig.gemini} label="Gemini AI grading (GEMINI_API_KEY)" />
            <Flag on={ig.email} label="Email — Gmail SMTP (GMAIL_USER / GMAIL_APP_PASSWORD)" />
            <Flag on={ig.cloudinary} label="Cloudinary API secret" />
            <Flag on={ig.cronSecret} label="CRON_SECRET" />
            <Flag on={ig.adminBootstrap} label="ADMIN_PASSWORD (admin bootstrap)" />
            <Flag on={ig.teacherBootstrap} label="TEACHER_PASSWORD (teacher bootstrap)" />
            <div style={{ fontSize: ".82rem", color: "var(--muted)", marginTop: 10 }}>
              APP_URL: {ig.appUrl || "(not set)"} · Node {data.runtime.node} · {data.runtime.env}
              {data.runtime.region ? " · " + data.runtime.region : ""}
            </div>
          </div>

          <div className="dash-col">
            <div className="card">
              <CardHead icon="sparkles" title="AI grading model chain" />
              <p style={{ fontSize: ".82rem", color: "var(--muted)", margin: "0 0 8px" }}>
                One model per line, tried in order. Known: {data.ai.known.map((m) => m.id).join(", ")}.
              </p>
              <textarea rows={4} value={models} onChange={(e) => setModels(e.target.value)}
                style={{ width: "100%", fontFamily: "monospace", fontSize: ".85rem" }} />
              <button className="btn" style={{ marginTop: 8 }} disabled={busy} onClick={saveModels}>Save models</button>
              <p style={{ fontSize: ".78rem", color: "var(--muted)", marginTop: 6 }}>Env default: {data.ai.envChain.join(" → ")}</p>
            </div>

            <AiBudgetCard
              key={JSON.stringify(data.ai.budget)}
              budget={data.ai.budget}
              chain={data.ai.models || []}
              onSaved={load}
            />

            <div className="card">
              <CardHead icon="refresh" title="Maintenance" />
              <button className="btn secondary" disabled={busy} onClick={runScan}>
                <svg className="icon"><use href="#icon-refresh" /></svg> Run deadline scan now
              </button>
              <p style={{ fontSize: ".8rem", color: "var(--muted)", marginTop: 8 }}>
                Normally runs daily via cron. Generates "deadline soon" notifications and flushes pending deadline emails.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { useDialog } from "@/components/ui/Dialog";
import { CardHead } from "@/components/dash/DashKit";

function Flag({ on, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
      <span className={"pill " + (on ? "pill-ok" : "pill-danger")}>{on ? "configured" : "missing"}</span>
      <span style={{ fontSize: ".9rem" }}>{label}</span>
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
            <p className="page-sub">Integration status, AI grading models, maintenance.</p>
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
                One model per line, tried in order. Known: {data.ai.known.join(", ")}.
              </p>
              <textarea rows={4} value={models} onChange={(e) => setModels(e.target.value)}
                style={{ width: "100%", fontFamily: "monospace", fontSize: ".85rem" }} />
              <button className="btn" style={{ marginTop: 8 }} disabled={busy} onClick={saveModels}>Save models</button>
              <p style={{ fontSize: ".78rem", color: "var(--muted)", marginTop: 6 }}>Env default: {data.ai.envChain.join(" → ")}</p>
            </div>

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

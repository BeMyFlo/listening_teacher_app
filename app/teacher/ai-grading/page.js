"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";

export default function AiGradingSettingsPage() {
  const [models, setModels] = useState(null);
  const [configured, setConfigured] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.teacher
      .aiSettings()
      .then((d) => {
        setModels(d.models || []);
        setConfigured(d.geminiConfigured);
      })
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="tab-panel active">
      <div className="page-head">
        <div className="head-left">
          <div className="page-head-icon"><svg className="icon"><use href="#icon-sparkles" /></svg></div>
          <div>
            <h1>AI Grading</h1>
            <p className="page-sub">
              The Gemini models the "AI grade" button uses. They are tried top to bottom — if one
              runs out of free quota, the next one is used automatically.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <p className="notice info">
          <svg className="icon"><use href="#icon-info" /></svg>{" "}
          AI grading models are managed by the platform administrator.
        </p>
        {!configured && (
          <p className="notice warn">
            <svg className="icon"><use href="#icon-warning" /></svg>{" "}
            <code>GEMINI_API_KEY</code> is not set — AI grading is disabled until it is added to the
            environment variables.
          </p>
        )}
        {err && (
          <div className="notice error">
            <svg className="icon"><use href="#icon-warning" /></svg> {err}
          </div>
        )}
        {models === null && !err && <p>Loading…</p>}

        {models && (
          <>
            <h3 style={{ marginTop: 0 }}>Fallback order</h3>
            {models.length === 0 && <p className="notice info">No models are configured.</p>}
            <ol className="ai-model-list">
              {models.map((m, i) => (
                <li key={m}>
                  <span className="ai-model-id">{m}</span>
                  {i === 0 && <span className="pill pill-ok">primary</span>}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}

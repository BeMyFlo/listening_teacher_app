"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { useDialog } from "@/components/ui/Dialog";

export default function AiGradingSettingsPage() {
  const dialog = useDialog();
  const [models, setModels] = useState(null);
  const [known, setKnown] = useState([]);
  const [envDefault, setEnvDefault] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function load() {
    api.teacher
      .aiSettings()
      .then((d) => {
        setModels(d.models || []);
        setKnown(d.known || []);
        setEnvDefault(d.envDefault || []);
        setConfigured(d.geminiConfigured);
      })
      .catch((e) => setErr(e.message));
  }
  useEffect(load, []);

  const move = (i, dir) => {
    setModels((m) => {
      const n = [...m];
      const j = i + dir;
      if (j < 0 || j >= n.length) return n;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  };
  const removeAt = (i) => setModels((m) => m.filter((_, k) => k !== i));
  const add = (id) => {
    const s = String(id || "").trim();
    if (!s) return;
    setModels((m) => (m.includes(s) ? m : [...m, s]));
    setCustom("");
  };

  async function save() {
    setSaving(true);
    setErr("");
    try {
      const r = await api.teacher.saveAiSettings(models);
      setModels(r.models);
      dialog.toast("AI grading models saved");
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  function resetDefault() {
    setModels([...envDefault]);
  }

  return (
    <div className="tab-panel active">
      <div className="page-head">
        <div className="head-left">
          <div className="page-head-icon"><svg className="icon"><use href="#icon-sparkles" /></svg></div>
          <div>
            <h1>AI Grading</h1>
            <p className="page-sub">
              Which Gemini models the "AI grade" button uses. They are tried top to bottom — if one
              runs out of free quota, the next one is used automatically.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
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
        {models === null && <p>Loading…</p>}

        {models && (
          <>
            <h3 style={{ marginTop: 0 }}>Fallback order</h3>
            {models.length === 0 && <p className="notice info">No models — add at least one below.</p>}
            <ol className="ai-model-list">
              {models.map((m, i) => (
                <li key={m}>
                  <span className="ai-model-id">{m}</span>
                  {i === 0 && <span className="pill pill-ok">primary</span>}
                  <span className="ai-model-actions">
                    <button type="button" className="icon-btn" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                      <svg className="icon" style={{ transform: "rotate(90deg)" }}><use href="#icon-arrow-left" /></svg>
                    </button>
                    <button type="button" className="icon-btn" title="Move down" disabled={i === models.length - 1} onClick={() => move(i, 1)}>
                      <svg className="icon" style={{ transform: "rotate(-90deg)" }}><use href="#icon-arrow-left" /></svg>
                    </button>
                    <button type="button" className="icon-btn danger" title="Remove" onClick={() => removeAt(i)}>
                      <svg className="icon"><use href="#icon-trash" /></svg>
                    </button>
                  </span>
                </li>
              ))}
            </ol>

            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <button type="button" className="btn" disabled={saving} onClick={save}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button type="button" className="btn secondary" onClick={resetDefault}>
                Reset to default
              </button>
            </div>

            <h3 style={{ marginTop: 24 }}>Add a model</h3>
            <p className="page-sub" style={{ margin: "0 0 10px" }}>
              Suggested models (must support text output, JSON schema and audio). Model ids can change
              over time — check <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer">Google AI Studio</a>.
            </p>
            <div className="ai-model-suggest">
              {known.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  className="ai-suggest-chip"
                  disabled={models.includes(k.id)}
                  onClick={() => add(k.id)}
                  title={k.note}
                >
                  + {k.label} <span>{k.id}</span>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input
                type="text"
                placeholder="custom model id, e.g. gemini-3.5-flash"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add(custom)}
                style={{ flex: 1, maxWidth: 340, padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8 }}
              />
              <button type="button" className="btn secondary" onClick={() => add(custom)}>Add</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { useDialog } from "@/components/ui/Dialog";
import { applyTheme, cacheTheme } from "@/components/ThemeLoader";
import { THEME_VARS, resolveTheme, themeWarnings } from "@/lib/theme";

const LOCALES = [
  { value: "vi", label: "Vietnamese" },
  { value: "en", label: "English" },
];
const GROUPS = ["Brand", "Surface", "Text", "Status"];

function timezoneOptions(current) {
  const supported = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return [...new Set([current, "Asia/Ho_Chi_Minh", "UTC", ...supported].filter(Boolean))];
}

export default function WorkspaceSettingsPage() {
  const dialog = useDialog();
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [general, setGeneral] = useState({ name: "", locale: "vi", timezone: "Asia/Ho_Chi_Minh" });
  const [draft, setDraft] = useState({}); // chỉ các màu đã đổi
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const savedTheme = useRef({});

  useEffect(() => {
    api.teacher
      .workspaceSettings()
      .then((d) => {
        setGeneral({ name: d.workspace.name, locale: d.workspace.locale, timezone: d.workspace.timezone });
        setDraft(d.theme || {});
        savedTheme.current = d.theme || {};
        setCanEdit(d.canEdit);
        setLoaded(true);
      })
      .catch((e) => setErr(e.message));
    // Rời trang mà chưa lưu -> trả về theme đã lưu, không để màu nháp ở lại.
    return () => applyTheme(savedTheme.current);
  }, []);

  const effective = useMemo(() => resolveTheme(draft), [draft]);
  const warnings = useMemo(() => themeWarnings(draft), [draft]);
  const zones = useMemo(() => timezoneOptions(general.timezone), [general.timezone]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedTheme.current);

  function setColor(def, value) {
    const hex = value.toUpperCase();
    const next = { ...draft };
    if (hex === def.default) delete next[def.key];
    else next[def.key] = hex;
    setDraft(next);
    applyTheme(next);
  }
  function resetColor(def) {
    const next = { ...draft };
    delete next[def.key];
    setDraft(next);
    applyTheme(next);
  }
  function resetAll() {
    setDraft({});
    applyTheme({});
  }

  async function saveGeneral(e) {
    e.preventDefault();
    setSavingGeneral(true);
    try {
      const d = await api.teacher.saveWorkspaceSettings({
        name: general.name,
        locale: general.locale,
        timezone: general.timezone,
      });
      setGeneral({ name: d.workspace.name, locale: d.workspace.locale, timezone: d.workspace.timezone });
      dialog.toast("Workspace settings saved");
    } catch (e2) {
      dialog.alert({ tone: "error", title: "Could not save", message: e2.message });
    } finally {
      setSavingGeneral(false);
    }
  }

  async function saveTheme() {
    setSavingTheme(true);
    try {
      const d = await api.teacher.saveWorkspaceSettings({ theme: draft });
      savedTheme.current = d.theme;
      setDraft(d.theme);
      applyTheme(d.theme);
      cacheTheme("teacher", d.theme);
      dialog.toast("Colors saved");
    } catch (e) {
      dialog.alert({ tone: "error", title: "Could not save colors", message: e.message });
    } finally {
      setSavingTheme(false);
    }
  }

  return (
    <div className="tab-panel active">
      <div className="page-head">
        <div className="head-left">
          <div className="page-head-icon"><svg className="icon"><use href="#icon-settings" /></svg></div>
          <div>
            <h1>Workspace</h1>
            <p className="page-sub">Your center&apos;s name, language and how the app looks for you and your students.</p>
          </div>
        </div>
      </div>

      {err && <div className="notice error"><svg className="icon"><use href="#icon-warning" /></svg> {err}</div>}
      {!loaded && !err && <div className="notice info">Loading…</div>}

      {loaded && (
        <>
          {!canEdit && (
            <p className="notice info">
              <svg className="icon"><use href="#icon-info" /></svg> Only the workspace owner can change these settings.
            </p>
          )}

          <div className="card" style={{ marginBottom: 14 }}>
            <h3 style={{ marginTop: 0 }}>General</h3>
            <form onSubmit={saveGeneral} style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label>Workspace name</label>
                <input type="text" value={general.name} maxLength={140} disabled={!canEdit} required
                  onChange={(e) => setGeneral((g) => ({ ...g, name: e.target.value }))} />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label>Language</label>
                <select value={general.locale} disabled={!canEdit} onChange={(e) => setGeneral((g) => ({ ...g, locale: e.target.value }))}>
                  {LOCALES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label>Time zone</label>
                <select value={general.timezone} disabled={!canEdit} onChange={(e) => setGeneral((g) => ({ ...g, timezone: e.target.value }))}>
                  {zones.map((z) => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>
              {canEdit && (
                <div style={{ display: "flex", alignItems: "end" }}>
                  <button type="submit" className="btn" disabled={savingGeneral || !general.name.trim()}>
                    {savingGeneral ? "Saving…" : "Save"}
                  </button>
                </div>
              )}
            </form>
          </div>

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Appearance</h3>
              {canEdit && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="btn secondary" disabled={!Object.keys(draft).length} onClick={resetAll}>
                    Reset all
                  </button>
                  <button type="button" className="btn" disabled={savingTheme || !dirty} onClick={saveTheme}>
                    {savingTheme ? "Saving…" : "Save colors"}
                  </button>
                </div>
              )}
            </div>
            <p className="page-sub" style={{ margin: "6px 0 14px" }}>
              Pick your own colors — changes preview instantly. Your teachers and students see them once saved.
              Anything you don&apos;t change keeps the default look.
            </p>

            {warnings.length > 0 && (
              <div className="notice warn">
                <svg className="icon"><use href="#icon-warning" /></svg>{" "}
                {warnings.join(" ")} You can still save, or reset a color to fix it.
              </div>
            )}

            {GROUPS.map((g) => (
              <div key={g} style={{ marginBottom: 14 }}>
                <h4 style={{ margin: "10px 0 6px", color: "var(--muted)", fontSize: ".78rem", letterSpacing: ".05em" }}>{g.toUpperCase()}</h4>
                {THEME_VARS.filter((d) => d.group === g).map((d) => {
                  const changed = d.key in draft;
                  return (
                    <div key={d.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                      <input type="color" value={effective[d.key].toLowerCase()} disabled={!canEdit}
                        aria-label={d.label} onChange={(e) => setColor(d, e.target.value)}
                        style={{ width: 42, height: 30, padding: 0, border: "1px solid var(--border)", borderRadius: 6, background: "none" }} />
                      <span style={{ minWidth: 150 }}>{d.label}</span>
                      <code style={{ color: "var(--muted)" }}>{effective[d.key]}</code>
                      {canEdit && changed && (
                        <button type="button" className="btn secondary sm" onClick={() => resetColor(d)}>Reset</button>
                      )}
                      {changed && <span className="pill pill-info">changed</span>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

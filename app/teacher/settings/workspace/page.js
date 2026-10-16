"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, uploadToCloudinary } from "@/lib/client/api";
import { useDialog } from "@/components/ui/Dialog";
import { applyTheme, cacheTheme, cacheBranding } from "@/components/ThemeLoader";
import { setBranding } from "@/lib/client/branding";
import { PLATFORM_LOGO } from "@/lib/platform";
import { THEME_VARS, resolveTheme, themeWarnings } from "@/lib/theme";
import { PROGRAMS, PROGRAM_KEYS } from "@/lib/curriculum";
import { LEVEL_MAX, NAME_MAX } from "@/lib/levelNames";
import { usePrograms } from "@/lib/client/program";

const LOCALES = [
  { value: "vi", label: "Vietnamese" },
  { value: "en", label: "English" },
];
const GROUPS = ["Brand", "Surface", "Text", "Status"];
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LEVEL_PLACEHOLDERS = { ielts: "e.g. Band 3.5–5.0", toeic: "e.g. 300–450" };

// { program: [{ level, name, used }] } từ levelNames đã lưu + các level đang được Lớp/Unit/Test dùng.
function buildLevelRows(levelNames, usedLevels) {
  const out = {};
  for (const k of PROGRAM_KEYS) {
    const byLevel = new Map();
    for (const lv of (usedLevels && usedLevels[k]) || []) byLevel.set(lv, { level: lv, name: "", used: true });
    for (const x of levelNames || []) {
      if (x.program !== k) continue;
      const prev = byLevel.get(x.level);
      byLevel.set(x.level, { level: x.level, name: x.name, used: !!(prev && prev.used) });
    }
    out[k] = [...byLevel.values()].sort((a, b) => a.level - b.level);
  }
  return out;
}

// Payload gửi server: mọi dòng đã có tên (server bỏ tên rỗng, gộp trùng).
function levelPayload(rows, programs) {
  const out = [];
  for (const k of PROGRAM_KEYS) {
    if (!programs.includes(k)) continue;
    for (const r of rows[k] || []) {
      const name = r.name.trim();
      if (name) out.push({ program: k, level: r.level, name });
    }
  }
  return out;
}

// Cập nhật thanh bên + cache ngay sau khi lưu, không cần tải lại trang.
function pushBranding(ws) {
  const b = { name: ws.name, slug: ws.slug, logoUrl: ws.logoUrl || "" };
  setBranding(b);
  cacheBranding("teacher", b);
}

function timezoneOptions(current) {
  const supported = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return [...new Set([current, "Asia/Ho_Chi_Minh", "UTC", ...supported].filter(Boolean))];
}

// Ô nhập mã màu: gõ tự do, chỉ áp dụng khi là hex hợp lệ (#RGB hoặc #RRGGBB, có/không dấu #).
function normaliseHex(raw) {
  let t = String(raw || "").trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(t)) t = t.split("").map((c) => c + c).join("");
  return /^[0-9a-f]{6}$/i.test(t) ? "#" + t.toUpperCase() : null;
}
function HexInput({ value, disabled, label, onCommit }) {
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(value); }, [value, focused]);
  const valid = normaliseHex(text) !== null;
  function change(v) {
    setText(v);
    const hex = normaliseHex(v);
    if (hex && hex !== String(value).toUpperCase()) onCommit(hex);
  }
  return (
    <input
      type="text" value={text} disabled={disabled} aria-label={label} spellCheck={false} maxLength={7}
      onChange={(e) => change(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); setText(normaliseHex(text) || value); }}
      style={{ width: 92, fontFamily: "monospace", padding: "4px 8px", border: "1px solid " + (valid ? "var(--border)" : "var(--red)"), borderRadius: 6 }}
    />
  );
}

export default function WorkspaceSettingsPage() {
  const dialog = useDialog();
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [general, setGeneral] = useState({ name: "", locale: "vi", timezone: "Asia/Ho_Chi_Minh" });
  const [logo, setLogo] = useState({ url: "", slug: "" });
  const [logoBusy, setLogoBusy] = useState(false);
  const logoRef = useRef(null);
  const [draft, setDraft] = useState({}); // chỉ các màu đã đổi
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const { programs, loaded: programsLoaded, refresh: refreshPrograms } = usePrograms();
  const [levelRows, setLevelRows] = useState({});
  const [hiddenNames, setHiddenNames] = useState([]); // tên đã lưu (mọi chương trình) — phần của chương trình không hiện thì giữ nguyên khi lưu
  const savedLevels = useRef("[]");
  const [savingLevels, setSavingLevels] = useState(false);
  const savedTheme = useRef({});
  const themeLoaded = useRef(false);

  useEffect(() => {
    api.teacher
      .workspaceSettings()
      .then((d) => {
        setGeneral({ name: d.workspace.name, locale: d.workspace.locale, timezone: d.workspace.timezone });
        setLogo({ url: d.workspace.logoUrl || "", slug: d.workspace.slug });
        setDraft(d.theme || {});
        setLevelRows(buildLevelRows(d.levelNames, d.usedLevels));
        savedLevels.current = JSON.stringify(d.levelNames || []);
        setHiddenNames(d.levelNames || []);
        savedTheme.current = d.theme || {};
        themeLoaded.current = true;
        setCanEdit(d.canEdit);
        setLoaded(true);
      })
      .catch((e) => setErr(e.message));
    // Rời trang mà chưa lưu -> trả về theme đã lưu, không để màu nháp ở lại.
    // Chưa tải xong (hoặc StrictMode mount/unmount thử ở dev) thì KHÔNG đụng vào:
    // savedTheme còn rỗng sẽ gỡ theme của workspace -> màu app nháy lên rồi quay lại.
    return () => {
      if (themeLoaded.current) applyTheme(savedTheme.current);
    };
  }, []);

  // Cuộn tới thẻ Levels khi vào từ link "Edit level names" (#levels) — nội dung chỉ có sau khi tải xong.
  useEffect(() => {
    if (loaded && programsLoaded && window.location.hash === "#levels") {
      const el = document.getElementById("levels");
      if (el) el.scrollIntoView();
    }
  }, [loaded, programsLoaded]);

  const shownPrograms = PROGRAM_KEYS.filter((k) => programs.includes(k));
  // Cùng thứ tự với server (program A-Z, level tăng dần) để so sánh "đã đổi chưa" không báo nhầm.
  const levelsPayload = [
    ...hiddenNames.filter((x) => !shownPrograms.includes(x.program)),
    ...levelPayload(levelRows, shownPrograms),
  ].sort((a, b) => (a.program === b.program ? a.level - b.level : a.program < b.program ? -1 : 1));
  const levelsDirty = JSON.stringify(levelsPayload) !== savedLevels.current;

  function setLevelName(k, level, name) {
    setLevelRows((r) => ({ ...r, [k]: r[k].map((x) => (x.level === level ? { ...x, name } : x)) }));
  }
  function removeLevel(k, level) {
    // Level đang được Lớp/Unit/Test dùng thì không biến mất — chỉ xoá tên.
    setLevelRows((r) => ({
      ...r,
      [k]: r[k].flatMap((x) => (x.level !== level ? [x] : x.used ? [{ ...x, name: "" }] : [])),
    }));
  }
  function addLevel(k) {
    setLevelRows((r) => {
      const rows = r[k] || [];
      const next = rows.length ? Math.max(...rows.map((x) => x.level)) + 1 : 1;
      return { ...r, [k]: [...rows, { level: next, name: "", used: false }] };
    });
  }
  async function saveLevels() {
    setSavingLevels(true);
    try {
      const d = await api.teacher.saveWorkspaceSettings({ levelNames: levelsPayload });
      savedLevels.current = JSON.stringify(d.levelNames || []);
      setHiddenNames(d.levelNames || []);
      // Giữ các dòng đang hiện (kể cả dòng mới chưa đặt tên), chỉ chuẩn hoá tên theo server.
      setLevelRows((r) => {
        const out = { ...r };
        for (const k of PROGRAM_KEYS) {
          out[k] = (r[k] || []).map((x) => {
            const hit = (d.levelNames || []).find((n) => n.program === k && n.level === x.level);
            return { ...x, name: hit ? hit.name : "" };
          });
        }
        return out;
      });
      refreshPrograms(); // nhãn level ở các trang khác cập nhật ngay
      dialog.toast("Level names saved");
    } catch (e) {
      dialog.alert({ tone: "error", title: "Could not save level names", message: e.message });
    } finally {
      setSavingLevels(false);
    }
  }

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
      pushBranding(d.workspace);
      dialog.toast("Workspace settings saved");
    } catch (e2) {
      dialog.alert({ tone: "error", title: "Could not save", message: e2.message });
    } finally {
      setSavingGeneral(false);
    }
  }

  async function changeLogo(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      dialog.alert({ tone: "error", title: "Not an image", message: "Please choose an image file (PNG, JPG, SVG...)." });
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      dialog.alert({ tone: "error", title: "Image too large", message: "Please choose an image under 2 MB." });
      return;
    }
    setLogoBusy(true);
    try {
      const up = await uploadToCloudinary(file, { resourceType: "image", folder: `workspaces/${logo.slug}/logo` });
      const d = await api.teacher.saveWorkspaceSettings({ logoUrl: up.cloudinaryUrl });
      setLogo((l) => ({ ...l, url: d.workspace.logoUrl || "" }));
      pushBranding(d.workspace);
      dialog.toast("Logo updated");
    } catch (e) {
      dialog.alert({ tone: "error", title: "Could not update the logo", message: e.message });
    } finally {
      setLogoBusy(false);
      if (logoRef.current) logoRef.current.value = "";
    }
  }

  async function removeLogo() {
    setLogoBusy(true);
    try {
      const d = await api.teacher.saveWorkspaceSettings({ logoUrl: "" });
      setLogo((l) => ({ ...l, url: "" }));
      pushBranding(d.workspace);
      dialog.toast("Logo removed");
    } catch (e) {
      dialog.alert({ tone: "error", title: "Could not remove the logo", message: e.message });
    } finally {
      setLogoBusy(false);
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
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
              <img src={logo.url || PLATFORM_LOGO} alt="Workspace logo" style={{ width: 64, height: 64, objectFit: "contain", border: "1px solid var(--border)", borderRadius: 10, background: "#fff" }} />
              <div>
                <div style={{ fontWeight: 600 }}>Logo</div>
                <div className="page-sub" style={{ margin: "2px 0 8px" }}>
                  Shown in the sidebar for you and your students. {logo.url ? "" : "Using the default logo."}
                </div>
                {canEdit && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => changeLogo(e.target.files && e.target.files[0])} />
                    <button type="button" className="btn secondary sm" disabled={logoBusy} onClick={() => logoRef.current && logoRef.current.click()}>
                      {logoBusy ? "Working…" : logo.url ? "Change logo" : "Upload logo"}
                    </button>
                    {logo.url && (
                      <button type="button" className="btn secondary sm" disabled={logoBusy} onClick={removeLogo}>Remove</button>
                    )}
                  </div>
                )}
              </div>
            </div>
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

          <div className="card" id="levels" style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Levels</h3>
              {canEdit && (
                <button type="button" className="btn" disabled={savingLevels || !levelsDirty} onClick={saveLevels}>
                  {savingLevels ? "Saving…" : "Save level names"}
                </button>
              )}
            </div>
            <p className="page-sub" style={{ margin: "6px 0 14px" }}>
              Give each level a name your teachers and students recognise, such as a band or score range.
              The number still decides the order; the name is only a label.
            </p>
            {!programsLoaded && <div className="notice info">Loading…</div>}
            {programsLoaded && shownPrograms.map((k) => {
              const rows = levelRows[k] || [];
              const lastLevel = rows.length ? Math.max(...rows.map((x) => x.level)) : 0;
              return (
                <div key={k} style={{ marginBottom: 14 }}>
                  {shownPrograms.length > 1 && (
                    <h4 style={{ margin: "10px 0 6px", color: "var(--muted)", fontSize: ".78rem", letterSpacing: ".05em" }}>
                      {PROGRAMS[k].label.toUpperCase()}
                    </h4>
                  )}
                  {rows.length === 0 && <p className="page-sub" style={{ margin: "4px 0 8px" }}>No levels yet.</p>}
                  {rows.length > 0 && (
                    <table className="data-table" style={{ maxWidth: 560 }}>
                      <thead>
                        <tr><th style={{ width: 90 }}>Level</th><th>Name</th>{canEdit && <th style={{ width: 50 }} />}</tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.level}>
                            <td>Level {r.level}</td>
                            <td>
                              <input
                                type="text" value={r.name} maxLength={NAME_MAX} disabled={!canEdit}
                                placeholder={LEVEL_PLACEHOLDERS[k] || "e.g. Beginner"}
                                aria-label={(shownPrograms.length > 1 ? PROGRAMS[k].label + " " : "") + "Level " + r.level + " name"}
                                onChange={(e) => setLevelName(k, r.level, e.target.value)}
                                style={{ width: "100%" }}
                              />
                            </td>
                            {canEdit && (
                              <td>
                                <button
                                  type="button" className="icon-btn danger"
                                  title={r.used ? "Clear name (level is in use)" : "Remove level"}
                                  onClick={() => removeLevel(k, r.level)}
                                >
                                  <svg className="icon"><use href="#icon-trash" /></svg>
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {canEdit && (
                    <button type="button" className="btn secondary sm" style={{ marginTop: 8 }}
                      disabled={lastLevel >= LEVEL_MAX} onClick={() => addLevel(k)}>
                      <svg className="icon"><use href="#icon-plus" /></svg> Add level
                    </button>
                  )}
                </div>
              );
            })}
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
                      <HexInput value={effective[d.key]} disabled={!canEdit} label={d.label + " hex code"} onCommit={(hex) => setColor(d, hex)} />
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

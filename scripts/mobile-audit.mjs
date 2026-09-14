// Mobile UI audit — crawls every page at phone widths (iOS + Android) and
// flags the bugs that don't show up on desktop:
//   • horizontal overflow / elements poking past the right edge
//   • inputs with font-size < 16px (iOS Safari zooms the page on focus)
//   • tap targets smaller than 40px
//   • images with no intrinsic constraint overflowing
//   • console errors / uncaught exceptions
//   • focus-steal: typing in the first field and losing focus after 1 char
//     (the SectionBlock duplicate-key class of bug)
//
// Usage:
//   npm i -D playwright && npx playwright install chromium
//   AUDIT_STUDENT_USER=... AUDIT_STUDENT_PASS=... \
//   AUDIT_TEACHER_USER=... AUDIT_TEACHER_PASS=... \
//   AUDIT_ADMIN_USER=...   AUDIT_ADMIN_PASS=... \
//   BASE_URL=http://localhost:3000 node scripts/mobile-audit.mjs
//
// Any role whose creds are omitted is skipped. Output: mobile-audit-report/
// (report.md, report.json, and a screenshot per page/device).

import { chromium, devices } from "playwright";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const OUT = "mobile-audit-report";
const PHONES = [
  { key: "iphone", label: "iPhone 13 (Safari)", device: devices["iPhone 13"] },
  { key: "android", label: "Pixel 7 (Chrome)", device: devices["Pixel 7"] },
];

// role -> { token key, static routes, dynamic route builders }
const ROUTES = {
  public: {
    tokenKey: null,
    routes: ["/", "/login"],
  },
  student: {
    tokenKey: "studentToken",
    routes: [
      "/student",
      "/student/lessons",
      "/student/tests",
      "/student/notebook",
      "/student/tickets",
    ],
    // Resolve real ids by scraping an index page: {from, linkRe -> paths}
    dynamic: [
      { from: "/student/lessons", re: /\/student\/lessons\/[a-f0-9]{8,}$/i, take: 2 },
      { from: "/student/tests", re: /\/student\/tests\/[a-f0-9]{8,}\/(reading|listening|writing|speaking)$/i, take: 2 },
    ],
  },
  teacher: {
    tokenKey: "teacherToken",
    routes: [
      "/teacher",
      "/teacher/overview",
      "/teacher/classes",
      "/teacher/students",
      "/teacher/lessons",
      "/teacher/tests",
      "/teacher/grading",
      "/teacher/ai-grading",
      "/teacher/submissions",
      "/teacher/audio",
      "/teacher/images",
      "/teacher/settings",
      "/teacher/tickets",
    ],
    dynamic: [
      { from: "/teacher/classes", re: /\/teacher\/classes\/[a-f0-9]{8,}$/i, take: 2 },
      { from: "/teacher/lessons", re: /\/teacher\/lessons\/[a-f0-9]{8,}$/i, take: 2 },
      { from: "/teacher/tests", re: /\/teacher\/tests\/[a-f0-9]{8,}$/i, take: 2 },
    ],
  },
  admin: {
    tokenKey: "adminToken",
    routes: [
      "/admin",
      "/admin/users",
      "/admin/classes",
      "/admin/notifications",
      "/admin/storage",
      "/admin/system",
      "/admin/tickets",
      "/admin/audit",
    ],
  },
};

async function login(role) {
  const user = process.env[`AUDIT_${role.toUpperCase()}_USER`];
  const pass = process.env[`AUDIT_${role.toUpperCase()}_PASS`];
  if (!user || !pass) return null;
  const res = await fetch(`${BASE_URL}/api/auth`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: user, password: pass }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) {
    console.warn(`  ! ${role} login failed: ${data.error || res.status}`);
    return null;
  }
  return data.token;
}

// Injected into every page. Returns the structured findings for one viewport.
const PAGE_AUDIT = () => {
  const vw = window.innerWidth;
  const docW = document.documentElement.scrollWidth;
  const desc = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = (el.className && typeof el.className === "string")
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
      : "";
    const txt = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
    return `${el.tagName.toLowerCase()}${id}${cls}${txt ? ` "${txt}"` : ""}`;
  };
  const all = Array.from(document.body.querySelectorAll("*"));
  const overflowRight = [];
  const smallFontFields = [];
  const tinyTapTargets = [];
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const st = getComputedStyle(el);
    if (st.position === "fixed") continue;
    if (r.right > vw + 2 && r.left < vw) {
      // only report the outermost offender in a chain
      if (!el.parentElement || el.parentElement.getBoundingClientRect().right <= vw + 2) {
        overflowRight.push({ el: desc(el), right: Math.round(r.right), vw });
      }
    }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.type !== "checkbox" && el.type !== "radio") {
      const fs = parseFloat(st.fontSize);
      if (fs < 16) smallFontFields.push({ el: desc(el), fontSize: fs });
    }
    const clickable = el.matches("a,button,[role=button],input[type=checkbox],input[type=radio],select,[onclick]");
    if (clickable && (r.width < 40 || r.height < 40)) {
      tinyTapTargets.push({ el: desc(el), w: Math.round(r.width), h: Math.round(r.height) });
    }
  }
  return {
    horizontalOverflow: docW > vw + 1 ? { docWidth: docW, viewport: vw } : null,
    overflowRight: overflowRight.slice(0, 15),
    smallFontFields: smallFontFields.slice(0, 15),
    tinyTapTargets: tinyTapTargets.slice(0, 20),
  };
};

async function resolveDynamic(page, specs) {
  const out = [];
  for (const spec of specs || []) {
    try {
      await page.goto(BASE_URL + spec.from, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(800);
      const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
      const matched = [...new Set(hrefs.filter((h) => h && spec.re.test(h)))].slice(0, spec.take);
      out.push(...matched);
    } catch { /* index page unavailable — skip */ }
  }
  return out;
}

async function auditPage(page, path) {
  const finding = { path, console: [], errors: [] };
  const onMsg = (m) => { if (m.type() === "error") finding.console.push(m.text().slice(0, 300)); };
  const onErr = (e) => finding.errors.push(String(e).slice(0, 300));
  page.on("console", onMsg);
  page.on("pageerror", onErr);
  try {
    const resp = await page.goto(BASE_URL + path, { waitUntil: "networkidle", timeout: 25000 });
    finding.status = resp ? resp.status() : 0;
    await page.waitForTimeout(1000);
    Object.assign(finding, await page.evaluate(PAGE_AUDIT));

    // focus-steal test on the first visible text field
    const input = page.locator('input[type="text"]:visible, input:not([type]):visible, textarea:visible').first();
    if (await input.count()) {
      await input.click({ timeout: 3000 }).catch(() => {});
      await page.keyboard.type("abc", { delay: 70 });
      await page.waitForTimeout(150);
      const ok = await page.evaluate(() => {
        const a = document.activeElement;
        return a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && (a.value || "").length >= 3;
      });
      finding.focusStealBug = !ok;
    }
  } catch (e) {
    finding.loadError = String(e).slice(0, 200);
  } finally {
    page.off("console", onMsg);
    page.off("pageerror", onErr);
  }
  return finding;
}

function scored(f) {
  return (
    (f.horizontalOverflow ? 1 : 0) +
    (f.focusStealBug ? 1 : 0) +
    (f.errors?.length ? 1 : 0) +
    (f.overflowRight?.length ? 1 : 0) +
    (f.smallFontFields?.length ? 1 : 0)
  );
}

async function run() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const report = { baseUrl: BASE_URL, generatedAt: new Date().toISOString(), pages: [] };

  for (const [role, cfg] of Object.entries(ROUTES)) {
    let token = null;
    if (cfg.tokenKey) {
      token = await login(role);
      if (!token) { console.log(`- skip ${role} (no creds / login failed)`); continue; }
    }
    console.log(`\n== ${role} ==`);

    for (const phone of PHONES) {
      const context = await browser.newContext({ ...phone.device });
      if (token) {
        await context.addInitScript(
          ([k, v]) => { try { localStorage.setItem(k, v); } catch {} },
          [cfg.tokenKey, token]
        );
      }
      const page = await context.newPage();

      let routes = [...cfg.routes];
      if (cfg.dynamic && phone.key === "iphone") {
        report._dynamic = report._dynamic || {};
        report._dynamic[role] = report._dynamic[role] || await resolveDynamic(page, cfg.dynamic);
      }
      if (cfg.dynamic) routes = routes.concat(report._dynamic?.[role] || []);

      for (const path of routes) {
        const f = await auditPage(page, path);
        f.role = role;
        f.device = phone.key;
        const shot = `${role}_${phone.key}_${path.replace(/[^a-z0-9]+/gi, "_") || "root"}.png`;
        await page.screenshot({ path: join(OUT, shot), fullPage: true }).catch(() => {});
        f.screenshot = shot;
        report.pages.push(f);
        const flags = [
          f.horizontalOverflow && "OVERFLOW",
          f.focusStealBug && "FOCUS-STEAL",
          f.errors?.length && `${f.errors.length} JS-ERR`,
          f.smallFontFields?.length && `${f.smallFontFields.length} small-font`,
          f.tinyTapTargets?.length && `${f.tinyTapTargets.length} tiny-tap`,
        ].filter(Boolean);
        console.log(`  [${phone.key}] ${path}  ${flags.length ? "⚠ " + flags.join(", ") : "ok"}`);
      }
      await context.close();
    }
  }

  await browser.close();
  delete report._dynamic;

  writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(OUT, "report.md"), toMarkdown(report));
  console.log(`\nReport: ${OUT}/report.md`);
}

function toMarkdown(report) {
  const rows = [...report.pages].sort((a, b) => scored(b) - scored(a));
  let md = `# Mobile audit — ${report.baseUrl}\n\n_${report.generatedAt}_\n\n`;
  md += `${rows.length} page renders checked (each route × iPhone + Android).\n\n`;
  const withIssues = rows.filter((f) => scored(f) > 0);
  md += `## ${withIssues.length} renders with findings\n\n`;
  for (const f of withIssues) {
    md += `### \`${f.path}\` — ${f.role} / ${f.device}  (HTTP ${f.status ?? "?"})\n\n`;
    if (f.loadError) md += `- **load error:** ${f.loadError}\n`;
    if (f.horizontalOverflow)
      md += `- **horizontal overflow:** page is ${f.horizontalOverflow.docWidth}px wide in a ${f.horizontalOverflow.viewport}px viewport\n`;
    for (const o of f.overflowRight || [])
      md += `  - past right edge (${o.right} > ${o.vw}): \`${o.el}\`\n`;
    if (f.focusStealBug)
      md += `- **focus-steal:** the first field lost focus / dropped characters while typing\n`;
    for (const s of f.smallFontFields || [])
      md += `- font-size ${s.fontSize}px (< 16 → iOS zoom): \`${s.el}\`\n`;
    for (const t of f.tinyTapTargets || [])
      md += `- tap target ${t.w}×${t.h}: \`${t.el}\`\n`;
    for (const e of f.errors || []) md += `- JS error: \`${e}\`\n`;
    for (const c of f.console || []) md += `- console.error: \`${c}\`\n`;
    md += `- screenshot: \`${f.screenshot}\`\n\n`;
  }
  const clean = rows.filter((f) => scored(f) === 0).map((f) => `\`${f.path}\` (${f.device})`);
  md += `## Clean\n\n${clean.join(", ") || "—"}\n`;
  return md;
}

run().catch((e) => { console.error(e); process.exit(1); });

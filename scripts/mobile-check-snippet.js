/* Zero-install spot check for the CURRENT page.
 *
 * Paste this whole file into the browser console while viewing a page at a
 * phone width — Chrome/Edge DevTools device toolbar (Cmd/Ctrl+Shift+M), or
 * a real phone via remote debugging (Safari Web Inspector / chrome://inspect).
 * It logs the same things scripts/mobile-audit.mjs checks, for one page.
 */
(() => {
  const vw = innerWidth;
  const docW = document.documentElement.scrollWidth;
  const d = (el) => {
    const c = typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
    return el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + c;
  };
  const els = [...document.body.querySelectorAll("*")];
  const past = [], smallFont = [], tinyTap = [];
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const s = getComputedStyle(el);
    if (s.position === "fixed") continue;
    if (r.right > vw + 2 && r.left < vw && (!el.parentElement || el.parentElement.getBoundingClientRect().right <= vw + 2))
      past.push([d(el), Math.round(r.right)]);
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !/^(checkbox|radio)$/.test(el.type) && parseFloat(s.fontSize) < 16)
      smallFont.push([d(el), s.fontSize]);
    if (el.matches("a,button,[role=button],select") && (r.width < 40 || r.height < 40))
      tinyTap.push([d(el), Math.round(r.width) + "x" + Math.round(r.height)]);
  }
  console.log("%cMobile check — " + location.pathname, "font-weight:bold;font-size:14px");
  console.log(docW > vw + 1 ? `❌ horizontal overflow: ${docW}px in ${vw}px viewport` : "✅ no horizontal overflow");
  if (past.length) console.table(past.map(([el, right]) => ({ el, right, viewport: vw })));
  if (smallFont.length) { console.log("❌ inputs < 16px (iOS will zoom on focus):"); console.table(smallFont); }
  if (tinyTap.length) { console.log("⚠ tap targets < 40px:"); console.table(tinyTap); }
  if (!past.length && !smallFont.length && !tinyTap.length && docW <= vw + 1) console.log("✅ clean");
})();

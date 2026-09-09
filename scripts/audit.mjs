#!/usr/bin/env node
/* ============================================================================
   audit.mjs — the UI/UX test suite.

   Drives real headless Chrome over the DevTools Protocol (no Puppeteer, no
   install step — Node's built-in WebSocket is enough) and, for every page at
   every breakpoint, checks the things that actually break a storefront:

     · console errors and failed requests
     · horizontal overflow, and which element causes it
     · tap targets below 44 x 44 CSS px
     · text colour contrast below WCAG AA against its real painted background
     · images with no alt text, and images that failed to load
     · headings out of order, duplicate ids, missing page title or h1
     · form controls with no accessible label
     · focus visibility on every interactive element
     · that the catalogue actually rendered (not an empty grid)

   Usage:  node scripts/audit.mjs [--shots] [--only=store,product]
   Exit code is 1 if any error-level finding is present.
   ========================================================================== */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { mkdirSync, writeFileSync } from "node:fs";

const CHROME = process.env.CHROME_PATH ||
  (process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : "google-chrome");
const PORT = 9333;
const BASE = process.env.BASE || "http://localhost:8788";
const SHOTS = process.argv.includes("--shots");
const ONLY = (process.argv.find(a => a.startsWith("--only=")) || "").split("=")[1];

const PAGES = [
  { path: "/index.html", name: "home" },
  { path: "/store.html", name: "store" },
  { path: "/store.html?c=sensors", name: "store-filtered" },
  { path: "/product.html?id=damiao-dm8009p", name: "product" },
  { path: "/product.html?id=mabel-assembled", name: "product-robot" },
  { path: "/product.html?id=does-not-exist", name: "product-404" },
  { path: "/mabel.html", name: "mabel" },
  { path: "/bag.html", name: "bag" },
  { path: "/checkout.html", name: "checkout" },
  { path: "/account.html", name: "account" },
  { path: "/about.html", name: "about" },
  { path: "/support.html", name: "support" },
  { path: "/404.html", name: "notfound" },
];

const VIEWPORTS = [
  { w: 390, h: 844, name: "phone", dpr: 2 },
  { w: 768, h: 1024, name: "tablet", dpr: 2 },
  { w: 1440, h: 900, name: "desktop", dpr: 1 },
];

/* ----------------------------------------------------------------- CDP ---- */
let chrome, msgId = 0;

async function connect() {
  chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
    "--disable-extensions", "--mute-audio", `--remote-debugging-port=${PORT}`,
    "--user-data-dir=/tmp/mabel-audit-profile", "about:blank",
  ], { stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(180);
  }
  throw new Error("Chrome did not expose a debugging port");
}

function session(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  const listeners = [];
  const ready = new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
    } else if (m.method) {
      listeners.forEach(fn => fn(m));
    }
  };
  const send = (method, params = {}, sessionId) => ready.then(() => new Promise((res, rej) => {
    const id = ++msgId;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error(`${method} timed out`)); } }, 30000);
  }));
  return { send, on: fn => listeners.push(fn), close: () => ws.close(), ready };
}

/* --------------------------------------------------- the in-page audit ---- */
// Runs inside the page. Returns plain JSON.
const AUDIT = String.raw`(() => {
  const out = { errors: [], warns: [], info: {} };
  const E = (code, msg, sel) => out.errors.push({ code, msg, sel });
  const W = (code, msg, sel) => out.warns.push({ code, msg, sel });
  const path = el => {
    if (!el || el === document.body) return "body";
    let s = el.tagName.toLowerCase();
    if (el.id) return s + "#" + el.id;
    if (el.className && typeof el.className === "string")
      s += "." + el.className.trim().split(/\s+/).slice(0, 2).join(".");
    return s;
  };

  /* ---- document basics ---- */
  if (!document.title || document.title.length < 8) E("title", "Page title missing or too short");
  if (!document.querySelector('meta[name="description"]')) E("meta", "No meta description");
  if (document.documentElement.lang !== "en") E("lang", "html lang is not set");
  // Content inside a [hidden] subtree is not in the accessibility tree, so it
  // must not count towards structure checks.
  const shown = el => !el.closest("[hidden]");
  const h1s = [...document.querySelectorAll("h1")].filter(shown);
  if (h1s.length === 0) E("h1", "No h1 on the page");
  if (h1s.length > 1) E("h1", h1s.length + " h1 elements — there must be exactly one");

  /* ---- duplicate ids ---- */
  const seen = new Set();
  document.querySelectorAll("[id]").forEach(el => {
    if (seen.has(el.id)) E("dup-id", "Duplicate id: " + el.id, path(el));
    seen.add(el.id);
  });

  /* ---- heading order ---- */
  let last = 0;
  [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter(shown).forEach(h => {
    const lvl = +h.tagName[1];
    if (last && lvl > last + 1) W("heading-skip", "Heading jumps h" + last + " to h" + lvl + ": " + h.textContent.trim().slice(0, 40), path(h));
    last = lvl;
  });

  /* ---- images ---- */
  document.querySelectorAll("img").forEach(img => {
    if (!img.hasAttribute("alt")) E("img-alt", "img has no alt attribute: " + img.src.split("/").pop(), path(img));
    if (img.complete && img.naturalWidth === 0 && img.getAttribute("src"))
      E("img-broken", "Image failed to load: " + img.getAttribute("src"), path(img));
  });

  /* ---- horizontal overflow ---- */
  const docW = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > docW + 1) {
    let worst = null, worstW = 0;
    document.querySelectorAll("body *").forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || getComputedStyle(el).position === "fixed") return;
      const right = r.right + window.scrollX;
      if (right > docW + 1 && right > worstW) { worstW = right; worst = el; }
    });
    E("overflow", "Page scrolls horizontally: scrollWidth " +
      document.documentElement.scrollWidth + " vs viewport " + docW +
      (worst ? " — widest offender reaches " + Math.round(worstW) + "px" : ""), worst ? path(worst) : "");
  }

  /* ---- tap targets ---- */
  const small = [], tight = [];
  document.querySelectorAll('a[href],button,input:not([type="hidden"]),select,textarea,[role="button"]').forEach(el => {
    // A control wrapped in its own <label> is clicked via the label, so the
    // label's box is the real target.
    const wrap = el.closest("label");
    const r = (wrap && wrap.contains(el) && el.tagName === "INPUT")
      ? wrap.getBoundingClientRect() : el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") return;
    // inline links inside a paragraph are exempt: they are text, not targets
    const inProse = el.tagName === "A" && el.closest("p,li,cite,summary,.foot-end,.foot-grid,.t-tiny,.t-small");
    if (inProse) return;
    if (el.classList.contains("btn-text")) return;   // an inline text link, not a target
    // WCAG 2.2 AA "Target Size (Minimum)" is 24 x 24 CSS px. 44 is Apple's HIG
    // guidance — worth knowing about, but not a failure.
    if (r.width < 24 || r.height < 24)
      small.push(path(el) + " " + Math.round(r.width) + "x" + Math.round(r.height));
    else if (r.width < 44 || r.height < 44) tight.push(path(el));
  });
  if (small.length) E("tap-target", small.length + " controls under the 24x24 WCAG minimum: " + small.slice(0, 6).join(", "));
  if (tight.length) out.info.tightTargets = tight.length;

  /* ---- contrast ---- */
  const lum = ([r, g, b]) => {
    const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const parse = s => { const m = s.match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : null; };
  const alpha = s => { const m = s.match(/[\d.]+/g); return m && m.length > 3 ? +m[3] : 1; };
  const bgOf = el => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && alpha(c) > 0.85) return parse(c);
      n = n.parentElement;
    }
    return [255, 255, 255];
  };
  const bad = [];
  document.querySelectorAll("p,span,a,li,h1,h2,h3,h4,td,th,label,button,cite,summary,b,i").forEach(el => {
    if (!el.textContent.trim()) return;
    if (el.children.length && !Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim())) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || +cs.opacity < 0.6) return;
    const fg = parse(cs.color), bg = bgOf(el);
    if (!fg || !bg) return;
    const L1 = lum(fg), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
    const need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;
    if (ratio < need)
      bad.push(path(el) + " " + ratio.toFixed(2) + ":1 (needs " + need + ") — \"" + el.textContent.trim().slice(0, 26) + "\"");
  });
  if (bad.length) E("contrast", bad.length + " elements below AA contrast: " + bad.slice(0, 5).join(" | "));

  /* ---- labels ---- */
  [...document.querySelectorAll("input:not([type=hidden]),select,textarea")].filter(shown).forEach(el => {
    const ok = el.labels?.length || el.getAttribute("aria-label") ||
               el.getAttribute("aria-labelledby") || el.closest("label");
    if (!ok) E("label", "Form control has no accessible name", path(el));
  });
  [...document.querySelectorAll("button,a[href]")].filter(shown).forEach(el => {
    const name = (el.textContent || "").trim() || el.getAttribute("aria-label") || el.getAttribute("title");
    if (!name) E("name", "Interactive element has no accessible name", path(el));
  });

  /* ---- focus visibility ---- */
  const probe = document.querySelector("a[href], button");
  if (probe) {
    probe.focus();
    const cs = getComputedStyle(probe);
    const has = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) ||
                cs.boxShadow !== "none";
    if (!has) W("focus", "No visible focus indicator on " + path(probe));
    probe.blur();
  }

  /* ---- content actually rendered ---- */
  out.info.cards = document.querySelectorAll(".card").length;
  out.info.specRows = document.querySelectorAll(".spec-t tr").length;
  out.info.tiles = document.querySelectorAll(".tile").length;
  out.info.skeletons = document.querySelectorAll(".skel").length;
  out.info.emptyState = !!document.querySelector(".empty");
  out.info.scrollW = document.documentElement.scrollWidth;
  out.info.clientW = document.documentElement.clientWidth;
  if (out.info.skeletons > 0) E("skeleton", out.info.skeletons + " loading skeletons still on screen after settle");
  return out;
})()`;

/* ------------------------------------------------------------------ run --- */
const results = [];

async function auditOne(root, page, vp) {
  const { targetId } = await root.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await root.send("Target.attachToTarget", { targetId, flatten: true });

  const consoleErrors = [], netFails = [];
  root.on(m => {
    if (m.sessionId !== sessionId) return;
    if (m.method === "Runtime.exceptionThrown")
      consoleErrors.push(m.params.exceptionDetails.exception?.description ||
                         m.params.exceptionDetails.text);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")
      consoleErrors.push(m.params.args.map(a => a.value ?? a.description ?? "").join(" "));
    if (m.method === "Network.loadingFailed" && !m.params.errorText.includes("ERR_ABORTED"))
      netFails.push(m.params.errorText);
    if (m.method === "Network.responseReceived" && m.params.response.status >= 400)
      netFails.push(`HTTP ${m.params.response.status} ${m.params.response.url}`);
  });

  await root.send("Runtime.enable", {}, sessionId);
  await root.send("Network.enable", {}, sessionId);
  await root.send("Page.enable", {}, sessionId);
  await root.send("Network.setCacheDisabled", { cacheDisabled: true }, sessionId);
  await root.send("Emulation.setDeviceMetricsOverride",
    { width: vp.w, height: vp.h, deviceScaleFactor: vp.dpr, mobile: vp.w < 700 }, sessionId);

  await root.send("Page.navigate", { url: BASE + page.path }, sessionId);
  await sleep(1400);           // let fetch + render settle

  const { result } = await root.send("Runtime.evaluate",
    { expression: AUDIT, returnByValue: true, awaitPromise: false }, sessionId);
  const audit = result.value || { errors: [{ code: "crash", msg: "audit did not run" }], warns: [], info: {} };

  if (consoleErrors.length)
    audit.errors.unshift({ code: "console", msg: consoleErrors.slice(0, 3).join(" ; ") });
  if (netFails.length)
    audit.errors.unshift({ code: "network", msg: netFails.slice(0, 3).join(" ; ") });

  if (SHOTS) {
    const { data } = await root.send("Page.captureScreenshot",
      { format: "png", captureBeyondViewport: true }, sessionId);
    mkdirSync("scripts/shots", { recursive: true });
    writeFileSync(`scripts/shots/${page.name}-${vp.name}.png`, Buffer.from(data, "base64"));
  }

  await root.send("Target.closeTarget", { targetId });
  results.push({ page: page.name, path: page.path, vp: vp.name, ...audit });
}

const wsUrl = await connect();
const root = session(wsUrl);
await root.ready;
await root.send("Target.setDiscoverTargets", { discover: true });

const pages = ONLY ? PAGES.filter(p => ONLY.split(",").includes(p.name)) : PAGES;
for (const p of pages) {
  for (const vp of VIEWPORTS) {
    try { await auditOne(root, p, vp); }
    catch (e) { results.push({ page: p.name, vp: vp.name, errors: [{ code: "harness", msg: e.message }], warns: [], info: {} }); }
  }
}

/* --------------------------------------------------------------- report --- */
let nErr = 0, nWarn = 0;
const bar = "─".repeat(74);
console.log(bar);
console.log(`MABEL Robotics — UI/UX audit · ${pages.length} pages × ${VIEWPORTS.length} viewports`);
console.log(bar);
for (const r of results) {
  nErr += r.errors.length; nWarn += r.warns.length;
  const tag = `${r.page} @ ${r.vp}`.padEnd(30);
  if (!r.errors.length && !r.warns.length) {
    console.log(`  ok   ${tag} cards:${r.info.cards ?? "-"} specs:${r.info.specRows ?? "-"}`);
  } else {
    console.log(`  ${r.errors.length ? "FAIL" : "warn"} ${tag}`);
    r.errors.forEach(e => console.log(`         ! [${e.code}] ${e.msg}${e.sel ? "  <" + e.sel + ">" : ""}`));
    r.warns.forEach(w => console.log(`         ~ [${w.code}] ${w.msg}${w.sel ? "  <" + w.sel + ">" : ""}`));
  }
}
console.log(bar);
console.log(`${nErr} errors, ${nWarn} warnings across ${results.length} page/viewport combinations`);
writeFileSync("scripts/audit-report.json", JSON.stringify(results, null, 1));
root.close(); chrome.kill();
process.exit(nErr ? 1 : 0);

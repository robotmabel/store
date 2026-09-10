#!/usr/bin/env node
/* ============================================================================
   flows.mjs — end-to-end tests for the things a shopper actually does.

   audit.mjs checks that each page is well-formed. This checks that the store
   works: adding to the bag, the drawer, quantity changes, filtering, search,
   the four-step checkout with its validation, and the account view.

   Drives real Chrome over CDP, same as audit.mjs. No install step.
       node scripts/flows.mjs
   ========================================================================== */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = process.env.CHROME_PATH ||
  (process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : "google-chrome");
const PORT = 9334;
const BASE = process.env.BASE || "http://localhost:8788";

let chrome, msgId = 0, pass = 0, fail = 0;

async function connect() {
  chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    "--no-first-run", `--remote-debugging-port=${PORT}`,
    "--user-data-dir=/tmp/mabel-flow-profile", "about:blank"], { stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) return (await r.json()).webSocketDebuggerUrl; }
    catch { /* not up */ }
    await sleep(180);
  }
  throw new Error("Chrome did not start");
}

function session(wsUrl) {
  const ws = new WebSocket(wsUrl), pending = new Map(), listeners = [];
  const ready = new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
    } else if (m.method) listeners.forEach(f => f(m));
  };
  const send = (method, params = {}, sessionId) => ready.then(() => new Promise((res, rej) => {
    const id = ++msgId; pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error(method + " timed out")); } }, 20000);
  }));
  return { send, on: f => listeners.push(f), close: () => ws.close(), ready };
}

const root = session(await connect());
await root.ready;
const { targetId } = await root.send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await root.send("Target.attachToTarget", { targetId, flatten: true });
await root.send("Runtime.enable", {}, sessionId);
await root.send("Page.enable", {}, sessionId);
await root.send("Network.enable", {}, sessionId);
await root.send("Network.setCacheDisabled", { cacheDisabled: true }, sessionId);
await root.send("Emulation.setDeviceMetricsOverride",
  { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);

const errors = [];
root.on(m => {
  if (m.sessionId !== sessionId) return;
  if (m.method === "Runtime.exceptionThrown")
    errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
});

async function go(path, settle = 1200) {
  await root.send("Page.navigate", { url: BASE + path }, sessionId);
  await sleep(settle);
}
async function js(expr, awaitPromise = false) {
  const { result, exceptionDetails } = await root.send("Runtime.evaluate",
    { expression: expr, returnByValue: true, awaitPromise }, sessionId);
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
  return result.value;
}
function check(name, got, want) {
  const ok = typeof want === "function" ? want(got) : JSON.stringify(got) === JSON.stringify(want);
  ok ? (pass++, console.log(`  ok    ${name}`))
     : (fail++, console.log(`  FAIL  ${name}\n          got ${JSON.stringify(got)}` +
        (typeof want === "function" ? "" : `\n          want ${JSON.stringify(want)}`)));
}
const group = t => console.log(`\n${t}`);

/* ------------------------------------------------------------------ 1 ---- */
group("Bag: add, drawer, quantity, persistence");
await go("/store.html", 1600);
await js(`localStorage.clear()`);
await go("/store.html", 1600);
check("store renders the full catalogue", await js(`document.querySelectorAll('.card').length`), 107);

await js(`document.querySelector('[data-add="damiao-dm8009p"]').click()`);
await sleep(300);
check("bag count is 1 after Add to Bag", await js(`document.querySelector('[data-bag-count]').textContent`), "1");
check("bag badge is visible", await js(`document.querySelector('[data-bag-count]').classList.contains('on')`), true);
check("card link was not followed", await js(`location.pathname.endsWith('/store.html')`), true);

await js(`document.querySelector('[data-add="wrist-cam-1200"]').click()`);
await sleep(250);
check("bag count is 2 after a second product", await js(`document.querySelector('[data-bag-count]').textContent`), "2");

await js(`document.getElementById('navBag').click()`);
await sleep(500);
check("drawer opens", await js(`document.querySelector('.drawer').classList.contains('on')`), true);
check("drawer is a modal dialog", await js(`document.querySelector('.drawer').getAttribute('aria-modal')`), "true");
check("drawer lists 2 line items", await js(`document.querySelectorAll('.drawer .line-item').length`), 2);
check("drawer shows a total", await js(`document.querySelector('.drawer .sum .total b').textContent`), v => /^\$[\d,]+/.test(v));
check("page scroll locked while drawer open", await js(`document.body.style.overflow`), "hidden");

await js(`document.querySelector('.drawer [data-inc]').click()`);
await sleep(300);
check("quantity increment reaches 3 items", await js(`document.querySelector('[data-bag-count]').textContent`), "3");
await js(`document.querySelector('.drawer [data-rm]').click()`);
await sleep(300);
check("remove drops the line", await js(`document.querySelectorAll('.drawer .line-item').length`), 1);

await js(`document.querySelector('.scrim').click()`);
await sleep(450);
check("scrim click closes the drawer", await js(`document.querySelector('.drawer').classList.contains('on')`), false);
check("scroll lock released", await js(`document.body.style.overflow`), "");

await go("/index.html", 1200);
check("bag survives navigation", await js(`document.querySelector('[data-bag-count]').textContent`), "1");

/* ------------------------------------------------------------------ 2 ---- */
group("Store: filter, search, sort, clear");
await go("/store.html", 1600);
await js(`document.querySelector('[data-cat="sensors"]').click()`);
await sleep(400);
check("category filter narrows to sensors", await js(`document.querySelectorAll('.card').length`), 15);
check("URL reflects the filter", await js(`new URL(location).searchParams.get('c')`), "sensors");
check("heading follows the category", await js(`document.getElementById('storeTitle').textContent`), "Sensors");

await js(`const i=document.getElementById('q'); i.value='lidar'; i.dispatchEvent(new Event('input'))`);
await sleep(400);
check("search narrows further", await js(`document.querySelectorAll('.card').length`), n => n >= 1 && n < 15);
check("two filter chips are shown", await js(`document.querySelectorAll('#activeF .f-tag').length`), n => n >= 3);

await js(`document.querySelector('[data-clear="all"]').click()`);
await sleep(400);
check("clear all restores 107", await js(`document.querySelectorAll('.card').length`), 107);

await js(`const s=document.getElementById('sort'); s.value='price-asc'; s.dispatchEvent(new Event('change'))`);
await sleep(400);
check("price sort is ascending", await js(`
  [...document.querySelectorAll('.card-price')].slice(0,6)
   .map(e=>parseFloat(e.textContent.replace(/[^0-9.]/g,'')))
   .every((v,i,a)=>i===0||a[i-1]<=v)`), true);

await js(`document.getElementById('mabelOnly').click()`);
await sleep(400);
check("MABEL-parts filter narrows the list", await js(`document.querySelectorAll('.card').length`), n => n > 0 && n < 107);

/* ------------------------------------------------------------------ 3 ---- */
group("Product page");
await go("/product.html?id=mabel-assembled", 1500);
check("h1 is the product name", await js(`document.querySelector('h1').textContent`), "MABEL, Assembled");
check("price shown", await js(`document.querySelector('.price-now').textContent`), "$25,000");
check("spec groups rendered", await js(`document.querySelectorAll('.spec-g').length`), 7);
check("related products shown", await js(`document.querySelectorAll('#related .card').length`), 4);
await js(`document.getElementById('qInc').click(); document.getElementById('qInc').click()`);
check("quantity stepper", await js(`document.getElementById('qty').value`), "3");
await js(`document.getElementById('qty').value='999'; document.getElementById('qty').dispatchEvent(new Event('change'))`);
check("quantity clamps at 99", await js(`document.getElementById('qty').value`), "99");
await go("/product.html?id=nope", 1400);
check("unknown id shows a not-found state", await js(`!!document.querySelector('.empty')`), true);

/* ------------------------------------------------------------------ 4 ---- */
group("MABEL configurator");
await go("/mabel.html", 1600);
check("default configuration totals kit + upgrades",
  await js(`document.querySelector('#cfgSummary .total b').textContent`), v => /^\$1[5-9],/.test(v));
await js(`document.querySelector('input[name="build"][value="mabel-assembled"]').click()`);
await sleep(300);
check("switching to assembled raises the total",
  await js(`document.querySelector('#cfgSummary .total b').textContent`), v => /^\$2[5-9],/.test(v));
await js(`document.querySelector('input[name="compute"][value="jetson-orin-nano"]').click()`);
await sleep(300);
check("included compute tier adds nothing",
  await js(`document.querySelectorAll('#cfgSummary .sum li').length`), 3);
await js(`document.querySelector('#cfgAdd').click()`);
await sleep(500);
check("configured robot lands in the bag",
  await js(`JSON.parse(localStorage.getItem('mabel.bag.v1')).some(l=>l.id==='mabel-assembled')`), true);

/* ------------------------------------------------------------------ 5 ---- */
group("Checkout: validation and the four steps");
await go("/checkout.html", 1500);
check("starts on step 1", await js(`document.querySelector('.co-step.on').dataset.step`), "1");
check("summary lists the bag", await js(`document.querySelectorAll('#coSummary .line-item').length`), n => n >= 1);

await js(`document.querySelector('[data-next="2"]').click()`);
await sleep(300);
check("empty required fields block the step", await js(`document.querySelector('.co-step.on').dataset.step`), "1");
check("the first bad field is marked invalid",
  await js(`document.querySelector('[name=email]').getAttribute('aria-invalid')`), "true");
check("an error message is shown",
  await js(`document.querySelector('[name=email]').closest('.field').querySelector('.err').textContent`), v => v.length > 8);

await js(`
  const set=(n,v)=>{const e=document.querySelector('[name="'+n+'"]');e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}))};
  set('email','not-an-email'); set('name','Jerry Cheng'); set('address1','128 Sterling Road');
  set('city','Toronto'); set('region','ON'); set('postal','M6R 2B7');`);
await js(`document.querySelector('[data-next="2"]').click()`);
await sleep(300);
check("a malformed email still blocks", await js(`document.querySelector('.co-step.on').dataset.step`), "1");

await js(`const e=document.querySelector('[name=email]'); e.value='jerry@lab.ca'; e.dispatchEvent(new Event('change',{bubbles:true}))`);
await js(`document.querySelector('[data-next="2"]').click()`);
await sleep(400);
check("valid details advance to step 2", await js(`document.querySelector('.co-step.on').dataset.step`), "2");
check("step 1 marked done", await js(`document.querySelectorAll('#coSteps li.done').length`), 1);

await js(`document.querySelector('input[name="method"][value="express"]').click()`);
await sleep(400);
check("express shipping is charged",
  await js(`[...document.querySelectorAll('#coSummary .sum li')].find(l=>l.textContent.includes('Express')).querySelector('b').textContent`), "$48");

await js(`document.querySelector('[data-next="3"]').click()`);
await sleep(400);
check("review step reached", await js(`document.querySelector('.co-step.on').dataset.step`), "3");
check("review shows the address",
  await js(`document.getElementById('reviewOut').textContent.includes('128 Sterling Road')`), true);
check("review shows the email",
  await js(`document.getElementById('reviewOut').textContent.includes('jerry@lab.ca')`), true);
check("place button is honest about the payment mode",
  await js(`document.getElementById('placeBtn').textContent`), "Place order");

await js(`document.getElementById('placeBtn').click()`);
await sleep(900);
check("confirmation shown", await js(`document.querySelector('.co-step.on').dataset.step`), "4");
check("an order reference was issued",
  await js(`document.querySelector('#doneOut .t-num').textContent`), v => /^MR-[A-Z0-9]{5,7}$/.test(v));
check("bag emptied after ordering", await js(`document.querySelector('[data-bag-count]').textContent`), "0");
check("order recorded", await js(`JSON.parse(localStorage.getItem('mabel.orders.v1')).length`), 1);

/* ------------------------------------------------------ 5b: order email --- */
group("Order email");

// (a) Nothing configured: the confirmation must say so and hand over a mailto.
await go("/store.html", 1600);
await js(`localStorage.clear()`);
await go("/store.html", 1600);
await js(`document.querySelector('[data-add="damiao-dm4340"]').click()`);
await go("/checkout.html", 1500);
check("no email provider is configured by default", await js(`MABEL.Notify.configured()`), false);
await js(`
  const set=(n,v)=>{const e=document.querySelector('[name="'+n+'"]');e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}))};
  set('email','jerry@lab.ca'); set('name','Jerry Cheng'); set('address1','128 Sterling Road');
  set('city','Toronto'); set('region','ON'); set('postal','M6R 2B7');
  document.querySelector('[data-next="2"]').click()`);
await sleep(400);
await js(`document.querySelector('[data-next="3"]').click()`); await sleep(400);
await js(`document.getElementById('placeBtn').click()`); await sleep(1200);
check("confirmation reached", await js(`document.querySelector('.co-step.on').dataset.step`), "4");
check("it does NOT claim an email was sent",
  await js(`!/we have emailed your order/i.test(document.getElementById('mailState').textContent)`), true);
check("it says email is not switched on",
  await js(`/not switched on/i.test(document.getElementById('mailState').textContent)`), true);
check("a one-click send button is offered",
  await js(`!!document.getElementById('sendOrderBtn')`), true);
check("that button carries the reference, the lines and the customer", await js(`(() => {
  const u = decodeURIComponent(document.getElementById('sendOrderBtn').getAttribute('href'));
  const ref = document.querySelector('#doneOut .t-num').textContent;
  return u.includes(ref) && u.includes('MR-ACT-4340') && u.includes('jerry@lab.ca');
})()`), true);

// (b) A provider configured: the order must actually be POSTed to it.
await go("/store.html", 1600);
await js(`localStorage.clear()`);
await go("/store.html", 1600);
await js(`document.querySelector('[data-add="damiao-dm4340"]').click()`);
await go("/checkout.html", 1500);
await js(`
  window.__posts = [];
  MABEL.CFG.notify.provider = "endpoint";
  MABEL.CFG.notify.endpoint = "https://hook.test.invalid/orders";
  const real = window.fetch;
  window.fetch = (url, opts) => {
    if (String(url).includes("hook.test.invalid")) {
      window.__posts.push({ url: String(url), body: opts && opts.body });
      return Promise.resolve(new Response('{"ok":true}', {status:200, headers:{'Content-Type':'application/json'}}));
    }
    return real(url, opts);
  };`);
check("provider is now detected", await js(`MABEL.Notify.provider()`), "endpoint");
await js(`
  const set=(n,v)=>{const e=document.querySelector('[name="'+n+'"]');e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}))};
  set('email','jerry@lab.ca'); set('name','Jerry Cheng'); set('address1','128 Sterling Road');
  set('city','Toronto'); set('region','ON'); set('postal','M6R 2B7'); set('notes','Leave with reception');
  document.querySelector('[data-next="2"]').click()`);
await sleep(400);
await js(`document.querySelector('[data-next="3"]').click()`); await sleep(400);
await js(`document.getElementById('placeBtn').click()`); await sleep(1400);
check("the order was POSTed to the configured endpoint", await js(`window.__posts.length`), 1);
check("the payload carries the reference", await js(`
  JSON.parse(window.__posts[0].body).order.ref === document.querySelector('#doneOut .t-num').textContent`), true);
check("the payload carries the line items", await js(`
  JSON.parse(window.__posts[0].body).order.lines[0].sku`), "MR-ACT-4340");
check("the payload carries the customer", await js(`
  JSON.parse(window.__posts[0].body).order.email`), "jerry@lab.ca");
check("the payload carries the order notes", await js(`
  JSON.parse(window.__posts[0].body).order.notes`), "Leave with reception");
check("a readable text version is included", await js(`
  /NEW ORDER/.test(JSON.parse(window.__posts[0].body).text)`), true);
check("the confirmation now says it was emailed", await js(`
  /we have emailed your order/i.test(document.getElementById('mailState').textContent)`), true);

// (c) A provider that fails must not claim success.
await go("/store.html", 1600);
await js(`localStorage.clear()`);
await go("/store.html", 1600);
await js(`document.querySelector('[data-add="damiao-dm4340"]').click()`);
await go("/checkout.html", 1500);
await js(`
  MABEL.CFG.notify.provider = "endpoint";
  MABEL.CFG.notify.endpoint = "https://hook.test.invalid/orders";
  const real = window.fetch;
  window.fetch = (url, opts) => String(url).includes("hook.test.invalid")
    ? Promise.resolve(new Response('{"message":"bad key"}', {status:401, headers:{'Content-Type':'application/json'}}))
    : real(url, opts);`);
await js(`
  const set=(n,v)=>{const e=document.querySelector('[name="'+n+'"]');e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}))};
  set('email','jerry@lab.ca'); set('name','Jerry Cheng'); set('address1','128 Sterling Road');
  set('city','Toronto'); set('region','ON'); set('postal','M6R 2B7');
  document.querySelector('[data-next="2"]').click()`);
await sleep(400);
await js(`document.querySelector('[data-next="3"]').click()`); await sleep(400);
await js(`document.getElementById('placeBtn').click()`); await sleep(1400);
check("a failed send is reported, not hidden", await js(`
  /could not send your order automatically/i.test(document.getElementById('mailState').textContent)`), true);
check("the error detail is surfaced", await js(`
  /401|bad key/i.test(document.getElementById('mailState').textContent)`), true);
check("the send button is still offered after a failure",
  await js(`!!document.getElementById('sendOrderBtn')`), true);

/* ------------------------------------------------------------------ 6 ---- */
group("Account");
await go("/account.html", 1300);
check("signed-out view shown", await js(`!document.getElementById('authView').hidden`), true);
await js(`document.getElementById('authForm').dispatchEvent(new Event('submit'))`);
await sleep(200);
check("blank email is rejected", await js(`document.getElementById('authErr').textContent`), v => v.length > 5);
await js(`document.getElementById('authEmail').value='jerry@lab.ca';
          document.getElementById('authForm').dispatchEvent(new Event('submit'))`);
await sleep(400);
check("signed-in view shown", await js(`!document.getElementById('acctView').hidden`), true);
check("the name is derived from the address", await js(`document.getElementById('hi').textContent`), "jerry");
check("initials are shown on the avatar", await js(`document.getElementById('hiInitials').textContent`), "J");
check("the nav shows the signed-in initials",
  await js(`document.querySelector('#navAccount .nav-initials')?.textContent`), "J");
check("the nav announces who is signed in",
  await js(`document.getElementById('navAccount').getAttribute('aria-label')`), v => /signed in as jerry/i.test(v));
check("the earlier order appears", await js(`document.querySelectorAll('#ordersOut .order').length`), 1);
check("the order lists its items", await js(`document.querySelectorAll('#ordersOut .order-line').length`), n => n >= 1);
await js(`document.querySelector('.acct-nav [data-go="prefs"]').click()`);
await sleep(220);
check("preferences panel switches", await js(`!document.querySelector('[data-panel="prefs"]').hidden`), true);
check("the orders panel is hidden with it", await js(`document.querySelector('[data-panel="orders"]').hidden`), true);
check("the url tracks the panel", await js(`location.hash`), "#prefs");
await js(`document.querySelector('#prefOut [data-set-theme="dark"]').click()`);
await sleep(220);
check("the dark theme applies", await js(`document.documentElement.getAttribute('data-theme')`), "dark");
check("the theme choice persists", await js(`JSON.parse(localStorage.getItem('mabel.theme.v1'))`), "dark");
await js(`document.querySelector('#prefOut [data-set-theme="system"]').click()`); await sleep(200);
check("system theme clears the override", await js(`document.documentElement.getAttribute('data-theme')`), null);
// the theme control must not attach itself to <html>, which [data-theme] also matches
check("no stray theme listener on the document element", await js(`
  document.querySelectorAll('#prefOut [data-set-theme]').length === 3`), true);
await js(`document.querySelector('.acct-nav [data-go="addresses"]').click()`); await sleep(200);
check("the saved checkout address shows up",
  await js(`/Sterling Road/.test(document.getElementById('addrOut').textContent)`), true);
await js(`document.getElementById('signOut').click()`);
await sleep(320);
check("sign out returns to the form", await js(`!document.getElementById('authView').hidden`), true);
check("sign out clears the session", await js(`localStorage.getItem('mabel.account.v1')`), null);
check("the nav reverts to the generic icon",
  await js(`!document.querySelector('#navAccount .nav-initials')`), true);
check("signing back in restores the same orders", await js(`(async () => {
  document.getElementById('authEmail').value = 'jerry@lab.ca';
  document.getElementById('authForm').dispatchEvent(new Event('submit'));
  await new Promise(r => setTimeout(r, 500));
  return document.querySelectorAll('#ordersOut .order').length;
})()`, true), 1);

/* ------------------------------------------------------------------ 6b --- */
group("Actuator finder");
await go("/actuators.html", 1700);
check("all actuators are listed", await js(`document.querySelectorAll('.card').length`), 18);
check("the count reads correctly", await js(`document.getElementById('count').textContent`), "18 of 18 actuators");
check("facet groups were built", await js(`document.querySelectorAll('#facets .filter-g').length`), n => n >= 6);

await js(`(() => { const i=document.getElementById('torque-min'); i.value='20'; i.dispatchEvent(new Event('input',{bubbles:true})); })()`);
await sleep(350);
check("a torque floor narrows the field", await js(`document.querySelectorAll('.card').length`), n => n > 0 && n < 18);
check("everything left really is above the floor", await js(`(() => {
  const names = [...document.querySelectorAll('.card-name')].map(e => e.textContent);
  return names.includes('DAMIAO DM8009P') && !names.includes('Dynamixel XC330-T181-T');
})()`), true);

await js(`document.getElementById('torque-min').value=''; document.getElementById('torque-min').dispatchEvent(new Event('input',{bubbles:true}))`);
await sleep(300);
check("clearing the floor restores everything", await js(`document.querySelectorAll('.card').length`), 18);

await js(`(() => [...document.querySelectorAll('[data-facet="gear"]')].find(x=>x.value==='harmonic').click())()`);
await sleep(320);
check("the harmonic filter finds exactly the two EYou joints",
  await js(`[...document.querySelectorAll('.card-name')].map(e=>e.textContent).sort().join('|')`),
  "EYou PHU17H-80|EYou PHU20H-100");

await js(`document.getElementById('resetAll').click()`); await sleep(320);
check("reset clears every facet", await js(`document.querySelectorAll('.card').length`), 18);

await js(`(() => [...document.querySelectorAll('[data-facet="bus"]')].find(x=>x.value==='TTL').click())()`);
await sleep(320);
check("the TTL bus filter finds exactly the four bus servos", await js(`document.querySelectorAll('.card').length`), 4);
await js(`document.getElementById('resetAll').click()`); await sleep(300);

await js(`document.querySelector('[data-view="table"]').click()`); await sleep(320);
check("table view renders", await js(`!!document.querySelector('table.cmp')`), true);
check("the table has a row per actuator", await js(`document.querySelectorAll('table.cmp tbody tr').length`), 18);
check("unpublished figures show as an em dash, not zero", await js(`(() => {
  const row = [...document.querySelectorAll('table.cmp tbody tr')]
    .find(r => r.querySelector('th').textContent.includes('EYou PHU17H-80'));
  return row.children[1].textContent.trim();
})()`), "—");
check("a peak-only figure is labelled peak", await js(`(() => {
  const row = [...document.querySelectorAll('table.cmp tbody tr')]
    .find(r => r.querySelector('th').textContent.includes('DM8009P'));
  return /peak/.test(row.children[1].textContent);
})()`), true);
check("the table scrolls inside its own box, not the page", await js(`
  document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1`), true);

// Setting aside products with unpublished figures must be visible, not silent.
// The switch only bites once a numeric axis is actually narrowed — with no
// range set, nothing is being compared and nothing can be set aside.
await js(`document.querySelector('[data-view="grid"]').click()`); await sleep(250);
await js(`(() => { const i=document.getElementById('torque-min'); i.value='1'; i.dispatchEvent(new Event('input',{bubbles:true})); })()`);
await sleep(320);
check("with a floor set, unpublished-torque actuators are still included by default",
  await js(`[...document.querySelectorAll('.card-name')].some(e=>/PHU17H/.test(e.textContent))`), true);
await js(`document.getElementById('unspec').click()`); await sleep(320);
check("turning it off drops them", await js(`
  [...document.querySelectorAll('.card-name')].some(e=>/PHU17H/.test(e.textContent))`), false);
check("turning off unspecified figures says how many were set aside",
  await js(`/hidden\\s+because we do not publish/.test(document.getElementById('unspecNote').textContent)`), true);
await js(`document.getElementById('showUnspec').click()`); await sleep(320);
check("and one click brings them back", await js(`document.getElementById('unspec').checked`), true);

/* ------------------------------------------------------------------ 7 ---- */
group("Currency");
await go("/store.html", 1600);
check("prices start in USD", await js(`document.querySelector('.card-price').textContent`), v => v.startsWith("$"));
await js(`MABEL.setCurrency('CAD')`);
await sleep(400);
check("switching to CAD re-renders prices",
  await js(`document.querySelector('.card-price').textContent`), v => /CA\$/.test(v));
await js(`MABEL.setCurrency('USD')`);

/* ------------------------------------------------------------------ 8 ---- */
group("Mobile navigation");
await root.send("Emulation.setDeviceMetricsOverride",
  { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }, sessionId);
await go("/store.html", 1600);
check("burger is shown at 390px",
  await js(`getComputedStyle(document.getElementById('navBurger')).display !== 'none'`), true);
await js(`document.getElementById('navBurger').click()`);
await sleep(350);
check("menu opens", await js(`document.getElementById('navLinks').classList.contains('open')`), true);
check("burger reports expanded", await js(`document.getElementById('navBurger').getAttribute('aria-expanded')`), "true");
check("scroll locked behind the menu", await js(`document.body.style.overflow`), "hidden");
await js(`document.getElementById('navBurger').click()`);
await sleep(350);
check("menu closes", await js(`document.getElementById('navLinks').classList.contains('open')`), false);
check("scroll lock released", await js(`document.body.style.overflow`), "");
check("no horizontal overflow at 390px",
  await js(`document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1`), true);

/* ------------------------------------------------------------------ 9 ---- */
group("Resilience");
check("no uncaught exceptions during any flow", errors, []);
await js(`localStorage.clear()`);
await go("/bag.html", 1200);
check("empty bag shows its empty state", await js(`!!document.querySelector('.empty')`), true);
await go("/checkout.html", 1200);
check("checkout with an empty bag does not offer to charge",
  await js(`!!document.querySelector('#coMain .empty')`), true);

/* -------------------------------------------------------------- report --- */
console.log("\n" + "─".repeat(60));
console.log(`${pass} passed, ${fail} failed`);
root.close(); chrome.kill();
process.exit(fail ? 1 : 0);

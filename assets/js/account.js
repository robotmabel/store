/* ============================================================================
   account.js — sign in, sign out, orders, addresses, preferences.

   This is a LOCAL session and the page says so in plain words. A static site
   has no server to check a password against, so nothing here pretends to: no
   password field, no fake authentication, no security theatre. What it does do
   is keep your bag, delivery details and order references on this device, and
   greet you by name.

   When shopify.customerAccountsUrl is set in config.js the whole thing steps
   aside and hands off to Shopify's real, hosted sign-in.
   ========================================================================== */
(() => {
  "use strict";
  const M = window.MABEL, esc = M.esc, h = M.href;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  if ((document.body.dataset.page || "") !== "account") return;

  const PANELS = ["orders", "addresses", "prefs"];
  const shopifyAuth = () => M.CFG.shopify.customerAccountsUrl;
  const orders = () => M.store.get("mabel.orders.v1", []) || [];

  const dateFmt = iso => new Date(iso).toLocaleDateString("en-CA",
    { year: "numeric", month: "long", day: "numeric" });

  /* ------------------------------------------------------------ signed in -- */
  function paintOrders() {
    const os = orders();
    $("#ordersOut").innerHTML = os.length ? os.map(o => `
      <article class="order">
        <div class="order-h">
          <div><span>Order</span><b class="t-num">${esc(o.ref)}</b></div>
          <div><span>Placed</span><b>${esc(dateFmt(o.placed))}</b></div>
          <div><span>Total</span><b>${M.money(o.total)}</b></div>
          <div><span>Status</span><b>${esc(o.status || "Received")}</b></div>
        </div>
        <div class="order-b">
          ${o.lines.map(l => `<div class="order-line">
            <span class="order-qty t-num">${l.qty}&times;</span>
            <span class="order-name">${esc(l.name)}</span>
            <span class="t-tiny">${esc(l.sku)}</span>
            <span class="order-amt t-num">${M.money(l.unitUsd * l.qty)}</span>
          </div>`).join("")}
        </div>
      </article>`).join("")
      : `<div class="empty" style="padding:44px 0">
           <p class="t-head">No orders yet.</p>
           <p class="t-small">Orders you place will appear here with their reference and status.</p>
           <p style="margin-top:18px"><a class="btn btn-sm" href="${h("store.html")}">Shop the store</a></p>
         </div>`;
  }

  function paintAddresses() {
    const a = M.store.get("mabel.checkout.v1", {}) || {};
    $("#addrOut").innerHTML = a.address1
      ? `<div class="review-block">
           <h3 style="font-size:13px;color:var(--ink-2);margin:0 0 8px">Default shipping address</h3>
           <p>${esc(a.name || "")}${a.org ? "<br>" + esc(a.org) : ""}<br>${
             [a.address1, a.address2, a.city, a.region, a.postal,
              { CA: "Canada", US: "United States" }[a.country] || a.country]
               .filter(Boolean).map(esc).join("<br>")}</p>
           <p class="t-tiny" style="margin-top:12px">Saved from your last checkout on this device.
             It is filled in for you next time.
             <button class="btn-text" id="clearAddr" style="font-size:12px">Forget it</button></p>
         </div>`
      : `<div class="empty" style="padding:36px 0">
           <p class="t-head">No address saved.</p>
           <p class="t-small">The address you enter at checkout is remembered here, on this device only.</p>
         </div>`;
    $("#clearAddr")?.addEventListener("click", () => {
      M.store.del("mabel.checkout.v1"); paintAddresses(); M.toast("Address forgotten");
    });
  }

  function paintPrefs() {
    const me = M.Session.get();
    if (!me) return;
    const theme = M.store.get("mabel.theme.v1", "system");
    $("#prefOut").innerHTML = `
      <div class="review-block">
        <h3 style="font-size:13px;color:var(--ink-2);margin:0 0 10px">Currency</h3>
        <div class="seg" role="group" aria-label="Currency">
          ${["USD", "CAD"].map(c => `<button class="seg-b" data-cur="${c}"
             aria-pressed="${String(M.currency === c)}">${c}</button>`).join("")}
        </div>
      </div>
      <div class="review-block">
        <h3 style="font-size:13px;color:var(--ink-2);margin:0 0 10px">Appearance</h3>
        <div class="seg" role="group" aria-label="Appearance">
          ${[["system", "System"], ["light", "Light"], ["dark", "Dark"]].map(([v, l]) =>
            `<button class="seg-b" data-set-theme="${v}" aria-pressed="${String(theme === v)}">${l}</button>`).join("")}
        </div>
      </div>
      <div class="review-block">
        <h3 style="font-size:13px;color:var(--ink-2);margin:0 0 8px">Your session</h3>
        <p>${esc(me.email)}<br><span class="t-small">Signed in since ${esc(dateFmt(me.since))}</span></p>
        <p class="t-tiny" style="margin-top:12px">This session lives in this browser only. It is not
          a server account and no password is checked &mdash; it exists so your bag, address and
          order references follow you between visits on this device. Connect Shopify Customer
          Accounts to enable real sign-in.</p>
      </div>`;

    $$("#prefOut [data-cur]").forEach(b => b.addEventListener("click", () => {
      M.setCurrency(b.dataset.cur); paintPrefs(); paintOrders();
    }));
    $$("#prefOut [data-set-theme]").forEach(b => b.addEventListener("click", () => {
      const v = b.dataset.setTheme;
      M.store.set("mabel.theme.v1", v);
      applyTheme(v);
      paintPrefs();
    }));
  }

  function applyTheme(v) {
    if (v === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", v);
  }

  function showAccount() {
    const me = M.Session.get();
    $("#authView").hidden = true;
    $("#acctView").hidden = false;
    $("#hiInitials").textContent = M.Session.initials();
    $("#hi").textContent = me.name;
    $("#hiMail").textContent = me.email;
    paintOrders(); paintAddresses(); paintPrefs();
    const hash = location.hash.slice(1);
    selectPanel(PANELS.includes(hash) ? hash : "orders");
  }

  function selectPanel(id) {
    $$(".acct-nav button").forEach(b => b.setAttribute("aria-current", String(b.dataset.go === id)));
    $$("[data-panel]").forEach(p => { p.hidden = p.dataset.panel !== id; });
    history.replaceState(null, "", "#" + id);
  }

  function showAuth() {
    $("#authView").hidden = false;
    $("#acctView").hidden = true;
  }

  /* ----------------------------------------------------------------- boot -- */
  function boot() {
    applyTheme(M.store.get("mabel.theme.v1", "system"));

    if (shopifyAuth()) {
      $("#shopifyAuth").hidden = false;
      $("#shopifyAuth").href = shopifyAuth();
      $("#localForm").hidden = true;
      $("#localNote").textContent =
        "Sign in to your MABEL Robotics account, hosted securely by Shopify.";
    }

    $$(".auth-tab").forEach(t => t.addEventListener("click", () => {
      $$(".auth-tab").forEach(x => x.setAttribute("aria-selected", String(x === t)));
      const create = t.dataset.mode === "create";
      $("#nameField").hidden = !create;
      $("#authSubmit").textContent = create ? "Create account" : "Continue";
      $("#authTitle").textContent = create ? "Create your account" : "Sign in";
      $("#authEmail").focus();
    }));

    const err = $("#authErr");
    $("#authEmail").addEventListener("input", () => {
      if (err.textContent) { err.textContent = ""; $("#authEmail").setAttribute("aria-invalid", "false"); }
    });

    $("#authForm").addEventListener("submit", async e => {
      e.preventDefault();
      const email = $("#authEmail").value.trim();
      if (!M.EMAIL_RE.test(email)) {
        err.textContent = "Enter a valid email address, for example you@lab.edu.";
        $("#authEmail").setAttribute("aria-invalid", "true");
        $("#authEmail").focus();
        return;
      }
      const btn = $("#authSubmit");
      btn.setAttribute("aria-disabled", "true");
      const was = btn.textContent;
      btn.textContent = "Signing in…";
      await new Promise(r => setTimeout(r, 260));     // let the state change register
      M.Session.signIn(email, $("#authName").value);
      btn.removeAttribute("aria-disabled");
      btn.textContent = was;
      showAccount();
      M.toast("Signed in");
      $("#hi").focus();
    });

    $("#signOut").addEventListener("click", () => {
      M.Session.signOut();
      showAuth();
      M.toast("Signed out");
      $("#authEmail").focus();
    });

    $$(".acct-nav button").forEach(b => b.addEventListener("click", () => selectPanel(b.dataset.go)));
    window.addEventListener("hashchange", () => {
      const id = location.hash.slice(1);
      if (M.Session.signedIn() && PANELS.includes(id)) selectPanel(id);
    });

    M.Session.signedIn() ? showAccount() : showAuth();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

/* ============================================================================
   account.js — sign in, create account, orders, addresses.

   This is a *local* session, and it says so on the page. A static site cannot
   authenticate anyone: there is no server to check a password against. When
   Shopify Customer Accounts is configured in config.js, the sign-in button
   hands off to Shopify's real, hosted login instead of this local mode.
   ========================================================================== */
(() => {
  "use strict";
  const M = window.MABEL, esc = M.esc, h = M.href;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  if ((document.body.dataset.page || "") !== "account") return;

  const KEY = "mabel.account.v1";
  let me = M.store.get(KEY, null);

  const shopifyAuth = () => M.CFG.shopify.customerAccountsUrl;

  /* ------------------------------------------------------------ signed in */
  function orders() { return M.store.get("mabel.orders.v1", []); }

  function paintAccount() {
    $("#authView").hidden = true;
    $("#acctView").hidden = false;
    $("#hi").textContent = me.name || me.email;
    $("#hiMail").textContent = me.email;

    const os = orders();
    $("#ordersOut").innerHTML = os.length ? os.map(o => `
      <article class="order">
        <div class="order-h">
          <div><span>Order</span><b class="t-num">${esc(o.ref)}</b></div>
          <div><span>Placed</span><b>${new Date(o.placed).toLocaleDateString("en-CA",
            { year: "numeric", month: "short", day: "numeric" })}</b></div>
          <div><span>Total</span><b>${M.money(o.total)}</b></div>
          <div><span>Status</span><b>${esc(o.status)}</b></div>
        </div>
        <div class="order-b">
          ${o.lines.map(l => `<div class="line-item" style="padding:12px 0">
            <div class="li-b"><div class="li-name" style="font-size:14px">${esc(l.name)}</div>
            <div class="li-meta">${esc(l.sku)} · Qty ${l.qty} · ${M.money(l.unitUsd * l.qty)}</div></div>
          </div>`).join("")}
        </div>
      </article>`).join("")
      : `<div class="empty" style="padding:44px 0">
           <p class="t-head">No orders yet.</p>
           <p class="t-small">Orders you place will appear here with their reference and status.</p>
           <p style="margin-top:18px"><a class="btn btn-sm" href="${h("store.html")}">Shop the store</a></p>
         </div>`;

    const addr = M.store.get("mabel.checkout.v1", {});
    $("#addrOut").innerHTML = addr.address1
      ? `<div class="review-block"><h4>Default shipping address</h4>
           <p>${esc(addr.name || "")}<br>${[addr.address1, addr.address2, addr.city,
              addr.region, addr.postal].filter(Boolean).map(esc).join("<br>")}</p></div>`
      : `<p class="t-small">No address saved yet. The address you enter at checkout is remembered here.</p>`;

    $("#prefOut").innerHTML = `
      <div class="review-block"><h4>Currency</h4>
        <p>${M.currency} — <button class="btn-text" id="curBtn" style="font-size:15px">switch to ${M.currency === "USD" ? "CAD" : "USD"}</button></p></div>
      <div class="review-block"><h4>Email</h4><p>${esc(me.email)}</p></div>
      <div class="review-block"><h4>Session</h4>
        <p class="t-small">This is a local session stored in this browser only. It is not a
        server account, and no password is checked. Connect Shopify Customer Accounts in
        <code>assets/js/config.js</code> to enable real sign-in.</p></div>`;
    $("#curBtn")?.addEventListener("click", () => {
      M.setCurrency(M.currency === "USD" ? "CAD" : "USD"); paintAccount();
    });
  }

  function paintAuth() {
    $("#authView").hidden = false;
    $("#acctView").hidden = true;
  }

  /* ---------------------------------------------------------------- boot */
  function boot() {
    if (shopifyAuth()) {
      $("#shopifyAuth").hidden = false;
      $("#shopifyAuth").href = shopifyAuth();
      $("#localNote").textContent =
        "Sign in with your MABEL Robotics account, hosted securely by Shopify.";
    }

    $$(".auth-tab").forEach(t => t.addEventListener("click", () => {
      $$(".auth-tab").forEach(x => x.setAttribute("aria-selected", String(x === t)));
      const mode = t.dataset.mode;
      $("#nameField").hidden = mode !== "create";
      $("#authSubmit").textContent = mode === "create" ? "Create account" : "Sign in";
      $("#authTitle").textContent = mode === "create" ? "Create your account" : "Sign in";
    }));

    $("#authForm").addEventListener("submit", e => {
      e.preventDefault();
      const email = $("#authEmail").value.trim();
      const name = $("#authName").value.trim();
      const err = $("#authErr");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        err.textContent = "Enter a valid email address.";
        $("#authEmail").setAttribute("aria-invalid", "true");
        $("#authEmail").focus();
        return;
      }
      err.textContent = "";
      me = { email, name: name || email.split("@")[0], since: new Date().toISOString() };
      M.store.set(KEY, me);
      paintAccount();
      M.toast("Signed in");
      history.replaceState(null, "", "#orders");
    });

    $("#signOut").addEventListener("click", () => {
      M.store.del(KEY); me = null; paintAuth(); M.toast("Signed out");
    });

    $$(".acct-nav button").forEach(b => b.addEventListener("click", () => {
      $$(".acct-nav button").forEach(x => x.setAttribute("aria-current", String(x === b)));
      $$("[data-panel]").forEach(p => { p.hidden = p.dataset.panel !== b.dataset.go; });
      history.replaceState(null, "", "#" + b.dataset.go);
    }));

    me ? paintAccount() : paintAuth();

    const hash = location.hash.slice(1);
    if (hash && me) document.querySelector(`.acct-nav button[data-go="${hash}"]`)?.click();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

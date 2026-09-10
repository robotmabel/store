/* ============================================================================
   ui.js — the chrome: navigation, mega menu, bag drawer, currency switch.
   Built once and injected into every page so the header is defined in exactly
   one place.
   ========================================================================== */
(() => {
  "use strict";
  const M = window.MABEL, CFG = M.CFG;
  const h = M.href, esc = M.esc;

  const NAV = [
    { id: "store",       label: "Store",       href: "store.html" },
    { id: "actuators",   label: "Actuators",   href: "actuators.html" },
    { id: "wheels",      label: "Wheels",      href: "store.html?c=wheels" },
    { id: "hardware",    label: "Hardware",    href: "store.html?c=hardware" },
    { id: "electronics", label: "Electronics", href: "store.html?c=electronics" },
    { id: "sensors",     label: "Sensors",     href: "store.html?c=sensors" },
    { id: "compute",     label: "Compute",     href: "store.html?c=compute" },
    { id: "mabel",       label: "MABEL",       href: "mabel.html" },
    { id: "support",     label: "Support",     href: "support.html" },
  ];

  const ICON = {
    bag: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5.5 6.5h9l-.8 10.2a1 1 0 0 1-1 .93H7.3a1 1 0 0 1-1-.93L5.5 6.5Z" stroke="currentColor" stroke-width="1.4"/><path d="M7.6 8V5.4a2.4 2.4 0 0 1 4.8 0V8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    user: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="7" r="3.1" stroke="currentColor" stroke-width="1.4"/><path d="M4 17c.6-3.1 3-4.7 6-4.7s5.4 1.6 6 4.7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    search: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="5.2" stroke="currentColor" stroke-width="1.4"/><path d="M13 13l4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    burger: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 6.5h14M3 13.5h14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M1.5 1.5l11 11M12.5 1.5l-11 11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  };

  const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true">
    <rect x="4" y="9" width="24" height="17" rx="6" fill="currentColor"/>
    <circle cx="11.5" cy="16.5" r="2.6" fill="var(--bg)"/><circle cx="20.5" cy="16.5" r="2.6" fill="var(--bg)"/>
    <path d="M16 3v6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="16" cy="3" r="2" fill="currentColor"/></svg>`;

  /* ------------------------------------------------------------- nav ----- */
  function buildNav() {
    const page = document.body.dataset.page || "";
    const links = NAV.map(n =>
      `<a class="nav-a" href="${h(n.href)}"${n.id === page ? ' aria-current="page"' : ""}>${n.label}</a>`
    ).join("");

    const el = document.createElement("header");
    el.className = "nav";
    el.innerHTML = `
      <nav class="nav-in" aria-label="Main">
        <a class="nav-logo" href="${h("index.html")}">${LOGO}<span>MABEL Robotics</span></a>
        <div class="nav-links" id="navLinks">${links}</div>
        <div class="nav-tools">
          <button class="nav-icon" id="navSearch" aria-label="Search the store">${ICON.search}</button>
          <a class="nav-icon" id="navAccount" href="${h("account.html")}" aria-label="Account">${ICON.user}</a>
          <button class="nav-icon" id="navBag" data-bag-label aria-label="Bag, empty" aria-haspopup="dialog">
            ${ICON.bag}<span class="nav-count" data-bag-count>0</span>
          </button>
          <button class="nav-icon nav-burger" id="navBurger" aria-label="Menu" aria-expanded="false"
                  aria-controls="navLinks">${ICON.burger}</button>
        </div>
      </nav>`;
    document.body.prepend(el);

    const burger = el.querySelector("#navBurger");
    const linksEl = el.querySelector("#navLinks");
    burger.addEventListener("click", () => {
      const open = linksEl.classList.toggle("open");
      burger.setAttribute("aria-expanded", String(open));
      burger.innerHTML = open ? ICON.close : ICON.burger;
      burger.setAttribute("aria-label", open ? "Close menu" : "Menu");
      M.lockScroll(open);
    });
    // A resize past the breakpoint must not leave the page scroll-locked.
    window.addEventListener("resize", () => {
      if (window.innerWidth > 760 && linksEl.classList.contains("open")) {
        linksEl.classList.remove("open");
        burger.setAttribute("aria-expanded", "false");
        burger.innerHTML = ICON.burger;
        M.lockScroll(false);
      }
    });

    el.querySelector("#navSearch").addEventListener("click", () => {
      const onStore = (document.body.dataset.page || "") === "store";
      const input = document.getElementById("q");
      if (onStore && input) { input.focus(); input.select(); }
      else location.href = h("store.html#q");
    });
    el.querySelector("#navBag").addEventListener("click", openDrawer);

    const acct = el.querySelector("#navAccount");
    function paintAccount() {
      const me = M.Session.get();
      if (me) {
        acct.innerHTML = `<span class="nav-initials" aria-hidden="true">${esc(M.Session.initials())}</span>`;
        acct.setAttribute("aria-label", `Account — signed in as ${me.name}`);
        acct.title = me.email;
      } else {
        acct.innerHTML = ICON.user;
        acct.setAttribute("aria-label", "Sign in");
        acct.removeAttribute("title");
      }
    }
    paintAccount();
    document.addEventListener("mabel:session", paintAccount);
  }

  /* ------------------------------------------------------- bag drawer ---- */
  let drawer, scrim, trapper;

  function buildDrawer() {
    scrim = document.createElement("div");
    scrim.className = "scrim";
    scrim.addEventListener("click", closeDrawer);

    drawer = document.createElement("aside");
    drawer.className = "drawer";
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");
    drawer.setAttribute("aria-label", "Your bag");
    drawer.hidden = true;
    drawer.innerHTML = `
      <div class="drawer-h">
        <h2 class="t-head" style="margin:0">Your Bag</h2>
        <button class="icon-btn" id="bagClose" aria-label="Close bag">${ICON.close}</button>
      </div>
      <div class="drawer-b" id="bagBody"></div>
      <div class="drawer-f" id="bagFoot"></div>`;
    document.body.append(scrim, drawer);
    drawer.querySelector("#bagClose").addEventListener("click", closeDrawer);
  }

  async function paintDrawer() {
    if (!drawer) return;
    const body = drawer.querySelector("#bagBody");
    const foot = drawer.querySelector("#bagFoot");
    let t;
    try { t = await M.Bag.totals(); }
    catch {
      body.innerHTML = `<p class="t-small" style="padding:30px 0">The catalogue could not be loaded. Please refresh.</p>`;
      foot.innerHTML = "";
      return;
    }

    if (!t.lines.length) {
      body.innerHTML = `
        <div style="padding:56px 0;text-align:center">
          <p class="t-head" style="margin:0 0 6px">Your bag is empty.</p>
          <p class="t-small" style="margin:0 0 22px">Parts you add will appear here.</p>
          <a class="btn btn-sm" href="${h("store.html")}">Shop the store</a>
        </div>`;
      foot.innerHTML = "";
      return;
    }

    body.innerHTML = t.lines.map(l => {
      const p = l.product;
      return `<div class="line-item" data-line="${esc(p.id)}">
        <div class="li-art"><img src="${h(p.image)}" alt="" loading="lazy" width="76" height="76"></div>
        <div class="li-b">
          <div class="li-name"><a href="${h("product.html?id=" + encodeURIComponent(p.id))}">${esc(p.name)}</a></div>
          <div class="li-meta">${esc(p.brand)} · ${esc(p.sku)}</div>
          <div class="li-foot">
            <div class="qty-mini">
              <button data-dec="${esc(p.id)}" aria-label="Decrease quantity of ${esc(p.name)}">&minus;</button>
              <span aria-live="polite">${l.qty}</span>
              <button data-inc="${esc(p.id)}" aria-label="Increase quantity of ${esc(p.name)}">+</button>
            </div>
            <div class="li-price">${M.money(p.price * l.qty)}</div>
          </div>
          <button class="li-rm" data-rm="${esc(p.id)}">Remove</button>
        </div>
      </div>`;
    }).join("");

    const short = t.freeOver - t.subtotal;
    foot.innerHTML = `
      <ul class="sum">
        <li><span>Subtotal</span><b>${M.money(t.subtotal)}</b></li>
        <li><span>Shipping</span><b>${t.shipping === 0 ? "Free" : M.money(t.shipping)}</b></li>
        <li class="total"><span>Total</span><b>${M.money(t.total)}</b></li>
      </ul>
      ${short > 0 ? `<p class="t-tiny" style="margin:-8px 0 14px">Add ${M.money(short)} for free shipping.</p>` : ""}
      <a class="btn btn-block" href="${h("checkout.html")}">Check Out</a>
      <a class="btn btn-quiet btn-block" style="margin-top:10px" href="${h("bag.html")}">Review Bag</a>
      <p class="t-tiny center" style="margin:12px 0 0">${esc(CFG.commerce.taxNote)}</p>`;
  }

  function openDrawer() {
    if (!drawer) buildDrawer();
    drawer.hidden = false;
    paintDrawer();
    requestAnimationFrame(() => { scrim.classList.add("on"); drawer.classList.add("on"); });
    M.lockScroll(true);
    trapper = M.trap(drawer, document.getElementById("navBag"));
    trapper.onClose(closeDrawer);
    setTimeout(() => drawer.querySelector("#bagClose")?.focus(), 60);
  }

  function closeDrawer() {
    if (!drawer || drawer.hidden) return;
    scrim.classList.remove("on");
    drawer.classList.remove("on");
    M.lockScroll(false);
    trapper?.release();
    setTimeout(() => { drawer.hidden = true; }, 340);
  }

  document.addEventListener("click", (e) => {
    const inc = e.target.closest("[data-inc]"), dec = e.target.closest("[data-dec]"),
          rm = e.target.closest("[data-rm]");
    if (inc) M.Bag.setQty(inc.dataset.inc, M.Bag.qty(inc.dataset.inc) + 1);
    else if (dec) M.Bag.setQty(dec.dataset.dec, M.Bag.qty(dec.dataset.dec) - 1);
    else if (rm) M.Bag.remove(rm.dataset.rm);
  });
  document.addEventListener("mabel:bag", paintDrawer);
  document.addEventListener("mabel:currency", paintDrawer);

  /* ---------------------------------------------------------- footer ----- */
  function buildFooter() {
    const b = CFG.business;
    const cols = [
      ["Shop", [["All products", "store.html"], ["Actuators", "store.html?c=actuators"],
                ["Wheels", "store.html?c=wheels"], ["Hardware", "store.html?c=hardware"],
                ["Electronics", "store.html?c=electronics"]]],
      ["More", [["Sensors", "store.html?c=sensors"], ["Compute", "store.html?c=compute"],
                ["Tools", "store.html?c=tools"], ["MABEL robot", "mabel.html"],
                ["Bulk & education", "support.html#bulk"]]],
      ["Support", [["Contact us", "support.html#contact"], ["Shipping", "support.html#shipping"],
                   ["Returns", "support.html#returns"], ["Warranty", "support.html#warranty"],
                   ["Documentation", "https://robotmabel.github.io/website/docs/"]]],
      ["Company", [["About MABEL Robotics", "about.html"], ["Open source", "https://github.com/robotmabel"],
                   ["The MABEL project", "https://robotmabel.github.io/website/"],
                   ["Careers", "about.html#careers"]]],
      ["Account", [["Sign in", "account.html"], ["Your orders", "account.html#orders"],
                   ["Your bag", "bag.html"], ["Saved lists", "account.html#lists"]]],
    ];
    const f = document.createElement("footer");
    f.className = "foot";
    f.innerHTML = `
      <div class="foot-in">
        <div class="foot-note">
          <p>Prices are shown in <button class="btn-text" id="curSwitch" style="font-size:12px"></button>
             and exclude tax and duties. ${esc(CFG.commerce.taxNote)}.</p>
          <p>MABEL Robotics is an independent supplier in Toronto, Canada. Product names and
             trademarks belong to their respective owners; we resell their hardware and are not
             affiliated with them.</p>
        </div>
        <div class="foot-grid">
          ${cols.map(([title, items]) => `<div><h2>${title}</h2><ul>${
            items.map(([lbl, url]) =>
              `<li><a href="${/^https?:/.test(url) ? url : h(url)}">${esc(lbl)}</a></li>`).join("")
          }</ul></div>`).join("")}
        </div>
        <div class="foot-end">
          <span>Copyright &copy; ${new Date().getFullYear()} ${esc(b.name)}. All rights reserved.</span>
          <span>${esc(b.address)}</span>
          <a href="${h("support.html#privacy")}">Privacy</a>
          <a href="${h("support.html#terms")}">Terms</a>
          <a href="${h("support.html#accessibility")}">Accessibility</a>
          <span>${esc(b.city)}, ${esc(b.country)}</span>
        </div>
      </div>`;
    document.body.append(f);

    const sw = f.querySelector("#curSwitch");
    const paint = () => { sw.textContent = `${M.currency} — switch to ${M.currency === "USD" ? "CAD" : "USD"}`; };
    paint();
    sw.addEventListener("click", () => { M.setCurrency(M.currency === "USD" ? "CAD" : "USD"); paint(); });
    document.addEventListener("mabel:currency", paint);
  }

  /* ------------------------------------------------------------ boot ----- */
  function boot() {
    if (document.body.dataset.chrome === "off") return;
    buildNav();
    buildDrawer();
    buildFooter();
    M.paintCount();
    M.reveal();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.MABEL.ui = { openDrawer, closeDrawer };
})();

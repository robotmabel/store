/* ============================================================================
   pages.js — per-page behaviour, dispatched from document.body.dataset.page.
   ========================================================================== */
(() => {
  "use strict";
  const M = window.MABEL, esc = M.esc, h = M.href;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ------------------------------------------------------ shared bits ---- */
  function cardHTML(p) {
    const url = h(`product.html?id=${encodeURIComponent(p.id)}`);
    return `<article class="card-w"><a class="card" href="${url}">
      ${p.badge ? `<span class="card-badge">${esc(p.badge)}</span>` : ""}
      <div class="card-art"><img src="${h(p.image)}" alt="${esc(p.name)}" loading="lazy"
        width="260" height="260"></div>
      <span class="card-brand">${esc(p.brand)}</span>
      <h3 class="card-name">${esc(p.name)}</h3>
      <p class="card-tag">${esc(p.tagline)}</p>
      <div class="card-foot">
        <span class="card-price">${M.money(p.price)}</span>
        ${p.unit ? `<span class="card-unit">${esc(p.unit)}</span>` : ""}
      </div>
      <span class="btn btn-sm card-add" data-add="${esc(p.id)}" role="button"
            tabindex="0" aria-label="Add ${esc(p.name)} to bag">Add to Bag</span>
    </a></article>`;
  }

  // Add-to-bag from a card must not follow the card's link.
  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (!add) return;
    e.preventDefault(); e.stopPropagation();
    M.Bag.add(add.dataset.add, 1);
    M.toast("Added to your bag");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const add = e.target.closest("[data-add]");
    if (!add) return;
    e.preventDefault();
    M.Bag.add(add.dataset.add, 1);
    M.toast("Added to your bag");
  });

  function fail(el, err) {
    console.error(err);
    el.innerHTML = `<div class="empty"><p class="t-head">We could not load the catalogue.</p>
      <p class="t-small">${esc(err.message || err)}</p>
      <p style="margin-top:18px"><button class="btn btn-sm" onclick="location.reload()">Try again</button></p></div>`;
  }

  /* --------------------------------------------------------------- home -- */
  async function home() {
    const d = await M.catalogue().catch(err => { fail($("#homeGrids") || document.body, err); });
    if (!d) return;

    const tiles = $("#catTiles");
    if (tiles) {
      const rep = {
        actuators: "damiao-dm8009p", wheels: "swerve-module", hardware: "extrusion-2020",
        electronics: "damiao-usb2can", sensors: "realsense-d405", compute: "jetson-orin-nx16",
        tools: "hoto-precision-24", robots: "mabel-assembled",
      };
      tiles.innerHTML = d.categories.filter(c => c.id !== "robots").map(c => {
        const n = d.products.filter(p => p.category === c.id).length;
        const art = d.byId[rep[c.id]];
        return `<a class="tile reveal" href="${h(`store.html?c=${c.id}`)}">
          <span class="tile-n">${n}</span>
          <h3>${esc(c.name)}</h3><p>${esc(c.blurb)}</p>
          <div class="tile-art"><img src="${h(art.image)}" alt="" loading="lazy" width="250" height="250"></div>
        </a>`;
      }).join("");
    }

    const pick = ids => ids.map(i => d.byId[i]).filter(Boolean);
    const featured = $("#featured");
    if (featured) {
      featured.innerHTML = pick([
        "damiao-dm8009p", "swerve-module", "wrist-cam-1200", "jetson-orin-nx16",
        "feetech-hl3915m", "damiao-usb2can", "lidar-c1", "extrusion-2020",
      ]).map(cardHTML).join("");
    }
    const newIn = $("#newIn");
    if (newIn) {
      newIn.innerHTML = pick([
        "eyou-phu17h-80", "orca-hand-kit", "tactile-fingertip", "ego-camera-rig",
      ]).map(cardHTML).join("");
    }
    M.reveal();
  }

  /* -------------------------------------------------------------- store -- */
  const SORTS = {
    featured: null,
    "price-asc": (a, b) => a.price - b.price,
    "price-desc": (a, b) => b.price - a.price,
    "name-asc": (a, b) => a.name.localeCompare(b.name),
  };

  async function storePage() {
    const grid = $("#grid");
    let d;
    try { d = await M.catalogue(); } catch (e) { return fail(grid, e); }

    const state = {
      cat: new URLSearchParams(location.search).get("c") || "all",
      brands: new Set(),
      q: new URLSearchParams(location.search).get("q") || "",
      sort: "featured",
      mabelOnly: false,
    };

    /* filter rail */
    const catList = $("#catFilter");
    catList.innerHTML =
      `<li><button class="f-btn" data-cat="all">All products <i>${d.products.length}</i></button></li>` +
      d.categories.map(c => {
        const n = d.products.filter(p => p.category === c.id).length;
        return `<li><button class="f-btn" data-cat="${c.id}">${esc(c.name)} <i>${n}</i></button></li>`;
      }).join("");

    const brands = [...new Set(d.products.map(p => p.brand))].sort();
    $("#brandFilter").innerHTML = brands.map(b => {
      const n = d.products.filter(p => p.brand === b).length;
      return `<li><label class="f-check"><input type="checkbox" value="${esc(b)}">
        <span>${esc(b)}</span> <i style="margin-left:auto;font-style:normal;font-size:12px;color:var(--ink-3)">${n}</i></label></li>`;
    }).join("");

    const qEl = $("#q");
    qEl.value = state.q;

    function matches(p) {
      if (state.cat !== "all" && p.category !== state.cat) return false;
      if (state.brands.size && !state.brands.has(p.brand)) return false;
      if (state.mabelOnly && !p.tags.includes("mabel")) return false;
      if (state.q) {
        const hay = `${p.name} ${p.brand} ${p.tagline} ${p.sku} ${p.tags.join(" ")} ${p.summary}`.toLowerCase();
        if (!state.q.toLowerCase().split(/\s+/).filter(Boolean).every(t => hay.includes(t))) return false;
      }
      return true;
    }

    function render() {
      let list = d.products.filter(matches);
      const cmp = SORTS[state.sort];
      if (cmp) list = list.slice().sort(cmp);

      $$("#catFilter .f-btn").forEach(b =>
        b.setAttribute("aria-pressed", String(b.dataset.cat === state.cat)));

      const cat = d.categories.find(c => c.id === state.cat);
      $("#storeTitle").textContent = cat ? cat.name : "Store";
      $("#storeIntro").textContent = cat ? cat.intro
        : "Every part we stock, from single fasteners to a complete robot. Sourced for research robots, held in Toronto, shipped worldwide.";
      $("#count").textContent = `${list.length} ${list.length === 1 ? "product" : "products"}`;

      const tags = [];
      if (state.cat !== "all") tags.push(["cat", cat?.name || state.cat]);
      state.brands.forEach(b => tags.push(["brand:" + b, b]));
      if (state.mabelOnly) tags.push(["mabel", "MABEL parts"]);
      if (state.q) tags.push(["q", `“${state.q}”`]);
      $("#activeF").innerHTML = tags.length
        ? tags.map(([k, l]) => `<button class="f-tag" data-clear="${esc(k)}">${esc(l)} <span aria-hidden="true">&times;</span><span class="vh">Remove filter</span></button>`).join("")
          + `<button class="f-tag" data-clear="all"><b>Clear all</b></button>`
        : "";

      grid.innerHTML = list.length
        ? list.map(cardHTML).join("")
        : `<div class="empty" style="grid-column:1/-1">
             <p class="t-head">No products match those filters.</p>
             <p class="t-small">Try removing a filter or searching for a different term.</p>
             <p style="margin-top:18px"><button class="btn btn-sm" data-clear="all">Clear all filters</button></p>
           </div>`;

      const u = new URL(location.href);
      state.cat === "all" ? u.searchParams.delete("c") : u.searchParams.set("c", state.cat);
      state.q ? u.searchParams.set("q", state.q) : u.searchParams.delete("q");
      history.replaceState(null, "", u);
      document.title = `${cat ? cat.name : "Store"} — MABEL Robotics`;
    }

    catList.addEventListener("click", e => {
      const b = e.target.closest("[data-cat]"); if (!b) return;
      state.cat = b.dataset.cat; render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    $("#brandFilter").addEventListener("change", e => {
      const cb = e.target; if (cb.type !== "checkbox") return;
      cb.checked ? state.brands.add(cb.value) : state.brands.delete(cb.value);
      render();
    });
    $("#mabelOnly").addEventListener("change", e => { state.mabelOnly = e.target.checked; render(); });
    $("#sort").addEventListener("change", e => { state.sort = e.target.value; render(); });

    let qt;
    qEl.addEventListener("input", () => {
      clearTimeout(qt);
      qt = setTimeout(() => { state.q = qEl.value.trim(); render(); }, 160);
    });

    $("#activeF").addEventListener("click", e => {
      const b = e.target.closest("[data-clear]"); if (!b) return;
      clearFilter(b.dataset.clear);
    });
    grid.addEventListener("click", e => {
      const b = e.target.closest("[data-clear]"); if (b) clearFilter(b.dataset.clear);
    });
    function clearFilter(k) {
      if (k === "all") {
        state.cat = "all"; state.brands.clear(); state.q = ""; state.mabelOnly = false;
        qEl.value = ""; $("#mabelOnly").checked = false;
        $$('#brandFilter input').forEach(c => { c.checked = false; });
      } else if (k === "cat") state.cat = "all";
      else if (k === "q") { state.q = ""; qEl.value = ""; }
      else if (k === "mabel") { state.mabelOnly = false; $("#mabelOnly").checked = false; }
      else if (k.startsWith("brand:")) {
        const b = k.slice(6); state.brands.delete(b);
        $$('#brandFilter input').forEach(c => { if (c.value === b) c.checked = false; });
      }
      render();
    }

    render();
    if (location.hash === "#q") qEl.focus();
    document.addEventListener("mabel:currency", render);
  }

  /* ------------------------------------------------------------ product -- */
  async function product() {
    const main = $("#pdp");
    const id = new URLSearchParams(location.search).get("id");
    let d;
    try { d = await M.catalogue(); } catch (e) { return fail(main, e); }
    const p = d.byId[id];
    if (!p) {
      main.innerHTML = `<div class="empty"><h1 class="t-hero" style="margin:0 0 10px">We could not find that product.</h1>
        <p class="t-small">It may have been renamed or discontinued.</p>
        <p style="margin-top:18px"><a class="btn btn-sm" href="${h("store.html")}">Back to the store</a></p></div>`;
      document.title = "Product not found — MABEL Robotics";
      return;
    }

    document.title = `${p.name} — MABEL Robotics`;
    $("#crumbCat").textContent = d.categories.find(c => c.id === p.category)?.name || "Store";
    $("#crumbCat").href = h(`store.html?c=${p.category}`);
    $("#crumbName").textContent = p.name;

    const stockLabel = { "in-stock": "In stock — ships in 1–2 business days",
                         "preorder": "Available to pre-order",
                         "made-to-order": "Made to order" }[p.stock] || "";
    const stockChip = { "in-stock": "chip-ok", "preorder": "chip-key", "made-to-order": "chip-warn" }[p.stock];

    main.innerHTML = `
      <div class="pdp-media">
        <div class="pdp-stage"><img id="stage" src="${h(p.image)}" alt="${esc(p.name)}" width="620" height="620"></div>
      </div>
      <div class="pdp-buy">
        ${p.badge ? `<p class="t-eyebrow">${esc(p.badge)}</p>` : ""}
        <h1 class="t-title">${esc(p.name)}</h1>
        <p class="t-sub" style="margin:8px 0 0">${esc(p.tagline)}</p>
        <div class="price-row">
          <span class="price-now">${M.money(p.price)}</span>
          ${p.unit ? `<span class="t-small">${esc(p.unit)}</span>` : ""}
          <span class="chip ${stockChip}" style="margin-left:auto">${esc(stockLabel)}</span>
        </div>
        <p class="t-small" style="margin:0">${esc(p.brand)} · ${esc(p.sku)}</p>
        <p class="t-body" style="margin:22px 0 0">${esc(p.summary)}</p>
        <ul class="hl">${p.highlights.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
        ${p.note ? `<div class="note-box"><b>Note.</b> ${esc(p.note)}</div>` : ""}
        <div class="buy-row">
          <div class="qty">
            <button id="qDec" aria-label="Decrease quantity">&minus;</button>
            <input id="qty" type="number" value="1" min="1" max="99" aria-label="Quantity">
            <button id="qInc" aria-label="Increase quantity">+</button>
          </div>
          <button class="btn btn-lg" id="addBtn">Add to Bag</button>
        </div>
        <ul class="assure">
          <li><svg viewBox="0 0 20 20" fill="none"><path d="M10 2.5l6 2.4v5c0 3.6-2.4 6.6-6 7.6-3.6-1-6-4-6-7.6v-5l6-2.4Z" stroke="currentColor" stroke-width="1.4"/><path d="M7.4 10l1.9 1.9 3.5-3.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            <span>One-year warranty on everything we sell, two years on MABEL robots.</span></li>
          <li><svg viewBox="0 0 20 20" fill="none"><path d="M2.5 6.5h9v7h-9z" stroke="currentColor" stroke-width="1.4"/><path d="M11.5 9h3l3 2.6v1.9h-6z" stroke="currentColor" stroke-width="1.4"/><circle cx="6" cy="15" r="1.6" stroke="currentColor" stroke-width="1.4"/><circle cx="14.5" cy="15" r="1.6" stroke="currentColor" stroke-width="1.4"/></svg>
            <span>Ships from Toronto. Free shipping in Canada and the US over ${M.money(M.CFG.commerce.freeShippingOver)}.</span></li>
          <li><svg viewBox="0 0 20 20" fill="none"><path d="M10 3v9m0 0l-3.2-3.2M10 12l3.2-3.2M3.5 14.5v2h13v-2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            <span>CAD, firmware and integration notes are open source on GitHub.</span></li>
          <li><svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.2" stroke="currentColor" stroke-width="1.4"/><path d="M10 6.4v4.2l2.6 1.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            <span>Thirty-day returns on unopened parts.</span></li>
        </ul>
      </div>`;

    const qty = $("#qty");
    const clamp = () => { qty.value = Math.max(1, Math.min(99, parseInt(qty.value, 10) || 1)); };
    $("#qInc").addEventListener("click", () => { qty.value = Math.min(99, (+qty.value || 1) + 1); });
    $("#qDec").addEventListener("click", () => { qty.value = Math.max(1, (+qty.value || 1) - 1); });
    qty.addEventListener("change", clamp);
    qty.addEventListener("blur", clamp);
    $("#addBtn").addEventListener("click", () => {
      clamp();
      M.Bag.add(p.id, +qty.value);
      M.toast(`Added ${qty.value} × ${p.name}`);
      M.ui.openDrawer();
    });

    /* tech specs */
    $("#specs").innerHTML = p.specs.map(g => `
      <div class="spec-g"><h3>${esc(g.group)}</h3>
        <table class="spec-t"><tbody>
          ${g.rows.map(r => `<tr><th scope="row">${esc(r.k)}</th><td>${esc(r.v)}</td></tr>`).join("")}
        </tbody></table>
      </div>`).join("");

    /* related — same category first, then shared tags */
    const rel = d.products
      .filter(x => x.id !== p.id)
      .map(x => ({ x, s: (x.category === p.category ? 2 : 0) + x.tags.filter(t => p.tags.includes(t)).length }))
      .filter(o => o.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 4)
      .map(o => o.x);
    if (rel.length) $("#related").innerHTML = rel.map(cardHTML).join("");
    else $("#relatedSec").hidden = true;

    M.reveal();
  }

  /* ---------------------------------------------------------------- bag -- */
  async function bagPage() {
    const el = $("#bagPage");
    async function paint() {
      let t;
      try { t = await M.Bag.totals(); } catch (e) { return fail(el, e); }
      if (!t.lines.length) {
        el.innerHTML = `<div class="empty">
          <h1 class="t-hero" style="margin:0 0 10px">Your bag is empty.</h1>
          <p class="t-sub" style="margin:0 0 26px">Once you add something, it will show up here.</p>
          <a class="btn" href="${h("store.html")}">Shop the store</a></div>`;
        return;
      }
      const short = t.freeOver - t.subtotal;
      el.innerHTML = `
        <div class="co-layout" style="padding-top:0">
          <div>
            <h1 class="t-title" style="margin-bottom:6px">Your bag</h1>
            <p class="t-small" style="margin:0 0 22px">${t.lines.length} ${t.lines.length === 1 ? "line" : "lines"} · ${M.Bag.count()} items</p>
            ${t.lines.map(l => {
              const p = l.product;
              return `<div class="line-item">
                <div class="li-art"><img src="${h(p.image)}" alt="" loading="lazy" width="76" height="76"></div>
                <div class="li-b">
                  <div class="li-name"><a href="${h("product.html?id=" + encodeURIComponent(p.id))}">${esc(p.name)}</a></div>
                  <div class="li-meta">${esc(p.brand)} · ${esc(p.sku)} · ${M.money(p.price)} each</div>
                  <div class="li-foot">
                    <div class="qty-mini">
                      <button data-dec="${esc(p.id)}" aria-label="Decrease quantity of ${esc(p.name)}">&minus;</button>
                      <span>${l.qty}</span>
                      <button data-inc="${esc(p.id)}" aria-label="Increase quantity of ${esc(p.name)}">+</button>
                    </div>
                    <div class="li-price">${M.money(p.price * l.qty)}</div>
                  </div>
                  <button class="li-rm" data-rm="${esc(p.id)}">Remove</button>
                </div></div>`;
            }).join("")}
          </div>
          <aside class="co-aside">
            <h2 class="t-head" style="margin:0 0 16px">Summary</h2>
            <ul class="sum">
              <li><span>Subtotal</span><b>${M.money(t.subtotal)}</b></li>
              <li><span>Shipping</span><b>${t.shipping === 0 ? "Free" : M.money(t.shipping)}</b></li>
              <li><span>Tax</span><b>At checkout</b></li>
              <li class="total"><span>Total</span><b>${M.money(t.total)}</b></li>
            </ul>
            ${short > 0 ? `<p class="t-tiny">Add ${M.money(short)} for free shipping.</p>` : ""}
            <a class="btn btn-block" href="${h("checkout.html")}">Check Out</a>
            <a class="btn btn-quiet btn-block" style="margin-top:10px" href="${h("store.html")}">Continue shopping</a>
          </aside>
        </div>`;
    }
    document.addEventListener("mabel:bag", paint);
    document.addEventListener("mabel:currency", paint);
    paint();
  }

  window.MABEL.pages = { home, storePage, product, bagPage, cardHTML, fail, $, $$ };
})();

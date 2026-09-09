/* ============================================================================
   checkout.js — a four-step checkout: Delivery, Payment, Review, Confirmation.

   The steps are client-side only. No card number is ever entered on this site:
   whichever processor is configured takes over at the Review step, and if none
   is configured the order becomes a quote request. That is deliberate — a
   static site that collected card fields would be both untrustworthy and
   illegal to operate.
   ========================================================================== */
(() => {
  "use strict";
  const M = window.MABEL, esc = M.esc, h = M.href;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  if ((document.body.dataset.page || "") !== "checkout") return;

  const FORM_KEY = "mabel.checkout.v1";
  let step = 1, totals = null;

  const form = {
    email: "", name: "", phone: "",
    address1: "", address2: "", city: "", region: "ON", postal: "", country: "CA",
    method: "standard", pay: "card", notes: "", org: "", po: "",
  };
  Object.assign(form, M.store.get(FORM_KEY, {}));

  const SHIP = {
    standard: { label: "Standard", detail: "3–6 business days · Canada Post / UPS Ground", cost: null },
    express:  { label: "Express",  detail: "1–2 business days · UPS Express", cost: 48 },
    freight:  { label: "Freight",  detail: "Crated, for robots and heavy orders · booked after ordering", cost: 0 },
  };

  /* ---------------------------------------------------------- validate --- */
  const RULES = {
    email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || "Enter a valid email address.",
    name:  v => v.trim().length >= 2 || "Enter the recipient's full name.",
    address1: v => v.trim().length >= 4 || "Enter a street address.",
    city:  v => v.trim().length >= 2 || "Enter a city.",
    postal: v => {
      const c = form.country;
      if (c === "CA") return /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(v.trim()) || "Enter a valid Canadian postal code, e.g. M6R 2B7.";
      if (c === "US") return /^\d{5}(-\d{4})?$/.test(v.trim()) || "Enter a valid ZIP code, e.g. 94043.";
      return v.trim().length >= 3 || "Enter a postal code.";
    },
    region: v => v.trim().length >= 2 || "Select a province or state.",
  };

  function validate(fields) {
    let ok = true, first = null;
    fields.forEach(k => {
      const input = document.querySelector(`[name="${k}"]`);
      if (!input) return;
      const res = RULES[k] ? RULES[k](input.value) : true;
      const errEl = input.closest(".field")?.querySelector(".err");
      if (res === true) {
        input.setAttribute("aria-invalid", "false");
        if (errEl) errEl.textContent = "";
      } else {
        ok = false;
        input.setAttribute("aria-invalid", "true");
        if (errEl) errEl.textContent = res;
        if (!first) first = input;
      }
    });
    if (first) { first.focus(); first.scrollIntoView({ block: "center", behavior: "smooth" }); }
    return ok;
  }

  function collect() {
    $$("#coForm [name]").forEach(el => {
      form[el.name] = el.type === "radio" ? (el.checked ? el.value : form[el.name]) : el.value;
    });
    M.store.set(FORM_KEY, form);
  }

  /* ------------------------------------------------------------ render --- */
  function shipCost(subtotal) {
    const m = SHIP[form.method];
    if (m.cost !== null) return m.cost;
    return subtotal >= M.CFG.commerce.freeShippingOver ? 0 : M.CFG.commerce.flatShipping;
  }

  async function paintAside() {
    const el = $("#coSummary");
    totals = await M.Bag.totals();
    const ship = shipCost(totals.subtotal);
    const total = totals.subtotal + ship;
    totals.shippingCost = ship;
    totals.grand = total;
    el.innerHTML = `
      <h2 class="t-head" style="margin:0 0 16px">Order summary</h2>
      ${totals.lines.map(l => `<div class="line-item" style="padding:12px 0">
        <div class="li-art" style="width:56px;height:56px"><img src="${h(l.product.image)}" alt="" width="56" height="56"></div>
        <div class="li-b"><div class="li-name" style="font-size:14px">${esc(l.product.name)}</div>
        <div class="li-meta">Qty ${l.qty} · ${M.money(l.product.price * l.qty)}</div></div></div>`).join("")}
      <ul class="sum" style="margin-top:16px">
        <li><span>Subtotal</span><b>${M.money(totals.subtotal)}</b></li>
        <li><span>Shipping (${esc(SHIP[form.method].label)})</span><b>${ship === 0 ? "Free" : M.money(ship)}</b></li>
        <li><span>Tax</span><b>Calculated at payment</b></li>
        <li class="total"><span>Total</span><b>${M.money(total)}</b></li>
      </ul>
      <p class="t-tiny">Prices in ${M.currency}. ${esc(M.CFG.commerce.taxNote)}.</p>`;
  }

  function paintSteps() {
    $$("#coSteps li").forEach((li, i) => {
      const n = i + 1;
      li.classList.toggle("done", n < step);
      if (n === step) li.setAttribute("aria-current", "step");
      else li.removeAttribute("aria-current");
    });
    $$(".co-step").forEach(s => s.classList.toggle("on", +s.dataset.step === step));
    const target = $(`.co-step[data-step="${step}"] h2`);
    if (target) { target.setAttribute("tabindex", "-1"); target.focus({ preventScroll: true }); }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function paintReview() {
    const ship = [form.address1, form.address2, form.city, form.region, form.postal,
                  { CA: "Canada", US: "United States" }[form.country] || form.country]
                 .filter(Boolean).join(", ");
    $("#reviewOut").innerHTML = `
      <div class="review-block"><a class="edit" href="#" data-goto="1">Edit</a>
        <h4>Contact</h4><p>${esc(form.name)}<br>${esc(form.email)}${form.phone ? "<br>" + esc(form.phone) : ""}</p></div>
      <div class="review-block"><a class="edit" href="#" data-goto="1">Edit</a>
        <h4>Ship to</h4><p>${esc(ship)}</p></div>
      <div class="review-block"><a class="edit" href="#" data-goto="2">Edit</a>
        <h4>Delivery</h4><p>${esc(SHIP[form.method].label)} — ${esc(SHIP[form.method].detail)}</p></div>
      <div class="review-block"><a class="edit" href="#" data-goto="2">Edit</a>
        <h4>Payment</h4><p>${esc(M.Commerce.payNote())}</p></div>
      ${form.notes ? `<div class="review-block"><h4>Notes</h4><p>${esc(form.notes)}</p></div>` : ""}`;
    $("#placeBtn").textContent = M.Commerce.payLabel();
  }

  /* -------------------------------------------------------------- flow --- */
  async function go(n) {
    if (n > step) {
      collect();
      if (step === 1 && !validate(["email", "name", "address1", "city", "region", "postal"])) return;
    }
    step = n;
    await paintAside();
    paintSteps();
    if (step === 3) paintReview();
  }

  async function place() {
    collect();
    const btn = $("#placeBtn");
    btn.setAttribute("aria-disabled", "true");
    btn.textContent = "Working…";
    try {
      totals = await M.Bag.totals();
      const ship = shipCost(totals.subtotal);
      const res = await M.Commerce.checkout({
        lines: totals.lines,
        subtotal: totals.subtotal,
        shippingCost: ship,
        total: totals.subtotal + ship,
        email: form.email, name: form.name,
        shipping: { address1: form.address1, address2: form.address2, city: form.city,
                    region: form.region, postal: form.postal, country: form.country },
      });
      if (res.kind === "redirect") { location.href = res.url; return; }
      done(res.record);
    } catch (err) {
      console.error(err);
      btn.removeAttribute("aria-disabled");
      btn.textContent = M.Commerce.payLabel();
      $("#coError").innerHTML =
        `<div class="note-box" style="border:1px solid var(--danger);color:var(--danger)">
           <b>We could not start checkout.</b> ${esc(err.message || err)}
           <br>Nothing has been charged. Please try again, or email
           <a href="mailto:${esc(M.CFG.commerce.quoteEmail)}">${esc(M.CFG.commerce.quoteEmail)}</a>.</div>`;
    }
  }

  function done(rec) {
    step = 4;
    paintSteps();
    $("#doneOut").innerHTML = `
      <div class="done-mark"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5"
        stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <h2 class="t-hero center" style="margin:0 0 10px">Thank you, ${esc(form.name.split(" ")[0] || "")}.</h2>
      <p class="t-sub center" style="margin:0 auto 8px;max-width:520px">
        Your order reference is <b class="t-num">${esc(rec.ref)}</b>. We have emailed a copy to
        ${esc(form.email)}.</p>
      <p class="t-small center" style="max-width:560px;margin:0 auto 30px">${esc(M.Commerce.payNote())}</p>
      <div class="center" style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <a class="btn" href="${esc(M.Commerce.quoteMailto(rec))}">Email this order to us</a>
        <a class="btn btn-quiet" href="${h("account.html#orders")}">View your orders</a>
        <a class="btn btn-quiet" href="${h("store.html")}">Keep shopping</a>
      </div>`;
    M.Bag.clear();
    $("#coAside").hidden = true;
  }

  /* -------------------------------------------------------------- boot --- */
  async function boot() {
    // Restore saved details, so a refresh mid-checkout is not a restart.
    $$("#coForm [name]").forEach(el => {
      if (el.type === "radio") el.checked = form[el.name] === el.value;
      else if (form[el.name] != null) el.value = form[el.name];
    });

    // Payment options reflect what is actually configured.
    const m = M.Commerce.mode();
    $("#payMode").innerHTML = {
      shopify: `<span class="chip chip-ok">Shopify secure checkout</span>`,
      stripe: `<span class="chip chip-ok">Stripe secure checkout</span>`,
      quote: `<span class="chip chip-warn">Card payment not yet enabled</span>`,
    }[m];
    $("#payNote").textContent = M.Commerce.payNote();

    const t = await M.Bag.totals().catch(() => null);
    if (!t || !t.lines.length) {
      $("#coMain").innerHTML = `<div class="empty">
        <h2 class="t-hero" style="margin:0 0 10px">Your bag is empty.</h2>
        <p class="t-sub" style="margin:0 0 26px">Add something before checking out.</p>
        <a class="btn" href="${h("store.html")}">Shop the store</a></div>`;
      $("#coAside").hidden = true;
      $("#coSteps").hidden = true;
      return;
    }

    if (new URLSearchParams(location.search).get("state") === "done") {
      done({ ref: "MR-" + Date.now().toString(36).toUpperCase().slice(-6) });
      return;
    }

    $$("[data-next]").forEach(b => b.addEventListener("click", () => go(+b.dataset.next)));
    $$("[data-back]").forEach(b => b.addEventListener("click", () => go(+b.dataset.back)));
    document.addEventListener("click", e => {
      const g = e.target.closest("[data-goto]");
      if (g) { e.preventDefault(); go(+g.dataset.goto); }
    });
    $("#coForm").addEventListener("change", async e => {
      collect();
      if (e.target.name === "method" || e.target.name === "country") await paintAside();
    });
    $("#coForm").addEventListener("submit", e => e.preventDefault());
    $("#placeBtn").addEventListener("click", place);

    await paintAside();
    paintSteps();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

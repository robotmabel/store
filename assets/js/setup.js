/* ============================================================================
   setup.js — what is switched on, and what is not.

   A storefront that silently does nothing is the worst failure mode there is:
   an order looks placed, no money moves, no email arrives, and nobody knows
   why. This page reads assets/js/config.js and reports the truth.
   ========================================================================== */
(() => {
  "use strict";
  const M = window.MABEL, CFG = M.CFG, esc = M.esc;
  if ((document.body.dataset.page || "") !== "setup") return;

  const row = (title, on, detail, how) => `
    <div class="review-block">
      <h2 style="display:flex;align-items:center;gap:10px;font-size:15px;color:var(--ink);font-family:var(--font);font-weight:600;margin:0">
        <span class="chip ${on ? "chip-ok" : "chip-warn"}">${on ? "On" : "Off"}</span>
        ${esc(title)}
      </h2>
      <p class="t-small" style="margin:8px 0 0">${detail}</p>
      ${on ? "" : `<p class="t-small" style="margin:10px 0 0"><b>To switch it on.</b> ${how}</p>`}
    </div>`;

  function paint() {
    const shop = Boolean(CFG.shopify.domain && CFG.shopify.storefrontToken);
    const stripe = Boolean(CFG.stripe.checkoutEndpoint);
    const links = Object.keys(CFG.stripe.paymentLinks || {}).length;
    const mail = M.Notify.configured();
    const mailP = M.Notify.provider();
    const accounts = Boolean(CFG.shopify.customerAccountsUrl);

    document.getElementById("summary").innerHTML =
      (shop || stripe)
        ? `<p class="t-sub">Payment is live through <b>${shop ? "Shopify" : "Stripe"}</b>.</p>`
        : `<p class="t-sub"><b>This store cannot take money yet.</b> Checkout works, an order is
             recorded and given a reference, but no card is charged. Connect Shopify or Stripe
             below.</p>`;

    document.getElementById("rows").innerHTML = [
      row("Card payment — Shopify", shop,
        shop ? `Storefront API on <code>${esc(CFG.shopify.domain)}</code>. Shopify hosts the
                checkout, charges the card and emails the receipt.`
             : `No shop domain or Storefront token. Checkout falls back to recording the order
                locally. <b>This is the recommended option:</b> Shopify handles payment, tax,
                shipping rates and both order emails, so nothing else on this page matters.`,
        `Import <code>dist/shopify_products.csv</code>, create a Storefront API token, and paste
         the domain and token into <code>assets/js/config.js</code>. Full steps in
         <a href="https://github.com/robotmabel/store/blob/main/docs/COMMERCE.md">docs/COMMERCE.md</a>.`),

      row("Card payment — Stripe", stripe,
        stripe ? `Checkout Sessions via <code>${esc(CFG.stripe.checkoutEndpoint)}</code>.`
               : `No checkout endpoint. ${links} Stripe Payment Link${links === 1 ? "" : "s"}
                  configured${links ? " (single-item buys only)" : ""}.`,
        `Deploy <code>api/create-checkout-session.js</code> to Vercel or Netlify with your
         <code>STRIPE_SECRET_KEY</code>, then put its URL in <code>stripe.checkoutEndpoint</code>.
         The secret key must stay on the server — never in this repository.`),

      row("Order email", mail,
        mail ? `Orders are sent through <b>${esc(mailP)}</b>${
                 CFG.notify.toCustomer !== false ? ", with a copy to the customer" : ""}.`
             : `<b>No order email is being sent.</b> A static site cannot send mail on its own.
                Right now an order is saved in the customer's browser and they are shown a button
                to email it to you — if they do not press it, you never hear about it.`,
        `Two minutes, no account: open <a href="https://web3forms.com" rel="noopener">web3forms.com</a>,
         enter the address you want orders at, press Create Access Key, and paste the key into
         <code>notify.web3formsKey</code> in <code>assets/js/config.js</code>. Other providers and
         details in <a href="https://github.com/robotmabel/store/blob/main/docs/EMAIL.md">docs/EMAIL.md</a>.`),

      row("Customer accounts", accounts,
        accounts ? `Sign-in is hosted by Shopify at <code>${esc(CFG.shopify.customerAccountsUrl)}</code>.`
                 : `The account page keeps a session in the visitor's own browser only. It
                    remembers their bag, address and order references on that device. It is not a
                    real login and the page says so.`,
        `Set <code>shopify.customerAccountsUrl</code> once Shopify is connected.`),
    ].join("");

    document.getElementById("where").innerHTML = `
      <p class="t-small">Orders placed while payment is off are stored in the visitor's browser
      under <code>mabel.orders.v1</code> and shown on their account page. They are
      <b>not</b> sent anywhere unless order email is on. There have been
      <b>${(M.store.get("mabel.orders.v1", []) || []).length}</b> such orders in this browser.</p>`;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", paint);
  else paint();
})();

/* ============================================================================
   commerce.js — checkout routing.

   Three paths, chosen automatically by what is configured in config.js:

     Shopify   domain + storefrontToken set, and the products carry variant ids
               → build a real Shopify cart, hand off to Shopify's hosted checkout.
               This is the path to use in production: Shopify holds the card
               data, so this site never touches a card number and stays out of
               PCI scope.
     Stripe    stripe.checkoutEndpoint set → POST the bag to your function,
               which creates a Checkout Session and returns { url }.
               Or stripe.paymentLinks[id] for a single-item buy.
     Quote     nothing configured → the local order flow in checkout.html
               records the order and emails it as a quote request. The store is
               fully usable in this mode; it just does not take payment.

   Whichever path is live, the same `Commerce.checkout(order)` call starts it.
   ========================================================================== */
(() => {
  "use strict";
  const M = window.MABEL, CFG = M.CFG;

  const shopifyReady = () => Boolean(CFG.shopify.domain && CFG.shopify.storefrontToken);
  const stripeReady  = () => Boolean(CFG.stripe.checkoutEndpoint);

  function mode() {
    if (shopifyReady()) return "shopify";
    if (stripeReady()) return "stripe";
    return "quote";
  }

  /* -------------------------------------------------------- Shopify ------ */
  async function shopifyFetch(query, variables) {
    const res = await fetch(
      `https://${CFG.shopify.domain}/api/${CFG.shopify.apiVersion}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": CFG.shopify.storefrontToken,
        },
        body: JSON.stringify({ query, variables }),
      }
    );
    if (!res.ok) throw new Error(`Shopify HTTP ${res.status}`);
    const json = await res.json();
    if (json.errors?.length) throw new Error(json.errors[0].message);
    return json.data;
  }

  const CART_CREATE = `
    mutation cartCreate($lines: [CartLineInput!]!, $email: String) {
      cartCreate(input: { lines: $lines, buyerIdentity: { email: $email } }) {
        cart { id checkoutUrl }
        userErrors { field message }
      }
    }`;

  async function shopifyCheckout(order) {
    const lines = order.lines
      .filter(l => l.product.shopifyVariantId)
      .map(l => ({ merchandiseId: l.product.shopifyVariantId, quantity: l.qty }));
    if (lines.length !== order.lines.length) {
      throw new Error("Some products have no Shopify variant id yet. Run tools/sync_ids.py.");
    }
    const data = await shopifyFetch(CART_CREATE, { lines, email: order.email || null });
    const errs = data.cartCreate.userErrors;
    if (errs?.length) throw new Error(errs[0].message);
    return data.cartCreate.cart.checkoutUrl;
  }

  /* --------------------------------------------------------- Stripe ------ */
  async function stripeCheckout(order) {
    const res = await fetch(CFG.stripe.checkoutEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: order.lines.map(l => ({
          id: l.product.id,
          sku: l.product.sku,
          name: l.product.name,
          priceId: l.product.stripePriceId || undefined,
          unitAmount: Math.round(l.product.price * 100),
          quantity: l.qty,
        })),
        currency: "usd",
        email: order.email || undefined,
        successUrl: `${location.origin}${M.root()}checkout.html?state=done`,
        cancelUrl: `${location.origin}${M.root()}checkout.html`,
      }),
    });
    if (!res.ok) throw new Error(`Checkout endpoint HTTP ${res.status}`);
    const { url } = await res.json();
    if (!url) throw new Error("Checkout endpoint returned no url");
    return url;
  }

  function stripePaymentLink(productId) {
    return CFG.stripe.paymentLinks?.[productId] || "";
  }

  /* ---------------------------------------------------------- quote ------ */
  // No payment processor configured: record the order locally so the customer
  // has a reference, and compose an email the shop can act on. Deliberately
  // explicit — it never pretends a payment was taken.
  function quoteCheckout(order) {
    const ref = "MR-" + Date.now().toString(36).toUpperCase().slice(-6);
    const rec = {
      ref,
      placed: new Date().toISOString(),
      status: "Received — awaiting payment link",
      email: order.email,
      name: order.name,
      phone: order.phone || "",
      org: order.org || "",
      po: order.po || "",
      notes: order.notes || "",
      method: order.method || "standard",
      pay: order.pay || "card",
      shipping: order.shipping,
      currency: M.currency,
      lines: order.lines.map(l => ({
        id: l.product.id, sku: l.product.sku, name: l.product.name,
        qty: l.qty, unitUsd: l.product.price,
      })),
      subtotal: order.subtotal, shippingCost: order.shippingCost, total: order.total,
    };
    const orders = M.store.get("mabel.orders.v1", []);
    orders.unshift(rec);
    M.store.set("mabel.orders.v1", orders.slice(0, 50));
    return rec;
  }

  function quoteMailto(rec) {
    const lines = rec.lines
      .map(l => `${l.qty} x ${l.name} (${l.sku}) — US$${(l.unitUsd * l.qty).toFixed(2)}`)
      .join("\n");
    const body =
      `Order reference: ${rec.ref}\n\n${lines}\n\n` +
      `Subtotal: US$${rec.subtotal.toFixed(2)}\n` +
      `Shipping: US$${rec.shippingCost.toFixed(2)}\n` +
      `Total: US$${rec.total.toFixed(2)}\n\n` +
      `Name: ${rec.name || ""}\nEmail: ${rec.email || ""}\n` +
      `Ship to: ${[rec.shipping?.address1, rec.shipping?.city, rec.shipping?.region,
                   rec.shipping?.postal, rec.shipping?.country].filter(Boolean).join(", ")}\n`;
    return `mailto:${CFG.commerce.quoteEmail}?subject=${encodeURIComponent(
      `Order ${rec.ref} — MABEL Robotics`)}&body=${encodeURIComponent(body)}`;
  }

  /* ------------------------------------------------------- public -------- */
  async function checkout(order) {
    switch (mode()) {
      case "shopify": return { kind: "redirect", url: await shopifyCheckout(order) };
      case "stripe":  return { kind: "redirect", url: await stripeCheckout(order) };
      default:        return { kind: "quote", record: quoteCheckout(order) };
    }
  }

  window.MABEL.Commerce = {
    mode, checkout, stripePaymentLink, quoteMailto,
    shopifyReady, stripeReady,
    // A short, honest label for the checkout button and the review step.
    payLabel() {
      return { shopify: "Continue to secure checkout",
               stripe: "Continue to secure payment",
               quote: "Place order" }[mode()];
    },
    payNote() {
      return {
        shopify: "You will be taken to Shopify's secure checkout to pay. Your card details never touch this site.",
        stripe: "You will be taken to Stripe's secure checkout to pay. Your card details never touch this site.",
        quote: window.MABEL.Notify && window.MABEL.Notify.configured()
          ? "Card payment is not switched on yet. Your order is emailed to our team, who confirm stock and send you a payment link within one business day."
          : "Card payment is not switched on yet, and neither is order email. Your order is saved in this browser and you will be given a button to send it to us.",
      }[mode()];
    },
  };
})();

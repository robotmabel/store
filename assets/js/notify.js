/* ============================================================================
   notify.js — order email.

   WHY THIS EXISTS. This is a static site on GitHub Pages. There is no server,
   so the page cannot send mail by itself, and nothing in a browser can. An
   order therefore reaches you one of three ways:

     1. Shopify or Stripe is connected. They own the transaction and send both
        the customer receipt and your merchant notification. Nothing here runs.
     2. A form-to-email service is configured below. The browser POSTs the
        order to it and the service emails you. No backend of your own.
     3. Nothing is configured. The confirmation screen SAYS SO and offers a
        mailto: button. Nothing is sent automatically, and the page does not
        pretend otherwise.

   Case 3 was what shipped first, and the confirmation screen wrongly claimed
   "we have emailed a copy" — it had not. That is fixed: the wording now
   follows what actually happened.

   Providers are all free at low volume and need only a PUBLIC key, which is
   why they can live in this repository. See docs/EMAIL.md.
   ========================================================================== */
(() => {
  "use strict";
  const M = window.MABEL, CFG = M.CFG;

  const cfg = () => CFG.notify || {};
  const provider = () => {
    const n = cfg();
    if (n.provider) return n.provider;                 // explicit wins
    if (n.web3formsKey) return "web3forms";
    if (n.formspreeId) return "formspree";
    if (n.emailjs && n.emailjs.publicKey) return "emailjs";
    if (n.endpoint) return "endpoint";
    return "";
  };
  const configured = () => Boolean(provider());

  /* ------------------------------------------------------- the message ---- */
  function plainText(rec) {
    const line = l => `  ${String(l.qty).padStart(2)} x ${l.name} (${l.sku})` +
                      `  US$${(l.unitUsd * l.qty).toFixed(2)}`;
    const s = rec.shipping || {};
    return [
      `NEW ORDER  ${rec.ref}`,
      `Placed ${new Date(rec.placed).toLocaleString("en-CA")}`,
      "",
      "ITEMS",
      ...rec.lines.map(line),
      "",
      `Subtotal  US$${rec.subtotal.toFixed(2)}`,
      `Shipping  US$${rec.shippingCost.toFixed(2)}`,
      `TOTAL     US$${rec.total.toFixed(2)}`,
      "",
      "CUSTOMER",
      `  ${rec.name || "(no name)"}`,
      `  ${rec.email || "(no email)"}`,
      rec.phone ? `  ${rec.phone}` : "",
      rec.org ? `  ${rec.org}` : "",
      "",
      "SHIP TO",
      `  ${[s.address1, s.address2, s.city, s.region, s.postal, s.country]
            .filter(Boolean).join(", ")}`,
      "",
      `Delivery  ${rec.method || "standard"}`,
      `Payment   ${rec.pay || "card"}`,
      rec.po ? `PO        ${rec.po}` : "",
      rec.notes ? `\nNOTES\n  ${rec.notes}` : "",
      "",
      "— sent by the MABEL Robotics storefront",
    ].filter(l => l !== "").join("\n");
  }

  /* --------------------------------------------------------- providers ---- */
  async function post(url, body, headers) {
    const res = await fetch(url, {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json", Accept: "application/json" },
                             headers || {}),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json()).message || ""; } catch { /* not json */ }
      throw new Error(`${res.status}${detail ? " — " + detail : ""}`);
    }
    return res;
  }

  const SENDERS = {
    // web3forms.com — free, no account beyond an access key emailed to you.
    async web3forms(rec, text) {
      const n = cfg();
      const body = {
        access_key: n.web3formsKey,
        subject: `New order ${rec.ref} — US$${rec.total.toFixed(2)}`,
        from_name: "MABEL Robotics storefront",
        name: rec.name || "",
        email: rec.email || "",
        replyto: rec.email || "",
        message: text,
      };
      // Copy the customer in, so they get the same record you do.
      if (n.toCustomer !== false && rec.email) body.ccemail = rec.email;
      await post("https://api.web3forms.com/submit", body);
    },

    // formspree.io — free tier, form id from the dashboard.
    async formspree(rec, text) {
      await post(`https://formspree.io/f/${cfg().formspreeId}`, {
        _subject: `New order ${rec.ref} — US$${rec.total.toFixed(2)}`,
        _replyto: rec.email || "",
        ref: rec.ref, name: rec.name, email: rec.email,
        total: rec.total, order: text,
      });
    },

    // emailjs.com — can send both the merchant copy and a customer receipt.
    async emailjs(rec, text) {
      const e = cfg().emailjs;
      const send = (templateId, params) => post("https://api.emailjs.com/api/v1.0/email/send", {
        service_id: e.serviceId, template_id: templateId, user_id: e.publicKey,
        template_params: params,
      });
      const params = {
        ref: rec.ref, name: rec.name, email: rec.email,
        total: rec.total.toFixed(2), order: text,
      };
      await send(e.templateId, params);
      if (cfg().toCustomer !== false && e.customerTemplateId && rec.email) {
        await send(e.customerTemplateId, params).catch(() => { /* merchant copy already sent */ });
      }
    },

    // Your own function. Gets the whole record as JSON.
    async endpoint(rec, text) {
      await post(cfg().endpoint, { order: rec, text });
    },
  };

  /* ------------------------------------------------------------ public ---- */
  async function send(rec) {
    const p = provider();
    if (!p) return { ok: false, reason: "not-configured" };
    const fn = SENDERS[p];
    if (!fn) return { ok: false, reason: "unknown-provider", error: p };
    try {
      await fn(rec, plainText(rec));
      return { ok: true, provider: p };
    } catch (err) {
      console.error("notify:", err);
      return { ok: false, reason: "failed", error: err.message || String(err) };
    }
  }

  window.MABEL.Notify = { send, configured, provider, plainText };
})();

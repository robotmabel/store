/**
 * api/create-checkout-session.js
 *
 * A Stripe Checkout Session endpoint. Deploy to Vercel (`/api/...`), Netlify
 * Functions or Cloudflare Workers, then put its URL in
 * assets/js/config.js → stripe.checkoutEndpoint.
 *
 *   npm i stripe
 *   env: STRIPE_SECRET_KEY   (sk_live_… / sk_test_…)  — server only, never in the repo
 *        ALLOWED_ORIGIN      e.g. https://robotmabel.github.io
 *
 * The site posts { items:[{id,sku,name,priceId,unitAmount,quantity}], email,
 * successUrl, cancelUrl } and expects { url } back.
 *
 * Note the price handling: if a line carries a Stripe `priceId` we use it, so
 * Stripe is the source of truth. Only when it does not do we build an inline
 * price from the amount the browser sent — and a browser can lie, so treat that
 * branch as test-mode only. Run tools/sync_ids.py to fill in the price ids and
 * then set TRUST_CLIENT_AMOUNTS to false.
 */
const TRUST_CLIENT_AMOUNTS = true;   // set false once every SKU has a Stripe price id

export default async function handler(req, res) {
  const origin = process.env.ALLOWED_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const { items = [], email, successUrl, cancelUrl, currency = "usd" } = req.body || {};
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: "No items" });

    const line_items = items.map(it => {
      const quantity = Math.max(1, Math.min(99, parseInt(it.quantity, 10) || 1));
      if (it.priceId) return { price: it.priceId, quantity };
      if (!TRUST_CLIENT_AMOUNTS)
        throw new Error(`No Stripe price id for ${it.sku}. Run tools/sync_ids.py.`);
      return {
        quantity,
        price_data: {
          currency,
          unit_amount: Math.max(50, parseInt(it.unitAmount, 10) || 0),
          product_data: { name: String(it.name).slice(0, 250), metadata: { sku: it.sku || "" } },
        },
      };
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      customer_email: email || undefined,
      success_url: successUrl,
      cancel_url: cancelUrl,
      automatic_tax: { enabled: true },
      shipping_address_collection: { allowed_countries: ["CA", "US", "GB", "DE", "JP", "AU"] },
      phone_number_collection: { enabled: true },
      allow_promotion_codes: true,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

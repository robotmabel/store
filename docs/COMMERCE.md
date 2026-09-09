# Connecting payments

The store works today with nothing configured: the bag is real, checkout is
real, and an order becomes a **quote request** that lands in your inbox with a
reference number. Nothing pretends a card was charged.

To take money, fill in one of the two sections in `assets/js/config.js`. That
file holds **publishable keys only**. A secret key must never appear in this
repository — GitHub Pages serves every file in it to the public.

---

## Option A — Shopify (recommended)

Shopify hosts the checkout, so card data never touches this site and you stay
out of PCI scope. You get taxes, shipping rates, inventory, order management
and customer accounts for free.

**1. Import the catalogue.**
`tools/build.py` writes `dist/shopify_products.csv` in Shopify's own import
format, all 107 SKUs with descriptions, spec tables and image URLs.

> Shopify admin → Products → Import → upload `dist/shopify_products.csv`

**2. Create a Storefront API access token.**

> Settings → Apps and sales channels → Develop apps → Create an app
> → Configure Storefront API scopes → tick
> `unauthenticated_read_product_listings` and `unauthenticated_write_checkouts`
> → Install app → copy the **Storefront API access token**

**3. Paste it into `assets/js/config.js`:**

```js
shopify: {
  domain: "your-shop.myshopify.com",
  storefrontToken: "your-public-storefront-token",
  apiVersion: "2025-07",
  customerAccountsUrl: "https://shopify.com/<shop-id>/account",
}
```

**4. Bring the variant ids back.**
The storefront builds a cart from variant ids, so it needs to know which
Shopify variant each SKU became.

```bash
# Shopify admin → Products → Export → CSV
python3 tools/sync_ids.py --shopify ~/Downloads/products_export.csv
```

That writes `assets/data/ids.json` and patches `assets/data/products.json`.
`tools/build.py` reads `ids.json` back, so rebuilding the catalogue no longer
loses them.

**5. Done.** Add to Bag now creates a real Shopify cart and Check Out hands off
to Shopify's hosted checkout. Setting `customerAccountsUrl` also switches
`account.html` from its local session to Shopify's real sign-in.

---

## Option B — Stripe

Use this if you would rather keep fulfilment yourself.

**1. Deploy the endpoint.** `api/create-checkout-session.js` is a
ready-to-deploy Vercel/Netlify function. Set `STRIPE_SECRET_KEY` and
`ALLOWED_ORIGIN` in the host's environment — never in this repo.

**2. Point the site at it:**

```js
stripe: {
  publishableKey: "pk_live_…",
  checkoutEndpoint: "https://your-api.vercel.app/api/create-checkout-session",
}
```

**3. Create Stripe prices and sync the ids.**

```bash
# dist/stripe_products.csv has one row per SKU, amounts already in cents
stripe prices list --limit 200 > prices.json
python3 tools/sync_ids.py --stripe prices.json
```

Put the SKU in each price's `metadata.sku` so the sync can match them.

**4. Then set `TRUST_CLIENT_AMOUNTS = false`** at the top of
`api/create-checkout-session.js`. Until you do, the function will accept the
price the browser sends it, which is fine for testing and wrong for production —
a browser can send any number it likes.

**Single-item alternative.** For a handful of products you can skip the function
entirely and use Stripe Payment Links:

```js
stripe: { paymentLinks: { "mabel-assembled": "https://buy.stripe.com/…" } }
```

---

## What is stored where

| Data | Where it lives | Leaves the browser? |
|---|---|---|
| Bag contents | `localStorage` (`mabel.bag.v1`) | Only when an order is placed |
| Currency choice | `localStorage` (`mabel.currency.v1`) | No |
| Delivery details | `localStorage` (`mabel.checkout.v1`) | Only when an order is placed |
| Order references | `localStorage` (`mabel.orders.v1`) | No |
| Local session | `localStorage` (`mabel.account.v1`) | No |
| Card details | Nowhere on this site | Handled entirely by Shopify or Stripe |

Every read and write is wrapped in try/catch, so private windows and browsers
with site data blocked degrade to a working, non-remembering store rather than
a blank page.

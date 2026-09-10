# Going live

The store is fully usable today except that **it cannot take money and does not
email you orders**, because both need accounts only you can open. Open
[`/setup.html`](../setup.html) to see the current state.

Three steps, in the order that gets you trading fastest.

## 1. Order email — 2 minutes

Without this you do not find out an order happened. See
[`docs/EMAIL.md`](EMAIL.md). Shortest path: a Web3Forms access key into
`notify.web3formsKey`.

Do this first even if you plan to use Shopify — it costs nothing and it means
you are never blind.

## 2. Payment — half an hour

**Shopify is the recommended route**, because it also solves tax, shipping
rates, inventory, customer accounts and both order emails:

1. Import `dist/shopify_products.csv` (all 107 SKUs, with descriptions, spec
   tables and image URLs already built).
2. Create a custom app, grant `unauthenticated_read_product_listings` and
   `unauthenticated_write_checkouts`, copy the Storefront access token.
3. Paste `domain` and `storefrontToken` into `assets/js/config.js`.
4. Run `python3 tools/sync_ids.py --shopify <export.csv>` so the cart can build
   real Shopify line items.

Stripe instead: deploy `api/create-checkout-session.js` and set
`stripe.checkoutEndpoint`. Details in [`docs/COMMERCE.md`](COMMERCE.md).

## 3. Before the first real order

- [ ] **Prices.** 38 SKUs are `estimate`-costed. Work through
      [`docs/SPEC_PROVENANCE.md`](SPEC_PROVENANCE.md) and confirm each against a
      real quote.
- [ ] **Photographs.** The 15 manufacturer images in
      [`docs/PHOTO_SOURCES.md`](PHOTO_SOURCES.md) are **not cleared for
      commercial use**. Get permission, or photograph the actual surplus stock —
      better anyway, since that is what the buyer receives.
- [ ] **Contact details.** `business` in `assets/js/config.js` still holds
      placeholders, including a fictional `555` phone number.
- [ ] **Stock counts.** The store says "one build's worth" but does not track
      quantities. Shopify does this properly once connected.
- [ ] **Terms.** `support.html#terms` is a reasonable draft, not legal advice.

# MABEL Robotics — store

The commercial storefront for [MABEL](https://robotmabel.github.io/website/):
robot parts, and the robot they add up to. Toronto, Canada.

**Live:** <https://robotmabel.github.io/store/>

A static site — no build step to deploy, no server to run. Pushing to `main`
publishes it. Everything a shopper sees is generated from one Python file.

---

## What is here

| | |
|---|---|
| **107 SKUs** | Actuators, wheels, hardware, electronics, sensors, compute, tools, robots |
| **107 generated figures** | One parametric SVG per product — no photographs, no stock art |
| **Full commerce flow** | Bag, drawer, four-step checkout, accounts, order history |
| **Shopify + Stripe ready** | Both wired behind placeholder keys; see `docs/COMMERCE.md` |
| **0 errors, 0 warnings** | 13 pages × 3 viewports, audited in real Chrome — see below |

```
index.html store.html product.html mabel.html      the shop
bag.html checkout.html account.html                the flow
about.html support.html 404.html                   the rest
assets/css/store.css        one stylesheet, all tokens
assets/js/                  config · store · ui · commerce · pages · checkout · account · mabel
assets/data/products.json   generated — do not edit
assets/img/products/*.svg   generated — do not edit
tools/catalog.py            THE SOURCE OF TRUTH for every product
tools/art.py                the SVG figure engine
tools/build.py              catalog.py → json + svg + csv + sitemap + provenance
tools/sync_ids.py           Shopify/Stripe ids back into the site
scripts/audit.mjs           the UI/UX test suite
api/                        Stripe Checkout Session function
```

## Working on it

```bash
python3 -m http.server 8788          # then open http://localhost:8788
python3 tools/build.py               # after ANY change to tools/catalog.py
node scripts/audit.mjs               # must be 0 errors before pushing
node scripts/audit.mjs --shots       # also writes scripts/shots/*.png
```

**Never hand-edit `assets/data/products.json` or `assets/img/products/*.svg`.**
They are outputs. Change `tools/catalog.py` and re-run `tools/build.py`.

### Adding a product

One `add(...)` call in `tools/catalog.py`:

```python
add(id="new-thing", sku="MR-ACT-NEW", cat="actuators", brand="DAMIAO",
    name="DAMIAO DM-J1234", tagline="What it is, in eight words",
    cost_usd=120, cost_src="vendor", src="vendor", family="joint_module",
    summary="A paragraph that says why someone would choose this one.",
    highlights=["at least three", "concrete", "claims"],
    specs=S(("Performance", [("Rated torque", "5 N·m")])))
```

`family` picks one of 29 renderers in `tools/art.py`; `art={...}` tunes its
colours and proportions. `build.py` refuses to ship a product with no specs,
fewer than three highlights, or a price below cost.

## Prices are derived, not typed

Every line carries what the part **costs us landed in Toronto**, and a
per-category margin turns that into a shelf price:

```
price = nice(landed_cost × MARGINS[category])
```

Margins live at the top of `tools/catalog.py` — thin on brand-name compute where
we are only a reseller, wider on commodity hardware we sort and kit ourselves.
Change a margin and the whole catalogue re-prices. `nice()` rounds to Apple-style
endings, so nothing is ever listed at $251.37.

32 SKUs are costed from MABEL's own bill of materials
(`~/Desktop/MABEL/BOM/data/*.csv`, priced 31 July 2026). You can check our work.

## Before this store takes a real order

`docs/SPEC_PROVENANCE.md` is generated on every build and lists **every
specification and price by source**:

- `bom` — from MABEL's bill of materials or measured on the robot
- `vendor` — published datasheet or list price
- `estimate` — **a Toronto landed-cost estimate that still needs a supplier quote**

38 of 107 SKUs are currently `estimate`. None of it is invented, but an estimate
is an estimate. Work that table before going live.

## The audit

`scripts/audit.mjs` drives real headless Chrome over the DevTools Protocol — no
Puppeteer, no install step, Node's built-in WebSocket is enough. For every page
at 390 / 768 / 1440 px it checks:

console errors · failed requests · horizontal overflow (and names the offending
element) · WCAG 2.2 target sizes · AA colour contrast against the real painted
background · alt text and broken images · heading order · duplicate ids ·
accessible names on every control · visible focus · and that the catalogue
actually rendered rather than leaving a skeleton on screen.

```
0 errors, 0 warnings across 39 page/viewport combinations
```

Keep it that way. It runs in CI on every push.

## Payments

Nothing is configured, and the store works anyway — an order becomes a quote
request with a reference number. To take money, fill in one section of
`assets/js/config.js`. **`docs/COMMERCE.md` has the exact steps** for both
Shopify (recommended — they host the checkout, so card data never touches this
site) and Stripe.

`assets/js/config.js` holds publishable keys only. GitHub Pages serves every
file in this repository to the public; a secret key must never land here.

## Licence

Site code MIT. Product names and trademarks belong to their owners — we resell
their hardware and are not affiliated with them.

#!/usr/bin/env python3
"""
build.py — turn tools/catalog.py into everything the site and the shop need.

    python3 tools/build.py

Writes:
    assets/data/products.json     the catalogue the site fetches
    assets/img/products/<id>.svg  one generated figure per SKU
    dist/shopify_products.csv     Shopify's product-import format, all SKUs
    dist/stripe_products.csv      one row per SKU for Stripe price creation
    docs/SPEC_PROVENANCE.md       every spec that still needs verifying
    sitemap.xml

Nothing here is hand-edited. Change tools/catalog.py and re-run.
"""
from __future__ import annotations
import csv, json, os, sys, datetime, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import art                      # noqa: E402
import catalog as cat           # noqa: E402
import photos                   # noqa: E402

SITE = "https://robotmabel.github.io/store"


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def main() -> int:
    os.makedirs(f"{ROOT}/assets/img/products", exist_ok=True)
    os.makedirs(f"{ROOT}/assets/data", exist_ok=True)
    os.makedirs(f"{ROOT}/dist", exist_ok=True)
    os.makedirs(f"{ROOT}/docs", exist_ok=True)

    # ids written back by tools/sync_ids.py survive a rebuild
    try:
        with open(f"{ROOT}/assets/data/ids.json") as f:
            IDS = json.load(f)
    except FileNotFoundError:
        IDS = {}

    products, problems = [], []
    for p in cat.P:
        pid = p["id"]
        # --- figure -------------------------------------------------------
        try:
            svg = art.render(pid, p["family"], f'{p["name"]} — {p["tagline"]}', p.get("art"))
        except KeyError as e:
            problems.append(f"{pid}: {e}")
            continue
        with open(f"{ROOT}/assets/img/products/{pid}.svg", "w") as f:
            f.write(svg)

        # --- validation ---------------------------------------------------
        for field in ("name", "tagline", "summary", "highlights", "specs", "price"):
            if not p.get(field):
                problems.append(f"{pid}: missing {field}")
        if len(p["highlights"]) < 3:
            problems.append(f"{pid}: fewer than 3 highlights")
        if p["price"] < p["cost_usd"] and p["cat"] != "robots":
            problems.append(f'{pid}: price {p["price"]} below cost {p["cost_usd"]}')

        # A real photograph wins over the generated illustration whenever we have
        # one. The drawing stays on disk either way, so a product without a photo
        # still has an image and the two never silently swap.
        photo = f"assets/img/photos/{pid}.webp"
        has_photo = os.path.exists(f"{ROOT}/{photo}")
        reg = photos.PHOTOS.get(pid, {})

        products.append({
            "id": pid, "sku": p["sku"], "name": p["name"], "tagline": p["tagline"],
            "brand": p["brand"], "category": p["cat"], "family": p["family"],
            "price": round(p["price"], 2),
            "priceCad": round(cat.nice(p["price"] * cat.USD_CAD), 2),
            "unit": p.get("unit", ""),
            "badge": p.get("badge", ""), "stock": p.get("stock", "in-stock"),
            "summary": p["summary"], "highlights": p["highlights"], "specs": p["specs"],
            "note": p.get("note", ""), "tags": p.get("tags", []),
            "image": photo if has_photo else f"assets/img/products/{pid}.svg",
            "illustration": f"assets/img/products/{pid}.svg",
            "photo": photo if has_photo else "",
            "photoKind": reg.get("kind", "") if has_photo else "",
            "photoCredit": reg.get("credit", "") if has_photo else "",
            "shopifyVariantId": IDS.get(p["sku"], {}).get("shopifyVariantId", ""),
            "stripePriceId": IDS.get(p["sku"], {}).get("stripePriceId", ""),
            "_src": p["src"], "_costUsd": p["cost_usd"], "_costSrc": p["cost_src"],
        })

    data = {
        "generated": datetime.date.today().isoformat(),
        "surplusNote": cat.SURPLUS_NOTE,
        "currency": {"base": "USD", "usdToCad": cat.USD_CAD},
        "categories": [{"id": c, "name": n, "blurb": b, "intro": i} for c, n, b, i in cat.CATEGORIES],
        "products": products,
    }
    with open(f"{ROOT}/assets/data/products.json", "w") as f:
        json.dump(data, f, indent=1, ensure_ascii=False)

    # --- Shopify product import ------------------------------------------
    # Column names are Shopify's own; the file imports without editing.
    sh_cols = ["Handle", "Title", "Body (HTML)", "Vendor", "Product Category", "Type", "Tags",
               "Published", "Option1 Name", "Option1 Value", "Variant SKU",
               "Variant Inventory Tracker", "Variant Inventory Policy",
               "Variant Fulfillment Service", "Variant Price", "Variant Requires Shipping",
               "Variant Taxable", "Image Src", "Image Alt Text", "Status"]
    with open(f"{ROOT}/dist/shopify_products.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(sh_cols)
        for p in products:
            body = (f'<p>{p["summary"]}</p><ul>'
                    + "".join(f"<li>{h}</li>" for h in p["highlights"]) + "</ul>"
                    + "".join(
                        f'<h3>{g["group"]}</h3><table>'
                        + "".join(f'<tr><th>{r["k"]}</th><td>{r["v"]}</td></tr>' for r in g["rows"])
                        + "</table>" for g in p["specs"]))
            w.writerow([p["id"], p["name"], body, p["brand"], "", p["category"],
                        ",".join(p["tags"]), "TRUE", "Title", "Default Title", p["sku"],
                        "shopify", "continue", "manual", f'{p["price"]:.2f}', "TRUE", "TRUE",
                        f'{SITE}/{p["image"]}', p["name"], "active"])

    with open(f"{ROOT}/dist/stripe_products.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "name", "description", "unit_amount_usd_cents", "currency", "sku", "image"])
        for p in products:
            w.writerow([p["id"], p["name"], p["tagline"], int(round(p["price"] * 100)), "usd",
                        p["sku"], f'{SITE}/{p["image"]}'])

    # --- provenance -------------------------------------------------------
    by_src = {"bom": [], "vendor": [], "estimate": [], "quote": []}
    for p in cat.P:
        by_src.setdefault(p["src"], []).append(p)
    lines = [
        "# Spec & price provenance",
        "",
        f"Generated by `tools/build.py` on {datetime.date.today().isoformat()}. "
        f"{len(cat.P)} SKUs.",
        "",
        "Every product records where its numbers came from. **Before this store takes a real "
        "order, every line marked `estimate` needs a supplier quote and a datasheet check.** "
        "Nothing here was invented to fill a table, but an estimate is an estimate.",
        "",
        "| Source | Meaning | SKUs |",
        "|---|---|---|",
        f"| `bom` | Taken from MABEL's own bill of materials (`BOM/data/*.csv`, priced 31 July 2026) "
        f"or measured on the robot | {len(by_src.get('bom', []))} |",
        f"| `vendor` | Published vendor datasheet or list price | {len(by_src.get('vendor', []))} |",
        f"| `estimate` | Toronto landed-cost estimate — **needs a quote** | "
        f"{len(by_src.get('estimate', []))} |",
        "",
        f"Retail price is derived, never typed: `price = nice(landed_cost × margin)`, margins in "
        f"`tools/catalog.py`. CNY→USD {cat.CNY_USD}, USD→CAD {cat.USD_CAD}.",
        "",
        "## Lines needing verification",
        "",
        "| SKU | Product | Cost source | Spec source | Cost USD | Retail USD |",
        "|---|---|---|---|---|---|",
    ]
    for p in cat.P:
        if p["src"] == "estimate" or p["cost_src"] == "estimate":
            lines.append(f'| {p["sku"]} | {p["name"]} | `{p["cost_src"]}` | `{p["src"]}` | '
                         f'{p["cost_usd"]:.2f} | {p["price"]:.2f} |')
    lines += ["", "## Verified against the MABEL BOM", "",
              "| SKU | Product | Cost USD | Retail USD |", "|---|---|---|---|"]
    for p in cat.P:
        if p["cost_src"] == "bom":
            lines.append(f'| {p["sku"]} | {p["name"]} | {p["cost_usd"]:.2f} | {p["price"]:.2f} |')
    with open(f"{ROOT}/docs/SPEC_PROVENANCE.md", "w") as f:
        f.write("\n".join(lines) + "\n")

    # --- photo sources ----------------------------------------------------
    man = photos.manifest()
    ours = [(k, v) for k, v in man.items() if v["kind"] == "local"]
    theirs = [(k, v) for k, v in man.items() if v["kind"] == "vendor"]
    plines = [
        "# Photograph sources",
        "",
        f"Generated by `tools/build.py` on {datetime.date.today().isoformat()}. "
        f"{len(man)} of {len(products)} products have a real photograph; the rest use the "
        f"generated illustration from `tools/art.py`, and the product page says so.",
        "",
        "## Ours",
        "",
        "Photographs of the actual MABEL build. No licensing question, and for surplus stock "
        "these are the honest image: it is the item you will receive.",
        "",
        "| Product | Frame | What it shows |", "|---|---|---|",
    ]
    for k, v in ours:
        src = photos.PHOTOS[k]
        plines.append(f'| `{k}` | `{os.path.basename(src["path"])}` | {v.get("note","")} |')
    plines += [
        "",
        "## Manufacturers and distributors",
        "",
        "**These need clearing before the store trades.** A product photograph is the "
        "photographer's copyright. Resellers normally get the right to use them through a "
        "distributor agreement or a written grant from the manufacturer; we have neither yet. "
        "Either obtain permission for the lines below, or replace them with our own photographs "
        "of the actual surplus stock — which is the better answer anyway, since that is what the "
        "buyer receives.",
        "",
        "| Product | Credit | Source page |", "|---|---|---|",
    ]
    for k, v in theirs:
        plines.append(f'| `{k}` | {v["credit"]} | {v["source"]} |')
    plines += ["", "## Everything else", "",
               "Uses `assets/img/products/<id>.svg`, generated by `tools/art.py`. The product page "
               "labels it *\"Illustration — we have not photographed this part yet.\"* Replace one "
               "by adding a `local(...)` entry to `tools/photos.py` and running "
               "`python3 tools/photos.py --fetch`."]
    with open(f"{ROOT}/docs/PHOTO_SOURCES.md", "w") as f:
        f.write("\n".join(plines) + "\n")

    # --- sitemap ----------------------------------------------------------
    pages = ["", "store.html", "mabel.html", "about.html", "support.html", "account.html", "bag.html"]
    urls = [f"{SITE}/{p}" for p in pages] + [f"{SITE}/product.html?id={p['id']}" for p in products]
    with open(f"{ROOT}/sitemap.xml", "w") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n'
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                + "".join(f"  <url><loc>{u.replace('&', '&amp;')}</loc></url>\n" for u in urls)
                + "</urlset>\n")

    # --- report -----------------------------------------------------------
    cats: dict[str, int] = {}
    for p in products:
        cats[p["category"]] = cats.get(p["category"], 0) + 1
    print(f"{len(products)} SKUs, {len(data['categories'])} categories")
    for c, n, *_ in cat.CATEGORIES:
        lo = min((p["price"] for p in products if p["category"] == c), default=0)
        hi = max((p["price"] for p in products if p["category"] == c), default=0)
        print(f"  {n:<12} {cats.get(c,0):>3} SKUs   ${lo:,.0f} – ${hi:,.0f}")
    n_photo = sum(1 for p in products if p["photo"])
    n_local = sum(1 for p in products if p["photoKind"] == "local")
    print(f"photography: {n_photo}/{len(products)} products have a real photograph "
          f"({n_local} shot by us, {n_photo - n_local} from the manufacturer); "
          f"the rest use their generated illustration")
    est = sum(1 for p in cat.P if p["src"] == "estimate")
    print(f"provenance: {sum(1 for p in cat.P if p['src']=='bom')} bom, "
          f"{sum(1 for p in cat.P if p['src']=='vendor')} vendor, {est} estimate "
          f"(listed in docs/SPEC_PROVENANCE.md)")
    if problems:
        print("\nPROBLEMS:")
        for pr in problems:
            print("  !", pr)
        return 1
    print("no problems")
    return 0


if __name__ == "__main__":
    sys.exit(main())

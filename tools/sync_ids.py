#!/usr/bin/env python3
"""
sync_ids.py — write Shopify variant ids and Stripe price ids back into the site.

After importing dist/shopify_products.csv into Shopify (or creating prices in
Stripe), export the ids and run this so the storefront can build a real cart.

    # Shopify: Products → Export → CSV, or the Admin API
    python3 tools/sync_ids.py --shopify shopify_export.csv
    # Stripe:  stripe prices list --limit 200 > prices.json
    python3 tools/sync_ids.py --stripe prices.json

Matching is by SKU, which is why every product in tools/catalog.py has one.
Ids are written into assets/data/products.json; re-running tools/build.py would
overwrite them, so this script also stores them in data/ids.json and build.py
reads that file back in.
"""
import argparse, csv, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDS = f"{ROOT}/assets/data/ids.json"


def load_ids():
    try:
        with open(IDS) as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--shopify", help="Shopify product export CSV")
    ap.add_argument("--stripe", help="Stripe `prices list` JSON")
    a = ap.parse_args()
    if not (a.shopify or a.stripe):
        ap.print_help()
        return 1

    ids = load_ids()

    if a.shopify:
        with open(a.shopify, newline="") as f:
            n = 0
            for row in csv.DictReader(f):
                sku = (row.get("Variant SKU") or "").strip()
                vid = (row.get("Variant ID") or row.get("ID") or "").strip()
                if not sku or not vid:
                    continue
                # Storefront API needs the GID form, not the numeric id.
                gid = vid if vid.startswith("gid://") else f"gid://shopify/ProductVariant/{vid}"
                ids.setdefault(sku, {})["shopifyVariantId"] = gid
                n += 1
        print(f"shopify: {n} variant ids")

    if a.stripe:
        with open(a.stripe) as f:
            blob = json.load(f)
        rows = blob.get("data", blob) if isinstance(blob, dict) else blob
        n = 0
        for p in rows:
            sku = (p.get("metadata") or {}).get("sku") or (p.get("nickname") or "")
            if not sku:
                continue
            ids.setdefault(sku, {})["stripePriceId"] = p["id"]
            n += 1
        print(f"stripe: {n} price ids")

    os.makedirs(os.path.dirname(IDS), exist_ok=True)
    with open(IDS, "w") as f:
        json.dump(ids, f, indent=1, sort_keys=True)

    # patch the live products.json so the change takes effect without a rebuild
    pj = f"{ROOT}/assets/data/products.json"
    with open(pj) as f:
        data = json.load(f)
    hit = 0
    for p in data["products"]:
        for k, v in ids.get(p["sku"], {}).items():
            p[k] = v
            hit += 1
    with open(pj, "w") as f:
        json.dump(data, f, indent=1, ensure_ascii=False)
    print(f"wrote {hit} ids into assets/data/products.json and assets/data/ids.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())

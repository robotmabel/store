"""
photos.py — real product photography for the catalogue.

The store started with generated SVG illustrations. Those are honest but they
are drawings, and a shopper buying a used DM8009P wants to see a DM8009P. This
module holds the photo registry and the normaliser that makes a folder of
wildly inconsistent vendor JPEGs look like one studio shot the way Apple's
grid does.

TWO SOURCES, and the difference matters:

  local   A photograph the shop took of the actual item, usually from the
          MABEL build itself. No licensing question, and for surplus stock it
          is the only honest option — it is the item you will receive.
  vendor  The manufacturer's or distributor's own product photograph, fetched
          from their public product page. `source` records where, and `credit`
          who. See docs/PHOTO_SOURCES.md — these need a distributor agreement
          or written permission before the store trades.

Anything with no entry here keeps its generated SVG, and build.py records
which is which so the difference stays visible rather than assumed.

    python3 tools/photos.py --fetch     download and normalise everything
    python3 tools/photos.py --sheet     build contact sheets for eyeballing
"""
from __future__ import annotations
import argparse, io, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = f"{ROOT}/.photo-cache"          # downloads, git-ignored
OUT = f"{ROOT}/assets/img/photos"     # normalised, committed
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

# Canvas: square, on the same ground the cards use, with the subject inset so
# nothing touches an edge. 1200px covers a 2x retina 600px tile.
#
# BG MUST TRACK --bg-2 IN assets/css/store.css. The normaliser floods each
# vendor photo's studio background out to this colour so it sits seamlessly in
# the tile; if the two drift apart every photo grows a visible box. Re-run
# `python3 tools/photos.py --fetch --force` after any change here.
SIZE = 1200
MARGIN = 0.085
BG = (244, 234, 210)          # --bone / --bg-2

PHOTOS: dict[str, dict] = {}


def local(pid: str, path: str, note: str = "", crop: tuple | None = None, wide=False):
    """A photograph of the actual item, taken by us. `wide` also writes an
    unsquared <id>-wide.webp for hero use."""
    PHOTOS[pid] = {"kind": "local", "path": os.path.expanduser(path),
                   "credit": "MABEL Robotics", "note": note, "crop": crop, "wide": wide}


def vendor(pid: str, url: str, source: str, credit: str, note: str = "",
           crop: tuple | None = None):
    """The manufacturer's or distributor's own product photograph."""
    PHOTOS[pid] = {"kind": "vendor", "url": url, "source": source,
                   "credit": credit, "note": note, "crop": crop}


# ---------------------------------------------------------------- normalise --
def normalise(src: str, dst: str, crop=None, square=True) -> tuple[int, int]:
    from PIL import Image, ImageChops

    im = Image.open(src)
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        flat = Image.new("RGB", im.size, BG)
        flat.paste(im, mask=im.split()[-1])
        im = flat
    else:
        im = im.convert("RGB")

    if crop:                       # (l, t, r, b) as fractions of the image
        w, h = im.size
        im = im.crop((int(crop[0] * w), int(crop[1] * h),
                      int(crop[2] * w), int(crop[3] * h)))

    # Most vendor shots sit on their own white field. Dropped straight onto the
    # #f5f5f7 stage that reads as a white rectangle floating inside a grey tile,
    # which is exactly the seam a product grid must not have. Flood the
    # background in from the edges so it becomes the canvas colour — connected
    # from the border only, so white *parts of the product* survive.
    # Fill to a sentinel rather than straight to BG: PIL's floodfill bails out
    # when the fill colour is within `thresh` of the seed pixel, and #f5f5f7 is
    # only 28 away from white — so filling white directly to BG did nothing at
    # any threshold wide enough to cross JPEG noise.
    from PIL import ImageDraw
    SENT = (255, 0, 255)
    w0, h0 = im.size
    seeds = [(0, 0), (w0 - 1, 0), (0, h0 - 1), (w0 - 1, h0 - 1),
             (w0 // 2, 0), (w0 // 2, h0 - 1), (0, h0 // 2), (w0 - 1, h0 // 2)]
    filled = False
    for sx, sy in seeds:
        px = im.getpixel((sx, sy))[:3]
        if px == SENT:
            continue
        if min(px) > 228:                       # a light, uniform studio ground
            ImageDraw.floodfill(im, (sx, sy), SENT, thresh=42)
            filled = True
    if filled:
        im.putdata([BG if p == SENT else p for p in im.getdata()])

    # Trim the remaining uniform border, using the corner pixel as the reference
    # so it works on white, grey or black grounds.
    ref = Image.new("RGB", im.size, im.getpixel((0, 0)))
    diff = ImageChops.difference(im, ref).convert("L").point(lambda p: 255 if p > 18 else 0)
    box = diff.getbbox()
    if box:
        w, h = im.size
        pad_x, pad_y = int(w * 0.005), int(h * 0.005)
        im = im.crop((max(0, box[0] - pad_x), max(0, box[1] - pad_y),
                      min(w, box[2] + pad_x), min(h, box[3] + pad_y)))

    if not square:
        # Hero use: keep the frame's own aspect ratio. Padding a landscape
        # photograph out to a square just puts a cream border round it.
        im.thumbnail((1800, 1800), Image.LANCZOS)
        im.save(dst, "WEBP", quality=86, method=6)
        return im.size

    # Fit into the square with an even margin.
    inner = int(SIZE * (1 - 2 * MARGIN))
    im.thumbnail((inner, inner), Image.LANCZOS)
    canvas = Image.new("RGB", (SIZE, SIZE), BG)
    canvas.paste(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2))
    canvas.save(dst, "WEBP", quality=88, method=6)
    return im.size


# -------------------------------------------------------------------- fetch --
def fetch(only: set[str] | None = None, force=False) -> int:
    os.makedirs(RAW, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    ok = bad = 0
    for pid, p in PHOTOS.items():
        if only and pid not in only:
            continue
        out = f"{OUT}/{pid}.webp"
        if os.path.exists(out) and not force:
            ok += 1
            continue
        raw = f"{RAW}/{pid}.bin"
        try:
            if p["kind"] == "local":
                if not os.path.exists(p["path"]):
                    print(f"  MISSING {pid}: {p['path']}")
                    bad += 1
                    continue
                raw = p["path"]
            elif not os.path.exists(raw) or force:
                r = subprocess.run(
                    ["curl", "-sSL", "--max-time", "40", "-A", UA,
                     "-e", p.get("source", ""), "-o", raw, p["url"]],
                    capture_output=True)
                if r.returncode != 0 or not os.path.exists(raw) or os.path.getsize(raw) < 3000:
                    print(f"  FAIL    {pid}: download {os.path.getsize(raw) if os.path.exists(raw) else 0}b")
                    bad += 1
                    continue
            w, h = normalise(raw, out, p.get("crop"))
            note = ""
            if p.get("wide"):
                ww, wh = normalise(raw, f"{OUT}/{pid}-wide.webp", p.get("crop"), square=False)
                note = f"  + wide {ww}x{wh}"
            print(f"  ok      {pid:<26} {w}x{h}  [{p['kind']}]{note}")
            ok += 1
        except Exception as e:
            print(f"  FAIL    {pid}: {type(e).__name__} {e}")
            bad += 1
    print(f"\n{ok} photos ready, {bad} failed, {len(PHOTOS)} registered")
    return bad


# ------------------------------------------------------------- contact sheet --
def sheet(tag="all") -> None:
    """An HTML grid of every photo next to the product it claims to be, so a
    human can confirm the picture matches the part before it ships."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import catalog as cat
    by_id = {p["id"]: p for p in cat.P}
    rows = []
    for pid, p in PHOTOS.items():
        if not os.path.exists(f"{OUT}/{pid}.webp"):
            continue
        prod = by_id.get(pid)
        rows.append(
            f'<figure><img src="../assets/img/photos/{pid}.webp" alt="">'
            f'<figcaption><b>{prod["name"] if prod else pid}</b>'
            f'<span>{prod["tagline"] if prod else ""}</span>'
            f'<em>{p["credit"]} &middot; {p["kind"]}</em></figcaption></figure>')
    os.makedirs(f"{ROOT}/scripts", exist_ok=True)
    with open(f"{ROOT}/scripts/photo-sheet-{tag}.html", "w") as f:
        f.write(
            "<!doctype html><meta charset=utf-8><style>"
            "body{margin:0;background:#fff;font:12px -apple-system,Helvetica;color:#1d1d1f}"
            ".g{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;padding:12px}"
            "figure{margin:0}img{width:100%;border-radius:12px;display:block}"
            "figcaption{padding:5px 2px}b{display:block;font-size:12px}"
            "span{display:block;color:#6e6e73;font-size:11px}"
            "em{display:block;color:#a1a1a6;font-size:10px;font-style:normal}"
            f"</style><div class=g>{''.join(rows)}</div>")
    print(f"scripts/photo-sheet-{tag}.html — {len(rows)} photos")


def manifest() -> dict:
    return {pid: {k: v for k, v in p.items() if k in ("kind", "source", "credit", "note")}
            for pid, p in PHOTOS.items() if os.path.exists(f"{OUT}/{pid}.webp")}


# ============================================================== THE REGISTRY ==
# Photographs of the actual items, from the MABEL build.
M = "~/Desktop/MABEL/marketing"
# The build photographs are 7952 x 5304, so a single part can be cropped out of
# one frame at full print resolution. Crops are (left, top, right, bottom) as
# fractions, measured off the frame rather than guessed.
local("mabel-assembled", f"{M}/hero_photo_1.JPG",
      "MABEL as built and calibrated, in the lab.", wide=True)
local("mabel-kit", f"{M}/working_progress_4.JPG",
      "Part-built, with the subsystem parts still on the bench behind it.",
      crop=(0.02, 0.06, 0.86, 1.0), wide=True)
local("mabel-arm", f"{M}/working_progress_4.JPG",
      "A single 7-DOF arm, shoulder to hand.", crop=(0.475, 0.24, 0.635, 0.99))
local("orca-hand-pair", f"{M}/working_progress_4.JPG",
      "Both ORCA hands on the robot, tendoned and tensioned.",
      crop=(0.492, 0.68, 0.795, 1.0))

# Manufacturer / distributor photographs. `source` is where each came from.
vendor("damiao-dm-j4310",
       "https://cdn11.bigcommerce.com/s-zj3gvq95ll/images/stencil/1280x1280/products/740/2563/-2%5F%5F84481.1743063375.jpg?c=1",
       "https://store.foxtech.com/dm-j4310-2ec-v1-1-mit-driven-brushless-servo-joint-motor-with-dual-encoders-gear-reduction-for-robotic-arms/",
       "Foxtech Robot")
vendor("damiao-dm4340",
       "https://cdn11.bigcommerce.com/s-zj3gvq95ll/images/stencil/1280x1280/products/763/2684/J4340-main-1%5F%5F71729.1749797299.jpg?c=1",
       "https://store.foxtech.com/dm-j4340-2ec-mit-driven-brushless-servo-joint-motor-with-dual-encoders-gear-reduction-for-robotic-arms-actuator-for-robot/",
       "Foxtech Robot")
vendor("damiao-dm8009p",
       "https://cdn11.bigcommerce.com/s-zj3gvq95ll/images/stencil/1280x1280/products/744/2575/-1%5F%5F49323.1743127399.jpg?c=1",
       "https://store.foxtech.com/dm-j8009p-2ec-mit-driven-brushless-servo-joint-motor-with-dual-encoders-for-robotic-arms-actuator-for-robot/",
       "Foxtech Robot")
# The robotis.us shot has an "Out of Stock" badge burned into the pixels, and the
# XL330 gallery images on that page are a different model. This is the XC330's
# own item folder on en.robotis.com.
vendor("dynamixel-xc330",
       "https://en.robotis.com/data/item/902-0170-000/XL330_500x500.png",
       "https://en.robotis.com/shop_en/item.php?it_id=902-0170-000", "ROBOTIS")
vendor("teensy41", "https://www.pjrc.com/store/teensy41_4.jpg",
       "https://www.pjrc.com/store/teensy41.html", "PJRC")
vendor("realsense-d405", "https://www.realsenseai.com/wp-content/uploads/2025/07/D-405.png",
       "https://www.realsenseai.com/products/stereo-depth-camera-d405/", "RealSense")
# Slamtec's C1 page turned out to hold only spec infographics and robot scenes,
# no clean shot of the unit. Dropped rather than shipping a graphic as a photo —
# lidar-c1 keeps its generated illustration until a real photo is taken.

vendor("xiaomi-cybergear-rs01",
       "https://cdn.shopify.com/s/files/1/0673/6848/5000/files/XiaoMi-CyberGear-Motor-main-1-1.jpg",
       "https://aifitlab.com/products/xiaomi-cybergear-micromotor", "AIFITLAB")
vendor("unitree-go-m8010-6",
       "https://cdn.shopify.com/s/files/1/0673/6848/5000/files/GO-M8010-6-1-1.png",
       "https://aifitlab.com/products/unitree-go-m8010-6-motor", "AIFITLAB")
vendor("unitree-a1",
       "https://cdn.shopify.com/s/files/1/0673/6848/5000/files/Unitee_A1_Motor-4.png",
       "https://aifitlab.com/products/unitree-a1-motor", "AIFITLAB")
vendor("pi5",
       "https://assets.raspberrypi.com/static/c671804c05a51efc4e3c2a1bdcbafbcf/e58b5/raspberry-pi-5.png",
       "https://www.raspberrypi.com/products/raspberry-pi-5/", "Raspberry Pi Ltd")

vendor("realsense-d435i",
       "https://cdn.shopify.com/s/files/1/0673/6848/5000/files/intel_realsense_D435i_main_4.jpg",
       "https://aifitlab.com/products/intel-realsense-depth-camera-d435i", "AIFITLAB")
vendor("realsense-d455",
       "https://cdn.shopify.com/s/files/1/0673/6848/5000/files/intel_realsense_D455_main_2.jpg",
       "https://aifitlab.com/products/intel-realsense-depth-camera-d455", "AIFITLAB")
vendor("feetech-sts3215",
       "https://cdn.shopify.com/s/files/1/0709/8790/7162/files/STS3215-1.png",
       "https://robotopian.com/products/feetech-sts3215-servo", "Robotopian")

vendor("feetech-hl3915m",
       "https://cdn.shopify.com/s/files/1/0673/6848/5000/files/HL3915-main-1.jpg",
       "https://aifitlab.com/products/feetech-hl-3915-servo-motor", "AIFITLAB")
vendor("feetech-hl3930m",
       "https://cdn.shopify.com/s/files/1/0673/6848/5000/files/HL3930-main-4.jpg",
       "https://aifitlab.com/products/feetech-hl-3930-servo-motor", "AIFITLAB")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--fetch", action="store_true")
    ap.add_argument("--sheet", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--only", default="")
    ap.add_argument("--tag", default="all")
    a = ap.parse_args()
    only = set(x for x in a.only.split(",") if x) or None
    rc = 0
    if a.fetch:
        rc = fetch(only, a.force)
    if a.sheet:
        sheet(a.tag)
    if not (a.fetch or a.sheet):
        ap.print_help()
    sys.exit(0 if rc == 0 else 1)

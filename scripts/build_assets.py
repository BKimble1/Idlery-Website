#!/usr/bin/env python3
"""Regenerate every image in site/assets/img/ from the originals in src-assets/.

    pip install Pillow numpy
    python3 scripts/build_assets.py

Nothing in src-assets/ is modified. Every output is a resize or a straight crop
of a real capture, photograph or render; nothing inside a product's interface
is redrawn. Rules carried over from the previous idlery.com build:

  * never upscale: a width larger than the source is emitted at the source's
    own width instead;
  * iPhone captures are cropped *below* the iOS status bar rather than having
    one painted in, because the captures were taken at different times;
  * WebP at each width, plus one JPEG at the largest width as a fallback.

The hero video and its posters are made by scripts/build_montage.py, and the
social cards by scripts/make_og.mjs.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src-assets"
OUT = ROOT / "site" / "assets" / "img"
SIZES: dict[str, list[int]] = {}   # stem -> [w, h] of the largest output, for the HTML


def log(msg: str) -> None:
    print(f"  {msg}")


def emit(im: Image.Image, stem: str, widths: tuple[int, ...], *, jpeg: bool = True, q: int = 82) -> None:
    im = im.convert("RGB")
    widths = tuple(sorted({min(w, im.width) for w in widths}))
    for w in widths:
        h = round(im.height * w / im.width)
        small = im.resize((w, h), Image.LANCZOS) if w != im.width else im
        path = OUT / f"{stem}-{w}.webp"
        small.save(path, "WEBP", quality=q, method=6)
        log(f"{path.name:36s} {w}x{h}  {path.stat().st_size // 1024} KB")
    w = widths[-1]
    h = round(im.height * w / im.width)
    SIZES[stem] = [w, h]
    if jpeg:
        path = OUT / f"{stem}-{w}.jpg"
        (im.resize((w, h), Image.LANCZOS) if w != im.width else im).save(path, "JPEG", quality=86, optimize=True, progressive=True)
        log(f"{path.name:36s} {w}x{h}  {path.stat().st_size // 1024} KB")


def crop_ratio(im: Image.Image, ratio: float, *, cx: float = 0.5, cy: float = 0.5) -> Image.Image:
    """The largest box of the given aspect ratio, centred on (cx, cy) as fractions."""
    w, h = im.size
    if w / h > ratio:
        nw, nh = round(h * ratio), h
    else:
        nw, nh = w, round(w / ratio)
    x = min(max(round(cx * w - nw / 2), 0), w - nw)
    y = min(max(round(cy * h - nh / 2), 0), h - nh)
    return im.crop((x, y, x + nw, y + nh))


# ------------------------------------------------------------------ brand --

def brand() -> None:
    svg = (SRC / "brand" / "idlery-wordmark.svg").read_text()
    (OUT / "idlery-wordmark.svg").write_text(svg)
    # The same paths in a lighter tint of the teal, for dark grounds.
    (OUT / "idlery-wordmark-light.svg").write_text(svg.replace("#39a5ab", "#7fcfd4"))
    log("idlery-wordmark.svg, idlery-wordmark-light.svg (vector, traced from the 1216px wordmark)")

    # Favicons and touch icons are the Idlery app icon itself.
    icon = Image.open(SRC / "brand" / "idlery-app-icon-1024.png").convert("RGB")
    for size, name in ((512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png"), (32, "favicon-32.png")):
        icon.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)
    # Nothing rounds a favicon for you, so the .ico gets the corners baked in.
    rounded = icon.resize((256, 256), Image.LANCZOS).convert("RGBA")
    mask = Image.new("L", (256, 256), 0)
    from PIL import ImageDraw
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, 255, 255), radius=56, fill=255)
    rounded.putalpha(mask)
    rounded.save(ROOT / "site" / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    log("favicons, touch icon and manifest icons from the Idlery app icon")

    shutil.copyfile(SRC / "brand" / "apple-download-badge-us-uk-black.svg", OUT / "apple-download-badge.svg")
    shutil.copyfile(SRC / "brand" / "karnwold-icon.svg", OUT / "karnwold-icon.svg")
    log("Apple's badge and Karnwold's mark copied byte for byte")

    cc = Image.open(SRC / "brand" / "corecredit-appicon-1024.png").convert("RGB")
    for size in (128, 256):
        cc.resize((size, size), Image.LANCZOS).save(OUT / f"corecredit-icon-{size}.png", optimize=True)

    # Elemora's mark has generous margin; crop a square around its own artwork
    # (the same rule as the previous site) so it sits level with CoreCredit's.
    el = Image.open(SRC / "brand" / "elemora-appicon-1254.png").convert("RGB")
    a = np.asarray(el).astype(int)
    ground = np.array(el.getpixel((4, 4)))
    ys, xs = np.nonzero(np.abs(a - ground).sum(axis=2) > 30)
    cx, cy = (xs.min() + xs.max()) // 2, (ys.min() + ys.max()) // 2
    half = round(max(xs.max() - xs.min(), ys.max() - ys.min()) / 2 / 0.62)
    half = int(min(half, cx, cy, el.width - cx, el.height - cy))
    el = el.crop((cx - half, cy - half, cx + half, cy + half))
    for size in (128, 256):
        el.resize((size, size), Image.LANCZOS).save(OUT / f"elemora-icon-{size}.png", optimize=True)
    log("CoreCredit and Elemora app icons")


# ------------------------------------------------------------ CoreCredit --

CC_STATUS = 125   # rows of iOS status bar (+ uniform ground) on a 946px-wide capture


def cc_phone(name: str) -> Image.Image:
    im = Image.open(SRC / "corecredit" / name).convert("RGB")
    if im.width != 946:
        im = im.resize((946, round(im.height * 946 / im.width)), Image.LANCZOS)
    return im.crop((0, CC_STATUS, 946, im.height))


def corecredit() -> None:
    for name, stem in (("phone-dashboard.png", "cc-dashboard"), ("phone-cores.png", "cc-cores"),
                       ("phone-scan.png", "cc-scan"), ("phone-dispute.png", "cc-dispute"),
                       ("phone-history.png", "cc-history")):
        emit(cc_phone(name), stem, (440, 880))
    dash = Image.open(SRC / "corecredit" / "phone-dashboard.png").convert("RGB")
    # Money at risk, Overdue and the Add core button. x 16..930 leaves an equal
    # 24px margin either side of the cards and drops the iOS scroll indicator
    # (columns 932..938) that the capture caught mid-fade.
    emit(dash.crop((16, 348, 930, 1034)), "card-corecredit", (640, 914))
    emit(dash.crop((16, 352, 930, 923)), "wide-corecredit", (800, 914))
    ipad = Image.open(SRC / "corecredit" / "ipad-dashboard.png").convert("RGB")
    # Below the iPad status bar (48px at this scale), the full dashboard.
    emit(ipad.crop((0, 48, 2360, 1640)), "cc-ipad-dashboard", (720, 1440))


# --------------------------------------------------------------- Elemora --

EL_STATUS = 141   # the iPhone's top safe-area inset at 3x


def elemora() -> None:
    for name, stem in (("01-table.png", "el-table"), ("02-element-oxygen.png", "el-oxygen"),
                       ("04-study.png", "el-study"),
                       ("05-identify.png", "el-identify"), ("06-build.png", "el-build"),
                       ("07-progress.png", "el-progress")):
        im = Image.open(SRC / "elemora" / name).convert("RGB")
        emit(im.crop((0, EL_STATUS, im.width, im.height)), stem, (440, 880))
    table = Image.open(SRC / "elemora" / "01-table.png").convert("RGB")
    emit(table.crop((30, 870, 1140, 1702)), "card-elemora", (640, 1110))      # the whole table, H to Lr
    emit(table.crop((0, 915, 1170, 1646)), "wide-elemora", (800, 1170))       # the table alone


# -------------------------------------------------------------- Karnwold --

def karnwold() -> None:
    src = SRC / "karnwold"
    online = Image.open(src / "01-online-game.png").convert("RGB")
    game = src / "table-1920.png"   # a fresh 1920x1080 capture, when there is one
    if game.exists():
        # Round 3 of an offline game against three bots, clock-stepped capture
        # of the production build at 1920x1080. Every crop starts below the
        # game's header bar (58px); the card keeps the four villages and the
        # decks, stopping short of the side panels and the resource bar.
        g = Image.open(game).convert("RGB")
        emit(g.crop((0, 58, 1920, 1080)), "kw-game", (720, 1200))
        emit(g.crop((312, 58, 1584, 1012)), "card-karnwold", (640, 1088))
        emit(g.crop((0, 58, 1920, 1080)), "wide-karnwold", (800, 1320))
    else:
        emit(online, "kw-game", (720, 1280))
        emit(online.crop((0, 40, 960, 760)), "card-karnwold", (640, 960))
        emit(crop_ratio(online, 16 / 10), "wide-karnwold", (800, 1280))
    emit(Image.open(src / "02-prototype-table.png"), "kw-prototype", (600, 1200))
    pieces = Image.open(src / "03-pieces.jpg").convert("RGB")
    emit(pieces.crop((0, 210, 1024, 786)), "kw-pieces", (600, 1024))
    emit(Image.open(src / "04-concept-spread.png"), "kw-concept", (600, 1200))


# --------------------------------------------------------------- Fab One --

def fabone() -> None:
    """Frames rendered by Fab One itself (its WebGL buffer on its virtual clock,
    no interface in frame): see montage/README.md for the lesson URLs."""
    src = SRC / "fabone"
    for stem in ("bay", "scanner", "develop"):
        emit(Image.open(src / f"{stem}.png"), f"fab-{stem}", (800, 1600))
    # The card: the scanner's lens column with the light path on, 4:3.
    emit(crop_ratio(Image.open(src / "scanner.png").convert("RGB"), 4 / 3, cx=0.49), "card-fabone", (640, 1088))
    # The Work tile: a resist-coated wafer in the developer bowl, 16:10.
    emit(crop_ratio(Image.open(src / "wafer.png").convert("RGB"), 16 / 10, cx=0.42), "wide-fabone", (800, 1320))


# ------------------------------------------------------------- portfolio --

def portfolio() -> None:
    # The ENP 359 strain-gage lab simulator with its own "Working example"
    # loaded, captured at 1600x1000 from a local build of the app. The crop keeps
    # the wired breadboard, the multimeter and the beam, and drops the side panels.
    cap = Image.open(SRC / "portfolio" / "straingage-capture.png").convert("RGB")
    emit(cap.crop((186, 40, 1216, 972)), "pf-straingage", (560, 1030))


# ----------------------------------------------------------------- legacy --

def legacy() -> None:
    """Files the previous idlery.com published that may be linked from elsewhere
    (social-card caches, notes, other sites). Kept byte for byte under their old
    names so those URLs keep resolving."""
    src = SRC / "legacy"
    for p in sorted(src.glob("*")):
        shutil.copyfile(p, OUT / p.name)
    log(f"{len(list(src.glob('*')))} legacy files kept at their old URLs")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for step in (brand, corecredit, elemora, karnwold, fabone, portfolio, legacy):
        print(step.__name__)
        step()
    (ROOT / "src-assets" / "sizes.json").write_text(json.dumps(SIZES, indent=1, sort_keys=True) + "\n")
    print(f"wrote src-assets/sizes.json ({len(SIZES)} images)")


if __name__ == "__main__":
    main()

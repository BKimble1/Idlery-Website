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

Featured-work cards are 4:3 and emitted at 440 and 880 px. A card is either a
chosen crop of a real frame, or, for a product that exists only as a phone
screen, one real screen set on a ground in the product's own accent colour and
entering from the bottom edge (see product_card). Nothing inside a screen is
drawn.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

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


CARD = (440, 880)          # featured-work card widths (4:3)


def product_card(screen: Image.Image, ground: tuple, ground2: tuple, *, width: int = 880, scale: float, top: int,
                 radius: int = 34) -> Image.Image:
    """One real phone screen on a vertical gradient of the product's own colours,
    centred, rising from the bottom edge of a 4:3 frame, with a soft shadow.
    `screen` is already cropped below the status bar; it is only scaled down."""
    W, H = width, width * 3 // 4
    top_c, bot_c = np.array(ground, float), np.array(ground2, float)
    ramp = np.linspace(0, 1, H)[:, None, None]
    bg = Image.fromarray((top_c * (1 - ramp) + bot_c * ramp).repeat(W, axis=1).astype(np.uint8), "RGB")
    sw = round(screen.width * scale)
    sh = round(screen.height * scale)
    shot = screen.resize((sw, sh), Image.LANCZOS)
    x = (W - sw) // 2
    mask = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, sw - 1, sh + radius), radius=radius, fill=255)
    shadow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(shadow).rounded_rectangle((x - 6, top + 18, x + sw + 6, H + 60), radius=radius, fill=120)
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))
    bg = Image.composite(Image.new("RGB", (W, H), (6, 14, 40)), bg, shadow)
    bg.paste(shot, (x, top), mask)
    return bg


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
    cc.resize((256, 256), Image.LANCZOS).save(OUT / "corecredit-icon-256.png", optimize=True)

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
    el.resize((256, 256), Image.LANCZOS).save(OUT / "elemora-icon-256.png", optimize=True)
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
    # The card: the dashboard screen, below the status bar, rising from the
    # bottom of a ground in CoreCredit's accent blue (Palette.accent #0053FD),
    # so the money-at-risk figures and the Add core button lead.
    # x 15..931 keeps the cards' own margins equal and drops the iOS scroll
    # indicator (columns 932..938) that the capture caught mid-fade.
    emit(product_card(cc_phone("phone-dashboard.png").crop((15, 0, 931, 1923)), (0, 83, 253), (6, 36, 128),
                      scale=0.64, top=78), "card-corecredit", CARD)
    # The Work tile: Money at risk and Overdue. x 16..930 leaves an equal
    # 24px margin either side of the cards and drops the iOS scroll indicator
    # (columns 932..938) that the capture caught mid-fade.
    emit(dash.crop((16, 352, 930, 923)), "wide-corecredit", (800, 914))
    ipad = Image.open(SRC / "corecredit" / "ipad-dashboard.png").convert("RGB")
    # Below the iPad status bar (48px at this scale), the full dashboard.
    emit(ipad.crop((0, 48, 2360, 1640)), "cc-ipad-dashboard", (720, 1440))


# --------------------------------------------------------------- Elemora --

EL_STATUS = 141   # the iPhone's top safe-area inset at 3x


def elemora() -> None:
    for name, stem in (("02-element-oxygen.png", "el-oxygen"),
                       ("04-study.png", "el-study"),
                       ("05-identify.png", "el-identify"), ("06-build.png", "el-build"),
                       ("07-progress.png", "el-progress")):
        im = Image.open(SRC / "elemora" / name).convert("RGB")
        emit(im.crop((0, EL_STATUS, im.width, im.height)), stem, (440, 880))
    table = Image.open(SRC / "elemora" / "01-table.png").convert("RGB")
    emit(table.crop((0, 915, 1170, 1646)), "wide-elemora", (800, 1170))       # the table alone
    # The card: Build, with caffeine assembled: its formula, molar mass and
    # skeletal structure, on the screen's own pale blue ground.
    build = Image.open(SRC / "elemora" / "06-build.png").convert("RGB")
    screen = build.crop((0, 280, build.width, build.height))                   # below the Build title bar
    emit(product_card(screen, (232, 240, 249), (205, 222, 242), scale=0.5, top=34), "card-elemora", CARD)


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
        emit(g.crop((312, 58, 1584, 1012)), "card-karnwold", CARD)
        emit(g.crop((0, 58, 1920, 1080)), "wide-karnwold", (800, 1320))
    else:
        emit(online, "kw-game", (720, 1280))
        emit(online.crop((0, 40, 960, 760)), "card-karnwold", CARD)
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
    # The card: the scanner's lens column with the light path on, 4:3.
    emit(crop_ratio(Image.open(src / "scanner.png").convert("RGB"), 4 / 3, cx=0.49), "card-fabone", CARD)
    # The Work tile: a resist-coated wafer in the developer bowl, 16:10.
    emit(crop_ratio(Image.open(src / "wafer.png").convert("RGB"), 16 / 10, cx=0.42), "wide-fabone", (800, 1320))


# ------------------------------------------------------ Rocket Engineering --

def rocket() -> None:
    """Frames rendered by the Rocket Engineering simulator itself (its WebGL
    buffer on its virtual clock, no interface in frame): see montage/capture/rocket/."""
    src = SRC / "rocket"
    # The card: the payload fairing separating over the curve of the Earth.
    fairing = Image.open(src / "fairing.png").convert("RGB")
    emit(crop_ratio(fairing, 4 / 3, cx=0.5), "card-rocket", CARD)
    # The Work tile: stage separation, the booster falling away.
    sep = Image.open(src / "stage-separation.png").convert("RGB")
    emit(crop_ratio(sep, 16 / 10, cx=0.5), "wide-rocket", (800, 1320))


# -------------------------------------------------------------- Holograph --

def holograph() -> None:
    """iPad simulator screenshots from Holograph's own UI test run
    (BKimble1/Holograph, branch ci-screenshots). Crops keep the status bar and
    the settings button out of frame."""
    src = SRC / "holograph"
    portrait = Image.open(src / "03-launcher-portrait.png").convert("RGB")   # 2064x2752
    emit(portrait.crop((0, 520, 2064, 2068)), "card-holograph", CARD)       # Scanpoint and its neighbours
    land = Image.open(src / "01-launcher-landscape.png").convert("RGB")     # 2752x2064, rotated upright
    emit(land.crop((0, 222, 2752, 1942)), "wide-holograph", (800, 1320))


# ------------------------------------------------------------------ marks --

def marks() -> None:
    """App icons of projects not yet captured in use, from each project's own
    asset catalogue: OffRent Ledger, WallField (BKimble1/Magshift), Turbid."""
    src = SRC / "marks"
    for name, stem in (("offrent-appicon-1024.png", "offrent-icon"), ("wallfield-appicon-1024.png", "wallfield-icon"),
                       ("turbid-appicon.png", "turbid-icon")):
        Image.open(src / name).convert("RGB").resize((256, 256), Image.LANCZOS).save(OUT / f"{stem}-256.png", optimize=True)
    log("OffRent Ledger, WallField and Turbid icons")


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
    for step in (brand, corecredit, elemora, karnwold, fabone, rocket, holograph, marks, legacy):
        print(step.__name__)
        step()
    (ROOT / "src-assets" / "sizes.json").write_text(json.dumps(SIZES, indent=1, sort_keys=True) + "\n")
    print(f"wrote src-assets/sizes.json ({len(SIZES)} images)")


if __name__ == "__main__":
    main()

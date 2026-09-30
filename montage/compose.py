#!/usr/bin/env python3
"""Compose moving clips for the montage from real app captures.

    python3 montage/compose.py                 # the product walls, all three shapes
    python3 montage/compose.py phone           # one shape (landscape, portrait, phone)
    python3 montage/compose.py elemora         # the earlier Elemora wall (an alternate)

Some products exist only as iPhone screens, which do not fill a wide frame.
The product wall (the reel's Products chapter) puts real CoreCredit and Elemora
screens on complete phones, in a row that climbs slowly through a soft sky
while cloud banks fall away below; its sky and clouds match the launch shot
the reel loops back to. Every pixel of interface is an unmodified capture,
whole and scaled down, never up; nothing inside a screen is drawn, retouched
or invented. The drawn elements are the phone bodies, the sky, the clouds and
the shadows.

The montage (scripts/build_montage.py) then treats the result as footage.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src-media" / "montage"

try:
    import imageio_ffmpeg
    FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
except ImportError:
    FFMPEG = "ffmpeg"

FPS = 30


def screen(path: Path, status: int, bottom: int, width: int, radius: int) -> Image.Image:
    """A capture between the status bar and the tab bar, scaled down to
    `width`, corners rounded."""
    im = Image.open(path).convert("RGB")
    im = im.crop((0, status, im.width, bottom))
    h = round(im.height * width / im.width)
    im = im.resize((width, h), Image.LANCZOS)
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width - 1, im.height - 1), radius=radius, fill=255)
    out = Image.new("RGBA", im.size)
    out.paste(im, (0, 0), mask)
    return out


def strip(screens: list[Image.Image], gap: int, ground: tuple[int, int, int], shadow: float) -> Image.Image:
    """Screens stacked in a column, with a soft shadow under each."""
    w = max(s.width for s in screens)
    h = sum(s.height for s in screens) + gap * (len(screens) - 1)
    pad = 60
    col = Image.new("RGBA", (w + pad * 2, h + pad * 2), ground + (255,))
    sh = Image.new("L", col.size, 0)
    y = pad
    for s in screens:
        ImageDraw.Draw(sh).rounded_rectangle((pad, y + 14, pad + s.width, y + s.height + 14), radius=40, fill=int(255 * shadow))
        y += s.height + gap
    sh = sh.filter(ImageFilter.GaussianBlur(26))
    shade = Image.new("RGBA", col.size, (40, 60, 90, 255))
    col = Image.composite(shade, col, sh)
    y = pad
    for s in screens:
        col.alpha_composite(s, (pad, y))
        y += s.height + gap
    return col


def encode(frames, size: tuple[int, int], path: Path) -> None:
    enc = subprocess.Popen(
        [FFMPEG, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{size[0]}x{size[1]}",
         "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-pix_fmt", "yuv420p", str(path)],
        stdin=subprocess.PIPE)
    for f in frames:
        enc.stdin.write(f.tobytes())
    enc.stdin.close()
    enc.wait()
    print(f"wrote {path.relative_to(ROOT)}")


def elemora_wall() -> None:
    """Elemora: the table, an element, a compound and study, as a slow wall."""
    src = ROOT / "src-assets" / "elemora"
    W, H = 1920, 1080
    ground = (231, 240, 248)          # sampled from Elemora's element screen
    # below the status bar (141 px) and above the tab bar (from 2270 px), so
    # the wall shows content rather than a row of repeated tab bars
    width, gap, status, bottom, radius = 520, 30, 141, 2270, 34
    columns = [                        # (screens top to bottom, start offset px, speed px/s)
        (["04-study.png", "07-progress.png"], 420, -46),
        (["01-table.png", "03-element-carbon.png"], 700, 38),
        (["02-element-oxygen.png", "05-identify.png"], 150, -52),
        (["06-build.png", "01-table.png"], 820, 42),
    ]
    strips = [strip([screen(src / n, status, bottom, width, radius) for n in names], gap, ground, 0.28) for names, _, _ in columns]
    pad = 60
    step = width + gap
    x0 = (W - (len(columns) * step - gap)) // 2 - pad
    seconds = 5.0
    frames = []
    for i in range(round(seconds * FPS)):
        t = i / FPS
        canvas = Image.new("RGBA", (W, H), ground + (255,))
        for k, ((names, off, speed), st) in enumerate(zip(columns, strips)):
            # the strip's top-left corner on the canvas, to a fraction of a pixel
            X, Y = x0 + k * step, -(off + speed * t) - pad
            layer = st.transform((W, H), Image.Transform.EXTENT, (-X, -Y, -X + W, -Y + H), Image.Resampling.BICUBIC)
            canvas.alpha_composite(layer)
        frames.append(np.asarray(canvas.convert("RGB")))
    encode(frames, (W, H), OUT / "elemora-wall-1080p.mp4")


# ------------------------------------------------------------ products wall --

# Real iPhone captures, alternating products. Each fills a whole phone screen,
# status bar included, exactly as captured.
PRODUCT_SCREENS = {
    "landscape": ["elemora/01-table.png", "corecredit/phone-dashboard.png", "elemora/06-build.png",
                  "corecredit/phone-cores.png", "elemora/02-element-oxygen.png"],
    "portrait": ["corecredit/phone-dashboard.png", "elemora/06-build.png", "corecredit/phone-cores.png"],
    "phone": ["elemora/01-table.png", "corecredit/phone-dashboard.png", "elemora/06-build.png"],
}

# Where the row of phones sits, as fractions of the frame: kept clear of the
# hero text (lower left on desktop, the lower half on phones) and inside the
# part of the frame every screen shape shows. The page frames the video with
# object-position 62% 50%, so a 4:3 screen crops 15.5% from the left of the
# landscape cut and 9.5% from its right; short phones crop the phone cut's top
# and bottom. The landscape row is sized by height and centred right of the
# middle, above the headline.
PRODUCT_LAYOUT = {           # size, x range (or row height and centre), top of the row at t=0 and t=end, stagger
    "landscape": {"size": (1920, 1080), "height": 0.40, "cx": 0.56, "top": (0.12, 0.10), "stagger": 0.018, "clouds": 0.0},
    "portrait": {"size": (1080, 1920), "x": (0.05, 0.95), "top": (0.185, 0.16), "stagger": 0.018, "clouds": 0.08},
    "phone": {"size": (1080, 2340), "x": (0.05, 0.95), "top": (0.145, 0.125), "stagger": 0.016, "clouds": 0.1},
}

# The sky the wall stands in, sampled from the opening launch shot (the wall's
# last frame cuts straight to it): blue overhead, paler toward the horizon,
# soft grey-white cloud banks low in the frame, like the launch smoke.
SKY_TOP = np.array([96, 132, 172], np.float32)
SKY_LOW = np.array([166, 180, 196], np.float32)
CLOUD_LIT = np.array([232, 233, 236], np.float32)
CLOUD_SHADE = np.array([150, 156, 168], np.float32)


def blur(a: np.ndarray, sigma: float) -> np.ndarray:
    """Gaussian blur of a 2-D float array (FFT, wrapping edges)."""
    h, w = a.shape
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.rfftfreq(w)[None, :]
    k = np.exp(-2 * (np.pi * sigma) ** 2 * (fx ** 2 + fy ** 2))
    return np.fft.irfft2(np.fft.rfft2(a) * k, s=a.shape).astype(np.float32)


def cloud_layer(w: int, h: int, seed: int, ridge: float, amp: float, puffs: int, size: tuple[float, float],
                soft: float) -> np.ndarray:
    """An RGBA bank of billowing cloud, like launch smoke seen out of focus. A
    ridgeline wanders across the layer; round puffs pile up along and below it,
    each lit from above (bright crown, cool grey underside), lower puffs over
    higher ones; everything below the pile is filled; then the bank is softened."""
    rng = np.random.default_rng(seed)
    xs = np.arange(w, dtype=np.float32)
    ridge_y = np.full(w, ridge * h, np.float32)
    for k, a in ((2, 1.0), (5, 0.45), (11, 0.2)):                       # a gently rolling top edge
        knots = rng.uniform(-1, 1, k + 3)
        ridge_y += amp * h * a * np.interp(xs, np.linspace(-0.1, 1.1, k + 3) * w, knots)
    rgb = np.zeros((h, w, 3), np.float32)
    alpha = np.zeros((h, w), np.float32)
    rmean = w * (size[0] + size[1]) / 2
    # the body of the bank, below the pile of puffs: a deepening grey
    yy = np.arange(h, dtype=np.float32)[:, None]
    body = np.clip((yy - (ridge_y[None, :] + rmean * 1.1)) / (rmean * 0.8), 0, 1)
    shade = np.clip((yy - ridge_y[None, :]) / (h * 0.5), 0, 1)[..., None]
    rgb[:] = CLOUD_LIT * 0.35 + CLOUD_SHADE * 0.65
    rgb = rgb * (1 - shade * 0.25)
    alpha[:] = body
    cx_all = rng.uniform(-0.05, 1.05, puffs) * w
    depth_all = rng.uniform(0, 1, puffs) ** 1.6                          # most puffs near the crown
    order = np.argsort(depth_all)
    for i in order:
        cx = cx_all[i]
        r = w * rng.uniform(*size)
        cy = ridge_y[int(np.clip(cx, 0, w - 1))] + r * 0.35 + depth_all[i] * rmean * 2.2
        x0, x1 = int(max(0, cx - r)), int(min(w, cx + r + 1))
        y0, y1 = int(max(0, cy - r)), int(min(h, cy + r + 1))
        if x0 >= x1 or y0 >= y1:
            continue
        py, px = np.mgrid[y0:y1, x0:x1].astype(np.float32)
        d = np.sqrt((px - cx) ** 2 + (py - cy) ** 2) / r
        a = np.clip((1 - d) / 0.25, 0, 1)
        v = np.clip((py - (cy - r)) / (2 * r), 0, 1)                    # 0 at the crown, 1 underneath
        light = np.clip(1.0 - v ** 1.4 * 0.95, 0, 1) * (1 - 0.35 * depth_all[i])
        col = CLOUD_SHADE * (1 - light[..., None]) + CLOUD_LIT * light[..., None]
        a3 = a[..., None]
        rgb[y0:y1, x0:x1] = rgb[y0:y1, x0:x1] * (1 - a3) + col * a3
        alpha[y0:y1, x0:x1] = alpha[y0:y1, x0:x1] * (1 - a) + a
    # out of focus: blur colour premultiplied by alpha, then divide back out
    pm = [blur(rgb[..., c] * alpha, soft) for c in range(3)]
    al = np.clip(blur(alpha, soft), 0, 1)
    out = np.dstack([np.clip(c / np.maximum(al, 1e-3), 0, 255) for c in pm] + [al * 255])
    return out.astype(np.float32)


def phone(path: Path, width: int) -> Image.Image:
    """A complete phone: the capture on its whole screen, in a plain dark body
    with an even bezel. Drawn at twice the size and scaled down for clean edges."""
    k = 2
    bw = width * k
    bez = round(bw * 0.034)
    sw = bw - 2 * bez
    cap = Image.open(path).convert("RGB")
    sh = round(sw * cap.height / cap.width)
    bh = sh + 2 * bez
    body = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    d = ImageDraw.Draw(body)
    r_body = round(bw * 0.15)
    d.rounded_rectangle((0, 0, bw - 1, bh - 1), radius=r_body, fill=(58, 61, 66, 255))          # rim
    d.rounded_rectangle((3 * k, 3 * k, bw - 1 - 3 * k, bh - 1 - 3 * k), radius=r_body - 3 * k, fill=(20, 21, 24, 255))
    scr = cap.resize((sw, sh), Image.Resampling.LANCZOS)
    mask = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, sw - 1, sh - 1), radius=r_body - bez, fill=255)
    body.paste(scr, (bez, bez), mask)
    return body.resize((width, round(bh / k)), Image.Resampling.LANCZOS)


def products_wall(cut: str, seconds: float = 5.0) -> None:
    """Products: CoreCredit and Elemora on real phones in a row, climbing
    together through a soft sky while the cloud banks fall away below (the
    nearer bank faster). The sky and the low cloud banks match the opening
    launch shot, so the reel can cut from the last frame of this wall straight
    back to the launch and keep moving."""
    lay = PRODUCT_LAYOUT[cut]
    W, H = lay["size"]
    names = PRODUCT_SCREENS[cut]
    gap = round(W * (0.022 if cut == "landscape" else 0.03))
    if "height" in lay:           # phone width from the row's height (a body is 2.085 times as tall as wide)
        pw = round(H * lay["height"] / 2.085)
        x0 = lay["cx"] - (len(names) * pw + (len(names) - 1) * gap) / 2 / W
    else:
        x0, x1 = lay["x"]
        pw = round((W * (x1 - x0) - gap * (len(names) - 1)) / len(names))
    phones = [phone(ROOT / "src-assets" / n, pw) for n in names]
    ph = phones[0].height
    # the row, with its soft shadow, drawn once on a transparent layer taller than the frame
    LH = H + ph
    row = Image.new("RGBA", (W, LH), (0, 0, 0, 0))
    shadow = Image.new("L", (W, LH), 0)
    top = round(H * lay["top"][0])
    places = []
    for i, p in enumerate(phones):
        x = round(W * x0 + i * (pw + gap))
        y = top + round(H * lay["stagger"] * (1 if i % 2 else -1))
        places.append((x, y))
        ImageDraw.Draw(shadow).rounded_rectangle((x + pw * 0.06, y + ph * 0.05, x + pw * 0.94, y + ph * 1.03), radius=round(pw * 0.2), fill=110)
    shadow = shadow.filter(ImageFilter.GaussianBlur(pw * 0.09))
    row = Image.composite(Image.new("RGBA", (W, LH), (22, 38, 66, 255)), row, shadow)
    for p, (x, y) in zip(phones, places):
        row.alpha_composite(p, (x, y))
    row_pm = row.convert("RGBa")
    # sky and two cloud banks, falling away below the climbing row (the nearer
    # bank faster: parallax)
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    sky = SKY_TOP * (1 - y ** 1.3) + SKY_LOW * y ** 1.3
    sky = np.broadcast_to(sky, (H, W, 3)).astype(np.float32)
    D = min(W, H)
    D = min(W, H)
    far = cloud_layer(W, round(H * 1.6), 11, ridge=0.62, amp=0.05, puffs=160, size=(0.035 * D / W, 0.08 * D / W), soft=D * 0.012)
    near = cloud_layer(W, round(H * 1.9), 23, ridge=0.62, amp=0.06, puffs=120, size=(0.07 * D / W, 0.15 * D / W), soft=D * 0.02)
    frames = []
    n = round(seconds * FPS)
    rise = (lay["top"][0] - lay["top"][1]) * H          # the row rises this far, at a constant speed
    for i in range(n):
        t = i / (n - 1)
        img = sky.copy()
        for layer, y0, dy, gain in ((far, 0.30, 0.10, 0.85), (near, 0.44, 0.24, 1.0)):
            yy = (y0 + lay["clouds"] - dy * t) * H                         # the bank sinks
            k0 = int(np.floor(yy)); f = yy - k0
            a = layer[k0:k0 + H]; b = layer[k0 + 1:k0 + 1 + H]
            lay_f = a * (1 - f) + b * f
            al = lay_f[..., 3:4] / 255 * gain
            img = img * (1 - al) + lay_f[..., :3] * al
        # the sky and clouds brighten slowly, from the dark game table before this
        # chapter to the daylight of the launch after it (the phones do not change)
        img = img * (0.62 + 0.38 * t)
        base = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
        # the row: a constant climb (still moving on the last frame) and a slow push in
        s = 1.0 + (0.035 if W > H else 0.022) * t
        oy = -rise * t
        cx, cy = W / 2, top + ph / 2                                  # about the row's centre
        # output pixel (u, v) samples the row at ((u - cx) / s + cx, (v - cy) / s + cy - oy)
        m = (1 / s, 0, cx - cx / s, 0, 1 / s, cy - cy / s - oy)
        moved = row_pm.transform((W, H), Image.Transform.AFFINE, m, Image.Resampling.BICUBIC).convert("RGBA")
        base.alpha_composite(moved)
        frames.append(np.asarray(base.convert("RGB")))
    encode(frames, (W, H), OUT / f"products-wall-{cut}.mp4")


if __name__ == "__main__":
    import sys
    which = sys.argv[1:] or ["products"]
    if "elemora" in which:
        elemora_wall()
    if "products" in which:
        for cut in PRODUCT_LAYOUT:
            products_wall(cut)
    for cut in PRODUCT_LAYOUT:
        if cut in which:
            products_wall(cut)

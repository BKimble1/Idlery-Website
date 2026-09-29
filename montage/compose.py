#!/usr/bin/env python3
"""Compose moving clips for the montage from real app captures.

    python3 montage/compose.py            # writes src-media/montage/elemora-wall-1080p.mp4

Some products exist only as iPhone screens, which do not fill a wide frame.
Rather than float a phone in empty space, this lays several of the product's
own screens side by side as tall columns on the product's own background
colour and drifts each column slowly up or down. Every pixel of interface is
an unmodified capture (scaled down, never up, and cropped below the iOS status
bar); nothing inside a screen is drawn, retouched or invented. The only drawn
elements are the background colour sampled from the app, rounded corners and a
soft shadow under each screen.

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


if __name__ == "__main__":
    elemora_wall()

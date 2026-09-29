#!/usr/bin/env python3
"""Assemble the home-page hero montage from real project footage and captures.

    pip install Pillow numpy imageio-ffmpeg     # imageio-ffmpeg supplies ffmpeg
    python3 scripts/build_montage.py            # every cut in montage/shots.json
    python3 scripts/build_montage.py landscape  # one cut
    python3 montage/compose.py                  # first, if its source captures changed

The edit lives in montage/shots.json: one entry per shot, in order, with its
source file, the moment to start from, how long it holds, the crop window it
pans from and to (fractions of the source frame: [x, y, width, height]), an
optional grade, and the crossfade into the next shot. Nothing is generated or
redrawn: every frame is a frame of a real recording or render, or a crop of a
real capture, moved and faded. There is no title or logo card: the reel runs
from project footage straight back into project footage.

The loop is seamless: the first frames of the first shot are held back and the
last shot crossfades into them, so the file wraps without a cut, and the poster
(the first frame of the file) is exactly where the loop lands.

Outputs:
    site/assets/video/hero-<cut>.av1.mp4 / .mp4 web encodes (AV1, H.264), silent
    site/assets/video/hero-poster-*.jpg / .webp posters (the first frame)
    montage/build/<cut>-master.mp4              near-lossless master (not deployed)
    montage/build/<cut>-chapters.json           when each project is on screen
Each hero cut's chapter times are also written into site/index.html
(data-chapters-landscape / -portrait / -phone), which the "Now showing" label
reads. Three cuts: landscape (16:9) for wide screens, portrait (9:16) for
portrait tablets, and phone (9:19.5, the shape of a modern phone screen).
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SPEC = json.loads((ROOT / "montage" / "shots.json").read_text())
BUILD = ROOT / "montage" / "build"
OUT = ROOT / "site" / "assets" / "video"

try:
    import imageio_ffmpeg
    FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
except ImportError:
    FFMPEG = "ffmpeg"


# ------------------------------------------------------------------ frames --

def video_size(path: Path) -> tuple[int, int]:
    info = subprocess.run([FFMPEG, "-hide_banner", "-i", str(path)], capture_output=True, text=True).stderr
    m = re.search(r"Video:.*?(\d{2,5})x(\d{2,5})", info)
    if not m:
        raise SystemExit(f"cannot read the frame size of {path}")
    return int(m.group(1)), int(m.group(2))


def source_frames(shot: dict, n: int, fps: int):
    """Yield n RGB images for a shot: decoded video frames, or a still repeated."""
    path = ROOT / shot["source"]
    if not path.exists():
        raise SystemExit(f"missing source: {shot['source']}")
    if path.suffix.lower() in (".mp4", ".webm", ".mov", ".mkv"):
        w, h = video_size(path)
        speed = shot.get("speed", 1.0)        # 0.5 plays at half speed
        cmd = [FFMPEG, "-v", "error", "-ss", str(shot.get("in", 0)), "-i", str(path),
               "-t", f"{n / fps * speed + 1:.3f}", "-vf", f"setpts=PTS/{speed},fps={fps}", "-frames:v", str(n),
               "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE)
        last = None
        for _ in range(n):
            buf = proc.stdout.read(w * h * 3)
            if len(buf) == w * h * 3:
                last = Image.frombuffer("RGB", (w, h), buf, "raw", "RGB", 0, 1)
            if last is None:
                raise SystemExit(f"{path}: no frames at {shot.get('in', 0)}s")
            yield last                          # holds the last frame if the clip runs short
        proc.stdout.close()
        proc.wait()
    else:
        im = Image.open(path).convert("RGB")
        for _ in range(n):
            yield im


def smooth(t: float) -> float:
    return t * t * (3 - 2 * t)


def grade(arr: np.ndarray, g: dict | None) -> np.ndarray:
    """A gentle, global grade (exposure and contrast only), so bright footage
    sits under the white headline. Never local, never content-changing."""
    if not g:
        return arr
    f = arr.astype(np.float32) / 255.0
    if "gamma" in g:
        f = f ** g["gamma"]
    if "contrast" in g:
        f = (f - 0.5) * g["contrast"] + 0.5
    if "brightness" in g:
        f = f * g["brightness"]
    if "saturation" in g:
        grey = f.mean(axis=2, keepdims=True)
        f = grey + (f - grey) * g["saturation"]
    return (np.clip(f, 0, 1) * 255 + 0.5).astype(np.uint8)


def source_size(shot: dict) -> tuple[int, int]:
    path = ROOT / shot["source"]
    if path.suffix.lower() in (".mp4", ".webm", ".mov", ".mkv"):
        return video_size(path)
    return Image.open(path).size


def check_windows(cut: str, shots: list[dict], size: tuple[int, int]) -> None:
    """Refuse to stretch footage: every crop window must have the cut's shape."""
    want = size[0] / size[1]
    for s in shots:
        W, H = source_size(s)
        for key in ("from", "to"):
            x, y, w, h = s.get(key, s.get("from", [0, 0, 1, 1]))
            got = (w * W) / (h * H)
            if abs(got / want - 1) > 0.005:
                raise SystemExit(f"{cut}: {s['source']} '{key}' window is {got:.3f}:1, the cut is {want:.3f}:1 "
                                 f"(set its height to {w * W / want / H:.4f})")
            if x < -1e-6 or y < -1e-6 or x + w > 1 + 1e-6 or y + h > 1 + 1e-6:
                raise SystemExit(f"{cut}: {s['source']} '{key}' window leaves the frame")


def render_shot(shot: dict, size: tuple[int, int], fps: int):
    n = max(2, round(shot["duration"] * fps))
    a = shot.get("from", [0, 0, 1, 1])
    b = shot.get("to", a)
    eased = shot.get("ease", "linear") != "linear"
    for i, frame in enumerate(source_frames(shot, n, fps)):
        t = i / (n - 1)
        t = smooth(t) if eased else t
        x, y, w, h = (p + (q - p) * t for p, q in zip(a, b))
        W, H = frame.size
        box = (x * W, y * H, (x + w) * W, (y + h) * H)
        out = frame.transform(size, Image.Transform.EXTENT, box, Image.Resampling.BICUBIC)
        yield grade(np.asarray(out), shot.get("grade"))


def blend(a: np.ndarray, b: np.ndarray, t: float) -> np.ndarray:
    return (a.astype(np.float32) * (1 - t) + b.astype(np.float32) * t + 0.5).astype(np.uint8)


# ------------------------------------------------------------------- build --

def build(cut: str) -> list[dict]:
    spec = SPEC[cut]
    fps = SPEC["fps"]
    size = tuple(spec["size"])
    shots = spec["shots"]
    check_windows(cut, shots, size)
    loop_n = round(SPEC.get("loop_fade", 0.6) * fps)
    BUILD.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    master = BUILD / f"{cut}-master.mp4"
    enc = subprocess.Popen(
        [FFMPEG, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{size[0]}x{size[1]}",
         "-r", str(fps), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "12",
         "-pix_fmt", "yuv420p", str(master)],
        stdin=subprocess.PIPE)

    head: list[np.ndarray] = []    # the first shot's opening frames: the loop's landing
    tail: list[np.ndarray] = []    # the previous shot's closing frames, for its crossfade
    chapters: list[dict] = []
    poster = None
    written = 0

    for si, shot in enumerate(shots):
        last = si == len(shots) - 1
        n = max(2, round(shot["duration"] * fps))
        fade_in = len(tail)
        fade_out = loop_n if last else round(shot.get("fade", 0) * fps)
        reserve = loop_n if si == 0 else 0
        if n < fade_in + fade_out + reserve:
            raise SystemExit(f"{cut} shot {si} ({shot['source']}) is too short for its fades")
        if "chapter" in shot:
            chapters.append({"t": round((written + fade_in / 2) / fps, 2),
                             "name": shot["chapter"], "kind": shot.get("kind", "")})
        new_tail = []
        for i, f in enumerate(render_shot(shot, size, fps)):
            if i < reserve:
                head.append(f)
                continue
            if i < fade_in:
                f = blend(tail[i], f, smooth((i + 1) / (fade_in + 1)))
            if i >= n - fade_out:
                new_tail.append(f)
                continue
            if poster is None:
                poster = f
            enc.stdin.write(f.tobytes())
            written += 1
        tail = new_tail

    for i in range(loop_n):                       # close the loop onto the opening frames
        enc.stdin.write(blend(tail[i], head[i], smooth((i + 1) / (loop_n + 1))).tobytes())
        written += 1
    enc.stdin.close()
    enc.wait()
    print(f"{cut}: {written / fps:.2f}s at {size[0]}x{size[1]}, master {master.relative_to(ROOT)}")

    # ---- web encodes: AV1 first (about half the size of H.264 at the same
    # SSIM for this footage), H.264 for every browser that cannot play AV1.
    web = spec["web"]
    scale = f"scale={web['size'][0]}:{web['size'][1]}:flags=lanczos"
    name = spec.get("output", f"hero-{cut}")
    av1, mp4 = OUT / f"{name}.av1.mp4", OUT / f"{name}.mp4"
    subprocess.run([FFMPEG, "-v", "error", "-y", "-i", str(master), "-vf", scale,
                    "-c:v", "libaom-av1", "-crf", str(web["crf_av1"]), "-b:v", "0", "-cpu-used", "6",
                    "-row-mt", "1", "-tiles", "2x2", "-g", str(fps * 2), "-pix_fmt", "yuv420p",
                    "-movflags", "+faststart", "-an", str(av1)], check=True)
    subprocess.run([FFMPEG, "-v", "error", "-y", "-i", str(master), "-vf", scale,
                    "-c:v", "libx264", "-preset", "veryslow", "-crf", str(web["crf_h264"]),
                    "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                    "-an", "-g", str(fps * 2), str(mp4)], check=True)
    for p in (av1, mp4):
        print(f"  {p.relative_to(ROOT)}  {p.stat().st_size / 1024:.0f} KB")
    for stale in (OUT / f"{name}.webm",):
        stale.unlink(missing_ok=True)

    # ---- posters: the first frame of the file, which is also the loop point
    im0 = Image.fromarray(poster)
    for name, width in spec["posters"]:
        im = im0.resize((width, round(im0.height * width / im0.width)), Image.Resampling.LANCZOS)
        im.save(OUT / f"{name}.webp", "WEBP", quality=80, method=6)
        im.save(OUT / f"{name}.jpg", "JPEG", quality=84, optimize=True, progressive=True)
        print(f"  {name}.webp/.jpg  {im.size[0]}x{im.size[1]}")

    (BUILD / f"{cut}-chapters.json").write_text(json.dumps(chapters, indent=1) + "\n")
    return chapters


def write_chapters(cut: str, chapters: list[dict]) -> None:
    index = ROOT / "site" / "index.html"
    html = index.read_text()
    data = json.dumps(chapters, separators=(",", ":"), ensure_ascii=False)
    attr = f"data-chapters-{cut}"
    new = re.sub(attr + r"='[^']*'", lambda m: f"{attr}='{data}'", html)
    if new != html:
        index.write_text(new)
        print(f"site/index.html: {attr} updated")


def main() -> None:
    cuts = sys.argv[1:] or [k for k in SPEC if isinstance(SPEC[k], dict) and "shots" in SPEC[k]]
    for cut in cuts:
        chapters = build(cut)
        if cut in ("landscape", "portrait", "phone"):
            write_chapters(cut, chapters)


if __name__ == "__main__":
    main()

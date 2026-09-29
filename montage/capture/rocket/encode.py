#!/usr/bin/env python3
"""Turn rec-canvas.mjs frame folders into the montage's source clips and stills.

    python3 encode.py <capture-dir>      # default: ./out (CAPTURE_DIR)

For each take listed below, reads <capture-dir>/<take>/frames/%05d.png (30 fps)
and writes a near-lossless H.264 clip to src-media/montage/, plus the still
frames the site's cards use to src-assets/rocket/. Frames are encoded as
rendered: no grading, no retouching (the montage applies its own gentle grade).
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CAP = Path(sys.argv[1] if len(sys.argv) > 1 else os.environ.get("CAPTURE_DIR", Path(__file__).parent / "out"))

try:
    import imageio_ffmpeg
    FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
except ImportError:
    FFMPEG = "ffmpeg"

TAKES = {                       # take -> clip in src-media/montage/
    "fairing-land": "rocket-fairing-900p.mp4",
    "stagesep-land": "rocket-stagesep-900p.mp4",
    "liftoff-land": "rocket-liftoff-900p.mp4",
    "fairing-port": "rocket-fairing-portrait.mp4",
    "liftoff-port": "rocket-liftoff-portrait.mp4",
}
STILLS = {                      # still in src-assets/rocket/ -> (take, frame)
    "fairing.png": ("fairing-land", 118),
    "stage-separation.png": ("stagesep-land", 130),
    "liftoff.png": ("liftoff-land", 90),
}


def main() -> None:
    out = ROOT / "src-media" / "montage"
    for take, clip in TAKES.items():
        frames = CAP / take / "frames"
        if not (CAP / take / "log.json").exists():   # rec-canvas writes it when a take is complete
            print(f"skip {take}: not recorded yet")
            continue
        subprocess.run([FFMPEG, "-v", "error", "-y", "-framerate", "30", "-i", str(frames / "%05d.png"),
                        "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p",
                        "-movflags", "+faststart", str(out / clip)], check=True)
        print(f"{clip}: {(out / clip).stat().st_size / 1e6:.1f} MB")
    stills = ROOT / "src-assets" / "rocket"
    stills.mkdir(parents=True, exist_ok=True)
    for name, (take, i) in STILLS.items():
        src = CAP / take / "frames" / f"{i:05d}.png"
        if src.exists() and (CAP / take / "log.json").exists():
            shutil.copyfile(src, stills / name)
            print(f"src-assets/rocket/{name} <- {take} frame {i}")


if __name__ == "__main__":
    main()

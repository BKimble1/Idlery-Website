#!/usr/bin/env python3
"""Package site/ as a Netlify drag-and-drop deploy.

    python3 scripts/make_zip.py            # writes dist/idlery-netlify.zip

The contents of site/ go in at the ZIP root -- index.html, _headers and
_redirects at the top level, no wrapper folder -- which is what Netlify's
manual deploy expects and what makes _headers and _redirects take effect.
Entries use forward slashes and a fixed timestamp, so the same site always
produces the same ZIP. Runs `scripts/build.py --check` first and refuses to
package a site whose shared regions have drifted.
"""

from __future__ import annotations

import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
OUT = ROOT / "dist" / "idlery-netlify.zip"
SKIP = {".DS_Store", "Thumbs.db"}
STORED = {".mp4", ".webm", ".webp", ".jpg", ".png", ".woff2", ".ico"}   # already compressed


def main() -> int:
    if subprocess.run([sys.executable, str(ROOT / "scripts" / "build.py"), "--check"]).returncode:
        print("build.py --check failed; run python3 scripts/build.py first")
        return 1
    for required in ("index.html", "404.html", "_headers", "_redirects"):
        if not (SITE / required).is_file():
            print(f"site/{required} is missing")
            return 1
    OUT.parent.mkdir(exist_ok=True)
    files = sorted(p for p in SITE.rglob("*") if p.is_file() and p.name not in SKIP)
    with zipfile.ZipFile(OUT, "w") as z:
        for p in files:
            info = zipfile.ZipInfo(p.relative_to(SITE).as_posix(), date_time=(2026, 1, 1, 0, 0, 0))
            info.external_attr = 0o644 << 16
            info.compress_type = zipfile.ZIP_STORED if p.suffix.lower() in STORED else zipfile.ZIP_DEFLATED
            z.writestr(info, p.read_bytes())
    total = sum(p.stat().st_size for p in files)
    print(f"{OUT.relative_to(ROOT)}: {len(files)} files, {total / 1e6:.1f} MB of site, {OUT.stat().st_size / 1e6:.1f} MB zipped")
    with zipfile.ZipFile(OUT) as z:
        names = z.namelist()
    for top in ("index.html", "_headers", "_redirects", "404.html"):
        assert top in names, top
    print("ZIP root: " + ", ".join(sorted(n for n in names if "/" not in n)))
    return 0


if __name__ == "__main__":
    sys.exit(main())

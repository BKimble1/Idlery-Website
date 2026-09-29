#!/usr/bin/env python3
"""Stamp the shared head, header and footer into every page, and lint the site.

    python3 scripts/build.py           # rewrite the marked regions in site/
    python3 scripts/build.py --check   # change nothing; fail if a page drifted

site/ is the deployable site and the source of truth for page content. Only
the regions between these markers are generated:

    <!-- @head -->    ... <!-- /@head -->      from partials/head.html
    <!-- @header -->  ... <!-- /@header -->    from partials/header.html
    <!-- @footer -->  ... <!-- /@footer -->    from partials/footer.html
    # @generated ...  # /@generated            in site/_redirects

A page says which nav item it belongs to with <body data-section="work">, and
the home page asks for the light-on-video header with data-header="over".
Destinations (where "Simulations" and "Portfolio" point) and the App Store
links come from site.config.json.

Standard library only.
"""

from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
PARTIALS = ROOT / "partials"
CONFIG = json.loads((ROOT / "site.config.json").read_text())

SECTIONS = ("work", "simulations", "apps", "portfolio", "about")
REGIONS = ("head", "header", "footer")


def render(template: str, *, section: str, over: bool) -> str:
    out = template
    out = out.replace("{{header_class}}", " site-header--over" if over else "")
    out = out.replace("{{wordmark}}", "idlery-wordmark-light.svg" if over else "idlery-wordmark.svg")
    out = out.replace("{{support_email}}", CONFIG["support_email"])
    for name, url in CONFIG["destinations"].items():
        out = out.replace("{{dest:%s}}" % name, url)
    for name in SECTIONS:
        out = out.replace("{{current:%s}}" % name, ' aria-current="page"' if name == section else "")
    leftover = re.findall(r"\{\{[^}]+\}\}", out)
    if leftover:
        raise SystemExit(f"unfilled placeholders: {sorted(set(leftover))}")
    return out.rstrip("\n")


def stamp(html: str, path: Path) -> str:
    body = re.search(r"<body([^>]*)>", html)
    if not body:
        raise SystemExit(f"{path}: no <body>")
    attrs = body.group(1)
    section = (re.search(r'data-section="([^"]*)"', attrs) or [None, ""])[1]
    over = 'data-header="over"' in attrs
    for region in REGIONS:
        pattern = re.compile(r"(<!-- @%s -->\n).*?(\n?<!-- /@%s -->)" % (region, region), re.S)
        if not pattern.search(html):
            if region == "head":
                raise SystemExit(f"{path}: missing <!-- @head --> region")
            continue  # the 404 page has no footer region, for instance
        partial = (PARTIALS / f"{region}.html").read_text()
        filled = render(partial, section=section, over=over)
        html = pattern.sub(lambda m: m.group(1) + filled + "\n" + m.group(2).lstrip("\n"), html)
    return html


def redirects_block() -> str:
    lines = ["# @generated from site.config.json by scripts/build.py -- do not edit by hand"]
    for name, url in CONFIG["destinations"].items():
        if url.startswith("http"):
            lines.append(f"/{name}/*    {url.rstrip('/')}/:splat    301!")
        else:
            lines.append(f"# /{name}/ is served by this site ({url}).")
    for app, url in CONFIG["app_store"].items():
        lines.append(f"/{app}/download    {url}    302")
    lines.append("# /@generated")
    return "\n".join(lines)


def stamp_redirects(text: str) -> str:
    pattern = re.compile(r"# @generated.*?# /@generated", re.S)
    if not pattern.search(text):
        raise SystemExit("site/_redirects: missing the # @generated block")
    return pattern.sub(lambda m: redirects_block(), text)


# --------------------------------------------------------------------- lint


class Lint(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.errors: list[str] = []
        self.h1 = 0
        self.title = False
        self.meta: dict[str, str] = {}
        self.canonical = None
        self.ids: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = dict(attrs)
        if "style" in a:
            self.errors.append(f"inline style attribute on <{tag}> (blocked by the CSP)")
        if any(k.startswith("on") for k in a):
            self.errors.append(f"inline event handler on <{tag}> (blocked by the CSP)")
        if a.get("id"):
            self.ids.append(a["id"])
        if tag == "h1":
            self.h1 += 1
        elif tag == "title":
            self.title = True
        elif tag == "img" and "alt" not in a:
            self.errors.append(f"<img src={a.get('src')}> has no alt")
        elif tag == "img" and not (a.get("width") and a.get("height")):
            self.errors.append(f"<img src={a.get('src')}> has no width/height (layout shift)")
        elif tag == "script":
            if a.get("type") != "application/ld+json" and not (a.get("src", "") or "").startswith("/assets/js/"):
                self.errors.append("a <script> that is neither local nor JSON-LD (blocked by the CSP)")
        elif tag == "style":
            self.errors.append("<style> element (blocked by the CSP)")
        elif tag == "meta":
            key = a.get("name") or a.get("property")
            if key:
                self.meta[key] = a.get("content") or ""
        elif tag == "link" and a.get("rel") == "canonical":
            self.canonical = a.get("href")
        elif tag == "a" and a.get("target") == "_blank" and "noopener" not in (a.get("rel") or ""):
            self.errors.append(f"target=_blank without rel=noopener: {a.get('href')}")


def lint(path: Path, html: str) -> list[str]:
    p = Lint()
    p.feed(html)
    errs = list(p.errors)
    rel = "/" + str(path.relative_to(SITE)).replace("index.html", "")
    if not p.title:
        errs.append("no <title>")
    if p.h1 != 1:
        errs.append(f"{p.h1} <h1> elements (want exactly 1)")
    if not p.meta.get("description"):
        errs.append("no meta description")
    if path.name != "404.html":
        for key in ("og:title", "og:description", "og:image", "og:url", "twitter:card"):
            if not p.meta.get(key):
                errs.append(f"no {key}")
        want = CONFIG["site_url"] + rel
        if p.canonical != want:
            errs.append(f"canonical is {p.canonical!r}, want {want!r}")
        if p.meta.get("og:url") != want:
            errs.append(f"og:url is {p.meta.get('og:url')!r}, want {want!r}")
    dupes = sorted({i for i in p.ids if p.ids.count(i) > 1})
    if dupes:
        errs.append(f"duplicate ids: {dupes}")
    for app, url in CONFIG["app_store"].items():
        for found in re.findall(r"https://apps\.apple\.com/[^\"' ]*", html):
            if app in found and found != url:
                errs.append(f"App Store link {found} does not match site.config.json ({url})")
    return errs


def main() -> int:
    check = "--check" in sys.argv
    drift, problems = [], []
    for path in sorted(SITE.rglob("*.html")):
        html = path.read_text()
        new = stamp(html, path)
        if new != html:
            drift.append(path)
            if not check:
                path.write_text(new)
        for e in lint(path, new):
            problems.append(f"{path.relative_to(ROOT)}: {e}")

    red = SITE / "_redirects"
    text = red.read_text()
    new = stamp_redirects(text)
    if new != text:
        drift.append(red)
        if not check:
            red.write_text(new)

    for p in problems:
        print("LINT", p)
    if check and drift:
        for p in drift:
            print("DRIFT", p.relative_to(ROOT))
        print("Run: python3 scripts/build.py")
    if not check:
        print(f"stamped {len(drift)} file(s)")
    return 1 if problems or (check and drift) else 0


if __name__ == "__main__":
    sys.exit(main())

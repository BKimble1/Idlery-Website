# Design notes

## Structure

idlery.com is the umbrella brand of an independent technology studio. It shows
the range of the work and routes people to the right place; it is not a
catalogue of apps.

| Nav | Goes to | What it is for |
|---|---|---|
| Work | `/work/` | Everything Idlery has built or is building, grouped as Engineering and simulation, Products, Games and Experiments, each with an honest status |
| Simulations | `https://simulations.idlery.com/` | A separate site (not built here) |
| Products | `https://products.idlery.com/` | A separate site (not built here). Replaces the old "Apps" item |
| Portfolio | `https://portfolio.idlery.com/` | A separate site (not built here): Blake Kimble's own engineering and design work |
| About | `/about/` | What Idlery is, how it works, and how to reach it |

The three outside destinations live in `site.config.json` and nowhere else:
`scripts/build.py` writes them into the header and footer, rewrites every
content link marked `data-dest="..."`, and fails the lint if a page types one
of those URLs by hand. The old local pages `/simulations/`, `/apps/` and
`/portfolio/` were removed; forced 301s send them (with and without the
trailing slash, and any deeper path) to their sites. Those sites may not be
live yet; the links point at their final addresses on purpose.

Karnwold, CoreCredit and Elemora keep their short project pages at
`/karnwold/`, `/corecredit/` and `/elemora/`, because other places link to them.

The home page: the hero reel, **Featured work** (six projects chosen to show
range, in a slow reel that drifts to the right), **Explore Idlery** (the three
sister sites, each labelled with its own hostname so it reads as navigation
within one studio rather than a definition of it) and a short About band.

Support is about Idlery itself: one address, what helps us help, and a
compact list of where each released product keeps its own help and policies.
idlery.com has its own [privacy policy](../site/privacy/index.html) and
[terms of use](../site/terms/index.html); `/legal/` indexes them and the
product policies. The footer carries only Explore and Help; project lists and
Apple's trademark line are gone from the global footer (the line stays on the
two pages that show Apple's badge).

### The featured-work reel

With scripting and motion allowed, the list of six cards drifts slowly to the
right, forever: the list is copied once or twice (copies are `inert` and
`aria-hidden`, so each project is announced and focusable once) and moved with
a transform. It eases to a stop under the pointer, when a project takes
keyboard focus (which also brings that card fully into view), and with its
Pause button (WCAG 2.2.2). It stops off screen, can be dragged by hand, speeds
up a little while the page scrolls, and never runs under
`prefers-reduced-motion`; then, and without scripting, it is a plain row you
scroll.

## Type

* **Manrope** (variable, 25 KB, SIL OFL) for everything. Its geometry is the
  closest match to the Idlery wordmark's own letters (open apertures, a
  straight-tailed y), so headings and the logo read as one family. Headings are
  set tight (letter-spacing down to -0.04em) and heavy (750).
* **IBM Plex Mono** 500 (15 KB, OFL) for small labels, statuses and fact keys:
  the index-card, engineering-notebook voice. Labels are sentence case so Apple
  product names keep their casing (iOS, iPhone, iPad).
* Both are self-hosted; `font-display: swap`, and Manrope is preloaded.

## Colour

Warm paper and a teal-black ink, with the wordmark's teal as the only brand
colour. The projects bring their own colour through their real imagery; each
also has a small swatch sampled from its own artwork (Karnwold's ember, Fab
One's violet, CoreCredit's blue, Elemora's teal, Rocket Engineering's KIMBLE
violet, Holograph's cyan), used only as a marker.

| Pair | Ratio |
|---|---|
| `--ink` #0f1b1f on `--paper` #f4f3ee | 15.8 : 1 |
| `--ink-2` #3e4c51 on `--paper` | 8.0 : 1 |
| `--ink-3` #56656a on `--paper` / `--paper-2` | 5.5 / 5.0 : 1 |
| `--teal-ink` #1c6a70 (links, focus) on `--paper` | 5.7 : 1 |
| white on `--teal-ink` | 6.3 : 1 |
| `--on-night` #eef2f1 on `--night` #0b1417 | 16.5 : 1 |
| `--on-night-3` #8fa0a2 on `--night` | 6.9 : 1 |
| `--teal-light` #7fcfd4 on `--night` | 10.5 : 1 |

Dark mode swaps the tokens under `prefers-color-scheme: dark`. Karnwold's page
always wears the game's own "Forge & Ember" ink (`.theme-kw`), in both modes.

The wordmark is now a vector (`idlery-wordmark.svg`), traced from the 1216 px
source artwork and checked against it by overlay. The favicon and touch icon
are the Idlery app icon from `BKimble1/CoreCredit-Legal/brand/`.

## The hero

A full-bleed montage of real footage with the headline over a scrim that is
darkest behind the words (86% at the left edge on desktop, 94% at the bottom on
phones), so white text holds contrast over every frame, including Fab One's
light renders; bright shots are also graded down slightly in the edit.

* Plays muted and looped, inline, only when motion is welcome: never under
  `prefers-reduced-motion` or Save-Data. It pauses when scrolled off screen.
* A visible Pause/Play button (WCAG 2.2.2) and a quiet "Now showing" label that
  names each project as it appears.
* Landscape cut on wide screens, portrait cut on phones. Without scripting, or
  before the video loads, the first frame is shown as a still.

## Motion

Only the hero moves on its own. The featured carousel never auto-advances; it
scrolls when asked (buttons, swipe, trackpad, arrow keys). Hover lifts cards by
3 px. Everything decorative switches off under `prefers-reduced-motion`.

## The carousel

A horizontally scrolling list with scroll-snap. With scripting: Previous/Next
buttons (disabled at the ends), and ArrowLeft/ArrowRight/Home/End move between
projects once focus is on one. Tab reaches each project once. Without
scripting (`@media (scripting: none)`) it is a plain grid, and the dead buttons
are hidden.

## JavaScript and the security headers

`site.js` is the only script (about 7 KB unminified). The CSP change is exactly
`script-src 'none'` to `script-src 'self'`. There are no inline scripts,
styles or event handlers; `scripts/build.py` fails the build if one appears.

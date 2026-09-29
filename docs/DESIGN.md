# Design notes

## Structure

| Nav | Page | What it is for |
|---|---|---|
| Work | `/work/` | Every Idlery project, grouped by kind (games, simulations, iOS apps) |
| Simulations | `/simulations/` | Idlery Simulations, starting with Fab One. A preview page until `simulations.idlery.com` exists |
| Apps | `/apps/` | CoreCredit and Elemora, with the App Store badge and each app's help links |
| Portfolio | `/portfolio/` | Blake Kimble's own engineering and design projects, kept apart from Idlery's products |
| About | `/about/` | What Idlery is, and how to reach it |

The five labels are the ones in the brief. They were kept because each names a
distinct destination and the set fits one row on a laptop and a short menu on a
phone. "Work" is the overview; "Simulations" and "Apps" are the two families
that will grow; "Portfolio" is deliberately a different kind of page (personal,
engineering-led, with a drafting-grid header) so it does not read as more
Idlery product work. Karnwold, CoreCredit and Elemora are projects inside
Work, not nav items, and their old URLs (`/karnwold/`, `/corecredit/`,
`/elemora/`) are kept as short project pages that lead with the real action:
Play, or Download on the App Store.

Support, contact, privacy and terms are in the footer of every page, on the
About page, and at `/support/` and `/legal/`. The old `/privacy`, `/terms`,
`/contact` and friends redirect there.

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
One's violet, CoreCredit's blue, Elemora's teal), used only as a marker.

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

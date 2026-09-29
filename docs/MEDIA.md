# Media: where every image and frame comes from

Everything on idlery.com is Idlery's own material or Apple's badge. There is no
stock imagery, no device mockup and no generated interface. All sources are
kept full size in `src-assets/` and `src-media/`, and the site's copies are
generated from them (`scripts/build_assets.py`, `scripts/build_montage.py`).

## Brand

| File | Source | Notes |
|---|---|---|
| `src-assets/brand/idlery-wordmark.svg` | Traced from `idlery-wordmark-source.png` (1216×501, `BKimble1/CoreCredit-Legal` `brand/`) | Vector version of the existing wordmark, checked by overlay; teal `#39a5ab` sampled from the artwork |
| `idlery-wordmark-source.jpg` | `BKimble1/Idlery` `src-assets/brand/` | The copy the previous site used |
| `idlery-app-icon-1024.png` | `BKimble1/CoreCredit-Legal` `brand/` | Favicon, touch icon and manifest icons |
| `corecredit-appicon-1024.png`, `elemora-appicon-1254.png`, `karnwold-icon.svg` | The apps' own icons and Karnwold's master mark, via `BKimble1/Idlery` | Karnwold's SVG is copied byte for byte |
| `apple-download-badge-us-uk-black.svg` | Apple's App Store marketing artwork | Used unmodified, 48 px tall, with Apple's trademark line |

## CoreCredit (`BKimble1/CoreCredit`, repository root)

Real device captures of the released app, showing sample records created for
illustration.

| File here | Original |
|---|---|
| `ipad-dashboard.png`, `ipad-cores.png`, `ipad-returns.png`, `ipad-history.png` | `IMG_0309/0313/0314/0315.PNG` (iPad, 2360×1640) |
| `phone-dashboard.png` | `Dashboard_Marketing.png` (the 9:41 capture) |
| `phone-cores.png`, `phone-scan.png`, `phone-add.png`, `phone-dispute.png`, `phone-history.png`, `phone-returns.png` | `Cores.png`, `lefttiltedphone.PNG`, `rightherophone.PNG`, `image5.png`, `Image 6.png`, `image4.PNG` |

The site crops every iPhone capture below the status bar, and crops the
dashboard card images short of the iOS scroll indicator.

## Elemora (`BKimble1/PeriodicPro`, `claude/elemora-app-store-screenshots-9pq3ne`)

Seven iPhone captures (1170×2532), `IMG_2838` to `IMG_2853`, taken before the App
Store release, as `src-assets/elemora/01-table.png` … `07-progress.png`. The
pages say they may differ in detail from the current version.

## Karnwold (`BKimble1/karnwold`)

| File | Source | What it is |
|---|---|---|
| `src-assets/karnwold/01-online-game.png` | `public/preview.png` via `BKimble1/Idlery` | Browser capture of the online game (1280×800) |
| `02-prototype-table.png`, `03-pieces.jpg` | The game's marketing photographs | The physical prototype and its pieces |
| `04-concept-spread.png`, `06-village-sketches.png` | The game's design spreads | Early concepts, marked work in progress |
| `05-board-disc.png` | The board render | |
| `src-assets/karnwold/table-1920.png`, `src-media/montage/karnwold-table-1080p.mp4`, `karnwold-build-1080p.mp4` | Captured for this site from Karnwold's production build: an offline game against three bots, 1920×1080, clock-stepped | The table in round 3; a Barracks assembled in the 3D build view. See `montage/capture/README.md` |
| `src-media/montage/karnwold-siege-720p.mp4` | Trimmed from `public/offline-preview.mp4` (1280×720 screen recording of karnwold.com), 0:56 to 1:03 | An alternate: a siege dice roll |
| `src-media/montage/karnwold-prototype-loop.mp4` | `public/about/physical-prototype-loop.mp4` | The prototype seen from above, slowly zooming |

## Fab One (`BKimble1/Photolithography-Simulation-Site`, `claude/fab-one-round-four-realism-x1ze0a`)

Rendered by the simulation itself from a local production build (commit
`822bb0f`), on its own virtual clock (`?virt=1`, exactly 1/30 s per frame), at
1600×900 with its documented `quality=high` tier, reading the WebGL buffer
directly so no interface is in the frame. Scripts and exact lesson URLs:
`montage/capture/`. Stills in `src-assets/fabone/`: `bay.png` (the whole fab),
`scanner.png` (the lens column with the light path on), `wafer.png` (the wafer
in the developer), `develop.png` (the magnified cross-section). The
repository's own recordings in `docs/recordings/` (960×540, with the
interface) were the reference.

## Rocket Engineering (`BKimble1/rocket-simulation`, `claude/kimble-rocket-engineering`)

Rendered by the simulator itself from a local production build (commit
`6bdec75`, built with `vite build`), on its own virtual clock (`?virt=1`,
exactly 1/30 s per frame), with its documented `quality=high` tier, reading the
WebGL buffer directly so no interface is in the frame. The interface layer is
hidden with a stylesheet during capture, so the app's own panel insets clear
and its director frames the subject for the whole canvas. The satellite-to-orbit
mission: liftoff (Ground camera), stage separation and payload fairing
separation (the mission's Auto camera), in 1600x900 and 720x1280 windows.
Scripts and specs: `montage/capture/rocket/`.

| File | What it is |
|---|---|
| `src-media/montage/rocket-fairing-900p.mp4`, `rocket-fairing-portrait.mp4` | T+223 to T+228 s: the fairing halves open over the Earth, the upper-stage engine firing |
| `src-media/montage/rocket-stagesep-900p.mp4` | T+150 to T+154.5 s: stage separation |
| `src-media/montage/rocket-liftoff-900p.mp4`, `rocket-liftoff-portrait.mp4` | Liftoff from the pad |
| `src-assets/rocket/fairing.png`, `stage-separation.png`, `liftoff.png` | Single frames from those takes, for the cards |

The vehicle is the simulator's own generic design (the KIMBLE K-1); no agency's
or company's footage or imagery is used anywhere.

## Holograph (`BKimble1/Holograph`, branch `ci-screenshots`)

`src-assets/holograph/`: the app's own UI-test screenshots from the iPad
simulator (commit `dfa2451`, taken from `2b7898e`), 2064x2752. The two
landscape ones were saved sideways by the simulator and are rotated upright
here; nothing else is changed. The demo tiles (Tagfield, Scanpoint and so on)
are the five clearly labelled demo tiles the app seeds on first run. Crops keep
the iPad status bar and the settings button out of frame.

## OffRent Ledger, WallField, Turbid

No captures of these in use exist yet (WallField and Turbid need a physical
iPhone; OffRent Ledger has not been driven by hand on a device). The Work page
shows each one's own app icon from its asset catalogue, in `src-assets/marks/`:
`BKimble1/OffRent-Ledger` `OffRentLedger/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png`,
`BKimble1/Magshift` `WallField/Resources/.../AppIcon-1024.png`,
`BKimble1/Turbid` `Turbid/Resources/.../AppIcon.png`.

## Composed frames

Two kinds of image are laid out rather than cropped, both from real captures
only:

* **The Elemora wall** in the reel (`montage/compose.py`): Elemora's real
  screens, cropped between the status bar and the tab bar and scaled down, in
  four columns on Elemora's own background colour, drifting slowly.
* **The CoreCredit and Elemora cards** (`product_card` in
  `scripts/build_assets.py`): one real screen, scaled down, rising from the
  bottom edge of a gradient in the product's own colours (CoreCredit's accent
  blue; Elemora's pale blue).

## Portfolio

`src-assets/portfolio/straingage-capture.png` (the ENP 359 strain-gage lab
simulator, `BKimble1/Lab-3-Simulation`) is no longer used on idlery.com, now
that the portfolio is its own site; it is kept here as source material for it.

## Fonts

Manrope and IBM Plex Mono, from the Fontsource npm packages, SIL Open Font
License 1.1 (licences in `site/assets/fonts/`).

## What would make the site better

1. **Rocket Engineering, real-time:** a screen recording on a machine with a
   GPU: the hangar camera orbiting the vehicle with the cutaway open, the
   exploded view animating, the turbopump demonstration. The hangar scenes were
   too slow to render frame by frame here to use in the reel.
2. **Holograph in motion:** 5 to 10 s of the launcher on an iPad (the wall
   sliding, a tile opening), recorded with iOS screen recording.
3. **WallField, Turbid and OffRent Ledger in use:** a screen recording or
   screenshots of each on a real device, so the Work page can show more than
   their icons. WallField's heat map on a wall would be especially clear.
4. **Karnwold gameplay recording:** 20 to 30 s at 1920x1080 or higher from a
   machine with a real GPU: a siege with the dice rolling, bots building, a
   building upgraded to stage 3.
5. **CoreCredit and Elemora in use:** 5 to 10 s iPhone screen recordings of each
   (CoreCredit logging a core; Elemora opening an element or building a
   compound) would replace the still captures in the reel.

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

Seven iPhone captures (1170×2532), `IMG_2838`–`IMG_2853`, taken before the App
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
| `src-media/montage/karnwold-siege-720p.mp4` | Trimmed from `public/offline-preview.mp4` (1280×720 screen recording of karnwold.com), 0:56–1:03 | An alternate: a siege dice roll |
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

## Portfolio

| File | Source |
|---|---|
| `src-assets/portfolio/straingage-capture.png` | The ENP 359 strain-gage lab simulator (`BKimble1/Lab-3-Simulation`), built locally, its own "Working example" loaded, captured at 1600×1000 |

## Fonts

Manrope and IBM Plex Mono, from the Fontsource npm packages, SIL Open Font
License 1.1 (licences in `site/assets/fonts/`).

## What would make the site better

1. **K-truss bridge:** 2–4 photos (the finished bridge; it under load on the
   test rig; a construction detail), plus the analysis summary and the measured
   result you want to show (for example, failure load and bridge mass). The
   portfolio card is built to take them.
2. **Hovercraft prototype:** 2–3 photos (the craft hovering; the skirt and lift
   fan; the build in progress) and a sentence each on what you built and how you
   tested it.
3. **Karnwold gameplay recording:** 20–30 s at 1920×1080 or higher from a
   machine with a real GPU: a siege with the dice rolling, bots building, a
   building upgraded to stage 3. The current footage is a frame-stepped capture
   of one round and one build; a siege could not be captured here.
4. **The physical Karnwold prototype in motion:** 10 s of hands placing pieces
   on the board, if you have it.
5. **Fab One, real-time:** a screen recording on a GPU machine would be smoother
   still than the frame-stepped renders, and would let the montage show the
   camera flying between machines at full speed.
6. **Optional:** a photograph of you for the portfolio, if you want one there.

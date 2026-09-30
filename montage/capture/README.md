# How the footage was captured

These scripts recorded the Rocket Engineering, Fab One and Karnwold footage
in `src-media/montage/`. They drive each product's own production build in
Playwright's Chromium and step its clock one frame at a time, so motion is
smooth and exactly timed even on a machine with only software rendering.
Nothing in either product was modified; these scripts only watch.

Both expect the product repository checked out beside this one (or say where
with an environment variable), its dependencies installed, and its production
build served locally. Frames and encodes go to `out/` next to each script, or
to `CAPTURE_DIR`.

## Fab One (`fabone/`)

Repository: `BKimble1/Photolithography-Simulation-Site`, branch
`claude/fab-one-round-four-realism-x1ze0a` (commit `822bb0f` was used).

```sh
cd ../Photolithography-Simulation-Site && npm ci && npm run build
npx vite preview --port 4183 &
cd -   # back here
FABONE_REPO=../Photolithography-Simulation-Site node fabone/rec-canvas.mjs fabone/shot-aisle-land.json
python3 fabone/post.py fabone/out/aisle-land --keep   # MP4, stills and a contact sheet
cp fabone/out/aisle-land/fabone-aisle-land-1600x900-30fps.mp4 ../../src-media/montage/fabone-aisle-900p.mp4
```

(`fabone-aisle-portrait.mp4` and `fabone-aisle-phone.mp4` come from
`shot-aisle-port.json` and `shot-aisle-phone.json` the same way.) The branch
can be exported without switching a checkout:
`git archive 822bb0f | tar -x -C ../fabone-r4`.

`rec-canvas.mjs` opens the lesson on the app's virtual clock (`?virt=1`), reads
the WebGL drawing buffer with `gl.readPixels` after every frame, and sizes the
browser window so the canvas itself is exactly 1600×900. No page, panel,
caption or label is in the frame. `quality=high` is the app's own documented
parameter for the rendering tier a desktop GPU gets. `record-*.json` records
the exact URL, window sizes, setup steps and timings of each take.

| Shot | Lesson | What happens |
|---|---|---|
| `shot-bay.json` | `?explore` | from the whole bay, the camera glides down to the scanner |
| `shot-bay-take1.json` | `?step=coat`, then Explore | the first 50 frames are the pull-back from the coat cup to the whole bay (`fabone-pullback-900p.mp4`) |
| `shot-scanner.json` | `?step=expose&lp=1` | the lens column with the light path shown; the beam blinks between exposure fields, so the montage uses it as a still only |
| `shot-develop.json` | `?step=develop` | developer on the wafer, then the dive into the magnified cross-section |
| `shot-aisle-land.json`, `shot-aisle-port.json`, `shot-aisle-phone.json` | `?explore` | the app's own flight from the scanner to the FOUP stocker at the far end of the bay: out into the central aisle, along it past both rows of tools under the ceiling rails, through the glass wall, and in to the stocker. Both machines are visited first so neither has to load mid-flight. The stage clock steps 1/80 s per frame (`window.__fab.stageTime.dt`, the app's own recording hook) instead of 1/30 s, so at 30 fps the move plays at 0.375 speed. Windows are sized so the canvas is exactly 1600x900, 720x1280 and 720x1560; the app frames the flight for each shape (on tall canvases it widens the view to floor and ceiling) |

Fab One issue noticed while capturing: navigating to a machine while the
camera is still easing out of a lesson makes the camera jump to it in a single
frame; waiting for the move to finish avoids it (`shot-bay-take1.json`
reproduces it).

## Karnwold (`karnwold/`)

Repository: `BKimble1/karnwold` (`main`).

```sh
cd ../karnwold && npm ci && npm run build && npx vite preview --port 4173 &
cd -
KARNWOLD_REPO=../karnwold node karnwold/shotA2.mjs   # the table, round 3
KARNWOLD_REPO=../karnwold node karnwold/shotB.mjs    # building a Barracks
python3 karnwold/finish.py table 14 191               # trim, encode, stills
python3 karnwold/finish.py build 10 147
KARNWOLD_REPO=../karnwold node karnwold/shotC.mjs siege-land 1920 1080   # a siege roll
KARNWOLD_REPO=../karnwold node karnwold/shotC.mjs siege-port 1080 1920
CRF=16 python3 karnwold/finish.py siege-land                               # -> karnwold-siege-1080p.mp4
CRF=16 python3 karnwold/finish.py siege-port                               # -> karnwold-siege-portrait.mp4
```

An offline game of You plus three bots (Play Karnwold → Play Offline → More
players twice → Start Game). Playwright's fake clock (`page.clock`) is
installed before the first load and advanced 32 ms per frame; CSS animations
are paused and stepped by the same amount. The window is 1920×1080. The
Barracks drop points come from the game's own build graph (`nodes.mjs`).

The siege (`shotC.mjs`, the reel's Karnwold chapter) uses the game's tabletop
preview (`#/table` with no saved game), which runs the real engine and siege
adapter; its "Round 3" fast-forward exists so a siege is reachable for review,
and the game's own end-to-end test (`tests/e2e/siege.spec.js`) uses it the
same way. The script opens the Siege tab, starts a siege on the first legal
target, records a second of the table with the siege bar, then presses "Roll
the dice": the table dims, the 3D dice tumble to the faces the engine rolled,
and the result panel ("Siege continues") is revealed. The page renders at
device scale 2 and each frame is saved at the window's size, so edges are
supersampled. Two takes: a 1920x1080 window for the landscape cut and a
1080x1920 window (the game's narrower layout, where the result panel fits a
tall frame) for the portrait and phone cuts. Each roll is the engine's own, so
the two takes show different dice.

Karnwold's interface asks for Georgia, then Times New Roman, for display type,
and for `system-ui`, Segoe UI and Roboto for body type. The Linux capture
machine had none of the first choices. For the table and build takes,
`fonts.conf` mapped them, for the capture browser only, to the metric-compatible
open fonts Gelasio and Selawik. For the siege takes it maps Georgia to Gelasio
and the system font to Roboto, which is in the game's own body stack (both from
the npm packages `@fontsource/gelasio` and `@fontsource/roboto`). Copy
`fonts.conf` to `karnwold/out/fonts/` and the font files to
`karnwold/out/fonts/fonts/`. The Google Fonts the page links load only on the
landing page's showcase section, not on the table.

Karnwold issue noticed while capturing: the header reads "You's turn" when the
player is named "You".

## Rocket Engineering (`rocket/`)

Repository: `BKimble1/rocket-simulation`, branch
`claude/kimble-rocket-engineering` (commit `6bdec75` was used).

```sh
cd ../rocket-simulation && npm ci && npx vite build   # the branch's tsc step trips on one unused constant; vite alone builds the same bundle
npx vite preview --port 4190 --host 127.0.0.1 &
cd -   # back here
ROCKET_REPO=../rocket-simulation node rocket/rec-canvas.mjs rocket/liftoff-land.json
python3 rocket/encode.py rocket/out     # clips to src-media/montage/, stills to src-assets/rocket/
```

`rec-canvas.mjs` opens the mission explorer on the app's virtual clock
(`?virt=1&capture=1`, its own test flags), waits for the flight scene, seeks
with the app's `__rocketSeekMission` test hook, sets the camera mode the
interface offers (Auto or Ground), plays at 1x and reads the WebGL drawing
buffer after every frame. The interface is hidden with a stylesheet first, so
the app's own panel insets clear and its director frames the subject for the
whole canvas; the 0.55 s dissolve from the hangar that plays when the page
first enters the flight scene is skipped. Nothing in the simulation, its
trajectories or its camera framings is changed.

| Spec | Mission moment | Window |
|---|---|---|
| `fairing-land.json` | Satellite to LEO, T+223.2 s, Auto: the payload fairing separates | 1600x900 |
| `ses1-land.json` | T+155.5 s, Auto: after stage separation, the upper stage's igniter flashes green, its engine lights and the booster falls away | 1600x900 |
| `liftoff-land.json` | T+5.5 s, Ground: the climb off the pad | 1600x900 |
| `fairing-port.json`, `ses1-port.json`, `liftoff-port.json` | The same moments, framed by the app for a portrait tablet (liftoff from T+0.6 s, the whole vehicle on the pad, for 8 s) | 720x1280 |
| `fairing-phone.json`, `ses1-phone.json`, `liftoff-phone.json` | The same moments, framed by the app for a phone | 720x1560 |

Rendering was done with SwiftShader (a CPU rasteriser), at 5 to 15 s a frame.

Notes from capturing: the release branch's `npm run build` stops at
`tsc -b` on an unused constant (`HE_UNION_DROP` in
`src/scene/vehicle/engine/mech.ts`); `vite build` on its own succeeds.

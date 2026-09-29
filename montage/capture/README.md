# How the footage was captured

These scripts recorded the Fab One and Karnwold footage in
`src-media/montage/`. They drive each product's own production build in
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
FABONE_REPO=../Photolithography-Simulation-Site node fabone/rec-canvas.mjs fabone/shot-develop.json
python3 fabone/post.py develop     # MP4, stills and a contact sheet
```

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
```

An offline game of You plus three bots (Play Karnwold → Play Offline → More
players twice → Start Game). Playwright's fake clock (`page.clock`) is
installed before the first load and advanced 32 ms per frame; CSS animations
are paused and stepped by the same amount. The window is 1920×1080. The
Barracks drop points come from the game's own build graph (`nodes.mjs`).

Karnwold's interface asks for Georgia and Segoe UI. The Linux capture machine
had neither, so `fonts.conf` maps them, for the capture browser only, to the
metric-compatible open fonts Gelasio and Selawik (put the font files in
`karnwold/fonts/`).

Karnwold issue noticed while capturing: the header reads "You's turn" when the
player is named "You".

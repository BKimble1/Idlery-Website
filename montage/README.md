# The hero montage

A silent, looping cut of Idlery's work for the home page, in two versions:
**landscape** (16.6 s; 1920×1080 master, 1600×900 on the web) for wide screens
and **portrait** (13.8 s; 1080×1920 master, 720×1280 on the web) for phones.
A third cut, `fabone` (7.8 s, 1280×720 on the web), is the Fab One loop on the
Simulations page.

The sequence: Karnwold (the table in round 3, then a Barracks being built) →
Fab One (pulling back from a wafer in the coater to the whole fab, then diving
from the developer into the chip's cross-section) → CoreCredit → Elemora → the
Idlery wordmark, which crossfades back into the first frame.

Every frame is real: gameplay recorded from Karnwold's production build,
frames rendered by Fab One's own renderer, and straight crops of CoreCredit and
Elemora device captures. The only composed frame is the closing card: the Idlery
wordmark on the site's dark ground. Nothing is generated, redrawn or mocked up.

## Rebuild it

```sh
pip install Pillow numpy imageio-ffmpeg
python3 scripts/build_montage.py            # both cuts, a few minutes
python3 scripts/build_montage.py portrait   # one cut
```

The script writes `site/assets/video/hero-<cut>.av1.mp4` (AV1) and `.mp4`
(H.264), the posters `hero-poster-*.webp|jpg` (the first frame of the file), a
near-lossless master in `montage/build/` (ignored by git), and the chapter
times the "Now showing" label reads, into `site/index.html`.

## Edit it

`shots.json` holds both cuts. Each shot:

| Field | Meaning |
|---|---|
| `source` | a video or image, relative to the repository root |
| `in` | for video, the second to start from |
| `speed` | for video, playback speed (0.6 = slower) |
| `duration` | how long the shot runs in the cut, in seconds |
| `from`, `to` | the crop window at the start and end of the shot, as `[x, y, width, height]` fractions of the source frame. The window moves in a straight line between them: a pan, a push-in, or a pull-out. Keep the window's shape the same as the cut's (16:9 or 9:16 after multiplying by the source size) or the picture stretches |
| `ease` | `"smooth"` for an eased move; linear otherwise |
| `grade` | optional global `brightness`, `contrast`, `gamma`, `saturation`. Used only to bring bright shots down under the white headline |
| `fade` | the crossfade into the next shot, in seconds |
| `chapter`, `kind` | what the "Now showing" label says from this shot on (`""` hides it) |

`loop_fade` is the crossfade from the last shot back into the first. The first
shot's opening frames are held back and used as the target of that crossfade, so
the file wraps without a visible cut, and the poster is exactly where the loop
lands. A shot must be longer than its fades.

Web encodes are set per cut under `web`: output size and the AV1 and H.264
quality (`crf`, lower is better and bigger). AV1 is listed first in the page
and is about 30–45% smaller at the same SSIM; browsers that cannot play it take
the H.264 file. Current sizes: landscape 1.7 MB AV1 / 2.3 MB H.264, portrait
0.8 / 1.0 MB, Fab One loop 0.7 / 0.9 MB.

## Where the footage came from

| File in `src-media/montage/` | Source |
|---|---|
| `karnwold-table-1080p.mp4` | Karnwold production build, offline game vs three bots, round 3; clock-stepped 1920×1080 capture (Playwright fake clock, 32 ms per frame). Scripts: `montage/capture/karnwold/` |
| `karnwold-build-1080p.mp4` | Same session: assembling a Barracks in the 3D build view, then the camera orbit |
| `karnwold-siege-720p.mp4` | Trimmed from `public/offline-preview.mp4` in the Karnwold repository (1280×720 screen recording, 0:56–1:03): a siege with the dice rolling. An alternate; the fresh capture has no siege |
| `karnwold-prototype-loop.mp4` | `public/about/physical-prototype-loop.mp4` in the Karnwold repository; kept as an alternate |
| `fabone-*.mp4` | Fab One (`Photolithography-Simulation-Site`, round-four branch), production build, rendered frame by frame on the app's virtual clock (`?virt=1&capture=1`), reading the WebGL canvas so no interface is in frame. Scripts and specs: `montage/capture/fabone/` |
| `corecredit-stage-*.png`, `elemora-stage-*.png` | Real iPhone captures (CoreCredit: dashboard and Scan core; Elemora: the table and Build), cropped below the status bar, with rounded corners, placed on the site's dark ground away from the headline: two on the right half in landscape, one in the upper middle in portrait |
| `idlery-card-*.png` | The Idlery wordmark SVG on `#0b1417`, rendered by Playwright |

Karnwold's interface asks for Georgia and Segoe UI, which the Linux capture
machine does not have; the capture browser substituted the metric-compatible
open fonts Gelasio and Selawik. Nothing in the game was changed.

## Better footage that would improve it

A real-GPU screen recording of Karnwold (a full round, a siege dice roll, a
building going up) and of Fab One's camera flying between machines would be
smoother and richer than frame-stepped software renders. Short iPhone screen
recordings of CoreCredit and Elemora in use would replace the two still app
shots. Drop new clips into `src-media/montage/`, point a shot's `source` at
them, and rebuild.

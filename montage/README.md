# The hero reel

A silent, looping studio reel for the home page, in three purpose-built cuts:
**landscape** (16:9; 1920x1080 master, 1600x900 on the web) for wide screens,
**portrait** (9:16; 1080x1920 master, 720x1280 on the web) for portrait
tablets, and **phone** (about 9:19.5, the shape of a modern phone screen;
1080x2340 master, 720x1560 on the web). Neither tall cut is a crop of the
landscape one: the rocket shots are rendered by the simulator itself in a
window of that shape, so its own camera director frames them, and every other
shot has its own framing or source (a phone interface filling the screen edge
to edge instead of a wide one). The phone cut exists because a 9:16 video
covering a 390x844 screen loses about a tenth of its width on each side, which
clips full-screen interface shots; the phone captures are themselves 9:19.5,
so there they fit exactly.

## The sequence

Landscape, about 27 seconds:

| Chapter ("Now showing") | Shot | Source |
|---|---|---|
| Rocket Engineering · Simulation | The payload fairing separates over the Earth, the upper stage firing | Rocket Engineering, rendered frame by frame |
| Fab One · Semiconductor simulation | Pull back from a wafer to the whole fab; the developer, then the dive into the cross-section | Fab One, rendered frame by frame |
| Karnwold · Strategy game | The table in round 3; a Barracks being built | Karnwold's production build |
| CoreCredit · Product | The iPad dashboard, pushing in to the money at risk | A real iPad capture |
| Rocket Engineering · Simulation | Liftoff: the vehicle climbing off the pad on its plume | Rocket Engineering |
| Elemora · Chemistry product | A slow wall of Elemora's screens: study, the table, an element, a compound | Real iPhone captures, composed by `montage/compose.py` |
| Holograph · Interface experiment | The launcher's glass tiles, pushing in to the selected one | A real iPad simulator screenshot |
| Rocket Engineering · Simulation | After stage separation: the upper-stage engine lights (the green flash is its hypergolic igniter) and the booster falls away | Rocket Engineering |

The last shot crossfades into the first (space into space), so the file loops
with no visible cut and no title card. The poster is the first frame of the
file, which is also where the loop lands.

Portrait and phone, about 25 seconds each: the fairing separation, Fab One's
developer, the Karnwold table and build, CoreCredit's dashboard filling the
screen, liftoff with the whole vehicle in frame, Elemora's Build screen
pushing in to caffeine's skeletal structure, and Holograph's launcher; then
back to the fairing.

Every frame is real: renders by the simulators' own renderers, gameplay from
Karnwold's production build, and unmodified crops of product captures. The
only composed frames are the Elemora wall (real screens laid out on Elemora's
own background colour; see `compose.py`) and the crossfades.

## Rebuild it

```sh
pip install Pillow numpy imageio-ffmpeg
python3 montage/compose.py                  # the Elemora wall, if its captures changed
python3 scripts/build_montage.py            # all three cuts, several minutes
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
| `from`, `to` | the crop window at the start and end of the shot, as `[x, y, width, height]` fractions of the source frame. The window moves between them: a pan, a push-in, or a pull-out. Keep the window's shape the same as the cut's (16:9 or 9:16 after multiplying by the source size) or the build refuses it |
| `ease` | `"smooth"` for an eased move; linear otherwise |
| `grade` | optional global `brightness`, `contrast`, `gamma`, `saturation`. Used only to bring bright shots down under the white headline |
| `fade` | the crossfade into the next shot, in seconds |
| `chapter`, `kind` | what the "Now showing" label says from this shot on (`""` hides it) |

`loop_fade` is the crossfade from the last shot back into the first. The first
shot's opening frames are held back and used as the target of that crossfade,
so the file wraps without a visible cut. A shot must be longer than its fades.

Web encodes are set per cut under `web`: output size and the AV1 and H.264
quality (`crf`, lower is better and bigger). AV1 is listed first in the page;
browsers that cannot play it take the H.264 file.

## Where the footage came from

| File | Source |
|---|---|
| `src-media/montage/rocket-*.mp4` | Rocket Engineering (`BKimble1/rocket-simulation`, branch `claude/kimble-rocket-engineering`, commit `6bdec75`), production build, rendered frame by frame on the app's own virtual clock (`?virt=1`), reading the WebGL buffer so no interface is in frame. Satellite-to-orbit mission: liftoff (Ground camera, from T+5.5 s), upper-stage ignition after stage separation (from T+155.5 s) and payload fairing separation (from T+223 s), the last two with the app's Auto camera. The portrait and phone takes are the same moments rendered in 720x1280 and 720x1560 windows, framed by the app's own director. Scripts and specs: `capture/rocket/` |
| `fabone-*.mp4` | Fab One (`Photolithography-Simulation-Site`, round-four branch), production build, rendered frame by frame on the app's virtual clock (`?virt=1&capture=1`), reading the WebGL canvas. Scripts and specs: `capture/fabone/` |
| `karnwold-table-1080p.mp4`, `karnwold-build-1080p.mp4` | Karnwold production build, offline game against three bots, round 3; clock-stepped 1920x1080 capture. Scripts: `capture/karnwold/` |
| `karnwold-siege-720p.mp4`, `karnwold-prototype-loop.mp4` | Alternates from the Karnwold repository (a siege dice roll; the physical prototype) |
| `elemora-wall-1080p.mp4` | Composed by `compose.py` from the real Elemora iPhone captures in `src-assets/elemora/` |
| `src-assets/corecredit/ipad-dashboard.png`, `phone-dashboard.png` | Real CoreCredit captures (sample records) |
| `src-assets/elemora/06-build.png` | A real Elemora capture: caffeine in Build |
| `src-assets/holograph/*.png` | Holograph's own UI-test screenshots from the iPad simulator (`BKimble1/Holograph`, branch `ci-screenshots`); the landscape ones rotated upright |

Karnwold's interface asks for Georgia and Segoe UI, which the Linux capture
machine does not have; the capture browser substituted the metric-compatible
open fonts Gelasio and Selawik. Nothing in the game was changed.

## Footage that would improve it

A real-GPU screen recording of the rocket simulator (the camera flying around
the vehicle in the hangar with the cutaway open, or the exploded view
animating), of Fab One's camera moving between machines, and of Karnwold's
siege dice would all be smoother and richer than frame-stepped software
renders. Short iPhone screen recordings of CoreCredit and Elemora in use, and
an iPad recording of Holograph's launcher moving, would replace the still
captures. Drop new clips into `src-media/montage/`, point a shot's `source` at
them, and rebuild.

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

Landscape, 26 seconds:

| Chapter ("Now showing") | Shot | Into the next |
|---|---|---|
| Rocket Engineering · Simulation | The payload fairing separates over the Earth, the upper stage firing (2.4 s) | cut |
| Holograph · Interface experiment | The launcher's glass tiles, then the same launcher after centring on a tile, each drifting in (1.5 s each) | cut |
| Karnwold · Strategy game | The table in round 3; a Barracks being built (2.3 s, 2.2 s) | dip through black, 0.6 s |
| Fab One · Semiconductor simulation | Pull back from a wafer to the whole fab; the developer running (2.1 s, 2.0 s) | cut |
| CoreCredit · Product | The iPad dashboard pushing in to the money at risk; the cores screen (1.9 s, 1.5 s) | cut |
| Elemora · Chemistry product | A slow wall of Elemora's screens (2.4 s) | cut |
| Rocket Engineering · Simulation | Liftoff, the vehicle climbing on its plume (3.0 s); after stage separation, the upper-stage engine lights (the green flash is its hypergolic igniter) and the booster falls away (3.2 s) | cut back to the first shot: from the wide view of the upper stage in to the close fairing, on the same diagonal |

Portrait and phone, 24.2 seconds each, in the same order: the fairing
separation (3.6 s), Holograph's launcher and its portrait layout, the Karnwold
table and build, a dip through black, Fab One's pullback and developer,
CoreCredit's phone dashboard and card scan, Elemora's Build screen (caffeine)
and oxygen's element page, and liftoff with the whole vehicle in frame (3.6 s);
then a cut back to the fairing.

### How it is edited

* **Short holds on stills.** No still capture holds longer than 1.9 s. Each
  product gets two real states (a dashboard, then a detail) instead of one long
  push-in, and every still keeps moving: a slow push or drift on an eased curve.
* **Tone runs in groups.** The dark footage (space, Holograph's glass, the
  Karnwold table) comes first; one dip through black carries it into the
  bright group (Fab One's clean room, CoreCredit, Elemora), which cuts to the
  daylight launch pad and climbs back into space. Nothing jumps straight from
  a dark frame to a white screen.
* **Transitions are chosen per join.** Joins between different subjects are
  hard cuts, which read as deliberate and never leave a double image. The one
  dip through black is where brightness changes most. There is no crossfade:
  the only place one was tried, the loop, stacked two rockets for a third of a
  second, so every cut now wraps on a hard cut instead (landscape from the
  wide view of the upper stage in to the close fairing on the same diagonal,
  the tall cuts from the climbing rocket to the fairing). Fab One's developer
  clip starts after the app's own camera dissolve, so it never shows two views
  at once.
* **The headline stays readable.** Bright shots carry a `grade` that brings
  them down under the white headline, and the page adds a scrim. The worst
  frame measured on the page (95th percentile luminance behind the words,
  sampled every half second) keeps the headline at 6.4:1 or better on a
  1440x900 desktop, 5.1:1 on a portrait tablet and 8.4:1 on a phone.

The file wraps with no title card and no logo. The poster is the first frame
of the file, which is also where the loop lands.

Every frame is real: renders by the simulators' own renderers, gameplay from
Karnwold's production build, and unmodified crops of product captures. The
only composed frames are the Elemora wall (real screens laid out on Elemora's
own background colour; see `compose.py`) and the transitions.

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

`shots.json` holds all three cuts. Each shot:

| Field | Meaning |
|---|---|
| `source` | a video or image, relative to the repository root |
| `in` | for video, the second to start from |
| `speed` | for video, playback speed (0.6 = slower) |
| `duration` | how long the shot runs in the cut, in seconds |
| `from`, `to` | the crop window at the start and end of the shot, as `[x, y, width, height]` fractions of the source frame. The window moves between them: a pan, a push-in, or a pull-out. Keep the window's shape the same as the cut's (16:9 or 9:16 after multiplying by the source size) or the build refuses it |
| `ease` | `"smooth"` for an eased move; linear otherwise |
| `grade` | optional global `brightness`, `contrast`, `gamma`, `saturation`. Used only to bring bright shots down under the white headline |
| `transition` | how the shot hands over to the next: `{"type": "cut"}`, `{"type": "fade", "duration": 0.5}` (a crossfade; the shots overlap) or `{"type": "dip", "duration": 0.6}` (down to black and up from black, with no overlap). The older `"fade": seconds` still works |
| `chapter`, `kind` | what the "Now showing" label says from this shot on (`""` hides it) |

Each cut's `loop` is how its last shot hands back to the first: `{"type":
"fade", "duration": s}` holds back the first shot's opening frames and
crossfades the last shot into them, so the file wraps without a jump; `{"type":
"cut"}` lets the last frame meet the first. A shot must be longer than its
transitions. Every cut uses `{"type": "cut"}` today. A crossfade is only safe
where the two frames share no subject that could be seen twice: two rockets,
two screens or two game tables dissolving together read as a double image.

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

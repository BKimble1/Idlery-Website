# The hero reel

A silent, looping studio reel for the home page, in three purpose-built cuts:
**landscape** (16:9; 1920x1080 master, 1600x900 on the web) for wide screens,
**portrait** (9:16; 1080x1920 master, 720x1280 on the web) for portrait
tablets, and **phone** (about 9:19.5, the shape of a modern phone screen;
1080x2340 master, 720x1560 on the web). Neither tall cut is a crop of the
landscape one: the rocket and Fab One shots are rendered by the apps
themselves in a window of that shape, so their own camera directors frame
them; the siege is recorded in a tall window; and the product wall is laid
out for each shape so every phone stays whole. The phone cut exists because a
9:16 video covering a 390x844 screen loses about a tenth of its width on each
side, which would clip the phones at the edges of the wall.

## The sequence

Four chapters, each one continuous piece of action, in about 22 seconds. Every
cut in the landscape edit (22.0 s):

| Chapter ("Now showing") | Shot | Into the next |
|---|---|---|
| Rocket Engineering · Simulation | Liftoff: the vehicle climbing off the pad through its own smoke, the tower falling away (4.0 s); then, after stage separation, the stack coasting over the Earth until the upper stage's igniter flashes green, its engine lights and the booster falls away (3.8 s) | a cut on the climb, from the rocket rising out of frame to the whole stack in space |
| Fab One · Semiconductor simulation | One flight through the fab (5.0 s): out of the scanner into the central aisle, along it between both rows of tools under the ceiling rails, through the glass wall, and in to the FOUP stocker at the far end | a cut as the camera settles on the stocker |
| Karnwold · Strategy game | A siege (4.4 s): the table with the siege bar, "Roll the dice", the table dims, the dice tumble to the faces the engine rolled, and the result panel reads "Siege continues" | a cut from the result |
| CoreCredit and Elemora · Products | Real phone screens, CoreCredit and Elemora alternating (five in landscape, three in the tall cuts), on complete phones in a row, climbing together through a soft sky while the cloud banks fall away below (4.8 s) | a cut back to the liftoff: from the wall's blue sky and low cloud to the launch sky and smoke |

The portrait and phone cuts (22.3 s) are the same four chapters, each shot in
its own framing: the rocket and Fab One rendered by the apps themselves in
tall windows (the liftoff runs a little longer, 4.6 s, so the rocket clears
the tower), the siege recorded in a tall window where the game lays its
result panel out narrower, and the product wall laid out for the shape.

### How it is edited

* **One subject per chapter, given time to register.** Four chapters instead
  of a new project every two seconds, and no project comes back later in the
  reel. The rocket chapter is two shots of one flight; Fab One, Karnwold and
  the product wall are each a single continuous move.
* **Cuts at motion points.** Every join is a hard cut, placed where the motion
  carries across it: the climb off the pad into the climb in orbit, the end of
  the engine burn into the camera already travelling down the fab's aisle, the
  camera arriving at the stocker, the siege result, and the product wall's
  climb back into the launch. There are no crossfades, dips or ghosted
  overlaps.
* **Exposure and colour matched between chapters.** Fab One's white clean
  room is graded down and slightly cool, so it does not flash after space;
  Karnwold's dimmed table is lifted in the shadows without clipping the gold board; the product wall's sky starts dim, after
  the game table, and brightens to the launch's daylight by its last frame.
* **An engineered loop.** The product wall is composed for the loop: its sky
  and low cloud banks are sampled from the opening launch shot, so the last
  frame (phones still climbing) cuts cleanly to the launch sky and smoke. There
  is no logo, title card, black frame or pause, and the file never stops
  moving. The poster is the first frame, the rocket and tower rising through
  the smoke, which is also where the loop lands.
* **The headline stays readable.** Each shot's `grade` keeps it under the
  white headline, and the page adds a scrim. The phones and the siege panel
  sit where the text is not: above the headline on desktop, in the upper half
  on phones. Measured on the page every half second (95th percentile
  luminance behind the words), the worst frame keeps the headline at 6.9:1 or
  better on 1280 to 1920 px desktops, 7.5:1 on a portrait tablet and 8.7:1 on
  a 390x844 phone; the lowest anywhere is 4.7:1, on a 360x740 phone and a 4:3
  tablet held sideways, for half a second over Karnwold's lit board. The
  subline never falls below 12:1.

Every frame is real: renders by the simulators' own renderers of their own
camera moves, gameplay from Karnwold's production build, and unmodified
product captures. The only composed frames are the product wall (real
screens, each whole, in drawn phone bodies on a drawn sky; see `compose.py`).

## Rebuild it

```sh
pip install Pillow numpy imageio-ffmpeg
python3 montage/compose.py                  # the product walls, if their captures changed
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
| `speed` | for video, playback speed (0.6 = slower). It repeats frames, so slow motion is better rendered slowly at the source, as the Fab One flight is |
| `duration` | how long the shot runs in the cut, in seconds |
| `from`, `to` | the crop window at the start and end of the shot, as `[x, y, width, height]` fractions of the source frame. The window moves between them: a pan, a push-in, or a pull-out. Keep the window's shape the same as the cut's (16:9 or 9:16 after multiplying by the source size) or the build refuses it |
| `ease` | `"smooth"` for an eased move; linear otherwise |
| `grade` | optional global `brightness`, `contrast`, `gamma`, `saturation` and `tint` (a white-balance gain per channel, `[r, g, b]`). Used to keep each chapter under the white headline and to match exposure and colour between chapters |
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
| `src-media/montage/rocket-liftoff-*.mp4`, `rocket-separation-*.mp4` | Rocket Engineering (`BKimble1/rocket-simulation`, branch `claude/kimble-rocket-engineering`, commit `6bdec75`), production build, rendered frame by frame on the app's own virtual clock (`?virt=1`), reading the WebGL buffer so no interface is in frame. Satellite-to-orbit mission: liftoff with the Ground camera (landscape from T+5.5 s; the tall takes from T+0.6 s, the vehicle still on the pad) and the upper-stage ignition after stage separation with the Auto camera (from T+155.5 s). The portrait and phone takes are the same moments rendered in 720x1280 and 720x1560 windows, framed by the app's own director. Scripts and specs: `capture/rocket/` |
| `fabone-aisle-900p.mp4`, `fabone-aisle-portrait.mp4`, `fabone-aisle-phone.mp4` | Fab One (`Photolithography-Simulation-Site`, round-four branch, commit `822bb0f`), production build: the Explore view's own camera flight from the scanner to the FOUP stocker, rendered frame by frame on the app's virtual clock at 0.375 speed, reading the WebGL canvas, in 16:9, 9:16 and 9:19.5 canvases (the app frames the flight for each). Scripts and specs: `capture/fabone/` |
| `karnwold-siege-1080p.mp4`, `karnwold-siege-portrait.mp4` | Karnwold production build, the tabletop preview's round-3 siege (the real engine and siege adapter), clock-stepped capture in 1920x1080 and 1080x1920 windows. Scripts: `capture/karnwold/shotC.mjs` |
| `products-wall-landscape.mp4`, `-portrait.mp4`, `-phone.mp4` | Composed by `compose.py` from real iPhone captures: CoreCredit's dashboard and cores (`src-assets/corecredit/`) and Elemora's periodic table, caffeine in Build and oxygen (`src-assets/elemora/`) |

Alternates kept in `src-media/montage/` but not in the current edit: the
payload fairing separation (`rocket-fairing-*`), Fab One's bay, pullback,
scanner and developer shots, Karnwold's round-3 table and a Barracks being
built (offline game against three bots), the 720p siege and the physical
prototype from the Karnwold repository, and the earlier Elemora wall.

## Footage that would improve it

Real-GPU screen recordings would be smoother and richer than frame-stepped
software renders, above all of the rocket simulator and Fab One. Short iPhone
screen recordings of CoreCredit and Elemora in use, and captures of any other
released product, would let the product wall show the apps moving. Drop new
clips into `src-media/montage/`, point a shot's `source` at them, and rebuild.

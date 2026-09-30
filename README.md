# idlery.com

The source of truth for **idlery.com**, the home of Idlery Services LLC, an
independent technology studio. The site shows the range of the work (Rocket
Engineering, Fab One, Karnwold, CoreCredit, Elemora, OffRent Ledger and a bench
of experiments) and points to the studio's other sites.

It is a plain static site: hand-written HTML, one stylesheet, one small script,
self-hosted fonts, no framework and no build step that Netlify has to run. What
Netlify serves is exactly the `site/` folder.

```
site/                    the deployable site; this folder is the publish root
  index.html             home: hero reel, featured work, Explore Idlery, about
  work/ about/           the two sections that live here
  karnwold/ corecredit/ elemora/                    project pages (old URLs, kept)
  support/ privacy/ terms/ legal/                   help, and this site's own policies
  404.html  _headers  _redirects  robots.txt  sitemap.xml  site.webmanifest  favicon.ico
  assets/css/site.css    the whole stylesheet
  assets/js/site.js      the whole script (menu, hero video, featured-work reel)
  assets/fonts/          Manrope and IBM Plex Mono, with their OFL licences
  assets/img/            generated images (see "Images")
  assets/video/          the hero reel and its posters

partials/                header, footer and <head> shared by every page
site.config.json         where Simulations, Products and Portfolio point; App Store links
src-assets/              full-size originals for every image; never served
src-media/montage/       the footage and captures the reel is cut from
montage/                 the reel's edit (shots.json), compositor, capture scripts
scripts/                 build.py, build_assets.py, build_montage.py, serve.mjs,
                         check_site.mjs, make_og.mjs, make_zip.py
docs/                    AUDIT.md, MEDIA.md, DESIGN.md
```

## The Idlery sites

| Address | What it is | Where it is built |
|---|---|---|
| idlery.com | The main brand: Work, About, Support, Privacy, Terms | here |
| products.idlery.com | Products | a separate site, not in this repository |
| simulations.idlery.com | Simulations | a separate site, not in this repository |
| portfolio.idlery.com | Blake Kimble's engineering portfolio | a separate site, not in this repository |

The navigation links straight to the three separate sites. Until each is set
up, its link simply goes nowhere; that is expected, and nothing here tries to
stand in for them. The old local pages `/simulations/`, `/apps/` and
`/portfolio/` 301 to them (see "Change something").

## Preview it locally

You need [Node.js](https://nodejs.org/) 20 or newer. Nothing to install for
the preview itself.

```sh
git clone https://github.com/BKimble1/Idlery-Website.git
cd Idlery-Website
node scripts/serve.mjs          # or: npm run serve; then open http://localhost:8080
```

On Windows, run the same commands in PowerShell or Command Prompt. The preview
server applies `_headers` (so the real Content-Security-Policy is enforced) and
`_redirects`, serves `404.html` for unknown paths, and supports video seeking.
Use `node scripts/serve.mjs 8090` for another port; stop it with Ctrl+C.

## Change something

**Page content** lives in `site/**/index.html`. Edit the HTML directly.

**The header, footer and `<head>` tags** are shared. Edit the files in
`partials/`, then run:

```sh
python3 scripts/build.py          # or: npm run build; rewrites the marked regions of every page
python3 scripts/build.py --check  # changes nothing; fails if a page has drifted
```

`build.py` also lints every page: one `<h1>`, a title, description, canonical
and social tags, `alt` and dimensions on every image, no em dashes, and nothing
the Content-Security-Policy would block (inline `style=` attributes, inline
scripts, `onclick`).

**Versioned assets.** `build.py` also stamps every link to the stylesheet, the
script, the hero posters and the hero video with a short content hash
(`/assets/css/site.css?v=` and ten hex characters). `_headers` caches those three folders
for a year (`immutable`), so a returning visitor never pairs new HTML with an
old stylesheet: a changed file has a new URL. After editing `site.css`,
`site.js` or rebuilding the reel, run `python3 scripts/build.py`; `--check`
(run by `make_zip.py` and the site checks) fails if a hash is out of date, and
the lint fails on any stylesheet or script link without one. Images and fonts
keep plain names and a one hour cache.

**Where "Simulations", "Products" and "Portfolio" point** is set in
`site.config.json`, under `destinations`, and nowhere else. `build.py` writes
those addresses into the navigation and footer, and into every link in page
content marked `data-dest="simulations"` (or `products`, `portfolio`); a page
that types one of those URLs without `data-dest` fails the lint. Under
`retired_paths`, each old local section gets a forced 301 to its site, with and
without the trailing slash, in the generated block of `site/_redirects`. The
App Store links live in the same file.

## Images

Every file in `site/assets/img/` is generated from `src-assets/`:

```sh
pip install Pillow numpy
python3 scripts/build_assets.py
node scripts/make_og.mjs          # the 1200x630 social card, from the generated cards
```

Screens are cropped, never redrawn: iPhone captures are cut below the iOS status
bar instead of having one painted in, nothing is upscaled, and each image ships
as WebP plus a JPEG fallback. Featured-work cards are 4:3: either a chosen crop
of a real frame, or one real phone screen rising from the bottom of a ground in
the product's own colours (CoreCredit, Elemora). `src-assets/sizes.json` lists
the final dimensions to use in `width`/`height` attributes. A few files from
the previous site are kept byte for byte under their old names
(`src-assets/legacy/`) because other places may link to them.

## The hero reel

```sh
pip install Pillow numpy imageio-ffmpeg
python3 montage/compose.py                  # the Elemora wall, if its captures changed
python3 scripts/build_montage.py            # all three cuts
```

A silent studio reel of real project footage in four chapters: Rocket
Engineering (liftoff, then the upper stage lighting after separation), a single
flight through the Fab One fab, a Karnwold siege roll, and CoreCredit and
Elemora on a wall of phones. About 22 s in landscape and in two separately
composed tall cuts (9:16 for portrait tablets, 9:19.5 for phones), joined by
hard cuts at motion points and looping from the product wall straight back
into the launch with no title card. The edit is `montage/shots.json`;
`montage/README.md` explains every field and where each piece of footage came
from, and `montage/capture/` holds the scripts that rendered the simulator
footage; `montage/compose.py` composes the product wall. The script writes the web encodes (AV1 and H.264 MP4) and posters to
`site/assets/video/`, and the "Now showing" chapter times into
`site/index.html`; run `python3 scripts/build.py` afterwards to restamp the
video's version hash. The page plays the landscape cut on wide screens, the
portrait cut on portrait tablets and the phone cut on phones, never under `prefers-reduced-motion` or Save-Data,
pauses it off screen, and has a visible Pause button. With scripting off, the
poster is shown.

## Check it

```sh
npm ci                        # Playwright, once
npm run check                 # or: node scripts/check_site.mjs
```

It loads every page at five sizes (360 px phone to 1920 px desktop, including
390x844, 834x1194, 1440x900 and 1920x1080) in light mode and at two in dark
mode, under the real `_headers`, and fails on console errors, CSP violations,
failed or third-party requests, horizontal overflow, broken images or wrong
image dimensions, tap targets under 24 px, dead internal links, navigation that
does not match `site.config.json`, any redirect rule that does not do what it
says, and linked hostnames that do not resolve. The three separate sites are
exempt from that last check and reported as "not live yet" instead. It also
checks the hero video (autoplay, pause, the phone and tablet cuts, reduced motion), the
featured-work reel (drift, hover, Pause, keyboard focus, reduced motion), the
no-script layout, keyboard order and the phone menu. Screenshots land in
`.preview/`.

## Package and deploy

```sh
python3 scripts/make_zip.py   # writes dist/idlery-netlify.zip
```

The contents of `site/` go in at the ZIP root (`index.html`, `_headers` and
`_redirects` at the top level, no wrapper folder). To publish: Netlify, the
idlery.com site, **Deploys**, then drag the ZIP onto **Deploy manually**. The
domain and certificate belong to the Netlify site, so every earlier deploy stays
available to roll back to. `netlify.toml` only matters if this repository is
ever connected to Netlify for automatic deploys.

## Hostnames

* `www.idlery.com` is redirected to `idlery.com` by Netlify itself.
* `idleryservices.com` and `www.idleryservices.com`, if attached to this Netlify
  site, 301 to idlery.com (host rules in `_redirects`).
* `karnwold.idlery.com` should be an alias of **this** Netlify site, so it only
  ever redirects to karnwold.com and never becomes a second origin for the game
  (no new OAuth callback, Stripe or WebSocket origin). It needs a DNS record at
  IONOS (`CNAME karnwold` to `idleryservices.netlify.app`) and the alias added
  in Netlify; until then its rule is inert.
* `products.idlery.com`, `simulations.idlery.com` and `portfolio.idlery.com` are
  separate sites with their own hosting, set up outside this repository.

## Content rules

* Every image and frame is real: renders by the simulators' own renderers,
  captures of the products, footage and photographs of Karnwold. No stock
  imagery, no device mockups, no invented interfaces. `docs/MEDIA.md` records
  where each one came from.
* Claims stay inside what each project's own repository, site or store listing
  supports, and each project says where it stands (released, in development,
  experimental). No ratings, user counts, prices or release dates.
* Experimental projects state their limits: WallField does not see through
  walls or confirm wiring; Turbid does not tell you whether water is safe to
  drink.
* Each product's own site is canonical for its support, privacy and terms;
  idlery.com links to them and does not restate them. idlery.com's own privacy
  policy and terms cover only this website.
* CoreCredit screens show sample records; Elemora screens were captured before
  release.
* Apple's badge is Apple's artwork, unmodified, at 48 px tall, and Apple's
  trademark line appears on the pages that show it.
* No em dashes, anywhere.

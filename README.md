# idlery.com

The source of truth for **idlery.com**, the home of Idlery Services LLC's work:
Karnwold, Fab One and Idlery Simulations, the iOS apps CoreCredit and Elemora,
and Blake Kimble's engineering portfolio.

It is a plain static site: hand-written HTML, one stylesheet, one small script,
self-hosted fonts, no framework and no build step that Netlify has to run. What
Netlify serves is exactly the `site/` folder.

```
site/                    the deployable site; this folder is the publish root
  index.html             home: hero montage, featured work, paths, about
  work/ simulations/ apps/ portfolio/ about/        the five sections
  karnwold/ corecredit/ elemora/                    project pages (old URLs, kept)
  support/ legal/        help, contact, privacy and terms
  404.html  _headers  _redirects  robots.txt  sitemap.xml  site.webmanifest  favicon.ico
  assets/css/site.css    the whole stylesheet
  assets/js/site.js      the whole script (menu, hero video, carousel)
  assets/fonts/          Manrope and IBM Plex Mono, with their OFL licences
  assets/img/            generated images (see "Images")
  assets/video/          the hero montage and its posters, the Fab One clip

partials/                header, footer and <head> shared by every page
site.config.json         where Simulations and Portfolio point; App Store links
src-assets/              full-size originals for every image; never served
src-media/montage/       the footage and captures the montage is cut from
montage/shots.json       the montage edit
scripts/                 build.py, build_assets.py, build_montage.py, serve.mjs,
                         check_site.mjs, make_zip.py
docs/                    AUDIT.md, MEDIA.md, DESIGN.md
```

## Preview it locally

You need [Node.js](https://nodejs.org/) 20 or newer. Nothing to install for
the preview itself.

```sh
git clone https://github.com/BKimble1/Idlery-Website.git
cd Idlery-Website
node scripts/serve.mjs          # then open http://localhost:8080
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
python3 scripts/build.py          # rewrites the marked regions of every page
python3 scripts/build.py --check  # changes nothing; fails if a page has drifted
```

`build.py` also lints every page: one `<h1>`, a title, description, canonical
and social tags, `alt` and dimensions on every image, and nothing the
Content-Security-Policy would block (inline `style=` attributes, inline
scripts, `onclick`).

**Where "Simulations" and "Portfolio" point** is set in `site.config.json`.
Today they are the pages `/simulations/` and `/portfolio/`. When
`simulations.idlery.com` (or `portfolio.idlery.com`) is live, change the value
to its full URL and run `python3 scripts/build.py`. The navigation and footer
then link straight there, and a forced 301 from the old path is added to
`_redirects`, so every existing link follows. The App Store links live in the
same file.

## Images

Every file in `site/assets/img/` is generated from `src-assets/`:

```sh
pip install Pillow numpy
python3 scripts/build_assets.py
```

Screens are cropped, never redrawn: iPhone captures are cut below the iOS
status bar instead of having one painted in, nothing is upscaled, and each
image ships as WebP plus a JPEG fallback. `src-assets/sizes.json` lists the
final dimensions to use in `width`/`height` attributes. A few files from the
previous site are kept byte for byte under their old names (`src-assets/legacy/`)
because other places may link to them.

## The hero montage

```sh
pip install Pillow numpy imageio-ffmpeg
python3 scripts/build_montage.py            # both cuts, about 16 s each
```

The edit is `montage/shots.json`; `montage/README.md` explains every field and
where each piece of footage came from. The script writes the web encodes
(H.264 MP4 and VP9 WebM) and posters to `site/assets/video/`, and updates the
"Now showing" chapter times in `site/index.html`. The page plays the landscape
cut on wide screens and the portrait cut on phones, never under
`prefers-reduced-motion` or Save-Data, pauses it off screen, and has a visible
Pause button. With scripting off, the poster is shown.

## Check it

```sh
npm install                   # Playwright, once
node scripts/check_site.mjs   # or: npm run check
```

It loads every page at five widths (360 to 1920 px) in light mode and at two in
dark mode, under the real `_headers`, and fails on console errors, CSP
violations, failed or third-party requests, horizontal overflow, broken images
or wrong image dimensions, tap targets under 24 px, dead internal links, any
redirect rule that does not do what it says, and linked hostnames that do not
resolve. It also checks the hero video (autoplay, pause, portrait cut,
reduced motion), the no-script layout, keyboard order and the carousel keys,
and the phone menu. Screenshots land in `.preview/`.

## Package and deploy

```sh
python3 scripts/make_zip.py   # writes dist/idlery-netlify.zip
```

The contents of `site/` go in at the ZIP root (`index.html`, `_headers` and
`_redirects` at the top level, no wrapper folder). To publish: Netlify → the
idlery.com site → **Deploys** → drag the ZIP onto **Deploy manually**. The
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
  IONOS (`CNAME karnwold → idleryservices.netlify.app`) and the alias added in
  Netlify; until then its rule is inert.
* `simulations.idlery.com` and `portfolio.idlery.com` do not exist yet. See
  "Change something" for switching the navigation over when they do.

## Content rules

* Every image and frame is real: captures of the apps, renders from Fab One,
  footage and photographs of Karnwold. No stock imagery, no device mockups, no
  invented interfaces. `docs/MEDIA.md` records where each one came from.
* Claims stay inside what each project's own repository, site or store listing
  supports. No ratings, user counts, prices or release dates.
* Each product's own site is canonical for its support, privacy and terms;
  idlery.com links to them and does not restate them.
* CoreCredit screens show sample records; Elemora screens were captured before
  release. The pages say so.
* Apple's badge is Apple's artwork, unmodified, at 48 px tall, with Apple's
  trademark line in the footer.

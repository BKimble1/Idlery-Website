# Audit of idlery.com before the redesign

> This audit records the first pass of the rebuilt site (September 2026). The
> site has since been repositioned as a technology studio: Simulations,
> Products and Portfolio are separate sites now, and idlery.com has its own
> privacy policy and terms. `docs/DESIGN.md` describes the current structure.

Written 2026-09-29, at the start of this repository.

## What could and could not be reached

`idlery.com`, its subdomains, `karnwold.com`, `apps.apple.com` and
`web.archive.org` were **blocked by the network policy** of the environment
this was built in (HTTPS and fetch tools both refused). DNS was reachable, so
hostnames were checked by resolution instead:

| Host | Resolves | Notes |
|---|---|---|
| `idlery.com` | yes, `75.2.60.5` (Netlify) | the site this repository replaces |
| `www.idlery.com` | yes (Netlify) | Netlify redirects `www` to the primary domain itself |
| `idleryservices.com` | yes, `75.2.60.5` (Netlify) | an alias with no automatic redirect; `_redirects` now folds it into idlery.com |
| `corecredit.idlery.com` | yes (Netlify) | |
| `elemora.idlery.com` | **yes** (Netlify) | was NXDOMAIN on 2026-09-19; now exists |
| `karnwold.com` | yes, `75.2.60.5` (Netlify) | |
| `simulations.idlery.com` | **no (NXDOMAIN)** | not live, so the site has its own `/simulations/` page |
| `portfolio.idlery.com` | no (NXDOMAIN) | an idea for later; `/portfolio/` is a page here |
| `karnwold.idlery.com` | no (NXDOMAIN) | its redirect rule stays inert until DNS exists |

`scripts/check_site.mjs` re-checks every hostname the pages link to.

## The baseline: which source matches the live site

| Source | What it is | Used for |
|---|---|---|
| **`BKimble1/Idlery`**, branch `claude/idlery-add-elemora-rao4qn`, commit `92f57a3` (2026-09-19) | The three-project site (CoreCredit, Elemora, Karnwold) | **The baseline.** It contains exactly the asset URLs the live site serves (`/assets/img/idlery-wordmark.png`, `kw-shot-online-1280.jpg`, `shot-dashboard-880.jpg`, `el-shot-table-880.jpg`), deploys `script-src 'none'`, and still calls Elemora "in development", which is the stale copy on the live site. |
| `BKimble1/Idlery`, branch `claude/idlery-corecredit-app-store-73miy4` (2026-09-16) | The earlier CoreCredit-only site | History only |
| `BKimble1/CoreCredit-Legal`, `claude/idlery-corecredit-launch-fjxot1` (2026-08-29) | The August site under `sites/idlery/`, its Netlify packaging, and the real Idlery app icon and a sharper wordmark in `brand/` | Old routes (restored as redirects), the app icon (now the favicon), the 1216 px wordmark (traced to SVG) |
| `BKimble1/CoreCredit-Legal`, `main` (2026-08-17) | The first CoreCredit legal pages | History only; the live copies are on corecredit.idlery.com |

No newer source, ZIP or deploy log for idlery.com was found in any accessible
repository. The live site could not be fetched to confirm it byte for byte, so
`92f57a3` is the best available match, not a verified copy.

## Inventory of the baseline

**Pages:** `/` (home), `/corecredit/`, `/elemora/`, `/karnwold/`, `/support/`,
`404.html`. `robots.txt`, `sitemap.xml` (five URLs), `favicon.ico`.

**Metadata:** each page had a title, description, canonical, Open Graph and
Twitter tags, and a JSON-LD block. Social cards: `og-idlery.png`,
`og-corecredit.png`, `og-elemora.png`, `og-karnwold.png`.

**Images:** 120 generated files in `/assets/img/`: the wordmark as PNG, favicons
built from its "i", CoreCredit and Elemora icons, Karnwold's mark, four
CoreCredit and seven Elemora phone captures at 440/880 px, Karnwold's browser
capture, prototype photographs and concept spread, landscape card crops, and
Apple's App Store badge.

**Headers (`_headers`):**
`Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'none'; font-src 'self'; form-action 'none'; frame-ancestors 'self'; base-uri 'self'`,
plus `X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`,
`Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy`, and
one-hour caching for `/assets/*`.

**Redirects (`_redirects`):** `karnwold.idlery.com` → karnwold.com (host rule);
`/karnwold.html`, `/elemora.html`, `/corecredit.html`; `/apps`, `/products`,
`/work` → `/#work`; `/contact` → `/support/`; `/app` → `/corecredit/`;
`/download` and `/corecredit/download` → CoreCredit's App Store listing;
`/karnwold/play`; per-project `/support`, `/privacy`, `/terms` aliases to each
project's own site; `/karnwold/rules`.

**Support and legal links:** every project's support, privacy and terms pages
live on its own site (corecredit.idlery.com, elemora.idlery.com, karnwold.com);
idlery.com linked to them and published `support@idlery.com`.

## Problems found

1. **Elemora is described as unreleased** ("In development", "not on the App
   Store yet") although it is on the App Store. Fixed everywhere, with the
   listing `apps.apple.com/us/app/elemora-periodic-table/id6812577166`.
2. **The August routes were dropped in September.** The August site published
   `/privacy`, `/terms`, `/about`, `/approach`, `/home`, `/app-store`,
   `/corecredit/app-store` and every `/corecredit/*` address; the September
   deploy answers them with 404. All are redirected again (see `_redirects`).
3. **`idleryservices.com` resolves to Netlify but its redirect was dropped.**
   Netlify only redirects `www` to the primary domain on its own; any other
   alias serves a duplicate of the site. The August host rules are restored.
4. **"Karnwold support" pointed at a funding page.** karnwold.com/support is
   "Help Build Karnwold" (supporter tiers), not help. Karnwold's own help and
   legal contact is `support@karnwold.com`; the support page now says so, and
   `/karnwold/support` goes to the Karnwold help card on idlery.com.
5. **The homepage was a catalogue.** Each product had a full band with feature
   bullets. Details now live on the project pages and the product sites.
6. **`Permissions-Policy` still lists `interest-cohort=()`,** a directive
   browsers no longer recognise (Chrome logs a console warning for it). Left
   unchanged to keep the header change minimal; it is safe to delete.

## App Store and product facts that were verified

* CoreCredit's App Store ID `6802336957` appears in its own repository
  (`codemagic.yaml`, `docs/HANDOFF.md`); its app points at
  `corecredit.idlery.com/support|privacy|terms`.
* Elemora's App Store ID `6812577166` was supplied by the owner; it does not
  appear in the PeriodicPro repository and apps.apple.com was unreachable, so it
  could not be verified from here. Its app points at
  `elemora.idlery.com/support|privacy|terms`.
* Karnwold's routes `/rules`, `/privacy`, `/terms`, `/refunds`, `/updates` and
  `/about` exist in its router; `/support` is the funding page.
* Neither app registers an `idlery.com` URL with Apple, so no App Review link
  depends on this site.

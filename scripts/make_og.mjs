#!/usr/bin/env node
// Render the 1200x630 social cards from real project images, in the site's own
// type, with Playwright:   node scripts/make_og.mjs
//
// Writes site/assets/img/og-idlery.png, og-simulations.png and og-portfolio.png.
// The product cards og-corecredit/og-elemora/og-karnwold are the previous
// site's, kept as they are (src-assets/legacy/), because they are accurate.

import { chromium } from "playwright";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const A = (p) => pathToFileURL(join(ROOT, "site", "assets", p)).href;

const base = `
@font-face { font-family: Manrope; src: url(${A("fonts/manrope-latin-wght.woff2")}) format("woff2"); font-weight: 200 800; }
@font-face { font-family: Plex; src: url(${A("fonts/ibm-plex-mono-latin-500.woff2")}) format("woff2"); font-weight: 500; }
* { box-sizing: border-box; margin: 0; }
html, body { width: 1200px; height: 630px; overflow: hidden; }
body { font-family: Manrope, sans-serif; -webkit-font-smoothing: antialiased; }
.label { font-family: Plex, monospace; font-size: 22px; letter-spacing: .01em; }
img { display: block; }
`;

const cards = {
  "og-idlery": `
<style>${base}
body { display: grid; grid-template-columns: 470px 1fr; background: #0b1417; color: #eef2f1; }
.l { padding: 64px 56px; display: flex; flex-direction: column; }
.l img { width: 190px; margin-bottom: auto; }
h1 { font-size: 54px; line-height: 1.02; letter-spacing: -.04em; font-weight: 750; margin: 0 0 22px; }
.label { color: #8fa0a2; }
.r { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 10px; padding: 10px 10px 10px 0; }
.r img { width: 100%; height: 100%; object-fit: cover; border-radius: 14px; }
</style>
<div class="l"><img src="${A("img/idlery-wordmark-light.svg")}">
<h1>Apps, simulations, and games.</h1><p class="label">idlery.com</p></div>
<div class="r">
<img src="${A("img/card-karnwold-1088.jpg")}">
<img src="${A("img/card-fabone-1088.jpg")}">
<img src="${A("img/card-corecredit-914.jpg")}">
<img src="${A("img/card-elemora-1110.jpg")}">
</div>`,

  "og-simulations": `
<style>${base}
body { position: relative; background: #0b1417; color: #fff; }
.bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.s { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(8,15,17,.9) 0%, rgba(8,15,17,.7) 42%, rgba(8,15,17,0) 75%); }
.c { position: absolute; left: 64px; bottom: 60px; width: 560px; }
.label { color: #b3c0c1; margin-bottom: 18px; display: flex; align-items: center; gap: 12px; }
.label i { width: 16px; height: 16px; border-radius: 3px; background: #6d5efc; display: inline-block; }
h1 { font-size: 76px; line-height: .98; letter-spacing: -.045em; font-weight: 750; margin: 0 0 18px; }
p { font-size: 28px; line-height: 1.3; color: #dbe4e3; }
.w { position: absolute; left: 64px; top: 56px; width: 150px; }
</style>
<img class="bg" src="${A("img/fab-scanner-1600.jpg")}">
<div class="s"></div>
<img class="w" src="${A("img/idlery-wordmark-light.svg")}">
<div class="c"><p class="label"><i></i>Idlery Simulations</p><h1>Fab One</h1><p>Build a chip, layer by layer. In development.</p></div>`,

  "og-portfolio": `
<style>${base}
body { display: grid; grid-template-columns: 1fr 520px; background: #f4f3ee; color: #0f1b1f;
  background-image: linear-gradient(#d8d7ce 1px, transparent 1px), linear-gradient(90deg, #d8d7ce 1px, transparent 1px);
  background-size: 100% 30px, 30px 100%; }
.l { padding: 64px 0 60px 64px; display: flex; flex-direction: column; }
.l img { width: 150px; margin-bottom: auto; }
.label { color: #56656a; margin-bottom: 16px; }
h1 { font-size: 78px; line-height: .98; letter-spacing: -.045em; font-weight: 750; margin: 0 0 18px; }
p.t { font-size: 28px; line-height: 1.3; color: #3e4c51; max-width: 520px; }
.r { padding: 40px 40px 40px 0; }
.r img { width: 100%; height: 100%; object-fit: cover; border-radius: 16px; box-shadow: 0 18px 40px -20px rgba(15,27,31,.4); }
</style>
<div class="l"><img src="${A("img/idlery-wordmark.svg")}">
<p class="label">Portfolio</p><h1>Blake Kimble</h1><p class="t">Engineering and design projects: what was built, and how.</p></div>
<div class="r"><img src="${A("img/pf-straingage-1030.jpg")}"></div>`,
};

const dir = mkdtempSync(join(tmpdir(), "og-"));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
for (const [name, html] of Object.entries(cards)) {
  const file = join(dir, `${name}.html`);
  writeFileSync(file, `<!doctype html><meta charset="utf-8">${html}`);
  await page.goto(pathToFileURL(file).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const broken = await page.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src));
  if (broken.length) console.warn(`${name}: missing ${broken.join(", ")}`);
  await page.screenshot({ path: join(ROOT, "site", "assets", "img", `${name}.png`) });
  console.log(`site/assets/img/${name}.png`);
}
await browser.close();

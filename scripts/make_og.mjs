#!/usr/bin/env node
// Render the 1200x630 social cards from real project images, in the site's own
// type, with Playwright:   node scripts/make_og.mjs
//
// Writes site/assets/img/og-idlery.png. The product cards og-corecredit,
// og-elemora and og-karnwold are the previous site's, kept as they are
// (src-assets/legacy/), because they are accurate.

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
<h1>Building ideas into working systems.</h1><p class="label">idlery.com</p></div>
<div class="r">
<img src="${A("img/card-rocket-880.jpg")}">
<img src="${A("img/card-fabone-880.jpg")}">
<img src="${A("img/card-karnwold-880.jpg")}">
<img src="${A("img/card-elemora-880.jpg")}">
</div>`,
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

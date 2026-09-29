#!/usr/bin/env node
// Checks the site the way a visitor meets it, in Chromium, served by
// scripts/serve.mjs (so the real _headers CSP and _redirects apply):
//
//   npm install          # Playwright, once
//   node scripts/check_site.mjs            # or: npm run check
//   node scripts/check_site.mjs --dir unzipped-package   # check a built ZIP
//
// Fails on: a console error or CSP violation, a failed or 4xx same-origin
// request, horizontal overflow, a broken image or one whose width/height
// attributes disagree with the file, a small tap target, a dead internal
// link, a redirect rule that does not do what it says, a third-party request,
// a hostname in a link that does not resolve, a Products/Simulations/Portfolio
// link that does not match site.config.json, and any of the behaviour checks
// below (hero video, reduced motion, no-script layout, keyboard, featured-work
// reel, menu). Full-page screenshots land in .preview/.
//
// The destinations in site.config.json (products., simulations. and
// portfolio.idlery.com) are separate sites that may not be live yet. Links to
// them are checked against the config, not fetched or resolved.

import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, readdirSync } from "node:fs";
import { lookup } from "node:dns/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const dirArg = process.argv.indexOf("--dir");
const SITE = dirArg >= 0 ? process.argv[dirArg + 1] : join(ROOT, "site");
process.argv.push("--dir", SITE);
const { start } = await import("./serve.mjs");
const PORT = 8123;
const server = await start(PORT, "127.0.0.1");
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = join(ROOT, ".preview");
mkdirSync(SHOTS, { recursive: true });

const CONFIG = JSON.parse(readFileSync(join(ROOT, "site.config.json"), "utf8"));
const DEST_HOSTS = new Set(Object.values(CONFIG.destinations).map((u) => new URL(u).host));
const PAGES = ["/", "/work/", "/about/", "/karnwold/", "/corecredit/", "/elemora/", "/support/",
  "/privacy/", "/terms/", "/legal/"];
const VIEWPORTS = [
  { name: "phone-360", width: 360, height: 780 },
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 834, height: 1194 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "wide", width: 1920, height: 1080 },
];

const failures = [];
const notes = [];
const fail = (where, what) => failures.push(`${where}: ${what}`);
const ok = (cond, where, what) => { if (!cond) fail(where, what); };

const browser = await chromium.launch();

async function newPage(opts = {}) {
  const ctx = await browser.newContext({ deviceScaleFactor: 1, ...opts });
  const page = await ctx.newPage();
  const log = { errors: [], csp: [], bad: [], foreign: [] };
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  page.on("console", (m) => { if (m.type() === "error") log.errors.push(m.text()); });
  page.on("pageerror", (e) => log.errors.push(e.message));
  page.on("requestfailed", (r) => {
    const f = r.failure()?.errorText || "";
    if (!/ERR_ABORTED/.test(f)) log.bad.push(`${r.url()} ${f}`);   // aborted = a video range the page moved past
  });
  page.on("response", (r) => { if (r.url().startsWith(BASE) && r.status() >= 400 && !r.url().includes("/nope")) log.bad.push(`${r.status()} ${r.url()}`); });
  page.on("request", (r) => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith("data:")) log.foreign.push(u); });
  return { ctx, page, log };
}

async function settle(page) {
  await page.evaluate(async () => {
    for (const img of document.querySelectorAll("img[loading=lazy]")) img.loading = "eager";
    const imgs = [...document.images];
    await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
    await Promise.all(imgs.map((i) => i.decode?.().catch(() => null)));
  });
}

// ------------------------------------------------------------ every page --

const internal = new Set();
for (const colorScheme of ["light", "dark"]) {
  for (const vp of VIEWPORTS) {
    if (colorScheme === "dark" && vp.name !== "desktop" && vp.name !== "phone") continue;
    const { ctx, page, log } = await newPage({ viewport: { width: vp.width, height: vp.height }, colorScheme });
    for (const path of PAGES) {
      const where = `${path} @${vp.name}${colorScheme === "dark" ? " dark" : ""}`;
      const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
      ok(res.status() === 200, where, `status ${res.status()}`);
      await settle(page);
      const r = await page.evaluate(() => {
        const out = { overflow: document.documentElement.scrollWidth - window.innerWidth, broken: [], ratio: [], small: [], links: [] };
        for (const img of document.images) {
          if (!img.complete || img.naturalWidth === 0) out.broken.push(img.currentSrc || img.src);
          let w = +img.getAttribute("width"), h = +img.getAttribute("height");
          // A <source> may carry its own dimensions (art direction); use the chosen one's.
          const file = (img.currentSrc || "").split("/").pop();
          const chosen = img.parentElement.tagName === "PICTURE" &&
            [...img.parentElement.querySelectorAll("source[width]")].find((s) => s.srcset.includes(file));
          if (chosen) { w = +chosen.getAttribute("width"); h = +chosen.getAttribute("height"); }
          if (w && h && img.naturalWidth && !img.currentSrc.endsWith(".svg")) {
            const d = Math.abs(w / h - img.naturalWidth / img.naturalHeight) / (w / h);
            if (d > 0.02) out.ratio.push(`${img.currentSrc.split("/").pop()} attr ${w}x${h} vs file ${img.naturalWidth}x${img.naturalHeight}`);
          }
        }
        const targets = document.querySelectorAll("header a, header button, footer a, .btn, .reel-toggle, .hero-toggle, .path, .card-title a, .tile h3 a, .help-card li a, .arrow-link, .nav-toggle");
        for (const el of targets) {
          if (el.closest("[data-copy]")) continue;
          const b = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          if (!b.width || style.visibility === "hidden" || el.closest("[hidden]")) continue;
          // WCAG 2.5.8: at least 24x24 CSS px (links stretched over a card count as the card).
          const hit = el.matches(".card-title a, .tile h3 a") ? el.closest(".card, .tile").getBoundingClientRect() : b;
          if (hit.height < 24 || hit.width < 24) out.small.push(`${el.textContent.trim().slice(0, 30) || el.className} ${Math.round(hit.width)}x${Math.round(hit.height)}`);
        }
        for (const a of document.querySelectorAll("a[href]")) out.links.push(a.getAttribute("href"));
        out.nav = [...document.querySelectorAll(".site-nav a")].map((a) => [a.textContent.trim(), a.getAttribute("href")]);
        out.dest = [...document.querySelectorAll("a[data-dest]")].map((a) => [a.dataset.dest, a.getAttribute("href")]);
        return out;
      });
      const navWant = [["Work", "/work/"], ["Simulations", CONFIG.destinations.simulations], ["Products", CONFIG.destinations.products],
        ["Portfolio", CONFIG.destinations.portfolio], ["About", "/about/"]];
      ok(JSON.stringify(r.nav) === JSON.stringify(navWant), where, `navigation is ${JSON.stringify(r.nav)}`);
      for (const [name, href] of r.dest) ok(CONFIG.destinations[name] === href, where, `data-dest="${name}" links to ${href}`);
      ok(r.overflow <= 0, where, `horizontal overflow of ${r.overflow}px`);
      ok(!r.broken.length, where, `broken images: ${r.broken.join(", ")}`);
      ok(!r.ratio.length, where, `image size attributes: ${r.ratio.join("; ")}`);
      ok(!r.small.length, where, `tap targets under 24px: ${r.small.join("; ")}`);
      for (const l of r.links) internal.add(l);
      const csp = await page.evaluate(() => window.__csp);
      ok(!csp.length, where, `CSP violations: ${csp.join(", ")}`);
      if (vp.name === "desktop" || vp.name === "phone") {
        const file = `${path.replace(/\//g, "_") || "_"}-${vp.name}${colorScheme === "dark" ? "-dark" : ""}.png`.replace(/^_+/, "") || "home.png";
        await page.screenshot({ path: join(SHOTS, file.startsWith("-") ? "home" + file : file), fullPage: true });
      }
    }
    ok(!log.errors.length, `${vp.name} ${colorScheme}`, `console errors: ${[...new Set(log.errors)].slice(0, 5).join(" | ")}`);
    ok(!log.bad.length, `${vp.name} ${colorScheme}`, `failed requests: ${[...new Set(log.bad)].slice(0, 5).join(" | ")}`);
    ok(!log.foreign.length, `${vp.name} ${colorScheme}`, `third-party requests: ${[...new Set(log.foreign)].slice(0, 5).join(" | ")}`);
    await ctx.close();
  }
}

// 404 page
{
  const { ctx, page } = await newPage({ viewport: { width: 1440, height: 900 } });
  const res = await page.goto(BASE + "/nope-not-a-page", { waitUntil: "networkidle" });
  ok(res.status() === 404, "/nope-not-a-page", `status ${res.status()}, want 404`);
  ok((await page.textContent("h1")).includes("not here"), "404", "the 404 page did not render");
  await page.screenshot({ path: join(SHOTS, "404-desktop.png"), fullPage: true });
  await ctx.close();
}

// --------------------------------------------------------- internal links --

for (const href of internal) {
  if (!href.startsWith("/") || href.startsWith("//")) continue;
  const res = await fetch(BASE + href, { redirect: "follow" });
  ok(res.status === 200, `link ${href}`, `resolves to ${res.status}`);
  const hash = href.split("#")[1];
  if (hash && res.status === 200) {
    const html = await res.text();
    ok(html.includes(`id="${hash}"`), `link ${href}`, `no element with id "${hash}"`);
  }
}

// -------------------------------------------------------------- redirects --

const rules = readFileSync(join(SITE, "_redirects"), "utf8").split(/\r?\n/)
  .map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map((l) => l.split(/\s+/));
let hostRules = 0;
for (const [from, to, status] of rules) {
  if (/^https?:/.test(from)) {
    hostRules++;
    ok(/^https?:\/\/[^/]+\/\*$/.test(from) && to.includes(":splat") && status.endsWith("!"), `rule ${from}`, "host rule should be <host>/* -> ...:splat with a forced status");
    continue;
  }
  const probe = from.replace("*", "some/deep/link");
  const res = await fetch(BASE + probe, { redirect: "manual" });
  const want = parseInt(status, 10);
  const target = to.replace(":splat", "some/deep/link");
  ok(res.status === want, `rule ${from}`, `status ${res.status}, want ${want}`);
  const loc = res.headers.get("location") || "";
  ok(loc === target || loc === BASE + target, `rule ${from}`, `location ${loc}, want ${target}`);
  if (target.startsWith("/")) {
    const follow = await fetch(BASE + target.split("#")[0]);
    ok(follow.status === 200, `rule ${from}`, `target ${target} is ${follow.status}`);
  }
}
notes.push(`${rules.length - hostRules} path redirects exercised; ${hostRules} host-matched rules checked for shape (they cannot fire on localhost)`);

// Real pages must not be shadowed by rules.
for (const path of PAGES) {
  const res = await fetch(BASE + path, { redirect: "manual" });
  ok(res.status === 200, `page ${path}`, `answered ${res.status} (shadowed by a redirect?)`);
}

// ---------------------------------------------------------- hostnames --

const hosts = new Set();
for (const f of readdirSync(SITE, { recursive: true })) {
  if (!String(f).endsWith(".html")) continue;
  for (const m of readFileSync(join(SITE, String(f)), "utf8").matchAll(/href="https?:\/\/([^/"#?]+)/g)) hosts.add(m[1]);
}
const pending = [];
for (const h of hosts) {
  if (DEST_HOSTS.has(h)) {
    // A separate Idlery site that may not exist yet: say so, never fail on it.
    try { await lookup(h); } catch { pending.push(h); }
    continue;
  }
  try { await lookup(h); } catch { fail(`host ${h}`, "does not resolve (a link to it would be dead)"); }
}
notes.push(`linked hostnames checked: ${[...hosts].sort().join(", ")}`);
if (pending.length) notes.push(`not live yet (expected, set up separately): ${pending.sort().join(", ")}`);

// --------------------------------------------------------- hero video --

async function heroState(page) {
  return page.evaluate(() => {
    const v = document.querySelector(".hero video");
    const b = document.querySelector(".hero .hero-toggle");
    return { playing: !v.paused && v.classList.contains("is-playing"), src: v.currentSrc, hidden: b.hidden,
      label: b.textContent.trim(), time: v.currentTime, now: document.querySelector("[data-ambient-now]").textContent };
  });
}
{
  const { ctx, page, log } = await newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + "/", { waitUntil: "load" });
  await page.waitForFunction(() => { const v = document.querySelector(".hero video"); return v && !v.paused && v.currentTime > 1.2; }, null, { timeout: 20000 }).catch(() => null);
  let s = await heroState(page);
  ok(s.playing, "hero desktop", "the montage is not playing");
  ok(/hero-landscape\.(av1\.)?mp4$/.test(s.src), "hero desktop", `landscape cut not chosen: ${s.src}`);
  ok(!s.hidden && s.label.startsWith("Pause"), "hero desktop", `pause control not shown (${s.label})`);
  ok(s.now.includes("Now showing"), "hero desktop", `no "Now showing" label (${s.now})`);
  await page.click(".hero .hero-toggle");
  await page.waitForTimeout(300);
  s = await heroState(page);
  ok(!s.playing && s.label.startsWith("Play"), "hero pause", "the pause control did not pause");
  const t = s.time;
  await page.waitForTimeout(800);
  ok((await heroState(page)).time === t, "hero pause", "the video kept running after pause");
  await page.keyboard.press("Shift+Tab"); // focus stays usable after the click
  await page.click(".hero .hero-toggle");
  await page.waitForTimeout(500);
  ok((await heroState(page)).playing, "hero resume", "the play control did not resume");
  // Scrolled away, it should stop drawing.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(600);
  ok(await page.evaluate(() => document.querySelector(".hero video").paused), "hero offscreen", "keeps playing off screen");
  ok(!log.errors.length, "hero desktop", `console errors: ${log.errors.join(" | ")}`);
  const vid = await page.evaluate(() => [...document.querySelectorAll(".hero video source")].map((s) => s.src));
  notes.push(`hero sources: ${vid.map((u) => u.replace(BASE, "")).join(", ")}`);
  await ctx.close();
}
{
  const { ctx, page } = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto(BASE + "/", { waitUntil: "load" });
  await page.waitForFunction(() => { const v = document.querySelector(".hero video"); return v && !v.paused && v.currentTime > 0.5; }, null, { timeout: 20000 }).catch(() => null);
  const s = await heroState(page);
  ok(s.playing && /hero-portrait\./.test(s.src), "hero phone", `portrait cut not playing: ${s.src}`);
  await page.screenshot({ path: join(SHOTS, "home-phone-hero-playing.png") });
  await ctx.close();
}
{
  const { ctx, page } = await newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const s = await heroState(page);
  ok(!s.playing && s.label.startsWith("Play"), "hero reduced motion", `should not autoplay (playing=${s.playing}, label=${s.label})`);
  const poster = await page.evaluate(() => { const i = document.querySelector(".hero-media img"); return i.complete && i.naturalWidth > 0; });
  ok(poster, "hero reduced motion", "the still image is not showing");
  await page.screenshot({ path: join(SHOTS, "home-desktop-reduced-motion.png") });
  await ctx.close();
}

// --------------------------------------------------------- no scripting --

{
  const { ctx, page } = await newPage({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const r = await page.evaluate(() => ({
    overflowX: getComputedStyle(document.querySelector(".reel-track")).overflowX,
    toggle: getComputedStyle(document.querySelector(".reel-toggle")).display,
    controls: getComputedStyle(document.querySelector(".hero-controls")).display,
    poster: document.querySelector(".hero-media img").naturalWidth > 0,
  }));
  ok(r.overflowX === "auto", "no-JS desktop", `featured projects should be a row you scroll (overflow-x ${r.overflowX})`);
  ok(r.toggle === "none" && r.controls === "none", "no-JS desktop", "inert controls are showing");
  ok(r.poster, "no-JS desktop", "the hero still is missing");
  await page.screenshot({ path: join(SHOTS, "home-desktop-no-js.png"), fullPage: true });
  await ctx.close();
}
{
  const { ctx, page } = await newPage({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  await page.goto(BASE + "/work/", { waitUntil: "networkidle" });
  const r = await page.evaluate(() => ({
    nav: getComputedStyle(document.querySelector(".site-nav")).display,
    toggle: getComputedStyle(document.querySelector(".nav-toggle")).display,
    overflow: document.documentElement.scrollWidth - innerWidth,
  }));
  ok(r.nav !== "none" && r.toggle === "none", "no-JS phone", `the menu should be laid out inline (nav ${r.nav}, toggle ${r.toggle})`);
  ok(r.overflow <= 0, "no-JS phone", `overflow ${r.overflow}px`);
  await page.screenshot({ path: join(SHOTS, "work-phone-no-js.png") });
  await ctx.close();
}

// ------------------------------------------------------------- keyboard --

{
  const { ctx, page } = await newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  ok(await page.evaluate(() => document.activeElement.classList.contains("skip")), "keyboard", "first Tab should reach the skip link");
  await page.keyboard.press("Tab");
  ok(await page.evaluate(() => document.activeElement.classList.contains("brand")), "keyboard", "second Tab should reach the Idlery home link");
  const order = [];
  for (let i = 0; i < 5; i++) { await page.keyboard.press("Tab"); order.push(await page.evaluate(() => document.activeElement.textContent.trim())); }
  ok(order.join(",") === "Work,Simulations,Products,Portfolio,About", "keyboard", `nav order is ${order.join(",")}`);
  await ctx.close();
}

// ---------------------------------------------------- featured-work reel --

const reelState = (page) => page.evaluate(() => {
  const root = document.querySelector("[data-reel]");
  const track = root.querySelector(".reel-track");
  const m = /translate3d\((-?[\d.]+)px/.exec(track.style.transform || "");
  const btn = document.querySelector("[data-reel-toggle]");
  return {
    moving: root.classList.contains("is-moving"), x: m ? +m[1] : null,
    items: track.children.length, copies: track.querySelectorAll("[data-copy]").length,
    copiesHidden: [...track.querySelectorAll("[data-copy]")].every((li) => li.getAttribute("aria-hidden") === "true" && li.inert),
    focusable: [...track.querySelectorAll("a")].filter((a) => a.tabIndex >= 0 && !a.closest("[inert]")).length,
    button: btn.hidden ? "hidden" : btn.textContent.trim(),
  };
});
{
  const { ctx, page, log } = await newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.querySelector("#featured").scrollIntoView({ block: "center" }));
  await page.mouse.move(5, 5);
  await page.waitForTimeout(1200);
  const a = await reelState(page);
  await page.waitForTimeout(1500);
  const b = await reelState(page);
  ok(a.moving && a.copies > 0 && a.copiesHidden, "reel", `should be moving with inert, hidden copies (${JSON.stringify(a)})`);
  ok(a.focusable === 6, "reel", `the six projects should be reachable once each by keyboard, found ${a.focusable}`);
  const d = b.x - a.x;
  ok(d > 10 || d < -200, "reel", `should drift to the right (moved ${d.toFixed(1)}px in 1.5 s)`);
  ok(a.button.startsWith("Pause"), "reel", `pause control should show (${a.button})`);
  await page.screenshot({ path: join(SHOTS, "home-desktop-reel.png") });
  // Hovering stops it.
  const box = await page.locator("[data-reel]").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(1500);
  const h1 = (await reelState(page)).x;
  await page.waitForTimeout(800);
  ok(Math.abs((await reelState(page)).x - h1) < 1.5, "reel hover", "should stop while the pointer is over it");
  await page.mouse.move(5, 5);
  // The Pause button stops it; Play starts it again.
  await page.click("[data-reel-toggle]");
  await page.waitForTimeout(1500);
  const p1 = await reelState(page);
  await page.waitForTimeout(800);
  const p2 = await reelState(page);
  ok(p1.button.startsWith("Play") && Math.abs(p2.x - p1.x) < 1.5, "reel pause", `Pause should stop it (${p1.button}, ${p1.x} -> ${p2.x})`);
  await page.click("[data-reel-toggle]");
  await page.waitForTimeout(1500);
  ok((await reelState(page)).button.startsWith("Pause"), "reel play", "Play should resume it");
  // Keyboard: focus a project; the reel stops with that project fully in view.
  await page.focus("#featured-track > li:nth-child(4) .card-title a");
  await page.waitForTimeout(700);
  const f = await page.evaluate(() => {
    const r = document.activeElement.closest("li").getBoundingClientRect();
    const box = document.querySelector("[data-reel]").getBoundingClientRect();
    return { text: document.activeElement.textContent.trim(), inView: r.left >= box.left - 1 && r.right <= box.right + 1 };
  });
  ok(f.text === "CoreCredit" && f.inView, "reel keyboard", `a focused project should be fully in view (${JSON.stringify(f)})`);
  await page.keyboard.press("Tab");
  await page.waitForTimeout(700);
  const g = await page.evaluate(() => {
    const r = document.activeElement.closest("li")?.getBoundingClientRect();
    const box = document.querySelector("[data-reel]").getBoundingClientRect();
    return { text: document.activeElement.textContent.trim(), inView: !!r && r.left >= box.left - 1 && r.right <= box.right + 1 };
  });
  ok(g.text === "Elemora" && g.inView, "reel keyboard", `Tab should move to the next project, in view (${JSON.stringify(g)})`);
  await page.screenshot({ path: join(SHOTS, "home-desktop-reel-focus.png") });
  ok(!log.errors.length, "reel", `console errors: ${log.errors.join(" | ")}`);
  await ctx.close();
}
{
  // Reduced motion: a still row you scroll, no copies, no control.
  const { ctx, page } = await newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const r = await reelState(page);
  const overflowX = await page.evaluate(() => getComputedStyle(document.querySelector(".reel-track")).overflowX);
  ok(!r.moving && r.copies === 0 && r.button === "hidden" && overflowX === "auto", "reel reduced motion", `should be a still, scrollable row (${JSON.stringify(r)}, overflow-x ${overflowX})`);
  await ctx.close();
}
{
  // Phone: moving, and a drag moves it by hand without opening a project.
  const { ctx, page } = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.querySelector("#featured").scrollIntoView({ block: "center" }));
  await page.waitForTimeout(800);
  const a = await reelState(page);
  ok(a.moving, "reel phone", "should be moving");
  await page.screenshot({ path: join(SHOTS, "home-phone-reel.png") });
  await ctx.close();
}

// ----------------------------------------------------------- phone menu --

{
  const { ctx, page } = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto(BASE + "/work/", { waitUntil: "networkidle" });
  ok(await page.evaluate(() => getComputedStyle(document.querySelector(".site-nav")).display === "none"), "phone menu", "menu should start closed");
  await page.tap(".nav-toggle");
  ok(await page.evaluate(() => document.querySelector(".nav-toggle").getAttribute("aria-expanded") === "true" && getComputedStyle(document.querySelector(".site-nav")).display !== "none"), "phone menu", "menu did not open");
  await page.screenshot({ path: join(SHOTS, "work-phone-menu-open.png") });
  const items = await page.evaluate(() => [...document.querySelectorAll(".site-nav a")].map((a) => a.textContent.trim()).join(","));
  ok(items === "Work,Simulations,Products,Portfolio,About", "phone menu", `items are ${items}`);
  await page.keyboard.press("Escape");
  ok(await page.evaluate(() => document.querySelector(".nav-toggle").getAttribute("aria-expanded") === "false"), "phone menu", "Escape did not close the menu");
  await ctx.close();
}

// ------------------------------------------------------------ packaging --

try {
  execFileSync("python3", [join(ROOT, "scripts", "build.py"), "--check"], { stdio: "pipe" });
} catch (e) {
  fail("build.py --check", String(e.stdout || e.message).trim().split("\n").slice(0, 6).join(" / "));
}
for (const f of ["hero-landscape.av1.mp4", "hero-landscape.mp4", "hero-portrait.av1.mp4", "hero-portrait.mp4"]) {
  try { notes.push(`${f}: ${(statSync(join(SITE, "assets", "video", f)).size / 1024).toFixed(0)} KB`); }
  catch { fail("video", `${f} is missing`); }
}

await browser.close();
server.close();

for (const n of notes) console.log("note  " + n);
if (failures.length) {
  for (const f of failures) console.log("FAIL  " + f);
  console.log(`\n${failures.length} problem(s). Screenshots in .preview/`);
  process.exit(1);
}
console.log(`\nAll checks passed: ${PAGES.length} pages at ${VIEWPORTS.length} widths (plus dark mode), redirects, video, reel, keyboard, no-JS. Screenshots in .preview/`);

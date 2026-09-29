// Shared capture helpers for Karnwold footage (clock-stepped, deterministic frames).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
// The Karnwold checkout whose Playwright this uses (KARNWOLD_REPO, default: a sibling folder).
const require = createRequire(new URL((process.env.KARNWOLD_REPO || '../karnwold').replace(/\/?$/, '/') + 'package.json', 'file://' + process.cwd() + '/'));
const { chromium } = require('playwright-core');

export const ROOT = process.env.CAPTURE_DIR || new URL('./out', import.meta.url).pathname;
export const BASE = 'http://127.0.0.1:4173/';
export const STEP_MS = 32; // two fake rAF ticks (16 ms grid) per captured frame -> perfectly uniform motion

export async function launch() {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars', '--font-render-hinting=none'],
    // Isolated fontconfig: maps Georgia -> Gelasio and Segoe UI/system-ui -> Selawik (metric-compatible
    // open fonts) so the Windows-targeted font stacks don't fall back to DejaVu. No app files touched.
    env: { ...process.env, FONTCONFIG_FILE: `${ROOT}/fonts/fonts.conf` },
  });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => { errors.push('dialog: ' + d.message()); d.dismiss().catch(() => {}); });
  await page.addInitScript(() => {
    try { localStorage.removeItem('karnwoldDigitalSave'); } catch (_) {}
    // CSS animations/transitions run on the compositor's real clock, not the fake JS clock.
    // Pause every document animation and advance it by exactly the frame step instead.
    const seen = new WeakSet();
    window.__capStep = (dt) => {
      for (const a of document.getAnimations()) {
        try {
          if (!seen.has(a)) { seen.add(a); a.pause(); if (a.currentTime == null) a.currentTime = 0; continue; }
          if (a.playState === 'paused') a.currentTime = (a.currentTime || 0) + dt;
        } catch (_) {}
      }
    };
  });
  await page.clock.install();
  const cdp = await context.newCDPSession(page);
  return { browser, context, page, cdp, errors };
}

export async function startOfflineGame(page, log = console.log) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('.hero').getByRole('link', { name: 'Play Karnwold' }).click();
  await page.getByRole('dialog', { name: 'Choose how to play' }).getByRole('button', { name: 'Play Offline' }).click();
  await page.getByRole('heading', { name: 'Prepare Your Strongholds' }).waitFor();
  await page.getByRole('button', { name: 'More players' }).click();
  await page.getByRole('button', { name: 'More players' }).click();
  await page.getByRole('button', { name: 'Start Game' }).click();
  await page.locator('.tt-root canvas').first().waitFor({ state: 'visible', timeout: 60000 });
  log('table canvas visible');
}

export async function roundText(page) {
  return (await page.locator('.tt-status').filter({ hasText: 'Round' }).first().textContent().catch(() => '')) || '';
}

// Pause the fake clock just ahead of "now"; from here on nothing moves unless we step.
export async function pauseClock(page) {
  // Under heavy load the page's main thread can be busy for seconds rendering a frame while the
  // real-time-synced fake clock keeps advancing, so aim well ahead and retry with a bigger margin.
  for (const margin of [1500, 4000, 10000, 20000]) {
    const now = await page.evaluate(() => Date.now());
    try { await page.clock.pauseAt(now + margin); return; } catch (e) { if (!/past/.test(String(e))) throw e; }
  }
  throw new Error('could not pause the clock');
}

export class FrameRecorder {
  constructor(page, cdp, dir) {
    this.page = page; this.cdp = cdp; this.dir = dir; this.n = 0; this.t0 = Date.now();
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
  async step(dt = STEP_MS) {
    // fastForward fires each due timer once at the jump target: exactly one rAF (one WebGL render,
    // with a 32 ms delta) per captured frame instead of two with runFor -> half the render cost.
    if (this.ff) await this.page.clock.fastForward(dt); else await this.page.clock.runFor(dt);
    await this.page.evaluate((d) => window.__capStep && window.__capStep(d), dt);
  }
  async shot() {
    const { data } = await this.cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, captureBeyondViewport: false });
    const f = path.join(this.dir, `f${String(this.n).padStart(5, '0')}.png`);
    fs.writeFileSync(f, Buffer.from(data, 'base64'));
    this.n++;
    return f;
  }
  // Advance one frame and capture it.
  async frame() { await this.step(); return this.shot(); }
  async frames(k, onEach) {
    for (let i = 0; i < k; i++) {
      await this.frame();
      if (onEach) await onEach(this.n);
      if (this.n % 20 === 0) console.log(`  frame ${this.n}  (${((Date.now() - this.t0) / this.n / 1000).toFixed(2)} s/frame)`);
    }
  }
}

// Canvas-only recorder for FAB / ONE (combines scripts/record.mjs's spec format and virtual
// clock with scripts/frames.mjs's WebGL read-back). Every saved frame is the app's own WebGL
// drawing buffer, read with gl.readPixels right after the app rendered it; no DOM (header,
// panels, captions, labels, buttons, the magnifier inset) is in the pixels.
//
//   node rec-canvas.mjs <spec.json> [--frames N] [--scale S]
//
// spec: {
//   "name": "bay",
//   "url": "http://127.0.0.1:4183/?step=coat&virt=1&quality=high",   (capture=1 is added)
//   "warm": { "w": 960, "h": 600 },     window during setup (same canvas aspect; cheap frames)
//   "w": 1920, "h": 1140,               window while recording (sized so the canvas is 1920x1080)
//   "expect": [1920, 1080],             drawing buffer required at the first recorded frame
//   "setup": [ {"wait": ms}, {"advance": n}, {"eval": "js"}, {"key": "k"}, {"click": "sel"} ],
//   "pre": 3,                           frames advanced at the recording size before frame 0
//   "during": [ {"frame": i, "eval": "js"} ],   run before frame i is advanced (as record.mjs)
//   "frames": 210,                      recorded frames (30 fps; each = window.__fabAdvance(1))
//   "outDir": ".../fabone/bay"
// }
// Writes <outDir>/frames/%05d.png, <outDir>/log.json (timings, geometry, console errors).
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
// The Fab One checkout whose Playwright this uses (FABONE_REPO, default: a sibling folder).
const FABONE_REPO = process.env.FABONE_REPO || '../Photolithography-Simulation-Site';
const { chromium } = await import(pathToFileURL(resolve(FABONE_REPO, 'node_modules/@playwright/test/index.mjs')).href);
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const spec = JSON.parse(readFileSync(args[0], 'utf8'));
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const FRAMES = Number(opt('--frames') ?? spec.frames);
const withCapture = (u) => (u.includes('capture=1') ? u : u + (u.includes('?') ? '&' : '?') + 'capture=1');
const outDir = spec.outDir;
const frameDir = join(outDir, 'frames');
rmSync(frameDir, { recursive: true, force: true });
mkdirSync(frameDir, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const warm = spec.warm ?? { w: spec.w, h: spec.h };
const ctx = await browser.newContext({ viewport: { width: warm.w, height: warm.h }, deviceScaleFactor: spec.dpr ?? 1, reducedMotion: 'no-preference' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url() + ' ' + (r.failure()?.errorText ?? '')));
// fresh learner state, once per recording (as record.mjs)
await page.addInitScript(() => {
  try {
    if (!sessionStorage.getItem('__rec')) {
      localStorage.clear();
      sessionStorage.setItem('__rec', '1');
    }
  } catch {}
});
const url = withCapture(spec.url);
const T0 = Date.now();
const el = () => ((Date.now() - T0) / 1000).toFixed(1) + ' s';
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => !!window.__fab && !!window.__fabAdvance && !!window.__fabStores, undefined, { timeout: 120000 });
const advance = async (n) => {
  for (let i = 0; i < n; i++) {
    await page.evaluate(() => window.__fabAdvance(1));
    await page.waitForTimeout(2);
  }
};
const geo = () => page.evaluate(() => {
  const c = window.__fab.gl.domElement; const r = c.getBoundingClientRect(); const gl = window.__fab.gl.getContext();
  return { cssRect: [r.x, r.y, r.width, r.height], drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight], pixelRatio: window.__fab.gl.getPixelRatio(), tier: window.__fab.useQuality.getState().tier, tierReason: window.__fab.useQuality.getState().reason, stage: { ...window.__fab.useStageInfo.getState() }, app: (({ mode, step, machine, demo, scaleOverride, lightPath }) => ({ mode, step, machine, demo, scaleOverride, lightPath }))(window.__fabStores.useApp.getState()) };
});
const log = { spec, url, started: new Date().toISOString(), setup: [], frames: [], errors };
for (const st of spec.setup ?? []) {
  const s = Date.now();
  if (st.wait) await page.waitForTimeout(st.wait);
  if (st.advance) await advance(st.advance);
  if (st.click) await (st.click.startsWith('text=') ? page.getByText(st.click.slice(5)).first() : page.locator(st.click).first()).click();
  if (st.eval) await page.evaluate(st.eval);
  if (st.key) await page.keyboard.press(st.key);
  // advance one frame at a time until a JS expression is true (at most st.max frames)
  if (st.until) {
    let k = 0;
    for (; k < (st.max ?? 300); k++) { if (await page.evaluate(st.until)) break; await advance(1); }
    st.framesTaken = k;
    console.log(`${spec.name}: until ${st.until.slice(0, 80)} -> ${k} frames`);
  }
  if (st.resize) { await page.setViewportSize({ width: spec.w, height: spec.h }); await page.waitForTimeout(300); }
  // wait (without advancing the virtual clock) until the WebGL drawing buffer has the expected size
  if (st.settleSize) {
    for (let k = 0; k < 60; k++) {
      const b = await page.evaluate(() => { const gl = window.__fab.gl.getContext(); const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return [gl.drawingBufferWidth, gl.drawingBufferHeight]; });
      if (b[0] === spec.expect[0] && b[1] === spec.expect[1]) { console.log(`${spec.name}: buffer ${b.join('x')} after ${k} waits`); break; }
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      await page.waitForTimeout(250);
      if (k === 59) console.log(`${spec.name}: WARNING buffer still ${b.join('x')}`);
    }
  }
  log.setup.push({ ...st, ms: Date.now() - s });
  console.log(`${spec.name}: setup ${JSON.stringify(st).slice(0, 90)} (${Date.now() - s} ms, ${el()})`);
}
log.geoWarm = await geo();
if (warm.w !== spec.w || warm.h !== spec.h) {
  await page.setViewportSize({ width: spec.w, height: spec.h });
  await page.waitForTimeout(300);
}
// the frame that follows the resize is drawn at the new size (R3F resizes on its next frame)
const grab = async () => {
  const r = await page.evaluate(async () => {
    const t0 = performance.now();
    window.__fabAdvance(1);
    const t1 = performance.now();
    const gl = window.__fab.gl.getContext();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const t2 = performance.now();
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const cx = c.getContext('2d'); const img = cx.createImageData(W, H);
    for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    cx.putImageData(img, 0, 0);
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    const data = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
    const t3 = performance.now();
    return { W, H, data, adv: t1 - t0, read: t2 - t1, enc: t3 - t2 };
  });
  return r;
};
for (let i = 0; i < (spec.pre ?? 0); i++) await advance(1);
log.geoRec = await geo();
console.log(`${spec.name}: recording geometry ${JSON.stringify({ css: log.geoRec.cssRect, buf: log.geoRec.drawingBuffer, pr: log.geoRec.pixelRatio, tier: log.geoRec.tier, app: log.geoRec.app, stage: log.geoRec.stage })}`);
const started = Date.now();
for (let i = 0; i < FRAMES; i++) {
  for (const ev of spec.during ?? []) {
    if (ev.frame === i) await page.evaluate(ev.eval);
    // {"when": "js expr", "after": frame, "eval": "js"}: fired once, before the first frame (>= after) where it is true
    if (ev.when && !ev.firedAt && i >= (ev.after ?? 0) && (await page.evaluate(ev.when))) { await page.evaluate(ev.eval); ev.firedAt = i; console.log(`${spec.name}: fired ${ev.eval.slice(0, 80)} at frame ${i}`); }
  }
  const s = Date.now();
  const r = await grab();
  if (i === 0 && spec.expect && (r.W !== spec.expect[0] || r.H !== spec.expect[1])) {
    console.log(`${spec.name}: WARNING drawing buffer ${r.W}x${r.H}, expected ${spec.expect.join('x')}`);
    log.bufferMismatch = [r.W, r.H];
  }
  writeFileSync(join(frameDir, `${String(i).padStart(5, '0')}.png`), Buffer.from(r.data.split(',')[1], 'base64'));
  const ms = Date.now() - s;
  log.frames.push({ i, W: r.W, H: r.H, ms, adv: Math.round(r.adv), read: Math.round(r.read), enc: Math.round(r.enc) });
  await page.waitForTimeout(2);
  if (i % 10 === 0 || i === FRAMES - 1) console.log(`${spec.name}: frame ${i}/${FRAMES} ${r.W}x${r.H} ${ms} ms (adv ${Math.round(r.adv)}, read ${Math.round(r.read)}, enc ${Math.round(r.enc)}) total ${((Date.now() - started) / 1000).toFixed(0)} s`);
}
log.geoEnd = await geo();
log.recordSeconds = (Date.now() - started) / 1000;
log.msPerFrame = Math.round((Date.now() - started) / FRAMES);
log.totalSeconds = (Date.now() - T0) / 1000;
writeFileSync(join(outDir, 'log.json'), JSON.stringify(log, null, 1));
console.log(`${spec.name}: done ${FRAMES} frames, ${log.msPerFrame} ms/frame, total ${el()}; errors: ${errors.length ? errors.slice(0, 5).join(' | ') : 'none'}`);
await browser.close();

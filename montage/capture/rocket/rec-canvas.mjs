// Canvas-only recorder for KIMBLE Rocket Engineering (BKimble1/rocket-simulation, branch
// claude/kimble-rocket-engineering). It opens the app's own production build on its virtual
// clock (?virt=1: every frame advances exactly 1/30 s) and, after each frame, reads the WebGL
// drawing buffer with gl.readPixels. No page, panel, caption, label or button is in the pixels.
//
// The app moves its projection centre away from panels that cover the stage (useStageInset).
// With hideUI the recorder hides the interface layer with a stylesheet before recording; the
// app's own ResizeObserver then clears the inset, so the subject is framed for the whole canvas.
// Nothing in the simulation, its trajectories or its framings is changed.
//
//   ROCKET_REPO=../rocket-simulation node rec-canvas.mjs <spec.json> [--frames N]
//
// spec: {
//   "name": "liftoff",
//   "url": "http://127.0.0.1:4190/?v=mission&m=leo&ch=ignition&quality=high",  (virt=1&capture=1 added)
//   "w": 1600, "h": 900,               window (the canvas fills it)
//   "setup": [ {"wait": ms}, {"advance": n}, {"eval": "js"}, {"click": "sel"}, {"until": "js", "max": n} ],
//   "hideUI": true,
//   "pre": 30,                          frames advanced after hiding the interface, before frame 0
//   "frames": 150,
//   "outDir": "out/liftoff"            (relative to the spec file)
// }
// Writes <outDir>/frames/%05d.png and <outDir>/log.json.
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const ROCKET_REPO = process.env.ROCKET_REPO || '../rocket-simulation';
const { chromium } = await import(pathToFileURL(resolve(ROCKET_REPO, 'node_modules/@playwright/test/index.mjs')).href);

const args = process.argv.slice(2);
const spec = JSON.parse(readFileSync(args[0], 'utf8'));
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const FRAMES = Number(opt('--frames') ?? spec.frames);
spec.outDir = resolve(dirname(args[0]), spec.outDir);   // relative to the spec file
const frameDir = join(spec.outDir, 'frames');
rmSync(frameDir, { recursive: true, force: true });
mkdirSync(frameDir, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: spec.w, height: spec.h }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 200)); });
// a fresh learner, with narration and sound off (the capture is silent anyway)
await page.addInitScript(() => {
  try {
    localStorage.clear();
    localStorage.setItem('kimble.settings', JSON.stringify({ narration: false, sound: 'off', captions: false }));
  } catch {}
});
const url = spec.url + (spec.url.includes('?') ? '&' : '?') + 'virt=1&capture=1';
const T0 = Date.now();
const el = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
await page.goto(url, { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction(() => typeof window.__rocketAdvance === 'function', null, { timeout: 180000 });
const advance = async (n) => { for (let i = 0; i < n; i++) await page.evaluate(() => window.__rocketAdvance(1)); };
// let textures and lazy scene parts load: render a frame, wait, repeat
for (let i = 0; i < 8; i++) { await advance(1); await page.waitForTimeout(500); }
const log = { spec, url, started: new Date().toISOString(), setup: [], errors };
for (const st of spec.setup ?? []) {
  if (st.wait) await page.waitForTimeout(st.wait);
  if (st.advance) await advance(st.advance);
  if (st.click) await page.locator(st.click).first().click();
  if (st.eval) await page.evaluate(st.eval);
  if (st.until) {
    let k = 0;
    for (; k < (st.max ?? 600); k++) { if (await page.evaluate(st.until)) break; await advance(1); }
    st.framesTaken = k;
  }
  log.setup.push(st);
  console.log(`${spec.name}: setup ${JSON.stringify(st).slice(0, 100)} (${el()})`);
}
if (spec.hideUI) {
  // everything except the stage (the canvas) leaves the layout; insets clear on their own
  await page.addStyleTag({ content: '.app > *:not(.stage) { display: none !important; }' });
  await page.waitForTimeout(300);
}
await advance(spec.pre ?? 0);
const info = () => page.evaluate(() => {
  const f = window.__rocketFrame; const gl = window.__rocketGL.getContext();
  return { location: f.location, missionTime: +f.missionTime.toFixed(2), buffer: [gl.drawingBufferWidth, gl.drawingBufferHeight] };
});
log.start = await info();
console.log(`${spec.name}: recording from ${JSON.stringify(log.start)} (${el()})`);
const started = Date.now();
for (let i = 0; i < FRAMES; i++) {
  for (const ev of spec.during ?? []) if (ev.frame === i) await page.evaluate(ev.eval);
  const r = await page.evaluate(async () => {
    window.__rocketAdvance(1);
    const gl = window.__rocketGL.getContext();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const cx = c.getContext('2d'); const img = cx.createImageData(W, H);
    for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    cx.putImageData(img, 0, 0);
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    return await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
  });
  writeFileSync(join(frameDir, `${String(i).padStart(5, '0')}.png`), Buffer.from(r.split(',')[1], 'base64'));
  if (i % 10 === 0 || i === FRAMES - 1) console.log(`${spec.name}: frame ${i + 1}/${FRAMES}, ${((Date.now() - started) / (i + 1) / 1000).toFixed(1)} s/frame (${el()})`);
}
log.end = await info();
log.secondsPerFrame = (Date.now() - started) / 1000 / FRAMES;
writeFileSync(join(spec.outDir, 'log.json'), JSON.stringify(log, null, 1));
console.log(`${spec.name}: done, ${FRAMES} frames, end ${JSON.stringify(log.end)}; errors: ${errors.length ? errors.slice(0, 4).join(' | ') : 'none'}`);
await browser.close();

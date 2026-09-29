// Shot B "build": real offline game (You + 3 bots). Round 1: collect income, buy Block+Arch+Roof,
// Build tab -> Barracks (Stage 1) opens the 3D build workbench. Drop points for the drags come from
// nodes.mjs (the app's own build-graph/placement modules + the workbench's fixed camera), verified live
// by the Required-pieces checklist. The workbench is opened once un-recorded (so the GLBs are cached),
// cancelled, then recorded clock-stepped: open workbench, drag Arch in, drag Roof in, orbit the camera.
import { execFileSync } from 'node:child_process';
import { launch, startOfflineGame, pauseClock, FrameRecorder, ROOT } from './lib.mjs';

const t0 = Date.now();
const log = (s) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);
const { browser, page, cdp, errors } = await launch();
const click = (sel) => page.locator(sel).first().evaluate((b) => b.click());
const box = async (sel) => page.locator(sel).first().boundingBox();
const checklist = async () => (await page.locator('.tt-checklist').first().innerText().catch(() => '')).replace(/\s+/g, ' ');

try {
  await startOfflineGame(page, log);
  await page.locator('[data-testid="collect-income"]').waitFor({ timeout: 30000 });
  await click('[data-testid="collect-income"]');
  await page.locator('[data-testid="tab-buy"]').waitFor({ timeout: 30000 });
  await click('[data-testid="tab-buy"]');
  for (const t of ['Block', 'Arch', 'Roof']) await click(`[data-testid="buy-plus-${t}"]`);
  await page.waitForTimeout(300);
  await click('[data-testid="buy-confirm"]');
  await page.waitForTimeout(500);
  await click('[data-testid="tab-build"]');
  await page.locator('[data-testid="build-plan-Barracks"]').waitFor({ timeout: 15000 });
  log('bought pieces; Barracks build available');
  await page.mouse.move(1700, 980);
  await page.waitForTimeout(1000);
  await pauseClock(page);
  const W = new FrameRecorder(page, cdp, `${ROOT}/frames/build_warm`); W.ff = true;

  // warm-up open (not recorded): loads + caches the piece GLBs, measures the workbench layout
  await click('[data-testid="build-plan-Barracks"]');
  await page.locator('.tt-checklist').waitFor({ timeout: 60000 });
  for (let i = 0; i < 12; i++) await W.step();
  // the canvas starts at the default 300x150 until R3F's resize measurement lands; wait for it
  let canvasBox = await box('.tt-buildoverlay canvas');
  for (let i = 0; i < 80 && !(canvasBox && canvasBox.width > 600); i++) { await W.step(); canvasBox = await box('.tt-buildoverlay canvas'); }
  for (let i = 0; i < 6; i++) await W.step();
  const trays = {};
  for (const p of ['arch', 'roof']) trays[p] = await box(`[data-piece="${p}"]`);
  const drops = JSON.parse(execFileSync('node', [`${ROOT}/nodes.mjs`, JSON.stringify(canvasBox)], { encoding: 'utf8' }).trim());
  log(`canvas box ${JSON.stringify(canvasBox)} drops ${JSON.stringify(drops)} checklist: ${await checklist()}`);
  await W.shot();
  await page.locator('.tt-buildoverlay').getByRole('button', { name: 'Cancel' }).first().evaluate((b) => b.click());
  for (let i = 0; i < 6; i++) await W.step();

  // ---------- recorded take ----------
  const R = new FrameRecorder(page, cdp, `${ROOT}/frames/build`); R.ff = true;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  async function glide(from, to, frames) {
    for (let i = 1; i <= frames; i++) {
      const k = ease(i / frames);
      await page.mouse.move(from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k);
      await R.frame();
    }
  }
  async function dragPiece(piece, to) {
    const tb = trays[piece];
    const from = [tb.x + tb.width / 2, tb.y + tb.height / 2];
    await page.mouse.move(from[0], from[1]);
    await page.mouse.down();
    await R.frame();
    const mid = [to[0] + 70, to[1] - 60];
    await glide(from, mid, 16);  // lift the piece up toward the build
    await glide(mid, to, 8);     // onto the node: magnet snap
    await R.frames(3);
    await page.mouse.up();
    await R.frames(12);          // piece seats into place
    log(`${piece} released at ${to}; checklist: ${await checklist()}`);
  }
  log('recording: open workbench');
  await R.frames(4);
  await click('[data-testid="build-plan-Barracks"]');
  await R.frames(14);
  await dragPiece('arch', drops.arch);
  await dragPiece('roof', drops.roof);
  // Orbit: drag on empty workbench space; OrbitControls damping carries the swing on after release.
  const o0 = [canvasBox.x + canvasBox.width * 0.8, canvasBox.y + canvasBox.height * 0.64];
  await page.mouse.move(o0[0], o0[1]);
  await page.mouse.down();
  await glide(o0, [o0[0] - 360, o0[1] - 24], 34);
  await page.mouse.up();
  await R.frames(16);
  log(`done: ${R.n} frames; checklist: ${await checklist()}`);
} catch (e) {
  log('ERROR ' + (e.stack || e));
} finally {
  console.log('page errors:', JSON.stringify(errors.slice(0, 10)));
  await browser.close();
}

// Shot C: a siege, from the launch to the result. Karnwold's tabletop preview (#/table, no
// saved game) runs the real engine and siege adapter; its "Round 3" fast-forward exists so a
// siege is reachable for review (tests/e2e/siege.spec.js uses it the same way). The capture
// opens the Siege tab, starts a siege on the first legal target, then records the roll: the
// dice tumble to the faces the engine rolled and the result panel is revealed.
//   KARNWOLD_REPO=../karnwold node karnwold/shotC.mjs siege-land 1920 1080
//   KARNWOLD_REPO=../karnwold node karnwold/shotC.mjs siege-port 1080 1920
// The page renders at deviceScaleFactor 2 and each frame is saved at the window's size, so every
// edge (the dice, the panel's type) is supersampled.
import { launch, pauseClock, FrameRecorder, ROOT } from './lib.mjs';

const [name = 'siege-land', W = '1920', H = '1080'] = process.argv.slice(2);
const t0 = Date.now();
const log = (s) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);
const { browser, page, cdp, errors } = await launch({ width: Number(W), height: Number(H), dpr: 2 });
const click = (loc) => loc.first().evaluate((b) => b.click());
try {
  // full motion (the dice tumble is skipped under reduced motion), high quality
  await page.addInitScript(() => localStorage.setItem('karnwoldTableSettings', JSON.stringify({ quality: 'high', motion: 'full' })));
  await page.goto('http://127.0.0.1:4173/#/table', { waitUntil: 'networkidle' });
  await page.locator('.tt-root canvas').first().waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForTimeout(2500);
  await click(page.getByRole('button', { name: /Round 3/ }));
  await page.waitForTimeout(2500);
  await click(page.getByRole('tab', { name: 'Siege' }));
  await page.waitForTimeout(1200);
  await click(page.getByRole('button', { name: /Start siege/ }));
  await page.getByRole('region', { name: 'Active siege' }).waitFor({ timeout: 20000 });
  await page.waitForTimeout(2500);
  await page.mouse.move(Number(W) - 40, Number(H) / 2);
  log('siege started');
  await pauseClock(page);
  const R = new FrameRecorder(page, cdp, `${ROOT}/frames/${name}`);
  for (let i = 0; i < 8; i++) await R.step();
  await R.frames(36);
  log('roll the dice');
  await click(page.getByRole('region', { name: 'Active siege' }).getByRole('button', { name: /Roll the dice/ }));
  await R.frames(170);
  log(`done ${R.n} frames; result: ${(await page.locator('.sr-headline').first().textContent().catch(() => '?')).trim()}`);
} catch (e) {
  log('ERROR ' + (e.stack || e));
} finally {
  console.log('page errors:', JSON.stringify(errors.slice(0, 10)));
  await browser.close();
}

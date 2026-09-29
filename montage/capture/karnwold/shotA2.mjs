// Shot A (variant "table2"): the human's own Round-3 turn, so the table never re-seats (the game
// re-seats the table instantly when the turn passes). Clock-stepped capture: start-of-turn card ->
// Collect income (Gold/Supply cards fly from the center decks into the HUD) -> hover the Gold deck
// (it lifts and glows) -> click it to draw a card (flies into the HUD).
import { launch, startOfflineGame, roundText, pauseClock, FrameRecorder, ROOT } from './lib.mjs';

const t0 = Date.now();
const log = (s) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);
const { browser, page, cdp, errors } = await launch();
const click = (sel) => page.locator(sel).first().evaluate((b) => b.click());
try {
  await startOfflineGame(page, log);
  let guard = 0;
  while (guard++ < 400) {
    const rt = await roundText(page);
    const round = Number((rt.match(/Round\s+(\d+)/) || [])[1] || 0);
    if (await page.locator('[data-testid="siege-continue"]').isVisible().catch(() => false)) { await click('[data-testid="siege-continue"]'); continue; }
    if (await page.locator('[data-testid="collect-income"]').isVisible().catch(() => false)) {
      if (round >= 3) { log(`reached ${rt.trim()}`); break; }
      log(`${rt.trim()} -> collect`); await click('[data-testid="collect-income"]'); await page.waitForTimeout(300); continue;
    }
    if (await page.locator('.tt-endturn').isVisible().catch(() => false)) { log(`${rt.trim()} -> end turn`); await click('.tt-endturn'); await page.waitForTimeout(300); continue; }
    await page.clock.fastForward(1000);
  }
  await page.mouse.move(1500, 700);
  await page.waitForTimeout(1500);
  await pauseClock(page);
  const R = new FrameRecorder(page, cdp, `${ROOT}/frames/table2`);
  for (let i = 0; i < 12; i++) await R.step();
  await R.frames(14);
  log('collect income');
  await click('[data-testid="collect-income"]');
  await R.frames(56);
  // glide the (invisible) pointer onto the Gold deck: it lifts + glows on hover
  const from = [1500, 700], to = [757, 455];
  for (let i = 1; i <= 16; i++) {
    const k = 1 - Math.pow(1 - i / 16, 3);
    await page.mouse.move(from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k);
    await R.frame();
  }
  await R.frames(14);
  log('draw from Gold deck');
  await page.mouse.down(); await page.mouse.up();
  await R.frames(10);
  // move the pointer off the deck so it settles back down
  for (let i = 1; i <= 12; i++) { await page.mouse.move(757 + 60 * i, 455 + 30 * i); await R.frame(); }
  await R.frames(70);
  log(`done ${R.n} frames; ${(await roundText(page)).trim()}`);
} catch (e) {
  log('ERROR ' + (e.stack || e));
} finally {
  console.log('page errors:', JSON.stringify(errors.slice(0, 10)));
  await browser.close();
}

// Shot A "table": real offline game (You + 3 bots), fast-forward to Round TARGET_ROUND on the
// human's actions phase, then clock-step and capture: ~0.6 s of the human's turn (Build panel open),
// click End Turn, and keep capturing while the table rotates and the bots play their turns.
import { launch, startOfflineGame, roundText, pauseClock, FrameRecorder, ROOT } from './lib.mjs';

const TARGET_ROUND = Number(process.env.ROUND || 3);
const PRE = Number(process.env.PRE || 20);     // frames before End Turn
const POST = Number(process.env.POST || 260);  // frames after End Turn
const t0 = Date.now();
const log = (s) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);

const { browser, page, cdp, errors } = await launch();
try {
  await startOfflineGame(page, log);
  // --- play to the target round (human: collect income + end turn; bots: stepwise via fastForward) ---
  let guard = 0;
  while (guard++ < 400) {
    const rt = await roundText(page);
    const m = rt.match(/Round\s+(\d+)/); const round = m ? Number(m[1]) : 0;
    const collect = page.locator('[data-testid="collect-income"]');
    const endTurn = page.locator('.tt-endturn');
    if (await collect.isVisible().catch(() => false)) {
      log(`${rt.trim()} -> collect income`);
      await collect.evaluate((b) => b.click());
      await page.waitForTimeout(300);
      continue;
    }
    if (await endTurn.isVisible().catch(() => false)) {
      if (round >= TARGET_ROUND) { log(`reached ${rt.trim()}`); break; }
      log(`${rt.trim()} -> end turn`);
      await endTurn.evaluate((b) => b.click());
      await page.waitForTimeout(300);
      continue;
    }
    await page.clock.fastForward(1000); // one bot step (bot loop is a 900 ms setTimeout)
  }
  await page.waitForTimeout(1500);
  await pauseClock(page);
  const rec = new FrameRecorder(page, cdp, `${ROOT}/frames/table`);
  for (let i = 0; i < 12; i++) await rec.step(); // settle (no capture)
  log('capturing pre-End-Turn frames');
  await rec.frames(PRE);
  log('click End Turn');
  await page.locator('.tt-endturn').evaluate((b) => b.click());
  await rec.frames(POST);
  log(`done: ${rec.n} frames; round bar now: ${(await roundText(page)).trim()}`);
} catch (e) {
  log('ERROR ' + (e.stack || e));
} finally {
  console.log('page errors:', JSON.stringify(errors.slice(0, 10)));
  await browser.close();
}

// Arena bot-testers: plays a career of rounds with several player styles
// (greedy / random / afk) in virtual time and checks balance + economy
// invariants (easy early wins, the difficulty wall, coins vs prices,
// frame budget). Usage: node qa/arena-bots.mjs [rounds]
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, veteranSave, report, ARENA_BOT, OUT } from './lib.mjs';

export async function runArenaBots(url, rounds = 20) {
  const results = [];
  const { browser, page, errors } = await openGame(url);
  const save = await veteranSave(page);
  await page.evaluate((s) => { localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)); }, save);
  await page.reload();
  await page.waitForFunction(() => window.game && window.game.state);
  await page.addScriptTag({ content: ARENA_BOT });

  const career = [];
  for (let i = 0; i < rounds; i++) {
    career.push(await page.evaluate(() => window.__qaPlayArena({ style: 'greedy' })));
  }
  const styles = {};
  for (const style of ['random', 'afk']) styles[style] = await page.evaluate((st) => window.__qaPlayArena({ style: st }), style);

  const first3 = career.slice(0, 3);
  results.push(report('arena: greedy bot wins its first 3 runs on podium (easy start)', first3.every(r => r.place <= 3), first3.map(r => '#' + r.place).join(' ')));
  const late = career.slice(-5);
  const lateAvg = late.reduce((a, r) => a + r.place, 0) / late.length;
  results.push(report('arena: difficulty wall exists (late avg place worse than early)', lateAvg >= first3.reduce((a, r) => a + r.place, 0) / 3, `late avg #${lateAvg.toFixed(1)}`));
  results.push(report('arena: afk player never crashes and finishes a round', styles.afk.state === 'RESULTS' || styles.afk.state === 'results', `afk place #${styles.afk.place} score ${styles.afk.score}`));
  const maxUpd = Math.max(...career.map(r => r.maxUpdateMs));
  const avgRender = career.reduce((a, r) => a + r.avgRenderMs, 0) / career.length;
  results.push(report('perf: update() under 4 ms average', career.every(r => r.avgUpdateMs < 4), `avg ${career[career.length - 1].avgUpdateMs} ms, max ${maxUpd} ms`));
  // Headless Chromium renders in software (SwiftShader), so absolute times
  // are pessimistic; the gate is the low-end fallback the in-game frame
  // watchdog drops to (GFX_LEVELS[0]), the high-quality number is reported.
  const low = await page.evaluate(() => window.__qaPlayArena({ style: 'greedy', gfx: 0 }));
  results.push(report('perf: low-end quality level renders under 12 ms (software GPU)', low.avgRenderMs < 12, `gfx0 avg ${low.avgRenderMs} ms · gfx2 avg ${avgRender.toFixed(2)} ms`));
  const coins = career[career.length - 1].coins;
  const prices = await page.evaluate(() => SKINS.filter(s => s.price).map(s => s.price).sort((a, b) => a - b));
  results.push(report('economy: first cosmetic affordable within 3 runs', career[2].coins >= prices[0], `${career[2].coins} coins after 3 runs, cheapest ${prices[0]}`));
  results.push(report('economy: currency stays finite and non-negative', career.every(r => Number.isFinite(r.coins) && r.coins >= 0 && Number.isFinite(r.score))));
  results.push(report('arena: no runtime errors during career', errors.length === 0, errors.slice(0, 3).join(' | ')));

  fs.writeFileSync(path.join(OUT, 'arena-career.json'), JSON.stringify({ career, styles, prices, coinsAfterCareer: coins }, null, 2));
  console.log('career places:', career.map(r => r.place).join(' '), '| scores:', career.map(r => r.score).join(' '));
  console.log('coins after career:', coins, '| player level:', career[career.length - 1].level, '| core level:', career[career.length - 1].coreLevel);
  await browser.close();
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { server, url } = await serve();
  const res = await runArenaBots(url, Number(process.argv[2]) || 20);
  server.close();
  process.exit(res.every(r => r.ok) ? 0 : 1);
}

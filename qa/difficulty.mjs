// v15 difficulty check: every mission, played under its real time limit by
// the expert bot and by the "casual" bot (screen-only view, ~0.4 s
// reactions, nearest-bite targeting -- the yardstick for design calls).
// Asserts the curve the owner asked for: early missions are friendly, the
// ladder rises, the hardest ones genuinely beat a casual player, and every
// mission stays beatable (the expert clears it).
// Usage: node qa/difficulty.mjs [runs=2] [workers=4]
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, CAMPAIGN_BOT, allDistrictsSave, report, OUT } from './lib.mjs';

export async function runDifficultyChecks(url, runs = 2, workers = 4) {
  const results = [];
  const all = [];
  let pageErrors = [];
  const { browser: b0, page: p0 } = await openGame(url);
  const ids = await p0.evaluate(() => CAMPAIGN_MISSIONS.map(m => ({ id: m.id, diff: m.diff, district: m.district })));
  await b0.close();
  const chunks = Array.from({ length: workers }, (_, i) => ids.filter((_, k) => k % workers === i));
  await Promise.all(chunks.map(async (chunk) => {
    const { browser, page, errors } = await openGame(url);
    const save = await allDistrictsSave(page);
    await page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
    await page.reload();
    await page.waitForFunction(() => window.game && window.game.state);
    await page.addScriptTag({ content: CAMPAIGN_BOT });
    for (const m of chunk) {
      for (const style of ['expert', 'casual']) {
        for (let k = 0; k < runs; k++) {
          const r = await page.evaluate(([id, st]) => window.__qaPlayMission(id, { style: st }), [m.id, style]);
          all.push({ ...r, style, district: m.district });
        }
      }
    }
    pageErrors = pageErrors.concat(errors);
    await browser.close();
  }));
  const rate = (f) => { const xs = all.filter(f); return xs.length ? xs.filter(r => r.success).length / xs.length : null; };
  const pct = v => v == null ? '—' : Math.round(v * 100) + '%';
  const byDiff = [1, 2, 3, 4, 5].map(d => ({ d, expert: rate(r => r.style === 'expert' && r.diff === d), casual: rate(r => r.style === 'casual' && r.diff === d), n: all.filter(r => r.diff === d && r.style === 'casual').length / runs }));
  console.log('\n  diff   missions  expert  casual');
  byDiff.forEach(x => console.log(`  ${x.d}      ${String(x.n).padEnd(8)}  ${pct(x.expert).padEnd(6)}  ${pct(x.casual)}`));
  const districts = [...new Set(ids.map(m => m.district))];
  console.log('\n  district   expert  casual');
  districts.forEach(d => console.log(`  ${d.padEnd(9)}  ${pct(rate(r => r.style === 'expert' && r.district === d)).padEnd(6)}  ${pct(rate(r => r.style === 'casual' && r.district === d))}`));
  const expertFails = ids.filter(m => all.filter(r => r.id === m.id && r.style === 'expert').every(r => !r.success)).map(m => m.id);
  fs.writeFileSync(path.join(OUT, 'difficulty.json'), JSON.stringify({ byDiff, runs: all }, null, 1));

  const c = d => byDiff[d - 1].casual;
  // With 2 runs a mission the expert clears 70% of the time still shows
  // 0/2 about one time in ten -- allow a few such (qa/calibrate.mjs and a
  // longer run of the named ones settle it).
  results.push(report('difficulty: every mission is beatable (the expert bot clears almost every one in 2 tries)', expertFails.length <= Math.ceil(ids.length * 0.035), `never cleared: ${expertFails.join(' ') || 'none'}`));
  results.push(report('difficulty: the expert bot clears ≥ 85% of all attempts', rate(r => r.style === 'expert') >= 0.85, pct(rate(r => r.style === 'expert'))));
  results.push(report('difficulty: easy missions are friendly (casual ≥ 80% at ŁATWA)', c(1) >= 0.8, pct(c(1))));
  results.push(report('difficulty: the ladder rises (casual pass rate falls level by level)', c(1) >= c(2) && c(2) >= c(3) - 0.05 && c(3) >= c(4) - 0.05 && c(4) >= c(5) - 0.05 && c(1) - c(5) >= 0.35, byDiff.map(x => pct(x.casual)).join(' → ')));
  // (v15 review: limits keep a slow-but-clean expert run inside them, so
  // EKSTREMALNA stops a casual player about every second try, not always.)
  results.push(report('difficulty: the hardest missions stop a casual player about half the time (casual ≤ 55% at EKSTREMALNA)', c(5) <= 0.55, pct(c(5))));
  results.push(report('difficulty: not everything clears on the first try (casual fails ≥ 25% of Rozdział II)', rate(r => r.style === 'casual' && +r.id.slice(1) > 60) <= 0.75, pct(rate(r => r.style === 'casual' && +r.id.slice(1) > 60))));
  results.push(report('difficulty: no runtime errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | ')));
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { server, url } = await serve();
  const res = await runDifficultyChecks(url, Number(process.argv[2]) || 2, Number(process.argv[3]) || 4);
  server.close();
  process.exit(res.every(r => r.ok) ? 0 : 1);
}

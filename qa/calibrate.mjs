// v15 mission timing calibration: the expert campaign bot plays every
// mission RUNS times with no time limit; prints MISSION_BOT_TIME
// ({id: [median, p90]} clear seconds) for game.js and writes
// qa/out/calibration.json. Also reports missions the bot fails to clear
// at all (a spec to fix, not a time to tune).
// Usage: node qa/calibrate.mjs [runs=5] [workers=4] [fromId] [toId]
//    or: node qa/calibrate.mjs [runs] [workers] M05,M13,M18  (just these)
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, CAMPAIGN_BOT, allDistrictsSave, OUT } from './lib.mjs';

const RUNS = Number(process.argv[2]) || 5;
const WORKERS = Number(process.argv[3]) || 4;
const { server, url } = await serve();

async function worker(ids, results) {
  const { browser, page, errors } = await openGame(url);
  const save = await allDistrictsSave(page);
  await page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await page.reload();
  await page.waitForFunction(() => window.game && window.game.state);
  await page.addScriptTag({ content: CAMPAIGN_BOT });
  for (const id of ids) {
    const runs = [];
    for (let k = 0; k < RUNS; k++) runs.push(await page.evaluate((mid) => window.__qaPlayMission(mid, { openLimit: true }), id));
    const times = runs.filter(r => r.success).map(r => r.elapsed).sort((a, b) => a - b);
    const q = f => times.length ? times[Math.min(times.length - 1, Math.floor(f * times.length))] : null;
    const rec = { id, clears: times.length, runs: RUNS, median: q(0.5), p90: q(0.9), fails: runs.filter(r => !r.success).map(r => r.fail) };
    results[id] = rec;
    console.log(`  ${id}: ${rec.clears}/${RUNS}  med ${rec.median}  p90 ${rec.p90}${rec.fails.length ? '  fails ' + rec.fails.join(',') : ''}`);
  }
  if (errors.length) console.log('ERRORS', errors.slice(0, 3));
  await browser.close();
}

const { browser: b0, page: p0 } = await openGame(url);
let ids = await p0.evaluate(() => CAMPAIGN_MISSIONS.filter(m => m.id !== 'M00').map(m => m.id));
await b0.close();
if (process.argv[4] && process.argv[4].includes(',')) ids = process.argv[4].split(',');
else if (process.argv[4]) { const a = ids.indexOf(process.argv[4]), z = process.argv[5] ? ids.indexOf(process.argv[5]) : ids.length - 1; ids = ids.slice(a, z + 1); }
const results = {};
const chunks = Array.from({ length: WORKERS }, (_, i) => ids.filter((_, k) => k % WORKERS === i));
await Promise.all(chunks.map(c => worker(c, results)));
server.close();
const file = path.join(OUT, 'calibration.json');
const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
Object.assign(prev, results);
fs.writeFileSync(file, JSON.stringify(prev, null, 1));
const table = Object.keys(prev).sort((a, b) => +a.slice(1) - +b.slice(1)).filter(id => prev[id].median != null)
  .map(id => `${id}: [${Math.round(prev[id].median)}, ${Math.round(prev[id].p90)}]`).join(', ');
console.log('\nconst MISSION_BOT_TIME = { ' + table + ' };');
const bad = Object.values(results).filter(r => r.clears < r.runs);
console.log(`\n${bad.length} missions not cleared every run:`, bad.map(r => `${r.id}(${r.clears}/${r.runs}:${r.fails.join('/')})`).join(' '));

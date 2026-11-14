// GG-UI-02 stage 2 (a report, not a test): what the menu screens cost on the
// base revision and on this checkout -- the same profile, the same actions,
// the two builds measured alternately in every repetition on one machine.
//   node design/ui2/tools/ui2-bench.mjs --base=DIR [--reps=5] [--frames=iphone,cg,qhd]
// DIR = a checkout of the base (e.g. `git worktree add DIR 1395c18`).
// Measured (wall time of the action + the two frames that show it; median):
//   Miasto opened, Dzielnice opened, all 12 districts switched, the mission
//   list scrolled (10 steps, total and the slowest step), Warsztat opened, the
//   four categories switched twice, an Arena result shown, a reward card shown;
//   and the idle frame interval of Miasto / Dzielnice / Warsztat (their canvas
//   loop), the number of animated canvases and their pixels in Warsztat.
// Headless Chromium renders in software: the numbers compare the two builds,
// they are not a phone's. Output: design/ui2/bench.json + a table.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, openGame, frozenDateScript, QA_RANDOM } from '../../../qa/lib.mjs';
import { VP, FROZEN_ISO, buildProfile } from './ui2-scenes.mjs';

const UI2 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opt = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const BASE = opt('base', '');
if (!BASE || !fs.existsSync(path.join(BASE, 'game.js'))) { console.error('usage: node design/ui2/tools/ui2-bench.mjs --base=DIR (a checkout of the base revision)'); process.exit(2); }
const REPS = Number(opt('reps', 5));
const FRAMES = opt('frames', 'iphone,cg,qhd').split(',');

const MEASURE = async () => {
  const gm = window.game, q = (s) => document.querySelector(s);
  const frames = (n) => new Promise(res => { let i = 0; const f = () => (++i >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  const timed = async (fn) => { const t0 = performance.now(); await fn(); void document.body.offsetHeight; await frames(2); return performance.now() - t0; };
  const idle = async (n = 40) => { await frames(3); const t0 = performance.now(); await frames(n); return (performance.now() - t0) / n; };
  const settle = () => new Promise(res => setTimeout(res, 450));
  const out = {};
  gm.unlockQueue = []; clearTimeout(gm.loginPopupTimer);
  out.openMiasto = await timed(() => { gm.showScreen('mainMenu'); gm.updateCoinDisplays(); }); await settle();
  out.idleMiasto = await idle();
  out.openDzielnice = await timed(() => gm.openCampaignScreen()); await settle();
  out.idleDzielnice = await idle();
  const ids = gm.save.campaign.unlockedDistricts.slice();
  out.switch12Districts = await timed(async () => { for (const id of DISTRICTS.map(d => d.id)) { if (ids.includes(id)) gm.selectCampaignDistrict(id); void document.body.offsetHeight; } });
  // the mission list, scrolled in ten steps
  const sc = (() => { for (let a = q('#missionList'); a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a); if (/auto|scroll/.test(cs.overflowY) && a.scrollHeight > a.clientHeight + 1) return a; } return null; })();
  if (sc) { const steps = []; const max = sc.scrollHeight - sc.clientHeight; for (let i = 1; i <= 10; i++) steps.push(await timed(() => { sc.scrollTop = max * i / 10; })); sc.scrollTop = 0; out.scrollMissions = steps.reduce((a, b) => a + b, 0); out.scrollMissionsWorst = Math.max(...steps); }
  out.openWarsztat = await timed(() => gm.openWarsztatScreen()); await settle();
  out.idleWarsztat = await idle();
  out.switchCategories8 = await timed(async () => { for (let k = 0; k < 2; k++) for (const id of ['tabAuras', 'tabEffects', 'tabOverdrive', 'tabSkins']) { document.getElementById(id).click(); void document.body.offsetHeight; await frames(1); } });
  const cvs = [...document.querySelectorAll('#shopScreen canvas')].filter(c => c.offsetParent);
  out.warsztatCanvases = cvs.length; out.warsztatCanvasPx = cvs.reduce((a, c) => a + c.width * c.height, 0);
  out.domNodes = document.getElementsByTagName('*').length;
  // an Arena result (the round is staged, not played) and a reward card
  out.showResult = await timed(() => { gm.checkEvolutionTriggers = () => {}; gm.startRound({ seed: 777 }); cancelAnimationFrame(gm.rafId); gm.player.score = 4200; gm.endRound(); });
  await new Promise(res => setTimeout(res, 1600));
  gm.unlockQueue = []; clearTimeout(gm.unlockShowTimer); q('#unlockOverlay').classList.add('hidden');
  out.idleResult = await idle(30);
  gm.showScreen('mainMenu'); await settle();
  out.showRewardCard = await timed(() => { gm.queueRewardCelebration({ kicker: 'ODBLOKOWANO!', eyebrow: 'NAGRODA CORE CITY · LVL 4', title: 'Efekt „Pikselowy Wybuch”', color: '#46D99A', icon: '', desc: 'Test.' }); });
  await new Promise(res => setTimeout(res, 900));
  gm.unlockQueue = []; clearTimeout(gm.unlockShowTimer); q('#unlockOverlay').classList.add('hidden');
  return out;
};

async function once(url, vp) {
  const g = await openGame(url, { viewport: { width: vp.width, height: vp.height }, mobile: vp.mobile, deviceScaleFactor: vp.mobile ? 2 : 1, initScript: frozenDateScript(FROZEN_ISO) + QA_RANDOM });
  const save = await g.page.evaluate(buildProfile, 'mid');
  // every district open, so that all twelve can be switched
  await g.page.evaluate((s) => { s.campaign.unlockedDistricts = DISTRICTS.map(d => d.id); localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)); }, save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
  await g.page.evaluate(() => { window.__qaSeedRandom(11); window.game.applyGfx(2); });
  await g.page.waitForTimeout(900);
  const m = await g.page.evaluate(MEASURE);
  const errors = g.errors.slice();
  await g.browser.close();
  return { m, errors };
}

const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const A = await serve({ root: path.resolve(BASE) }), B = await serve();
const report = { reps: REPS, base: path.resolve(BASE), frames: {} };
let errs = 0;
for (const f of FRAMES) {
  const vp = VP[f], runs = { base: [], cand: [] };
  for (let r = 0; r < REPS; r++) {
    // alternate the order too, so neither build always runs on a warmer machine
    for (const k of r % 2 ? ['cand', 'base'] : ['base', 'cand']) { const x = await once(k === 'base' ? A.url : B.url, vp); runs[k].push(x.m); errs += x.errors.length; if (x.errors.length) console.log('ERRORS', k, f, x.errors.slice(0, 2)); }
  }
  const keys = Object.keys(runs.cand[0]);
  const row = {};
  for (const k of keys) { const b = median(runs.base.map(x => x[k]).filter(v => v != null)), c = median(runs.cand.map(x => x[k]).filter(v => v != null)); row[k] = { base: +b.toFixed(2), cand: +c.toFixed(2), delta: +(c - b).toFixed(2), ratio: b ? +(c / b).toFixed(2) : null }; }
  report.frames[f] = { label: vp.label, row };
  console.log(`\n${vp.label}  (median of ${REPS}; ms unless noted)`);
  console.log('  ' + 'measure'.padEnd(22) + 'base'.padStart(11) + 'candidate'.padStart(11) + 'delta'.padStart(10) + '  ratio');
  for (const k of keys) console.log('  ' + k.padEnd(22) + String(row[k].base).padStart(11) + String(row[k].cand).padStart(11) + String(row[k].delta).padStart(10) + '  ' + (row[k].ratio == null ? '' : row[k].ratio));
}
A.server.close(); B.server.close();
fs.writeFileSync(path.join(UI2, 'bench.json'), JSON.stringify(report, null, 1));
console.log(errs ? `\ndone with ${errs} page error(s)` : '\ndone, no page errors');
process.exit(errs ? 1 : 0);

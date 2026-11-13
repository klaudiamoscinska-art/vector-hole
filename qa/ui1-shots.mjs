// GG-UI-01 stage 2 evidence (not a test, not part of the game): the eight
// approved stage-1 frames, staged the same way -- seeded Math.random, a
// virtual clock, the game's own startRound() / startCampaignMission() /
// startDailyChallenge(), the same greedy bot -- on ANY checkout of the game:
//   node qa/ui1-shots.mjs --label=before --root=<base checkout>
//   node qa/ui1-shots.mjs --label=prod
//   node qa/ui1-shots.mjs --extra        (the four acceptance fixes, 320 / 360 px phones)
// Output: design/ui1/prod/<scene>-<label>.jpg, a 1:1 minimap crop, and
// facts-<label>.json (time, score, tier, camera, zoom, a hash of every
// hole and object, the number of random draws, and the SHA-256 of the
// frame with every HUD layer off). `--compare` then checks the two fact
// files: the world, the camera and the random stream must be identical --
// only the interface's pixels may differ. Exit 1 on a difference or a
// console error.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { serve, openGame, allDistrictsSave, frozenDateScript, QA_RANDOM, ROOT } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', 'design', 'ui1', 'prod');
const opt = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const ONLY = opt('only', '').split(',').filter(Boolean);
const LABEL = opt('label', 'prod');
const GAME_ROOT = path.resolve(opt('root', ROOT));

const PHONE = { width: 390, height: 844, mobile: true };
const CG = { width: 800, height: 450, mobile: false };
const DESK = { width: 1366, height: 768, mobile: false };
/** The stage-1 scenes (same ids, seeds, bot times). */
export const SCENES = [
  { id: 's1-arena-early', title: 'Arena · telefon · wczesna faza', vp: PHONE, spec: { mode: 'arena', seed: 4242, secs: 14, skill: 1 } },
  { id: 's2-arena-late', title: 'Arena · telefon · późna faza', vp: PHONE, spec: { mode: 'arena', seed: 4242, secs: 104, skill: 0.72 } },
  { id: 's3-campaign', title: 'Kampania · M24 (boss)', vp: PHONE, spec: { mode: 'campaign', mission: 'M24', secs: 52, nela: true } },
  { id: 's4-daily', title: 'Wyzwanie dnia · telefon', vp: PHONE, spec: { mode: 'daily', secs: 46, skill: 0.5 } },
  { id: 's5-crazygames', title: 'CrazyGames 800×450 · Arena', vp: CG, spec: { mode: 'arena', seed: 4242, secs: 52, skill: 0.6 } },
  { id: 's5b-crazygames-campaign', title: 'CrazyGames 800×450 · Kampania', vp: CG, spec: { mode: 'campaign', mission: 'M24', secs: 52 } },
  { id: 's6-desktop', title: 'Desktop 1366×768 · Arena', vp: DESK, spec: { mode: 'arena', seed: 4242, secs: 70, skill: 0.6 } },
  { id: 's8-friend', title: 'Wyzwanie znajomego · telefon', vp: PHONE, spec: { mode: 'arena', seed: 777, secs: 30, skill: 0.5, challenge: { score: 1500, from: 'Maja' } } }
];

/** Candidate-only evidence (`--extra`): the four acceptance fixes and the
 *  small phones. `tweak` runs in the page on the staged frame. */
const P320 = { width: 320, height: 568, mobile: true }, P360 = { width: 360, height: 800, mobile: true };
const TWEAKS = {
  // a combo, the friend target and SZAŁ under the clock; the game's own banner
  banner: () => { const g = window.game; g.comboCount = 7; g.comboMultiplier = 1.7; g.comboTimer = 1.2; g.comboDisplayAlpha = 1; g.banner = null; g.showBanner('AWANS NA 3. MIEJSCE', null, '#EFCB63', 0.9, 1); g.banner.life = g.banner.maxLife * 0.6; for (let i = 0; i < 14; i++) { window.__vnow += 16; window.__ui1Draw(); } },
  // the vortex as large as the mission's T6, in the middle of the board
  bigVortex: () => { const g = window.game, b = CONFIG.campaign.bounds; g.player.x = (b.minX + b.maxX) / 2; g.player.y = (b.minY + b.maxY) / 2; g.player.radius = 150; g.followCamera(b.minX, b.minY, b.maxX, b.maxY); g.comboCount = 5; g.comboMultiplier = 1.5; g.comboTimer = 1; g.comboDisplayAlpha = 1; },
  place3: () => { const g = window.game; g.bots.forEach((b, i) => { b.score = 4200 - i * 520; }); g.player.score = g.bots[1].score - 14; g.updateHUD(); },
  lit: () => { window.game.mission.def.setup.dark = false; }
};
export const EXTRA = [
  { id: 'f1-daily-en-320', title: 'Poprawka 1 · DAILY CHALLENGE · EN · 320×568', vp: P320, locale: 'en-US', tweak: 'place3', spec: { mode: 'daily', secs: 24, skill: 0.5 } },
  { id: 'f1-daily-en-390', title: 'Poprawka 1 · DAILY CHALLENGE · EN · 390×844', vp: PHONE, locale: 'en-US', tweak: 'place3', spec: { mode: 'daily', secs: 24, skill: 0.5 } },
  { id: 'f1-daily-pl-320', title: 'Poprawka 1 · WYZWANIE DNIA · PL · 320×568', vp: P320, tweak: 'place3', spec: { mode: 'daily', secs: 24, skill: 0.5 } },
  { id: 'f1-daily-en-cg', title: 'Poprawka 1 · DAILY CHALLENGE · EN · 800×450', vp: CG, locale: 'en-US', tweak: 'place3', spec: { mode: 'daily', secs: 24, skill: 0.5 } },
  { id: 'f2-banner-cg', title: 'Poprawka 2 · awans obok combo · 800×450', vp: CG, tweak: 'banner', spec: { mode: 'arena', seed: 777, secs: 20, skill: 0.5, challenge: { score: 1500, from: 'Maja' } } },
  { id: 'f2-banner-640', title: 'Poprawka 2 · awans, combo przygasa · 640×360', vp: { width: 640, height: 360, mobile: false }, tweak: 'banner', spec: { mode: 'arena', seed: 777, secs: 20, skill: 0.5, challenge: { score: 1500, from: 'Maja' } } },
  { id: 'f2-banner-desktop', title: 'Poprawka 2 · awans · 1366×768', vp: DESK, tweak: 'banner', spec: { mode: 'arena', seed: 777, secs: 20, skill: 0.5, challenge: { score: 1500, from: 'Maja' } } },
  { id: 'f3-nela-big', title: 'Poprawka 3 · NELA przy wirze T6 · telefon', vp: PHONE, tweak: 'bigVortex', spec: { mode: 'campaign', mission: 'M24', secs: 8, nela: true } },
  { id: 'f3-nela-big-cg', title: 'Poprawka 3 · NELA przy wirze T6 · 800×450', vp: CG, tweak: 'bigVortex', spec: { mode: 'campaign', mission: 'M24', secs: 8, nela: true } },
  { id: 'f3-nela-big-320', title: 'Poprawka 3 · NELA przy wirze T6 · 320×568', vp: P320, tweak: 'bigVortex', spec: { mode: 'campaign', mission: 'M24', secs: 8, nela: true } },
  { id: 'f4-dark', title: 'Poprawka 4 · misja z ciemnością (M15) · minimapa 1:1', vp: PHONE, spec: { mode: 'campaign', mission: 'M15', secs: 12 } },
  { id: 'f4-dark-lit', title: 'Poprawka 4 · ta sama plansza przy świetle (tylko test)', vp: PHONE, tweak: 'lit', spec: { mode: 'campaign', mission: 'M15', secs: 12 } },
  { id: 'p320-arena', title: 'Telefon 320×568 · Arena', vp: P320, spec: { mode: 'arena', seed: 4242, secs: 30, skill: 0.8 } },
  { id: 'p320-campaign', title: 'Telefon 320×568 · Kampania', vp: P320, spec: { mode: 'campaign', mission: 'M24', secs: 30, nela: true } },
  { id: 'p360-arena', title: 'Telefon 360×800 · Arena', vp: P360, spec: { mode: 'arena', seed: 4242, secs: 30, skill: 0.8 } },
  { id: 'p360-campaign', title: 'Telefon 360×800 · Kampania', vp: P360, spec: { mode: 'campaign', mission: 'M24', secs: 30, nela: true } }
];

/** Stages the scene in the page and stops on one frame (stage 1's own routine). Returns its facts. */
export async function stage(page, spec) {
  return page.evaluate(async (spec) => {
    const g = window.game, dt = 1 / 30;
    window.__vnow = 700000;
    performance.now = () => window.__vnow;
    window.__qaSeedRandom(11);
    g.applyGfx(2);
    const campaign = spec.mode === 'campaign';
    if (campaign) { g.missionBoosters = []; g.startCampaignMission(spec.mission); if (g.introPending) g.beginMissionPlay(); }
    else if (spec.mode === 'daily') g.startDailyChallenge();
    else g.startRound({ seed: spec.seed, challenge: spec.challenge || undefined });
    if (g.rafId) cancelAnimationFrame(g.rafId);
    g.running = false;
    const p = g.player;
    const frames = Math.round(spec.secs / dt);
    for (let f = 0; f < frames; f++) {
      if (g.evolutionPending) { g.skipEvolutionOffer(); }
      if (campaign && g.introPending) g.beginMissionPlay();
      if (g.revivePending) g.declineRevive();
      if (campaign && (g.mission.ended || g.mission.finishing)) break;
      let tx = 0, ty = 0, bs = -1;
      const consider = (x, y, v) => { const d = Math.hypot(x - p.x, y - p.y); const s = (v + 2) / (d + 40); if (s > bs) { bs = s; tx = x - p.x; ty = y - p.y; } };
      if (campaign) {
        const tier = g.campaignTierIndex(g.campaignPlayerTier().id);
        const goal = g.campaignGoalEntityTypes();
        for (const e of g.campaignEntities) {
          if (e.consumed || e.eating || !e.live || e.type === 'gate') continue;
          if ((e.type === 'node' || e.type === 'pylon') && !e.active) continue;
          if (e.type === 'landmark' && !e.unlocked) continue;
          if (tier < e.stats.minTier) continue;
          consider(e.x, e.y, goal.has(e.type) ? 12 : 3);
        }
      } else {
        for (const o of g.objects) { if (o.eating || !g.holeCanEat(p, o)) continue; consider(o.x, o.y, o.value); }
      }
      for (const b of g.bots) {
        const d = Math.hypot(b.x - p.x, b.y - p.y);
        if (b.radius > p.radius * 1.08 && d < b.radius + 190) { tx = p.x - b.x; ty = p.y - b.y; break; }
      }
      const n = Math.hypot(tx, ty) || 1;
      const idle = spec.skill != null && (f % 30) >= 30 * spec.skill;
      g.keyDir = idle ? { x: 0, y: 0 } : { x: tx / n, y: ty / n };
      window.__vnow += dt * 1000;
      if (campaign) g.updateCampaign(dt); else g.update(dt);
      if (f % 6 === 0) { if (campaign) g.renderCampaign(window.__vnow / 1000); else g.render(window.__vnow / 1000); }
    }
    if (spec.nela && g.mission) {
      const d = g.mission.def;
      const line = typeof d.nela === 'string' ? d.nela : (d.nela && (d.nela.start || d.nela.intro || Object.values(d.nela)[0])) || null;
      if (line && g.showNelaToast) g.showNelaToast(line);
      window.__nelaLine = line;
    }
    g.shake = 0; g.flashAlpha = 0;
    window.__ui1Draw = () => { g.shake = 0; if (campaign) g.renderCampaign(window.__vnow / 1000); else g.render(window.__vnow / 1000); };
    // (NELA's bubble is added on the next animation frame; the HUD boxes are re-read every 20 frames)
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    for (let k = 0; k < 44; k++) { window.__vnow += 1; window.__ui1Draw(); }
    const holes = [p, ...g.bots];
    const pos = holes.map(h => [h.x.toFixed(2), h.y.toFixed(2), h.radius.toFixed(2), h.score].join(',')).join(';');
    const objs = campaign ? g.campaignEntities.filter(e => e.live && !e.consumed).map(e => `${e.type}:${e.x.toFixed(1)},${e.y.toFixed(1)}`).join(';')
      : g.objects.map(o => `${o.tier}:${o.x.toFixed(1)},${o.y.toFixed(1)}`).join(';');
    let hh = 0; for (const ch of pos + '|' + objs) hh = (Math.imul(hh, 31) + ch.charCodeAt(0)) >>> 0;
    const m = g.mission;
    return {
      mode: g.mode, daily: !!g.isDailyRun, challenge: g.challenge ? { score: g.challenge.score, from: g.challenge.from } : null,
      seed: campaign ? null : g.runSeed, mission: campaign ? m.def.id : null,
      time: campaign ? formatClock(m.timeRemaining) : formatClock(g.timeRemaining),
      score: p.score, radius: +p.radius.toFixed(3),
      tier: document.getElementById('missionTierBadge').textContent,
      growth: campaign ? m.growthUnits : null,
      rank: campaign ? null : document.getElementById('rankValue').textContent,
      camera: [+g.camera.x.toFixed(3), +g.camera.y.toFixed(3)], zoom: +g.zoom.toFixed(5),
      layout: g.layout, uiScale: g.uiScale, width: g.width, height: g.height, dpr: g.dpr,
      minimap: g.showMinimap ? Object.assign({ size: g.minimapSize() }, g.minimapRect()) : null,
      combo: g.comboCount, banner: g.banner ? g.banner.text : null,
      goals: campaign ? g.campaignGoalItems().map(it => `${it.label} ${it.display || Math.min(it.progress, it.target) + '/' + it.target}`) : null,
      nela: window.__nelaLine || null,
      holes: holes.length, objects: campaign ? g.campaignEntities.length : g.objects.length,
      stateHash: hh.toString(16), randomCalls: window.__qaRandomCalls
    };
  }, spec);
}

/** Every HUD layer off, in either version of the game: the DOM HUD hidden,
 *  the screen-space canvas widgets and the centre banner not drawn. */
const PLATE = `(on) => {
  const g = window.game;
  const names = ['drawMinimap', 'drawCampaignMinimap', 'drawComboHud', 'drawChallengeTarget', 'drawHudStack', 'drawFrenzyVignette', 'drawGoldenIndicator', 'drawCampaignGoalArrow']; // (the edge arrows slide out of the HUD panels: edgeMarkerPos())
  if (on) { names.forEach(n => { g[n] = () => 0; }); window.__banner = g.banner; g.banner = null; document.getElementById('hud').style.visibility = 'hidden'; }
  else { names.forEach(n => { delete g[n]; }); g.banner = window.__banner; document.getElementById('hud').style.visibility = ''; }
  window.__ui1Draw();
}`;

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
export async function openScene(url, vp, locale = 'pl-PL') {
  const g = await openGame(url, { viewport: { width: vp.width, height: vp.height }, mobile: vp.mobile, deviceScaleFactor: 2, locale, initScript: `${frozenDateScript('2026-11-10')}\n${QA_RANDOM}` });
  const save = await allDistrictsSave(g.page);
  save.selected = 'cyan';
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
  return g;
}

function compare() {
  const a = JSON.parse(fs.readFileSync(path.join(OUT, 'facts-before.json'), 'utf8')), b = JSON.parse(fs.readFileSync(path.join(OUT, 'facts-prod.json'), 'utf8'));
  const KEYS = ['mode', 'daily', 'seed', 'mission', 'time', 'score', 'radius', 'tier', 'growth', 'rank', 'camera', 'zoom', 'layout', 'uiScale', 'minimap', 'combo', 'banner', 'goals', 'holes', 'objects', 'stateHash', 'randomCalls', 'plate'];
  let bad = 0;
  for (const id of Object.keys(a)) {
    const diff = KEYS.filter(k => JSON.stringify(a[id][k]) !== JSON.stringify((b[id] || {})[k]));
    console.log(`${diff.length ? 'FAIL' : 'PASS'} ${id}: ${diff.length ? 'differs in ' + diff.join(', ') : `world, camera, score ${a[id].score}, ${a[id].time}, ${a[id].tier}, ${a[id].randomCalls} random draws and the HUD-less frame ${a[id].plate.slice(0, 12)} identical`}`);
    if (diff.length) bad++;
  }
  process.exit(bad ? 1 : 0);
}

async function run() {
  if (process.argv.includes('--compare')) return compare();
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve({ root: GAME_ROOT });
  const factsFile = path.join(OUT, process.argv.includes('--extra') ? 'facts-extra.json' : `facts-${LABEL}.json`);
  const facts = fs.existsSync(factsFile) && ONLY.length ? JSON.parse(fs.readFileSync(factsFile, 'utf8')) : {};
  let failed = false;
  const extra = process.argv.includes('--extra');
  for (const sc of extra ? EXTRA : SCENES) {
    if (ONLY.length && !ONLY.includes(sc.id)) continue;
    const g = await openScene(server.url, sc.vp, sc.locale || 'pl-PL');
    const f = await stage(g.page, sc.spec);
    if (sc.tweak) {
      await g.page.evaluate(`(${TWEAKS[sc.tweak]})()`);
      if (sc.spec.nela) await g.page.evaluate(() => new Promise(r => { window.game.showNelaToast(window.__nelaLine); requestAnimationFrame(() => requestAnimationFrame(r)); }));
      await g.page.evaluate(() => { for (let k = 0; k < 44; k++) { window.__vnow += 1; window.__ui1Draw(); } });
    }
    await g.page.evaluate(() => document.fonts.ready);
    await g.page.waitForTimeout(450);          // CSS transitions settle (the frame itself is frozen)
    await g.page.evaluate(() => window.__ui1Draw());
    await g.page.screenshot({ path: path.join(OUT, `${sc.id}-${LABEL}.jpg`), type: 'jpeg', quality: 90 });
    if (f.minimap) {
      const pad = 26, mm = f.minimap;
      await g.page.screenshot({ path: path.join(OUT, `${sc.id}-minimap-${LABEL}.png`), type: 'png', clip: { x: Math.max(0, mm.l - pad), y: Math.max(0, mm.t - pad), width: Math.min(mm.size + pad * 2, sc.vp.width - Math.max(0, mm.l - pad)), height: Math.min(mm.size + pad * 2, sc.vp.height - Math.max(0, mm.t - pad)) } });
    }
    await g.page.evaluate(`(${PLATE})(true)`);
    f.plate = sha(await g.page.screenshot({ type: 'png' }));
    await g.page.evaluate(`(${PLATE})(false)`);
    facts[sc.id] = { title: sc.title, viewport: `${sc.vp.width}x${sc.vp.height}`, ...f, errors: g.errors.slice() };
    if (g.errors.length) failed = true;
    console.log(`SHOT ${sc.id} ${sc.vp.width}x${sc.vp.height} · ${f.mode}${f.daily ? '/daily' : ''} · ${f.time} · ${f.score} pkt · ${f.tier} · rank ${f.rank} · combo ${f.combo} · banner ${f.banner} · errors ${g.errors.length}${g.errors.length ? '\n  ' + g.errors.join('\n  ') : ''}`);
    await g.browser.close();
  }
  fs.writeFileSync(factsFile, JSON.stringify(facts, null, 1));
  server.server.close();
  process.exit(failed ? 1 : 0);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();

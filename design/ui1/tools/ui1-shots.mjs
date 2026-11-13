// GG-UI-01 stage 1 evidence, not a test and not part of the game: real
// frames of the current game with three UI layers over the SAME frame --
//   before  the game's own HUD, untouched;
//   a / b   the proposed HUD (design/ui1/variants/*): a stylesheet added to
//           the test page plus per-instance overrides of the screen-space
//           canvas widgets (minimap, combo, challenge target). Nothing in
//           game.js / style.css / index.html is edited;
//   plate   the same frame with every UI layer off (taken once per variant;
//           the three plates must be byte-identical -- the identity check).
// A scene is staged once per page: seeded Math.random, a virtual clock, the
// game's own startRound()/startCampaignMission()/startDailyChallenge(), a
// greedy bot for N frames, then the loop is stopped and the same frozen
// frame is redrawn under each layer.
//   node design/ui1/tools/ui1-shots.mjs [--only=id,id] [--layers=before,a,b]
// Output: design/ui1/shots/<scene>-<layer>.jpg, minimap crops, facts.json.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { serve, openGame, allDistrictsSave, frozenDateScript, QA_RANDOM, ROOT } from '../../../qa/lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UI1 = path.resolve(HERE, '..');
const SHOTS = path.join(UI1, 'shots');
const opt = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const ONLY = opt('only', '').split(',').filter(Boolean);
const LAYERS = opt('layers', 'before,a,b').split(',');
const DRY = process.argv.includes('--dry');   // facts only (tuning a scene)

const PHONE = { width: 390, height: 844, mobile: true };
const CG = { width: 800, height: 450, mobile: false };
const DESK = { width: 1366, height: 768, mobile: false };
/** id, title, viewport, spec. `secs` = how long the bot plays before the frame. */
export const SCENES = [
  { id: 's1-arena-early', title: 'Arena · telefon · wczesna faza', vp: PHONE, spec: { mode: 'arena', seed: 4242, secs: +opt('t1', 14), skill: +opt('k1', 1) } },
  { id: 's2-arena-late', title: 'Arena · telefon · późna faza', vp: PHONE, spec: { mode: 'arena', seed: 4242, secs: +opt('t2', 104), skill: +opt('k2', 0.72) } },
  { id: 's3-campaign', title: 'Kampania · misja z bossem', vp: PHONE, spec: { mode: 'campaign', mission: opt('mission', 'M24'), secs: +opt('csecs', 52), nela: true } },
  { id: 's4-daily', title: 'Wyzwanie dnia · telefon', vp: PHONE, spec: { mode: 'daily', secs: +opt('t4', 46), skill: +opt('k4', 0.5) } },
  { id: 's5-crazygames', title: 'CrazyGames 800×450 · Arena', vp: CG, spec: { mode: 'arena', seed: 4242, secs: +opt('t5', 52), skill: +opt('k5', 0.6) } },
  { id: 's5b-crazygames-campaign', title: 'CrazyGames 800×450 · Kampania', vp: CG, spec: { mode: 'campaign', mission: opt('mission', 'M24'), secs: +opt('csecs', 52) } },
  { id: 's6-desktop', title: 'Desktop 1366×768 · Arena', vp: DESK, spec: { mode: 'arena', seed: 4242, secs: +opt('t6', 70), skill: +opt('k6', 0.6) } },
  { id: 's8-friend', title: 'Wyzwanie znajomego · telefon', vp: PHONE, spec: { mode: 'arena', seed: 777, secs: +opt('t8', 30), skill: +opt('k8', 0.5), challenge: { score: 1500, from: 'Maja' } } }
];

/** Stages the scene in the page and stops on one frame. Returns its facts. */
async function stage(page, spec) {
  return page.evaluate(async (spec) => {
    const g = window.game, dt = 1 / 30;
    window.__realNow = window.__realNow || performance.now.bind(performance);
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
      // Greedy steer: the best eatable thing nearby; away from a bigger rival close by.
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
      // skill < 1: a slower player -- steers only that share of every second.
      const idle = spec.skill != null && (f % 30) >= 30 * spec.skill;
      g.keyDir = idle ? { x: 0, y: 0 } : { x: tx / n, y: ty / n };
      window.__vnow += dt * 1000;
      if (campaign) g.updateCampaign(dt); else g.update(dt);
      if (f % 6 === 0) { if (campaign) g.renderCampaign(window.__vnow / 1000); else g.render(window.__vnow / 1000); }
    }
    if (spec.nela && g.mission) {
      // The mission's own NELA line (its intro text), shown by the game's own toast.
      const d = g.mission.def;
      const line = typeof d.nela === 'string' ? d.nela : (d.nela && (d.nela.start || d.nela.intro || Object.values(d.nela)[0])) || null;
      if (line && g.showNelaToast) g.showNelaToast(line);
      window.__nelaLine = line;
    }
    g.shake = 0; g.flashAlpha = 0;
    window.__ui1Draw = () => { g.shake = 0; if (campaign) g.renderCampaign(window.__vnow / 1000); else g.render(window.__vnow / 1000); };
    for (let k = 0; k < 6; k++) window.__ui1Draw();
    const holes = [p, ...g.bots];
    const pos = holes.map(h => [h.x.toFixed(2), h.y.toFixed(2), h.radius.toFixed(2), h.score].join(',')).join(';');
    const objs = campaign ? g.campaignEntities.filter(e => e.live && !e.consumed).map(e => `${e.type}:${e.x.toFixed(1)},${e.y.toFixed(1)}`).join(';')
      : g.objects.map(o => `${o.tier}:${o.x.toFixed(1)},${o.y.toFixed(1)}`).join(';');
    let hh = 0; for (const ch of pos + '|' + objs) hh = (Math.imul(hh, 31) + ch.charCodeAt(0)) >>> 0;
    const m = g.mission;
    return {
      mode: g.mode, daily: !!g.isDailyRun, challenge: g.challenge ? { score: g.challenge.score, from: g.challenge.from } : null,
      seed: campaign ? null : g.runSeed, mission: campaign ? m.def.id : null, missionName: campaign ? m.def.name : null,
      time: campaign ? formatClock(m.timeRemaining) : formatClock(g.timeRemaining),
      score: p.score, radius: +p.radius.toFixed(3),
      tier: document.getElementById('missionTierBadge').textContent, tierPct: document.getElementById('missionTierBar').style.width,
      rank: campaign ? null : document.getElementById('rankValue').textContent,
      camera: [+g.camera.x.toFixed(3), +g.camera.y.toFixed(3)], zoom: +g.zoom.toFixed(5),
      layout: g.layout, uiScale: g.uiScale, width: g.width, height: g.height, dpr: g.dpr,
      minimap: g.showMinimap ? Object.assign({ size: g.minimapSize() }, g.minimapRect()) : null,
      combo: g.comboCount, banner: g.banner ? g.banner.text : null,
      goals: campaign ? g.campaignGoalItems().map(it => `${it.label} ${it.display || Math.min(it.progress, it.target) + '/' + it.target}`) : null,
      nela: window.__nelaLine || null,
      holes: holes.length, objects: campaign ? g.campaignEntities.length : g.objects.length,
      stateHash: hh.toString(16), randomCalls: window.__qaRandomCalls, vnow: window.__vnow
    };
  }, spec);
}

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

async function run() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = await serve({ root: ROOT });
  const variantJs = fs.existsSync(path.join(UI1, 'variants', 'variant.js')) ? fs.readFileSync(path.join(UI1, 'variants', 'variant.js'), 'utf8') : null;
  const css = (n) => ['base', n].map(x => fs.readFileSync(path.join(UI1, 'variants', `${x}.css`), 'utf8')).join('\n');
  // The street grid and the district map, read from game.js (module-scoped there, not on the QA bridge).
  const src = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
  const num = (n) => +src.match(new RegExp(`^const ${n} = ([\\d.]+)`, 'm'))[1];
  const city = {
    pitch: num('CITY_PITCH'), road: num('CITY_ROAD'),
    map: JSON.parse(src.match(/^const CITY_DISTRICT_MAP = (\[[^\]]+\]);/m)[1].replace(/'/g, '"')),
    keys: JSON.parse(src.match(/^const CITY_DISTRICT_KEYS = (\{[^}]+\});/m)[1].replace(/'/g, '"').replace(/(\w+):/g, '"$1":'))
  };
  city.cells = city.map.length;
  const factsFile = path.join(UI1, 'facts.json');
  const facts = fs.existsSync(factsFile) && ONLY.length ? JSON.parse(fs.readFileSync(factsFile, 'utf8')) : {};
  let failed = false;
  for (const sc of SCENES) {
    if (ONLY.length && !ONLY.includes(sc.id)) continue;
    const g = await openGame(server.url, { viewport: { width: sc.vp.width, height: sc.vp.height }, mobile: sc.vp.mobile, deviceScaleFactor: 2, initScript: `${frozenDateScript('2026-11-10')}\n${QA_RANDOM}` });
    const save = await allDistrictsSave(g.page);
    save.selected = 'cyan';
    await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
    await g.page.reload();
    await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
    const f = await stage(g.page, sc.spec);
    await g.page.evaluate(() => document.fonts.ready);
    if (variantJs) { await g.page.evaluate((c) => { window.__ui1City = c; }, city); await g.page.addScriptTag({ content: variantJs }); }
    const plates = {}, boxes = {};
    for (const layer of DRY ? [] : LAYERS) {
      if (layer !== 'before' && !variantJs) continue;
      await g.page.evaluate(({ layer, css }) => {
        if (window.__ui1Apply) window.__ui1Apply(layer, css);
        window.__ui1Draw();
      }, { layer, css: layer === 'before' ? '' : css(layer) });
      await g.page.waitForTimeout(450);          // CSS transitions settle (the frame itself is frozen)
      await g.page.evaluate(() => window.__ui1Draw());
      if (variantJs) {
        const bx = await g.page.evaluate(() => window.__ui1Boxes());
        // The game's canvas-drawn combo / challenge plates (fixed boxes in drawComboHud() / drawChallengeTarget()).
        if (layer === 'before' && f.combo >= 2) bx.push({ name: 'combo', w: 150, h: 62, x: 8, y: 58 });
        if (layer === 'before' && f.challenge) bx.push({ name: 'challenge', w: 158, h: 40, x: 8, y: 128 });
        boxes[layer] = { panels: bx, area: Math.round(bx.reduce((a, b) => a + b.w * b.h, 0)), pct: +(bx.reduce((a, b) => a + b.w * b.h, 0) / (sc.vp.width * sc.vp.height) * 100).toFixed(2) };
      }
      await g.page.screenshot({ path: path.join(SHOTS, `${sc.id}-${layer}.jpg`), type: 'jpeg', quality: 90 });
      if (f.minimap) {
        const pad = 26, mm = f.minimap;
        await g.page.screenshot({ path: path.join(SHOTS, `${sc.id}-minimap-${layer}.png`), type: 'png', clip: { x: Math.max(0, mm.l - pad), y: Math.max(0, mm.t - pad), width: Math.min(mm.size + pad * 2, sc.vp.width - Math.max(0, mm.l - pad)), height: Math.min(mm.size + pad * 2, sc.vp.height - Math.max(0, mm.t - pad)) } });
      }
      // The plate: this layer's page with every UI layer off.
      if (variantJs) {
        await g.page.evaluate(() => { window.__ui1Plate(true); window.__ui1Draw(); });
        const buf = await g.page.screenshot({ type: 'png' });
        plates[layer] = sha(buf);
        if (layer === 'before') fs.writeFileSync(path.join(SHOTS, `${sc.id}-plate.png`), buf);
        await g.page.evaluate(() => { window.__ui1Plate(false); window.__ui1Draw(); });
      }
    }
    const after = await g.page.evaluate(() => ({ randomCalls: window.__qaRandomCalls, vnow: window.__vnow, score: window.game.player.score, x: window.game.player.x }));
    const same = Object.values(plates).length === LAYERS.length && new Set(Object.values(plates)).size === 1 && after.randomCalls === f.randomCalls && after.vnow === f.vnow && after.score === f.score;
    if (variantJs && !same) failed = true;
    facts[sc.id] = { title: sc.title, viewport: `${sc.vp.width}x${sc.vp.height}`, ...f, plates, boxes, identical: variantJs ? same : null, errors: g.errors.slice() };
    if (g.errors.length) failed = true;
    console.log(`${variantJs ? (same ? 'PASS' : 'FAIL') : 'SHOT'} ${sc.id} ${sc.vp.width}x${sc.vp.height} · ${f.mode}${f.daily ? '/daily' : ''} · ${f.time} · ${f.score} pkt · ${f.tier} ${f.tierPct} · rank ${f.rank} · combo ${f.combo} · banner ${f.banner} · errors ${g.errors.length}${g.errors.length ? '\n  ' + g.errors.join('\n  ') : ''}`);
    if (f.goals) console.log('   goals: ' + f.goals.join(' | ') + ' · nela: ' + f.nela);
    await g.browser.close();
  }
  fs.writeFileSync(factsFile, JSON.stringify(facts, null, 1));
  server.server.close();
  process.exit(failed ? 1 : 0);
}
run();

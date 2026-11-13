// GG-VFX-01 evidence, not a test: swallows BEFORE / AFTER, staged in a real
// round and drawn by the game's own render() / renderCampaign() (never a
// mock-up), into qa/out/vfx1/:
//   strips  -- consecutive frames of one swallow per weight (a small, a
//              medium and a large object, a boss landmark, a rival): contact
//              with the rim, the fall, the fade, the vortex's answer;
//   skins   -- the same large swallow by every skin (AFTER only);
//   q0      -- the strips on quality 0 (AFTER only);
//   anim    -- every frame of those swallows as sprite sheets (what the
//              preview page built by qa/vfx1-publish.mjs plays);
//   shots   -- whole screens mid-swallow: Arena, a campaign mission, the
//              Daily Challenge and a rival, on a phone (390x844), the
//              CrazyGames frame (800x450) and a desktop (1366x768).
// Each staged swallow also records the score, the radius, the frames the
// eat took and the Math.random() draws -- facts-<name>.json; with --root the
// two are compared (the stage must not move a thing).
// BEFORE = another checkout (--root DIR, e.g. a worktree of origin/main),
// AFTER = this one.   node qa/vfx1-shots.mjs --root /path/to/base [--only=strips,skins,q0,anim,shots]
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, allDistrictsSave, frozenDateScript, QA_RANDOM, ROOT, OUT, isMain } from './lib.mjs';

const SKIN_IDS = ['rainbow', 'cyan', 'pink', 'green', 'purple', 'gold', 'white', 'aurora', 'krysztal', 'pryzmat'];
const opt = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); if (a) return a.slice(k.length + 3); const i = process.argv.indexOf(`--${k}`); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const DIR = path.join(OUT, 'vfx1');
const ONLY = (opt('only', 'strips,skins,q0,anim,shots')).split(',');
export const FRAMES = { iphone: { width: 390, height: 844, mobile: true }, crazygames: { width: 800, height: 450, mobile: false }, desktop: { width: 1366, height: 768, mobile: false } };

/** One staged swallow: [id, label, spec]. `pick`: an Arena object's look, a
 *  campaign entity type, 'landmark' (the mission's boss) or 'rival'. */
export const SWALLOWS = [
  ['small-kapsula', 'mały · kapsuła (T1)', { mode: 'arena', skin: 'cyan', R: 30, pick: 'kapsula', tier: 'capsule' }],
  ['small-drzewo', 'mały · drzewo (T2)', { mode: 'arena', skin: 'cyan', R: 52, pick: 'drzewo', tier: 'prop' }],
  ['medium-samochod', 'średni · samochód (T3)', { mode: 'arena', skin: 'purple', R: 70, pick: 'samochod', tier: 'vehicle' }],
  ['medium-pawilon', 'średni · pawilon (T4)', { mode: 'arena', skin: 'purple', R: 100, pick: 'pawilon', tier: 'structure' }],
  ['large-autobus', 'duży · autobus (T5)', { mode: 'arena', skin: 'pink', R: 135, pick: 'autobus', tier: 'heavy' }],
  ['large-wiezowiec', 'duży · wieżowiec (T6)', { mode: 'arena', skin: 'rainbow', R: 170, pick: 'wiezowiec', tier: 'tower' }],
  ['boss-landmark', 'boss dzielnicy (Kampania M20)', { mode: 'campaign', mission: 'M20', skin: 'gold', pick: 'landmark' }],
  ['rival', 'rywal', { mode: 'arena', skin: 'krysztal', R: 90, pick: 'rival', rivalR: 48 }]
];
// Frames (1/60 s apart) drawn into a strip: contact, the fall, the answer.
const STRIP_FRAMES = [1, 4, 7, 10, 13, 16, 19, 23, 28, 36];
const STRIP_FRAMES_SLOW = [1, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 68];   // a boss (0.8 s) and a rival (0.45 s)

/** Stages `spec` in the page, steps the game frame by frame on a virtual
 *  clock and draws the frames in `frames` (or every frame up to `all`) side
 *  by side. Returns the sheet as a data URL and what the swallow did. */
export async function stage(page, spec, { frames = null, all = 0, cell = 220, mime = 'image/png' } = {}) {
  return page.evaluate(async ({ spec, frames, all, cell, mime }) => {
    const g = window.game, dt = 1 / 60;
    const real = window.__realNow || (window.__realNow = performance.now.bind(performance));
    window.__vnow = 700000;
    performance.now = () => window.__vnow;
    window.__qaSeedRandom(11);
    g.applyGfx(spec.gfx == null ? 2 : spec.gfx);
    const campaign = spec.mode === 'campaign';
    if (campaign) { g.missionBoosters = []; g.startCampaignMission(spec.mission); if (g.introPending) g.beginMissionPlay(); }
    else if (spec.mode === 'daily') g.startDailyChallenge();
    else g.startRound({ seed: 4242 });
    if (g.rafId) cancelAnimationFrame(g.rafId);
    g.running = false;
    g.checkEvolutionTriggers = () => {};
    const p = g.player;
    p.skin = spec.skin;
    const step = () => { window.__vnow += dt * 1000; if (campaign) g.updateCampaign(dt); else g.update(dt); };
    const draw = () => (campaign ? g.renderCampaign(window.__vnow / 1000) : g.render(window.__vnow / 1000));
    const quiet = () => { g.banner = null; g.bannerQueue = []; g.floatTexts = []; g.scorePop = null; };
    let target = null, R = spec.R;
    if (campaign) {
      const m = g.mission;
      target = g.campaignEntities.find(e => e.live !== false && !e.consumed && (spec.pick === 'landmark' ? e.type === 'landmark' : e.type === spec.pick));
      if (!target) return { error: 'no ' + spec.pick + ' in ' + spec.mission };
      if (target.type === 'landmark') target.unlocked = true;
      // Grow along the mission's own curve until the target can be eaten.
      const need = target.stats.minTier;
      for (let u = 0; u < 4000 && g.campaignTierIndex(g.campaignPlayerTier().id) < need; u += 5) { m.growthUnits += 5; g.syncCampaignRadius(); }
      m.growthUnits += 30; g.syncCampaignRadius();
      m.timeRemaining = Math.max(m.timeRemaining, 60);
      R = p.radius;
      for (const e of g.campaignEntities) if (e !== target && Math.hypot(e.x - target.x, e.y - target.y) < R * 3 + 200) { e.live = false; }
      for (const b of g.bots) { b.x = target.x + 1500; b.y = target.y + 1500; }
      p.x = target.x - (R * 0.8 + 60); p.y = target.y;
    } else {
      p.x = WORLD_W / 2; p.y = WORLD_H / 2;
      p.radius = R;
      if (spec.pick === 'rival') {
        target = g.bots[0];
      } else {
        target = g.objects.find(o => o.subtype === spec.pick);
        if (!target) { target = g.objects.find(o => o.tier === 'fragment'); target.respawn(spec.tier, false); target.subtype = spec.pick; target.spawnFlash = 0; }
        while (!g.holeCanEat(p, target) && p.radius < 400) p.radius += 4;
        R = p.radius;
      }
      // An empty neighbourhood: only the staged thing is eaten.
      let n = 0;
      for (const o of g.objects) if (o !== target && Math.hypot(o.x - p.x, o.y - p.y) < R * 2 + 700) { o.x = 60 + (n % 40) * 30; o.y = 60 + Math.floor(n / 40) * 30; n++; }
      g.bots.forEach((b, i) => { b.x = 200 + i * 90; b.y = WORLD_H - 200; b.invulnerableUntil = 0; });
      target.x = p.x + 3000 > WORLD_W ? p.x - 900 : p.x + 900; target.y = p.y;
      if (spec.pick === 'rival') { target.radius = spec.rivalR; target.x = p.x + 700; }
    }
    g.keyDir = { x: 0, y: 0 };
    const hold = () => { if (!campaign) { p.x = WORLD_W / 2; p.y = WORLD_H / 2; p.radius = R; if (spec.pick === 'rival') { target.radius = spec.rivalR; target.x = p.x + 700; target.y = p.y; } g.bots.forEach((b, i) => { if (b !== target) { b.x = 200 + i * 90; b.y = WORLD_H - 200; } }); } };
    for (let k = 0; k < 150; k++) { hold(); step(); }
    hold(); quiet();
    g.particles = []; g.ripples = []; g.shake = 0; g.flashAlpha = 0; p.growPopAt = 0;
    for (let k = 0; k < 20; k++) draw();
    // Contact: the staged thing touches the rim on the next update.
    const a = spec.angle == null ? -0.6 : spec.angle;
    const before = { score: p.score, radius: p.radius, calls: window.__qaRandomCalls };
    if (campaign) { p.x = target.x - Math.cos(a) * R * 0.8; p.y = target.y - Math.sin(a) * R * 0.8; g.camera.x = p.x; g.camera.y = p.y; }
    else if (spec.pick === 'rival') { target.x = p.x + Math.cos(a) * R * 0.7; target.y = p.y + Math.sin(a) * R * 0.7; target.invulnerableUntil = 0; }
    else { target.x = p.x + Math.cos(a) * R * 0.8; target.y = p.y + Math.sin(a) * R * 0.8; }
    const list = frames || Array.from({ length: all }, (_, i) => i + 1);
    const last = list[list.length - 1];
    const dpr = g.dpr, half = Math.max(R * g.zoom * 1.7, 48);
    const sheet = document.createElement('canvas');
    sheet.width = cell * list.length; sheet.height = cell;
    const sc = sheet.getContext('2d');
    let eatFrames = 0, ate = false, col = 0;
    const eating = () => spec.pick === 'rival' ? g.swallowGhosts.length > 0 : target.eating && !(target.consumed === true || (target.eatT >= 1));
    for (let f = 1; f <= last; f++) {
      step(); quiet();
      if (eating()) { eatFrames++; ate = true; }
      if (list.includes(f)) {
        draw();
        const sx = (g.width / 2 + (p.x - g.camera.x) * g.zoom - half) * dpr, sy = (g.height / 2 + (p.y - g.camera.y) * g.zoom - half) * dpr;
        sc.drawImage(g.canvas, sx, sy, half * 2 * dpr, half * 2 * dpr, col * cell, 0, cell, cell);
        col++;
      }
    }
    performance.now = real;
    delete g.checkEvolutionTriggers;
    return {
      url: sheet.toDataURL(mime, 0.86), frames: list.length, cell,
      facts: { ate, eatFrames, scoreGain: p.score - before.score, radiusAfter: +p.radius.toFixed(4), randomCalls: window.__qaRandomCalls - before.calls, gfx: g.gfxLevel, zoom: +g.zoom.toFixed(3) }
    };
  }, { spec, frames, all, cell, mime });
}

const save64 = (file, url) => fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));

export async function open(root, viewport = { width: 800, height: 600 }, mobile = false) {
  const server = await serve({ root });
  const g = await openGame(server.url, { viewport, mobile, initScript: `${frozenDateScript('2026-11-10')}\n${QA_RANDOM}` });
  const save = await allDistrictsSave(g.page);
  save.owned = SKIN_IDS; save.selected = 'purple';
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
  return { ...g, server, close: async () => { await g.browser.close(); server.server.close(); } };
}

async function strips(root, name) {
  const g = await open(root);
  const facts = {};
  const run = async (id, spec, o, file) => {
    const r = await stage(g.page, spec, o);
    if (r.error) { console.log(`  ${id}: ${r.error}`); return null; }
    save64(path.join(DIR, file), r.url);
    return r;
  };
  for (const [id, , spec] of SWALLOWS) {
    const slow = spec.pick === 'landmark' || spec.pick === 'rival';
    if (ONLY.includes('strips')) { const r = await run(id, spec, { frames: slow ? STRIP_FRAMES_SLOW : STRIP_FRAMES }, `strip-${id}-${name}.png`); if (r) facts[id] = r.facts; }
    if (ONLY.includes('q0') && name === 'after') { const r = await run(id, { ...spec, gfx: 0 }, { frames: slow ? STRIP_FRAMES_SLOW : STRIP_FRAMES }, `strip-q0-${id}-${name}.png`); if (r) facts['q0:' + id] = r.facts; }
    if (ONLY.includes('anim')) {
      const n = slow ? 72 : 44;
      const r = await run(id, spec, { all: n, cell: 150, mime: 'image/jpeg' }, `anim-${id}-${name}.jpg`);
      if (r) facts['anim:' + id] = { frames: r.frames, cell: r.cell };
    }
  }
  if (ONLY.includes('skins') && name === 'after') {
    for (const skin of SKIN_IDS) {
      await run('skin-' + skin, { mode: 'arena', skin, R: 135, pick: 'autobus', tier: 'heavy' }, { frames: [4, 10, 16, 19, 23, 28, 36] }, `skin-${skin}-${name}.png`);
      await run('skin-rival-' + skin, { mode: 'arena', skin, R: 90, pick: 'rival', rivalR: 48 }, { frames: [6, 14, 22, 28, 32, 40, 50] }, `skin-rival-${skin}-${name}.png`);
    }
  }
  const errors = g.errors.slice();
  await g.close();
  if (Object.keys(facts).length) fs.writeFileSync(path.join(DIR, `facts-${name}.json`), JSON.stringify(facts, null, 1));
  return errors;
}

/** Whole screens: the swallow as the player sees it, HUD included. */
const SHOTS = [
  ['arena-large', { mode: 'arena', skin: 'pink', R: 135, pick: 'autobus', tier: 'heavy' }, [9, 20]],
  ['arena-small', { mode: 'arena', skin: 'cyan', R: 30, pick: 'kapsula', tier: 'capsule' }, [9]],
  ['arena-rival', { mode: 'arena', skin: 'krysztal', R: 90, pick: 'rival', rivalR: 48 }, [14, 30]],
  ['campaign-boss', { mode: 'campaign', mission: 'M20', skin: 'gold', pick: 'landmark' }, [24, 52]],
  ['campaign-vehicle', { mode: 'campaign', mission: 'M12', skin: 'purple', pick: 'vehicle' }, [9, 20]],
  ['daily-medium', { mode: 'daily', skin: 'green', R: 100, pick: 'pawilon', tier: 'structure' }, [9, 20]]
];

async function shots(root, name) {
  const errors = [];
  for (const [frame, vp] of Object.entries(FRAMES)) {
    const g = await open(root, { width: vp.width, height: vp.height }, vp.mobile);
    for (const [id, spec, at] of SHOTS) {
      for (const f of at) {
        // The same staged swallow, stopped at frame f (the page keeps the frame it drew last).
        const r = await stage(g.page, spec, { frames: [f], cell: 8 });
        if (r.error) { console.log(`  ${id}@${frame}: ${r.error}`); continue; }
        await g.page.screenshot({ path: path.join(DIR, `shot-${id}-f${f}-${frame}-${name}.jpg`), type: 'jpeg', quality: 84 });
      }
    }
    errors.push(...g.errors.map(e => `${frame}: ${e}`));
    await g.close();
  }
  return errors;
}

if (isMain(import.meta.url)) {
  fs.mkdirSync(DIR, { recursive: true });
  const base = opt('root', null);
  const variants = [['after', ROOT]].concat(base ? [['before', path.resolve(base)]] : []);
  let failed = false;
  for (const [name, root] of variants) {
    const errors = [];
    if (ONLY.some(o => ['strips', 'skins', 'q0', 'anim'].includes(o))) errors.push(...await strips(root, name));
    if (ONLY.includes('shots')) errors.push(...await shots(root, name));
    console.log(`${name}: ${errors.length ? 'console errors:\n  ' + errors.join('\n  ') : 'no console errors'}`);
    if (errors.length) failed = true;
  }
  if (ONLY.includes('strips') && fs.existsSync(path.join(DIR, 'facts-before.json')) && fs.existsSync(path.join(DIR, 'facts-after.json'))) {
    // The swallow itself must not move: same frames, score, radius and Math.random() draws.
    const [a, b] = ['after', 'before'].map(n => JSON.parse(fs.readFileSync(path.join(DIR, `facts-${n}.json`), 'utf8')));
    for (const [id] of SWALLOWS) {
      if (!a[id] || !b[id]) { console.log(`NOT RUN ${id}`); failed = true; continue; }
      const same = ['ate', 'eatFrames', 'scoreGain', 'radiusAfter', 'randomCalls'].every(k => a[id][k] === b[id][k]) && a[id].ate;
      if (!same) failed = true;
      console.log(`${same ? 'PASS' : 'FAIL'} ${id}: eat ${b[id].eatFrames} -> ${a[id].eatFrames} frames · score +${b[id].scoreGain} -> +${a[id].scoreGain} · radius ${b[id].radiusAfter} -> ${a[id].radiusAfter} · Math.random ${b[id].randomCalls} -> ${a[id].randomCalls}`);
    }
  }
  console.log('written to ' + DIR);
  process.exit(failed ? 1 : 0);
}

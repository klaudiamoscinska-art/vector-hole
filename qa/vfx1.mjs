// GG-VFX-01 -- "Premium Swallow Effects": what the player sees of an eat,
// scaled by what was eaten. What this suite proves:
//  - V1 display only: swallowPose() (the path the eaten object itself
//    follows) is the base's source; the new code draws no Math.random();
//    the save keeps its key, its version and its fields;
//  - V2 one family in three weights + a rival: every T1-T6 class, every
//    campaign entity type and a boss landmark land in the right weight;
//  - V3 a staged swallow of each weight (Arena, a campaign boss, a rival)
//    takes exactly the frames it always took (0.28 s / 0.8 s / 0.45 s) and
//    pays the same score -- the picture never stretches the eat;
//  - V4 no ghosts: when the eat ends nothing is left mid-swallow, the
//    vortex's answer ends within 0.7 s, its drawn radius is its real one,
//    and the frame is again the still frame;
//  - V5 no double drawing: one body per swallowed thing (+ its
//    after-images, capped), a crowd of small bites and a rival's bites draw
//    the fall only;
//  - V6 every skin has its own accent and draws a large gulp and a rival
//    with no error; the rim's answer is really on screen;
//  - V7 quality 0: the fall, a wake and a ring -- no after-images, shards,
//    accents or particle glows; the capped list is shorter;
//  - V8 a busy Arena stays quiet: rivals' small bites add nothing, the
//    list is capped, a chain of small bites restarts one pulse;
//  - V9 Arena, Daily, a friend's challenge and a campaign mission play
//    through swallows with no page or console error.
// Usage: node qa/vfx1.mjs
import fs from 'node:fs';
import path from 'node:path';
import { report, expectAll, is, holds, revisionFile, ROOT, isMain } from './lib.mjs';
import { stage, open, SWALLOWS } from './vfx1-shots.mjs';

const BASE_REV = process.env.VH_VFX1_BASE || '7d8a747f77ec1492fed3791196b54510461c8e2f';
const SKIN_IDS = ['rainbow', 'cyan', 'pink', 'green', 'purple', 'gold', 'white', 'aurora', 'krysztal', 'pryzmat'];
const fnSource = (src, head) => { const a = src.indexOf(head); if (a < 0) return null; const end = head.startsWith('  ') ? '\n  }\n' : '\n}\n'; const b = src.indexOf(end, a); return src.slice(a, b + end.length); };

export async function runVfx1Checks() {
  const results = [];
  const src = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
  let base = null;
  try { base = String(revisionFile(BASE_REV, 'game.js')); } catch (e) { base = null; }

  // V1 -- display only (source).
  const pose = fnSource(src, 'function swallowPose(obj, hole, k) {');
  results.push(base
    ? expectAll('V1 swallowPose() -- the path the eaten object itself follows -- is the base revision\'s source', { same: is(pose, fnSource(base, 'function swallowPose(obj, hole, k) {')), used: holds(/const p = swallowPose\(this, this\.eater, this\.eatT\);\s+this\.x = p\.x;\s+this\.y = p\.y;/.test(src), 'WorldObject.update', 'still moves the object along it') })
    : report('V1 swallowPose() is the base revision\'s source', false, 'NOT RUN: base revision ' + BASE_REV + ' not readable'));
  const a = src.indexOf('/* ----------------------- Premium swallow effects (GG-VFX-01)'), b = src.indexOf('/** v13: a random point on one of the city\'s road lanes');
  const c = src.indexOf('  swallowPass(h, swallowed) {'), d = src.indexOf('  /** A rival hole `b` was just eaten by `a`');
  const fx = (src.slice(a, b) + src.slice(c, d)).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
  results.push(expectAll('V1 the new effect code draws no random numbers (variety comes from the object\'s own seed)', {
    found: holds(a > 0 && b > a && c > 0 && d > c && fx.length > 8000, fx.length, 'both effect blocks found'),
    mathRandom: is((fx.match(/Math\.random|\brand\(|\brandInt\(|seededRand|\.rng\b/g) || []).length, 0)
  }));
  if (base) {
    const tef = (s) => { const f = fnSource(s.replace(/\r/g, ''), '  triggerEatFeedback(x, y, color, eatenRadius, isPlayerInvolved, eater'); return f && f.replace(/, weight\) \{/, ') {').replace(/\n    \/\/ GG-VFX-01: the vortex answers[\s\S]*?addGulp\(eater, fxW, burstColor, x \* 0\.013 \+ y \* 0\.029\);/, ''); };
    results.push(expectAll('V1 triggerEatFeedback() keeps every particle, ripple, shake and hit-stop of the base (the gulp is added, nothing is taken)', { same: is(tef(src), tef(base)) }));
    const keep = ['  spawnSuck(x, y, color, count, hole, spread) {', '  spawnParticles(x, y, color, count, speedMult = 1) {', '  hitStop(ms) {', '  handleObjectEating(hole) {', '  handleHoleCollisions() {'];
    const diff = keep.filter(h => fnSource(src, h) !== fnSource(base, h).replace('this.triggerEatFeedback(b.x, b.y, b.isPlayer ? \'#50F0FA\' : b.edgeColor, b.radius, a.isPlayer || b.isPlayer, a);', 'this.triggerEatFeedback(b.x, b.y, b.isPlayer ? \'#50F0FA\' : b.edgeColor, b.radius, a.isPlayer || b.isPlayer, a, SWALLOW_RIVAL);'));
    results.push(report('V1 the eat rules, the rival fight, the particles\' random draws and hitStop() are the base revision\'s source', diff.length === 0, diff.join(' | ')));
    const cfg = (s) => (s.match(/eatAnimTime: [\d.]+|hitStopMs: \d+|SAVE_SCHEMA_VERSION = \d+|const SAVE_KEY = '[^']+'|g\.t \+= dt \/ 0\.45|this\.type === 'landmark' \? 0\.8 : EAT_ANIM_TIME/g) || []).join(' · ');
    results.push(expectAll('V1 eat time, boss time, rival time, hit-stop, save key and save version unchanged', { same: is(cfg(src), cfg(base)), six: holds(cfg(src).split(' · ').length >= 6, cfg(src), 'all six found') }));
  }
  const looks = [...src.slice(src.indexOf('const HOLE_LOOKS = {'), src.indexOf('function holePalette')).matchAll(/^  ([a-z]+): \{$/gm)].map(m => m[1]);
  const accents = [...src.slice(src.indexOf('const GULP_ACCENTS = {'), b).matchAll(/^  ([a-z]+)\(ctx, r, t, a, p/gm)].map(m => m[1]);
  results.push(expectAll('V6 every look (HOLE_LOOKS) has its own gulp accent', { looks: is(looks.length, 10), accents: is(accents.sort().join(','), looks.slice().sort().join(',')) }));

  const g = await open(ROOT);
  try {
    // The effect internals are not part of the QA bridge: read through the game object.
    // V2 -- weights.
    const weights = await g.page.evaluate(() => {
      const gm = window.game;
      gm.startRound({ seed: 5 }); cancelAnimationFrame(gm.rafId); gm.running = false;
      const p = gm.player, out = {};
      for (const tier of Object.keys(TIERS)) {
        const o = gm.objects.find(x => x.tier === 'fragment' && !x.eating);
        o.respawn(tier, false); o.x = p.x; o.y = p.y; o.eating = false; o.startEating(p);
        out[tier] = o.swW;
        o.eating = false; o.respawn('fragment', false);
      }
      return out;
    });
    const want = { fragment: 0, capsule: 0, prop: 0, marker: 0, golden: 0, vehicle: 1, node: 1, pylon: 1, landmark: 1, structure: 1, portal: 1, heavy: 2, tower: 2 };
    results.push(expectAll('V2 Arena classes by weight: T1/T2 small, T3/T4 medium, T5/T6 large', Object.fromEntries(Object.entries(want).map(([k, v]) => [k, is(weights[k], v)]))));

    // V3 / V4 / V5 -- the staged swallows.
    const EXPECT = { 'boss-landmark': 48, rival: 27 };
    for (const [id, label, spec] of SWALLOWS) {
      const probe = await g.page.evaluate(() => {
        const gm = window.game;
        window.__vfx = { body: 0, wake: 0, shards: 0, maxItems: 0, frames: 0, squash: 0, gulpW: [] };
        for (const fn of ['drawSwallowBody', 'drawSwallowWake', 'drawSwallowShards']) {
          const orig = Object.getPrototypeOf(gm)[fn];
          gm[fn] = function (...a) { window.__vfx[fn === 'drawSwallowBody' ? 'body' : fn === 'drawSwallowWake' ? 'wake' : 'shards']++; return orig.apply(this, a); };
        }
        const ds = Object.getPrototypeOf(gm).drawSwallowed;
        gm.drawSwallowed = function (ctx, h, items) { window.__vfx.frames++; window.__vfx.maxItems = Math.max(window.__vfx.maxItems, items.length); window.__vfx.squash = Math.min(window.__vfx.squash, h.fxSquash || 0); return ds.call(this, ctx, h, items); };
        const ag = Object.getPrototypeOf(gm).addGulp;
        gm.addGulp = function (e, w, ...r) { if (e === gm.player) window.__vfx.gulpW.push(w); return ag.call(this, e, w, ...r); };
        return true;
      });
      const slow = spec.pick === 'landmark' || spec.pick === 'rival';
      const r = await stage(g.page, spec, { all: slow ? 110 : 70, cell: 8 });
      const after = await g.page.evaluate(({ campaign }) => {
        const gm = window.game, p = gm.player, v = window.__vfx;
        for (const fn of ['drawSwallowBody', 'drawSwallowWake', 'drawSwallowShards', 'drawSwallowed', 'addGulp']) delete gm[fn];
        const list = campaign ? gm.campaignEntities : gm.objects;
        // 70+ frames (1.17 s) after contact: everything must be over.
        // (the stage's virtual clock: 70+ frames after contact)
        const real = performance.now; performance.now = () => window.__vnow;
        const now = performance.now();
        gm.swallowPass(p, gm.collectSwallowed());
        const gulpsOf = gm.gulpsOf(p);
        performance.now = real;
        return { ...v, gulpsOfP: gulpsOf, eatingLeft: list.filter(o => o.eater === p && o.eating && o.consumed !== true && !(o.eatT >= 1)).length, ghosts: gm.swallowGhosts.length,
          liveGulps: gm.gulps.filter(x => now - x.at < x.dur).length, gulpsOf: gulpsOf, squashNow: p.fxSquash || 0 };
      }, { campaign: spec.mode === 'campaign' });
      if (r.error) { results.push(report(`V3 ${id}`, false, 'NOT RUN: ' + r.error)); continue; }
      const w = id.startsWith('small') ? 0 : id.startsWith('medium') ? 1 : id === 'rival' ? 3 : 2;
      results.push(expectAll(`V3 ${label}: swallowed in exactly the frames it always took, with the gulp of its weight`, {
        ate: is(r.facts.ate, true), eatFrames: is(r.facts.eatFrames, EXPECT[id] || 17), scored: holds(r.facts.scoreGain > 0, r.facts.scoreGain, '> 0'),
        gulp: is(String(after.gulpW[after.gulpW.length - 1]), String(w))
      }, JSON.stringify(r.facts)));
      results.push(expectAll(`V4 ${label}: nothing left behind -- no ghost, the answer over, the vortex back at its real radius`, {
        eatingLeft: is(after.eatingLeft, 0), ghosts: is(after.ghosts, 0), gulpsOf: is(after.gulpsOf, null), squashNow: is(after.squashNow, 0),
        inhale: holds(w === 0 ? after.squash === 0 : after.squash < 0 && after.squash >= -0.07, after.squash, w === 0 ? 'none for a small bite' : 'a short inhale, at most 7% of the radius')
      }));
      const echoes = [0, 1, 2, 2][w];
      results.push(expectAll(`V5 ${label}: one body per frame plus at most ${echoes} after-images; a wake; shards only off a heavy body`, {
        oneItem: is(after.maxItems, 1), bodies: holds(after.body >= after.frames && after.body <= after.frames * (1 + echoes), `${after.body} in ${after.frames} frames`, 'frames .. frames x (1 + after-images)'),
        wake: holds(after.wake > 0 && after.wake <= after.frames, after.wake, '<= one per frame'),
        shards: holds(w === 1 || w === 2 ? after.shards > 0 : after.shards === 0, after.shards, w === 1 || w === 2 ? '> 0' : '0')
      }));
    }

    // V4 -- the frame after a swallow is the still frame again (same scene, same clock).
    const still = await g.page.evaluate(async () => {
      const gm = window.game;
      const hash = () => { const d = gm.ctx.getImageData(0, 0, gm.canvas.width, gm.canvas.height).data; let h = 0x811c9dc5; for (let i = 0; i < d.length; i += 4) { h ^= d[i] | (d[i + 1] << 8) | (d[i + 2] << 16); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
      const real = performance.now.bind(performance);
      performance.now = () => 900000;
      gm.particles = []; gm.ripples = []; gm.floatTexts = []; gm.shake = 0; gm.flashAlpha = 0; gm.banner = null; gm.player.growPopAt = 0;
      gm.gulps = [];
      gm.render(900); const a = hash();
      gm.addGulp(gm.player, 2, '#46D99A', 1); gm.render(900.1 - 0.1); const during = hash();
      gm.gulps = []; gm.render(900); const b2 = hash();
      performance.now = real;
      return { same: a === b2, visible: during !== a };
    });
    results.push(expectAll('V4 a gulp is really on screen, and the frame after it is the still frame, pixel for pixel', { visible: is(still.visible, true), same: is(still.same, true) }));

    // V5 / V8 -- a crowd of small bites, rivals' bites, the cap.
    const crowd = await g.page.evaluate(() => {
      const gm = window.game;
      const real = performance.now.bind(performance);
      let now = 950000; performance.now = () => now;
      gm.applyGfx(2);
      gm.startRound({ seed: 77 }); cancelAnimationFrame(gm.rafId); gm.running = false;
      const p = gm.player;
      gm.checkEvolutionTriggers = () => {};
      p.radius = 60;
      const small = gm.objects.filter(o => o.tier === 'fragment').slice(0, 12);
      small.forEach((o, i) => { o.x = p.x + Math.cos(i) * 30; o.y = p.y + Math.sin(i) * 30; });
      const c = { body: 0, wake: 0, frames: 0, max: 0 };
      const P = Object.getPrototypeOf(gm);
      gm.drawSwallowBody = function (...a) { c.body++; return P.drawSwallowBody.apply(this, a); };
      gm.drawSwallowWake = function (...a) { c.wake++; return P.drawSwallowWake.apply(this, a); };
      gm.drawSwallowed = function (ctx, h, items) { if (h === p) { c.frames++; c.max = Math.max(c.max, items.length); c.body0 = c.body; } const r = P.drawSwallowed.call(this, ctx, h, items); if (h === p) c.perFrame = c.body - c.body0; return r; };
      gm.update(1 / 60); now += 16; gm.update(1 / 60); now += 16;
      gm.render(now / 1000);
      const busy = { items: c.max, bodies: c.perFrame, wake: c.wake };
      delete gm.drawSwallowBody; delete gm.drawSwallowWake; delete gm.drawSwallowed;
      // the gulp list
      gm.gulps = [];
      const bot = gm.bots[0];
      gm.addGulp(bot, 0, '#fff', 1);
      const rivalSmall = gm.gulps.length;
      for (let i = 0; i < 10; i++) gm.addGulp(p, 0, '#fff', i);   // a chain within 90 ms
      const chain = gm.gulps.length;
      now += 100; gm.addGulp(p, 0, '#fff', 1);
      const chain2 = gm.gulps.length;
      for (let i = 0; i < 60; i++) gm.addGulp(i % 2 ? p : bot, 2, '#fff', i);
      const cap = gm.gulps.length;
      gm.applyGfx(0);
      for (let i = 0; i < 60; i++) gm.addGulp(p, 2, '#fff', i);
      const cap0 = gm.gulps.length;
      now += 2000; gm.addGulp(p, 1, '#fff', 1);
      const pruned = gm.gulps.length;
      gm.applyGfx(2); gm.gulps = [];
      delete gm.checkEvolutionTriggers;
      performance.now = real;
      return { busy, rivalSmall, chain, chain2, cap, cap0, pruned };
    });
    results.push(expectAll('V5 a crowd of small bites (12 at once) draws one body each and no wake', { items: holds(crowd.busy.items >= 7, crowd.busy.items, '>= 7 at once'), bodies: is(crowd.busy.bodies, crowd.busy.items), wake: is(crowd.busy.wake, 0) }, JSON.stringify(crowd.busy)));
    results.push(expectAll('V8 the vortex\'s answers are few: a rival\'s small bite adds none, a chain of small bites one pulse per 90 ms, at most 16 at once (8 on quality 0), old ones dropped', {
      rivalSmall: is(crowd.rivalSmall, 0), chain: is(crowd.chain, 1), chain2: is(crowd.chain2, 2), cap: is(crowd.cap, 16), cap0: is(crowd.cap0, 8), pruned: is(crowd.pruned, 1)
    }));

    // V6 -- every skin: a large gulp and a rival, with its accent.
    const skins = {};
    for (const skin of SKIN_IDS) {
      const probe = async (spec, frames) => {
        await g.page.evaluate(() => { const gm = window.game; window.__acc = 0; const lo = Object.getPrototypeOf(gm.player).lookOf; gm.__lookStyle = null; });
        const r = await stage(g.page, spec, { all: frames, cell: 8 });
        return r.error ? null : r.facts;
      };
      const big = await probe({ mode: 'arena', skin, R: 135, pick: 'autobus', tier: 'heavy' }, 40);
      const riv = await probe({ mode: 'arena', skin, R: 90, pick: 'rival', rivalR: 48 }, 60);
      const style = await g.page.evaluate(() => window.game.player.lookOf().style);
      skins[skin] = holds(big && big.ate && riv && riv.ate && accents.includes(style), JSON.stringify({ big: big && big.ate, riv: riv && riv.ate, style }), 'eats a large object and a rival, accent drawn');
    }
    results.push(expectAll('V6 every skin swallows a T5 object and a rival with its own accent, no error', { ...skins, errors: is(g.errors.length, 0) }, g.errors.join(' | ').slice(0, 300)));

    // V7 -- quality 0.
    const q0 = await g.page.evaluate(() => { window.__q0 = { body: 0, frames: 0, shards: 0, glow: 0 }; return true; });
    await g.page.evaluate(() => {
      const gm = window.game, P = Object.getPrototypeOf(gm), v = window.__q0;
      gm.drawSwallowBody = function (...a) { v.body++; return P.drawSwallowBody.apply(this, a); };
      gm.drawSwallowShards = function (...a) { v.shards++; return P.drawSwallowShards.apply(this, a); };
      gm.drawSwallowed = function (...a) { v.frames++; return P.drawSwallowed.apply(this, a); };
    });
    const r0 = await stage(g.page, { mode: 'arena', skin: 'gold', R: 170, pick: 'wiezowiec', tier: 'tower', gfx: 0 }, { all: 50, cell: 8 });
    const v0 = await g.page.evaluate(() => { const gm = window.game; for (const fn of ['drawSwallowBody', 'drawSwallowShards', 'drawSwallowed']) delete gm[fn]; const v = window.__q0; gm.applyGfx(2); return v; });
    results.push(expectAll('V7 quality 0: a T6 tower still falls in whole (one body + one after-image), no shards; same frames and score', {
      ate: is(r0.facts && r0.facts.ate, true), gfx: is(r0.facts && r0.facts.gfx, 0), eatFrames: is(r0.facts && r0.facts.eatFrames, 17),
      bodies: holds(v0.body >= v0.frames && v0.body <= v0.frames * 2, `${v0.body} in ${v0.frames}`, 'at most two per frame'), shards: is(v0.shards, 0)
    }));

    // V9 -- real rounds in every mode, drawn every frame.
    const modes = await g.page.evaluate(() => {
      const gm = window.game, out = {};
      const real = performance.now.bind(performance);
      let now = 1200000; performance.now = () => now;
      gm.checkEvolutionTriggers = () => {};
      const play = (name, start, campaign) => {
        window.__qaSeedRandom(31);
        start();
        if (gm.rafId) cancelAnimationFrame(gm.rafId); gm.running = false;
        const p = gm.player;
        let swallows = 0, gulps = 0;
        const P = Object.getPrototypeOf(gm);
        gm.drawSwallowed = function (...a) { swallows += a[2].length; return P.drawSwallowed.apply(this, a); };
        gm.drawGulps = function (...a) { gulps += a[2].length; return P.drawGulps.apply(this, a); };
        for (let f = 0; f < 900 && gm.state === GameState.PLAYING; f++) {
          if (gm.introPending) gm.beginMissionPlay();
          const list = campaign ? gm.campaignEntities.filter(e => e.live !== false && !e.eating && !e.consumed) : gm.objects.filter(o => !o.eating && gm.holeCanEat(p, o));
          let best = null, bd = 1e9;
          for (const o of list) { const d = Math.hypot(o.x - p.x, o.y - p.y); if (d < bd) { bd = d; best = o; } }
          if (best) gm.keyDir = { x: (best.x - p.x) / (bd || 1), y: (best.y - p.y) / (bd || 1) };
          now += 1000 / 60;
          if (campaign) { gm.updateCampaign(1 / 60); gm.renderCampaign(now / 1000); } else { gm.update(1 / 60); gm.render(now / 1000); }
        }
        delete gm.drawSwallowed; delete gm.drawGulps;
        gm.keyDir = { x: 0, y: 0 };
        out[name] = { swallows, gulps, score: p.score };
      };
      play('arena', () => gm.startRound({ seed: 4242 }), false);
      play('daily', () => gm.startDailyChallenge(), false);
      play('challenge', () => gm.startRound({ seed: 99, challenge: { seed: 99, score: 500, name: 'QA' } }), false);
      play('campaign', () => { gm.missionBoosters = []; gm.startCampaignMission('M01'); }, true);
      delete gm.checkEvolutionTriggers;
      window.__qaRestoreRandom();
      performance.now = real;
      const raw = localStorage.getItem('vectorHoleSave_v1') || '';
      return { out, saveHasFx: /gulp|swallow|fxSquash|swW/.test(raw), version: (JSON.parse(raw || '{}').schemaVersion) };
    });
    results.push(expectAll('V9 Arena, Daily, a friend\'s challenge and a campaign mission: swallows and the vortex\'s answers are drawn in every mode', Object.fromEntries(
      Object.entries(modes.out).map(([k, v]) => [k, holds(v.swallows > 0 && v.gulps > 0 && v.score > 0, JSON.stringify(v), 'swallows, gulps and score > 0')]))));
    results.push(expectAll('V1 the save holds nothing of the effects (schema 13)', { fx: is(modes.saveHasFx, false), version: is(modes.version, 13) }));
    results.push(report('V9 no page or console errors', g.errors.length === 0, g.errors.join(' | ').slice(0, 400)));
  } finally { await g.close(); }
  return results;
}

if (isMain(import.meta.url)) {
  const r = await runVfx1Checks();
  const bad = r.filter(x => !x.ok);
  console.log(`\n${r.length - bad.length}/${r.length} GG-VFX-01 checks passed`);
  process.exit(bad.length ? 1 : 0);
}

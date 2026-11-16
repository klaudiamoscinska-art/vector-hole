// UX-FIX-C (GG_UX_AUDIT_1, stage C): Warsztat cosmetics beyond the vortex.
// Kinds: FN = the game's own functions on a set scene (virtual clock);
// DOM = real clicks in Warsztat; FRAMES = Game.render() of one scene, the
// same frames on the base and on the candidate (--strips).
//  - T: a Smuga is a real trail -- at most AURA_TRAIL.maxPts points (never
//    more over 3000 frames), behind the vortex, fading to nothing within
//    life(r) s once it stops, restarted on a respawn / a jump (no line across
//    the map), the same at quality 0 (lite) and 2; a new round starts clean.
//  - E: each Efekt has its shape on the player's eats only; a small bite has
//    the same particle count as Klasyczny, the particle cap holds, eat time,
//    points and hit-stop are the same as with Klasyczny.
//  - F: the Finisz banner keeps its moment (12 s left), its 1.6 s and priority,
//    carries the skin's decoration; Pryzmat's color is from the palette.
//  - W: Warsztat -- the showroom card follows the open tab (name + one line on
//    what it does), each category's preview draws (Smuga moving, Efekt bite,
//    Finisz banner), browsing tabs and looking at locked items writes nothing,
//    owned / worn items unchanged; PL / EN; 375x667, 390x844, 1280x720.
//  - P: frame cost of a round with a Smuga + Efekt vs none (same scene).
//  - S: switching the previewed Efekt (GPT review of #109) -- the new Efekt's particles at once,
//    normal and reduced motion, NIE TERAZ on an Efekt not owned, back to the Efekt tab.
// Usage: node qa/uxfix-c.mjs [--only=T,E,F,W,S] [--strips --root=DIR --label=NAME]
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, veteranSave, report, isMain, OUT, ARENA_BOT, QA_RANDOM } from './lib.mjs';

const DESK = { viewport: { width: 1280, height: 720 }, mobile: false, deviceScaleFactor: 1 };
const PHONE = { viewport: { width: 375, height: 667 }, mobile: true, deviceScaleFactor: 2 };
const PHONE2 = { viewport: { width: 390, height: 844 }, mobile: true, deviceScaleFactor: 2 };
const SHOTS = path.join(OUT, 'uxfix-c');

const LIB = `
window.__uc = (function () {
  const A = {};
  const realNow = window.__realNow || (window.__realNow = performance.now.bind(performance));
  A.clockOn = () => { A.vnow = 1e6; performance.now = () => A.vnow; };
  A.clockOff = () => { performance.now = realNow; };
  A.start = (seed) => {
    const g = window.game; A.clockOn(); A.t = 0;
    g.checkEvolutionTriggers = () => {}; g.checkOverdriveTrigger = () => {};
    g.startRound({ seed: seed || 77 }); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false; g.paused = false;
    g.bots.forEach((b, i) => { b.x = 120 + i * 70; b.y = 120; b.setRadius(15); b.update = function () {}; });
    g.player.invulnerableUntil = Infinity;
    return g;
  };
  A.step = (n, dt) => { const g = window.game; dt = dt || 1 / 30; for (let i = 0; i < n && g.state === GameState.PLAYING; i++) { A.vnow += dt * 1000; A.t += dt; g.update(dt); } };
  A.frame = () => window.game.render(A.t);
  A.trail = () => { const p = window.game.player; return { n: (p.trail || []).length, pts: (p.trailOut || []).map(q => [Math.round(q.x), Math.round(q.y), +q.a.toFixed(2)]) }; };
  return A;
})();`;

async function page(url, opts, mutate) {
  const g = await openGame(url, opts);
  const s = await veteranSave(g.page, { runsPlayed: 6 });
  s.auras.owned.push('ember', 'vortex', 'impuls', 'pryzmat');
  s.effects.owned.push('pixel_burst', 'neon_rose', 'violet_rift', 'pryzmat');
  s.overdriveSkins.owned.push('fala', 'zloty_szczyt', 'zielona_burza', 'pryzmat');
  if (mutate) mutate(s);
  await g.page.evaluate((x) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(x)), s);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state === GameState.MENU);
  for (const content of [ARENA_BOT, QA_RANDOM, LIB]) await g.page.addScriptTag({ content });
  return g;
}

/* ============================ T: trails (FN) ============================ */
async function trailChecks(url) {
  const out = [];
  const g = await page(url, DESK, (s) => { s.auras.selected = 'ember'; });
  for (const gfx of [2, 0]) {
    const r = await g.page.evaluate((gfx) => {
      const A = window.__uc, g = A.start(77); g.applyGfx(gfx);
      const P = g.player; P.x = 1200; P.y = 1500; P.setRadius(40); g.pointerScreen = null;
      let maxN = 0, maxSeg = 0;
      const seg = () => { const o = P.trailOut || []; for (let i = 1; i < o.length; i++) maxSeg = Math.max(maxSeg, Math.hypot(o[i].x - o[i - 1].x, o[i].y - o[i - 1].y)); };
      // drive in a circle 100 s (3000 frames): the list never grows past maxPts
      for (let f = 0; f < 3000; f++) { const a = f / 40; g.keyDir = { x: Math.cos(a), y: Math.sin(a) }; A.step(1); if (f % 3 === 0) { A.frame(); maxN = Math.max(maxN, (P.trail || []).length); seg(); } }
      const moving = A.trail();
      // stop: within life(r) s nothing is left but the vortex itself
      g.keyDir = { x: 0, y: 0 };
      const len = () => { const o = P.trailOut || []; let s = 0; for (let i = 1; i < o.length; i++) s += Math.hypot(o[i].x - o[i - 1].x, o[i].y - o[i - 1].y); return +(s / P.radius).toFixed(2); };
      A.step(48); A.frame(); // 1.6 s > life(40) = 1.03 s (plus the vortex coasting to a stop)
      const stopped = A.trail(), stoppedLen = len();
      // respawn after being eaten: no line from the old spot
      g.keyDir = { x: 1, y: 0 }; for (let f = 0; f < 20; f++) { A.step(1); A.frame(); }
      const before = [P.x, P.y]; P.shrinkAndRespawn(0); A.step(1); A.frame(); // the camera follows, then it is drawn
      const afterRespawn = A.trail(), respawnLen = len();
      // a jump (teleport) also restarts it
      for (let f = 0; f < 20; f++) { A.step(1); A.frame(); }
      P.x = 400; P.y = 400; A.step(1); A.frame(); const afterJump = A.trail(), jumpLen = len();
      // a new round: no trail carried over
      A.start(78); A.frame(); const fresh = A.trail();
      A.clockOff(); g.applyGfx(2);
      return { maxN, maxSegOverR: +(maxSeg / 40).toFixed(2), moving: moving.n, stopped: stopped.pts.length, stoppedLen, respawnLen, jumpLen, afterRespawn: afterRespawn.pts.length, afterJump: afterJump.pts.length, fresh: fresh.pts.length, aura: P.auraId };
    }, gfx);
    out.push(report(`T1 FN quality ${gfx}: a Smuga keeps at most 14 points over 100 s of driving (no growing history), each segment short (< 1 r with a render every 3rd frame)`, r.aura === 'ember' && r.maxN <= 14 && r.moving >= 6 && r.maxSegOverR < 1, JSON.stringify(r)));
    out.push(report(`T2 FN quality ${gfx}: stopped, the trail fades to nothing within ~1.5 s; a respawn and a jump restart it (no line across the map); a new round starts clean`, r.stoppedLen < 0.3 && r.respawnLen < 0.3 && r.jumpLen < 0.3 && r.fresh <= 2, JSON.stringify(r)));
  }
  // Memory: 5000 frames of driving + rendering -> no growth in the trail or particle lists.
  const mem = await g.page.evaluate(() => {
    const A = window.__uc, g = A.start(79), P = g.player; P.setRadius(30);
    const sizes = [];
    for (let f = 0; f < 5000; f++) { const a = f / 25; g.keyDir = { x: Math.cos(a), y: Math.sin(a) }; A.step(1); if (f % 2 === 0) A.frame(); if (f % 1000 === 999) sizes.push([(P.trail || []).length, g.particles.length]); }
    A.clockOff();
    return { sizes, cap: CONFIG.juice.maxParticles };
  });
  out.push(report('T3 FN: 5000 frames of driving and rendering -- the trail list stays <= 14, particles stay under the cap (no growth)', mem.sizes.every(([t, p]) => t <= 14 && p <= mem.cap), JSON.stringify(mem)));
  out.push(report('T no page errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
  await g.browser.close();
  return out;
}

/* ============================ E: eat effects (FN) ============================ */
async function effectChecks(url) {
  const out = [];
  const g = await page(url, DESK);
  const r = await g.page.evaluate(() => {
    const res = {};
    for (const id of ['classic', 'pixel_burst', 'neon_rose', 'violet_rift', 'pryzmat']) {
      const A = window.__uc, g = A.start(81); g.save.effects.selected = id;
      const P = g.player; P.x = 1500; P.y = 1500; P.setRadius(60); g.keyDir = { x: 0, y: 0 }; g.pointerScreen = null;
      for (const o of g.objects) if (Math.hypot(o.x - 1500, o.y - 1500) < 400) { o.x = 2900; o.y = 2900; }
      A.step(20); // the size-up burst of setRadius() comes and goes first
      g.particles.length = 0;
      // a small bite (a fragment), then a big one (r > 24)
      const small = g.objects.find(o => o.tier === 'fragment'); small.x = 1500 + 42; small.y = 1500; // at the rim, where bites happen
      const seenShapes = (set) => { for (const q of g.particles) set.add(q.shape || null); };
      window.__qaSeedRandom(4242); const calls0 = window.__qaRandomCalls;
      const s0 = P.score; let f = 0, smallParts = 0; const ss = new Set(); while (P.score === s0 && f < 120) { A.step(1); f++; } for (let k = 0; k < 6; k++) { A.step(1); smallParts = Math.max(smallParts, g.particles.length); seenShapes(ss); }
      const smallShapes = [...ss];
      const smallFrames = f, smallPts = P.score - s0;
      g.particles.length = 0;
      const big = g.objects.find(o => o.radius > 24 && g.holeCanEat(P, o)); big.x = 1500 + 40; big.y = 1500;
      g.particles.length = 0; const bs = new Set(); let bigParts = 0; f = 0; const s1 = P.score; while (P.score === s1 && f < 200) { A.step(1); f++; } for (let k = 0; k < 6; k++) { A.step(1); bigParts = Math.max(bigParts, g.particles.length); seenShapes(bs); }
      const draws = window.__qaRandomCalls - calls0; window.__qaRestoreRandom();
      res[id] = { draws, smallParts, smallShapes, smallFrames, smallPts, bigParts, bigShapes: [...bs], bigFrames: f, bigPts: P.score - s1, cap: bigParts <= CONFIG.juice.maxParticles };
    }
    window.__uc.clockOff();
    return res;
  });
  const c = r.classic;
  const want = { classic: null, pixel_burst: 'pixel', neon_rose: 'petal', violet_rift: 'rift', pryzmat: 'prism' };
  // Klasyczny's small-bite streaks start at the core and vanish at once (unchanged base behaviour);
  // a shaped effect starts them at the rim, so they are seen.
  const shapesOk = Object.entries(want).every(([id, sh]) => sh === null ? r[id].smallShapes.every(x => x === null) : r[id].smallShapes.length === 1 && r[id].smallShapes[0] === sh);
  out.push(report('E1 FN: each Efekt draws its own shape on the player\'s bites, small and big (Klasyczny none, Pikselowy Wybuch pixel, Neonowa Róża petal, Fioletowa Szczelina rift, Pryzmat prism)', shapesOk && Object.entries(want).every(([id, sh]) => r[id].bigShapes.includes(sh)), JSON.stringify(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, [v.smallShapes, v.bigShapes]])))));
  out.push(report('E2 FN: a small bite spawns no more than Klasyczny\'s 6 particles for every Efekt (light); a big bite shows more; the cap holds', Object.values(r).every(v => v.smallParts <= 6 && v.cap) && Object.values(r).every(v => v.bigParts > v.smallParts), JSON.stringify(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, [v.smallParts, v.bigParts]])))));
  out.push(report('E4 FN: a bite with any Efekt draws exactly as many Math.random numbers as with Klasyczny (a cosmetic never shifts the round\'s random stream)', Object.values(r).every(v => v.draws === c.draws) && c.draws > 0, JSON.stringify(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.draws])))));
  out.push(report('E3 FN: eat time and points are the same for every Efekt as for Klasyczny (small and big bite)', Object.values(r).every(v => v.smallFrames === c.smallFrames && v.bigFrames === c.bigFrames && v.smallPts === c.smallPts && v.bigPts === c.bigPts), JSON.stringify(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, [v.smallFrames, v.bigFrames, v.smallPts, v.bigPts]])))));
  out.push(report('E no page errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
  await g.browser.close();
  return out;
}

/* ============================ F: finish banner (FN) ============================ */
async function finishChecks(url) {
  const out = [];
  const g = await page(url, DESK);
  const r = await g.page.evaluate(() => {
    const res = {};
    for (const s of OVERDRIVE_SKINS) {
      const A = window.__uc, g = A.start(91); g.save.overdriveSkins.selected = s.id;
      delete g.checkOverdriveTrigger; g.banner = null; g.bannerQueue = [];
      g.timeRemaining = CONFIG.overdrive.triggerSecondsRemaining + 0.05; A.step(1); const before = g.overdriveActive;
      A.step(2);
      const b = g.banner && g.banner.text === 'WIELKI FINISZ!' ? g.banner : (g.bannerQueue || []).find(q => q.text === 'WIELKI FINISZ!');
      A.frame();
      res[s.id] = { before, at: g.overdriveActive, left: +g.timeRemaining.toFixed(1), life: b && b.maxLife, prio: b && b.priority, color: b && b.color, deco: b ? b.deco : 'NO BANNER' };
    }
    window.__uc.clockOff();
    return res;
  });
  const palette = ['#50F0FA', '#EFCB63', '#46D99A', '#FF54AD', '#9875FF'];
  out.push(report('F1 FN: every Finisz shows "WIELKI FINISZ!" at 12 s left for 1.6 s, priority 3 (unchanged), with its decoration (Klasyczny none, Fala wave, Złoty Szczyt peaks, Zielona Burza storm, Pryzmat prism)',
    Object.values(r).every(v => !v.before && v.at && v.life === 1.6 && v.prio === 3) && r.classic.deco === null && r.fala.deco === 'wave' && r.zloty_szczyt.deco === 'peak' && r.zielona_burza.deco === 'storm' && r.pryzmat.deco === 'prism', JSON.stringify(r)));
  out.push(report('F2 FN: every Finisz color is from the palette (Pryzmat #ff00ea -> #FF54AD)', Object.values(r).every(v => palette.includes(v.color)), JSON.stringify(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.color])))));
  out.push(report('F no page errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
  await g.browser.close();
  return out;
}

/* ============================ W: Warsztat (DOM) ============================ */
async function warsztatChecks(url) {
  const out = [];
  for (const [vp, opts, lang] of [['375x667', PHONE, 'pl-PL'], ['390x844', PHONE2, 'en-US'], ['1280x720', DESK, 'pl-PL']]) {
    const g = await page(url, { ...opts, locale: lang }, (s) => { s.auras.selected = 'ember'; s.effects.selected = 'pixel_burst'; s.overdriveSkins.selected = 'zielona_burza'; s.auras.owned = s.auras.owned.filter(x => x !== 'pryzmat'); });
    const p = g.page;
    await p.evaluate(() => window.game.openWarsztatScreen());
    const stored0 = await p.evaluate(() => localStorage.getItem('vectorHoleSave_v1'));
    const seen = {};
    for (const [tab, cat] of [['tabSkins', 'skin'], ['tabAuras', 'aura'], ['tabEffects', 'effect'], ['tabOverdrive', 'overdriveSkin']]) {
      await p.click('#' + tab);
      await p.waitForTimeout(cat === 'overdriveSkin' ? 300 : 900);
      seen[cat] = await p.evaluate(async (cat) => {
        const gm = window.game, cv = document.getElementById('warsztatPreviewCanvas');
        const snap = () => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; c.getContext('2d').drawImage(cv, 0, 0, 64, 64); return c.toDataURL(); };
        const a = snap(); await new Promise(r => setTimeout(r, 450)); const b = snap();
        const hole = cv._hole;
        return { name: document.getElementById('warsztatPreviewName').textContent, label: document.querySelector('#warsztatLook .warsztat-look-label').textContent, value: document.getElementById('warsztatLookValue').textContent,
          animates: a !== b, trail: hole && hole.trailPoints ? hole.trailPoints.length : 0, parts: gm.warsztatFxBite != null ? 1 : 0, cat: gm.warsztatCat,
          clipped: (() => { const el = document.getElementById('warsztatLookValue'); return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1; })() };
      }, cat);
      if (vp !== '1280x720' || cat !== 'skin') await p.screenshot({ path: path.join(SHOTS, `w-${cat}-${vp}.png`) });
    }
    // looking at a locked item and cancelling, then leaving: nothing written, worn items unchanged
    await p.click('#tabAuras');
    const locked = await p.$('#auraGrid .skin-card.is-reward, #auraGrid .skin-card.is-short, #auraGrid .skin-card.is-buyable');
    if (locked) { await locked.click(); await p.waitForTimeout(200); }
    const looking = await p.evaluate(() => ({ focus: !!window.game.warsztatFocus, name: document.getElementById('warsztatPreviewName').textContent, trail: (document.getElementById('warsztatPreviewCanvas')._hole || {}).auraId }));
    if (looking.focus) await p.click('#btnWarsztatCancel');
    await p.evaluate(() => window.game.showScreen('mainMenu'));
    const after = await p.evaluate(() => ({ stored: localStorage.getItem('vectorHoleSave_v1'), worn: [window.game.save.auras.selected, window.game.save.effects.selected, window.game.save.overdriveSkins.selected] }));
    const want = lang === 'en-US'
      ? { aura: [null, /TRAIL/], effect: [null, /EFFECT/], overdriveSkin: [null, /FINALE/] }
      : { aura: ['Żar', /^SMUGA · /], effect: ['Pikselowy Wybuch', /^EFEKT POCHŁANIANIA · /], overdriveSkin: ['Zielona Burza', /^FINISZ · /] };
    const ok = ['aura', 'effect', 'overdriveSkin'].every(c => (!want[c][0] || seen[c].name === want[c][0]) && want[c][1].test(seen[c].label) && seen[c].value.length > 8 && seen[c].value !== '—' && !seen[c].clipped && seen[c].cat === c);
    out.push(report(`W1 DOM ${vp}${lang === 'en-US' ? ' EN' : ''}: the showroom card follows the open tab -- the worn Smuga / Efekt / Finisz by name, its category and one line on what it does (not the vortex's), nothing cut off`, ok, JSON.stringify(seen)));
    out.push(report(`W2 DOM ${vp}: each preview runs the round's code -- Smuga drives with its trail points, Efekt has its bite particles, all animate`, seen.aura.trail >= 6 && seen.effect.parts > 0 && seen.aura.animates && seen.effect.animates && seen.overdriveSkin.animates, JSON.stringify({ aura: seen.aura.trail, parts: seen.effect.parts, anim: [seen.aura.animates, seen.effect.animates, seen.overdriveSkin.animates] })));
    out.push(report(`W3 DOM ${vp}: browsing the tabs and looking at an item not owned writes nothing; worn items unchanged (ember / pixel_burst / zielona_burza)`, after.stored === stored0 && after.worn.join() === 'ember,pixel_burst,zielona_burza', JSON.stringify({ looking, worn: after.worn, same: after.stored === stored0 })));
    out.push(report(`W ${vp}: no page errors`, g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }
  // Reduced motion: the previews hold still.
  {
    const g = await openGame(url, { ...PHONE, initScript: () => { const mm = window.matchMedia.bind(window); window.matchMedia = (q) => (/prefers-reduced-motion/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q)); } });
    const s = await veteranSave(g.page, { runsPlayed: 6 }); s.auras.owned.push('ember'); s.auras.selected = 'ember';
    await g.page.evaluate((x) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(x)), s);
    await g.page.reload(); await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state === GameState.MENU);
    const r = await g.page.evaluate(async () => {
      const gm = window.game; gm.openWarsztatScreen(); document.getElementById('tabAuras').click(); await new Promise(r => setTimeout(r, 300));
      const h = document.getElementById('warsztatPreviewCanvas')._hole; const a = [h.x, h.y]; await new Promise(r => setTimeout(r, 500)); const b = [h.x, h.y];
      return { reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, still: a[0] === b[0] && a[1] === b[1], trail: h.trailPoints ? h.trailPoints.length : 0 };
    });
    out.push(report('W4 DOM reduced motion: the Smuga preview holds still (its trail still shown)', r.reduced && r.still && r.trail >= 6, JSON.stringify(r)));
    await g.browser.close();
  }
  return out;
}

/* ============================ S: switching the previewed Efekt (DOM) ============================
   GPT review of PR #109: drawPreviewEatFx() kept the particles of the previous Efekt until its
   next 1.6 s bite -- the label named the new item while the preview still showed the old one.
   Real clicks in Warsztat: the particles must belong to the new Efekt at once (before the next
   bite), with normal and reduced motion; cancelling a preview of an Efekt not owned and coming
   back to the Efekt tab show the worn one; looking costs nothing and puts nothing on. */
const fxShapes = (p) => p.evaluate(() => {
  const gm = window.game, list = gm.warsztatFxParts || [];
  return { n: list.length, shapes: [...new Set(list.map(q => q.shape || null))], name: document.getElementById('warsztatPreviewName').textContent, bite: gm.warsztatFxBite };
});
async function switchChecks(url) {
  const out = [];
  for (const reduced of [false, true]) {
    const tag = reduced ? 'reduced motion' : 'normal motion';
    const initScript = reduced ? () => { const mm = window.matchMedia.bind(window); window.matchMedia = (q) => (/prefers-reduced-motion/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q)); } : null;
    const g = await openGame(url, { ...PHONE2, initScript });
    const s0 = await veteranSave(g.page, { runsPlayed: 6, coins: 5000 });
    s0.prisms = 500;
    s0.effects.owned = ['classic', 'pixel_burst', 'violet_rift', 'pryzmat']; s0.effects.selected = 'pixel_burst'; // Neonowa Róża: not owned
    await g.page.evaluate((x) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(x)), s0);
    await g.page.reload();
    await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state === GameState.MENU);
    const p = g.page;
    await p.click('#btnNavWarsztat');
    await p.click('#tabEffects');
    await p.waitForTimeout(400);
    // Right after a bite (normal motion) the next one is ~1.6 s away: every check below runs well inside it.
    const sync = async () => { if (reduced) return; const b0 = await p.evaluate(() => window.game.warsztatFxBite); await p.waitForFunction((b) => window.game.warsztatFxBite !== b, b0, { timeout: 4000 }); await p.waitForTimeout(60); };
    const before = await fxShapes(p);
    const wallet0 = await p.evaluate(() => [window.game.save.coins, window.game.save.prisms]);
    await sync();
    await p.click('#effectGrid .skin-card[data-item="pryzmat"]');
    await p.waitForTimeout(120);
    const a = await fxShapes(p);
    await sync();
    await p.click('#effectGrid .skin-card[data-item="violet_rift"]');
    await p.waitForTimeout(120);
    const b = await fxShapes(p);
    out.push(report(`S1 DOM ${tag}: Pikselowy Wybuch -> Pryzmat -> Fioletowa Szczelina by real clicks -- each preview shows the new Efekt at once (before its next bite), no particle of the previous one`,
      before.shapes.join() === 'pixel' && a.n > 0 && a.shapes.join() === 'prism' && b.n > 0 && b.shapes.join() === 'rift', JSON.stringify({ before, a, b })));
    // Look at an Efekt not owned, then NIE TERAZ: back to the worn one at once; nothing spent or put on.
    await sync();
    await p.click('#effectGrid .skin-card[data-item="neon_rose"]');
    await p.waitForTimeout(120);
    const look = await fxShapes(p);
    await p.click('#btnWarsztatCancel');
    await p.waitForTimeout(120);
    const back = await fxShapes(p);
    const st = await p.evaluate(() => ({ sel: window.game.save.effects.selected, owned: window.game.save.effects.owned.join(), wallet: [window.game.save.coins, window.game.save.prisms],
      stored: JSON.parse(localStorage.getItem('vectorHoleSave_v1')).effects }));
    out.push(report(`S2 DOM ${tag}: previewing Neonowa Róża (not owned) shows petals at once; NIE TERAZ brings the worn Fioletowa Szczelina back at once; nothing spent, nothing put on`,
      look.n > 0 && look.shapes.join() === 'petal' && back.n > 0 && back.shapes.join() === 'rift' && st.sel === 'violet_rift' && !st.owned.includes('neon_rose') && st.wallet.join() === wallet0.join() && st.stored.selected === 'violet_rift' && !st.stored.owned.includes('neon_rose'),
      JSON.stringify({ look, back, st, wallet0 })));
    // Away to another tab and back to Efekt: still the worn Efekt.
    await p.click('#tabAuras');
    await p.waitForTimeout(150);
    await p.click('#tabEffects');
    await p.waitForTimeout(150);
    const ret = await fxShapes(p);
    out.push(report(`S3 DOM ${tag}: back on the Efekt tab the preview shows the worn Efekt (Fioletowa Szczelina)`, ret.n > 0 && ret.shapes.join() === 'rift', JSON.stringify(ret)));
    out.push(report(`S ${tag}: no page errors`, g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }
  return out;
}

/* ============================ P: frame cost ============================ */
export async function frameCost(url, label = 'candidate') {
  // The same frozen scene rendered 300 times per condition (no update between renders, so
  // nothing random changes): the cost of drawing a Smuga / an Efekt burst against none.
  const g = await page(url, DESK);
  const r = await g.page.evaluate(() => {
    const out = {};
    for (const gfx of [2, 0]) for (const [name, aura, eff] of [['none', 'none', 'classic'], ['ember', 'ember', 'classic'], ['pryzmat', 'pryzmat', 'classic'], ['pixel-bite', 'none', 'pixel_burst']]) {
      const A = window.__uc, g = A.start(77); g.applyGfx(gfx); g.save.auras.selected = aura; g.save.effects.selected = eff; g.player.auraId = aura;
      const P = g.player; P.x = 1500; P.y = 1500; P.setRadius(46); g.pointerScreen = null;
      for (let f = 0; f < 50; f++) { const b = f / 40; g.keyDir = { x: Math.cos(b), y: Math.sin(b) }; A.step(1); A.frame(); }
      if (eff !== 'classic') { g.triggerEatFeedback(P.x + 40, P.y, '#fff', 30, true, P, 1); }
      g.banner = null;
      const times = [];
      for (let k = 0; k < 6; k++) { const t0 = window.__realNow(); for (let i = 0; i < 50; i++) g.render(A.t); times.push((window.__realNow() - t0) / 50); }
      times.sort((x, y) => x - y);
      out[`${name}-gfx${gfx}`] = +times[2].toFixed(3);
      A.clockOff();
    }
    window.game.applyGfx(2);
    return out;
  });
  await g.browser.close();
  return r;
}

/* ============================ strips (FRAMES) ============================ */
export async function strips(url, label) {
  const dir = path.join(SHOTS, 'strips', label);
  fs.mkdirSync(dir, { recursive: true });
  const scenes = [
    { name: 'smuga-gfx2', gfx: 2, aura: 'ember', eff: 'classic' },
    { name: 'smuga-gfx0', gfx: 0, aura: 'ember', eff: 'classic' },
    { name: 'smuga-zawirowanie', gfx: 2, aura: 'vortex', eff: 'classic' },
    { name: 'efekt-pikselowy', gfx: 2, aura: 'none', eff: 'pixel_burst' },
    { name: 'efekt-pryzmat', gfx: 2, aura: 'none', eff: 'pryzmat' },
    { name: 'finisz-burza', gfx: 2, aura: 'none', eff: 'classic', od: 'zielona_burza' }
  ];
  for (const sc of scenes) {
    const g = await page(url, { viewport: { width: 420, height: 420 }, mobile: false, deviceScaleFactor: 1 });
    await g.page.evaluate((sc) => {
      const A = window.__uc, g = window.game; g.save.auras.selected = sc.aura; g.save.effects.selected = sc.eff; if (sc.od) g.save.overdriveSkins.selected = sc.od;
      A.start(77); g.applyGfx(sc.gfx); g.player.auraId = sc.aura;
      const P = g.player; P.x = 1500; P.y = 1500; P.setRadius(46); g.pointerScreen = null;
      window.__frames = 0;
      // warm-up: the size banner of setRadius() fades first
      for (let f = 0; f < 45; f++) { g.keyDir = { x: 1, y: 0 }; A.step(1); A.frame(); window.__frames++; } // rendered every frame, as in a round
      g.banner = null; g.bannerQueue = [];
      // the bites come after the warm-up, in front of the vortex
      if (sc.eff !== 'classic') { const objs = g.objects.filter(o => (o.tier === 'fragment' || o.tier === 'capsule') && Math.hypot(o.x - P.x, o.y - P.y) > 600).slice(0, 5); objs.forEach((o, i) => { o.x = P.x + 70 + i * 34; o.y = P.y + (i % 2 ? 12 : -12); }); const big = g.objects.find(o => o.radius > 24 && g.holeCanEat(P, o) && Math.hypot(o.x - P.x, o.y - P.y) > 600); if (big) { big.x = P.x + 150; big.y = P.y; } }
      if (sc.od) { delete g.checkOverdriveTrigger; g.timeRemaining = CONFIG.overdrive.triggerSecondsRemaining + 0.02; }
    }, sc);
    for (let k = 0; k < 4; k++) {
      await g.page.evaluate((sc) => { const A = window.__uc, g = window.game; for (let f = 0; f < (sc.eff !== 'classic' ? 11 : 6); f++) { window.__frames++; const b = (window.__frames - 45) / 70; g.keyDir = sc.eff !== 'classic' ? { x: 1, y: 0 } : { x: Math.cos(b), y: Math.sin(b) }; A.step(1); A.frame(); } }, sc);
      await g.page.screenshot({ path: path.join(dir, `${sc.name}-${k}.png`) });
    }
    await g.page.evaluate(() => window.__uc.clockOff());
    await g.browser.close();
  }
  return dir;
}

export async function runUxFixCChecks(url, only = null) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const parts = { T: trailChecks, E: effectChecks, F: finishChecks, W: warsztatChecks, S: switchChecks };
  const out = [];
  for (const [k, fn] of Object.entries(parts)) if (!only || only.includes(k)) out.push(...await fn(url));
  return out;
}

if (isMain(import.meta.url)) {
  const arg = (k) => { const a = process.argv.find(x => x === `--${k}` || x.startsWith(`--${k}=`)); return a ? (a.includes('=') ? a.split('=')[1] : true) : null; };
  const root = arg('root');
  const { server, url } = await serve(root ? { root: path.resolve(root) } : {});
  const label = arg('label') || (root ? path.basename(root) : 'candidate');
  if (arg('strips')) { console.log(await strips(url, label)); server.close(); process.exit(0); }
  if (arg('cost')) { const r = await frameCost(url, label); console.log(label, JSON.stringify(r)); fs.mkdirSync(SHOTS, { recursive: true }); fs.writeFileSync(path.join(SHOTS, `cost-${label}.json`), JSON.stringify(r, null, 2)); server.close(); process.exit(0); }
  const only = arg('only') ? arg('only').split(',') : null;
  const res = await runUxFixCChecks(url, only);
  server.close();
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} UX-FIX-C checks passed`);
  process.exit(failed.length ? 1 : 0);
}

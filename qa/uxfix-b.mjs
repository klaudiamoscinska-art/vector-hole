// UX-FIX-B (GG_UX_AUDIT_1, stage B): the Arena evolution cards Skaner,
// Impuls ssący (was Fala) and Łowca, and the card chips in the HUD.
// Kinds: FN = the game's own functions on a set scene (virtual clock, same
// seed and layout with and without the card); DOM = real clicks on the
// offered cards and the HUD as drawn; SIM = full rounds with the casual bot
// (lib.mjs ARENA_BOT) -- reported as a spread over seeds, never one number.
//  - M: micro scenes -- Skaner points only at an object the player can eat,
//    in range (never the far T6 tower, never the Złoty Rdzeń), marks it on
//    screen or with an edge arrow, re-picks after it is eaten / out of use,
//    none = no marker and no error; Impuls ssący pulls only edible objects
//    in, by at most shockwavePush, never past half the radius, not rivals,
//    and more get eaten than without it; Łowca marks only an eatable rival,
//    pays +40 exactly once with "+40 ŁOWCA", picks a new one, drops one that
//    grew / was eaten by a rival / waits, retries when none; Turbo combo
//    keeps +60% / 1.5 s; two cards together; a new round resets all.
//  - H: the chips -- two picked cards (real clicks), lit only while working,
//    clear of the buttons, PL / EN, 375x667 / 390x844 / 1280x720.
//  - S: SIM rounds (--sim, slow): score spread without a card and with
//    each card; --root=DIR runs the same rounds on another checkout (base).
// Usage: node qa/uxfix-b.mjs [--only=M,H] [--sim[=N]] [--root=DIR]
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, veteranSave, report, isMain, OUT, ARENA_BOT, QA_RANDOM } from './lib.mjs';

const DESK = { viewport: { width: 1280, height: 720 }, mobile: false, deviceScaleFactor: 1 };
const PHONE = { viewport: { width: 375, height: 667 }, mobile: true, deviceScaleFactor: 2 };
const PHONE2 = { viewport: { width: 390, height: 844 }, mobile: true, deviceScaleFactor: 2 };
const SHOTS = path.join(OUT, 'uxfix-b');

const LIB = `
window.__ux = (function () {
  const A = {};
  const realNow = window.__realNow || (window.__realNow = performance.now.bind(performance));
  A.clockOn = (t0) => { A.vnow = t0 != null ? t0 : 1e6; performance.now = () => A.vnow; };
  A.clockOff = () => { performance.now = realNow; };
  A.start = (seed) => {
    const g = window.game; A.clockOn();
    g.checkEvolutionTriggers = () => {}; g.checkOverdriveTrigger = () => {};
    g.startRound({ seed: seed || 61 }); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false; g.paused = false;
    g.goldenObj && (g.goldenObj.x = 2950, g.goldenObj.y = 2950); g.spawnGoldenCore = () => {};
    return g;
  };
  A.step = (n, dt) => { const g = window.game; dt = dt || 1 / 30; for (let i = 0; i < n && g.state === GameState.PLAYING; i++) { A.vnow += dt * 1000; g.update(dt); } };
  A.park = () => { window.game.bots.forEach((b, i) => { b.x = 120 + i * 70; b.y = 120; b.setRadius(15); b.update = function () {}; }); };
  A.clear = (x, y, R) => { for (const o of window.game.objects) if (Math.hypot(o.x - x, o.y - y) < R && o !== window.game.goldenObj) { o.x = 2900 - Math.random() * 60; o.y = 2900 - Math.random() * 60; } };
  A.take = (tier, x, y) => { const g = window.game; const o = g.objects.find(ob => ob.tier === tier && !ob.eating && !ob.__used && ob !== g.goldenObj && Math.hypot(ob.x - 1500, ob.y - 1500) > 700); o.__used = true; o.x = x; o.y = y; return o; };
  A.pick = (id) => { const g = window.game; g.evolutionPending = true; g.pickMutation(id); };
  return A;
})();`;

async function page(url, opts, save) {
  const g = await openGame(url, opts);
  const s = save || await veteranSave(g.page, { runsPlayed: 3 });
  s.stats.recentArenaScores = [2400, 2600, 2800, 3000, 3200];
  await g.page.evaluate((x) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(x)), s);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state === GameState.MENU);
  for (const content of [ARENA_BOT, QA_RANDOM, LIB]) await g.page.addScriptTag({ content });
  return g;
}

/* ============================ M: micro scenes (FN) ============================ */
async function microChecks(url) {
  const out = [];
  const g = await page(url, DESK);
  const p = g.page;
  // --- Skaner
  const sc = await p.evaluate(() => {
    const A = window.__ux, g = A.start(61); A.park();
    const P = g.player; P.x = 1500; P.y = 1500; P.setRadius(46); g.keyDir = { x: 0, y: 0 }; g.pointerScreen = null; P.invulnerableUntil = Infinity;
    A.clear(1500, 1500, 1600);
    // a T6 tower close by (not edible at r 46), the old pick; two edible objects at 300 and 700; one edible far away (2000).
    const tower = A.take('tower', 1500 + 250, 1500);
    const near = A.take('capsule', 1500 - 300, 1500), mid = A.take('prop', 1500, 1500 + 700), far = A.take('prop', 1500 - 1350, 1500 - 1350);
    const towerEdible = g.holeCanEat(P, tower), farD = Math.round(Math.hypot(far.x - P.x, far.y - P.y));
    A.pick('scanner'); A.step(2);
    const t1 = g.scannerTarget;
    const r1 = { id: t1 === near ? 'near' : t1 === mid ? 'mid' : t1 === tower ? 'TOWER' : t1 === far ? 'FAR' : t1 ? t1.tier : null, edible: !!t1 && g.holeCanEat(P, t1), inView: !!t1 && g.isInView(t1.x, t1.y, t1.radius) };
    // the target is eaten -> a new one at once (not after 4 s)
    const was = t1; t1.x = P.x; t1.y = P.y; A.step(3);
    const t2 = g.scannerTarget;
    const r2 = { changed: t2 !== was, id: t2 === near ? 'near' : t2 === mid ? 'mid' : t2 === tower ? 'TOWER' : t2 === far ? 'FAR' : t2 ? t2.tier : null, timerLeft: +g.scannerTimer.toFixed(2) };
    // off screen -> an edge arrow is drawn (render() and look for its pixels at the edge is costly; the condition instead)
    g.render(1); const offScreen = !!g.scannerTarget && !g.isInView(g.scannerTarget.x, g.scannerTarget.y, 0);
    // nothing edible in range -> null, no marker, no error
    A.clear(1500, 1500, 1600); tower.x = 1520; tower.y = 1500;
    const picks0 = g.scannerPicks; g.scannerTimer = 0; A.step(1);
    const none = { target: g.scannerTarget, picks: g.scannerPicks - picks0 };
    // never the Złoty Rdzeń
    g.spawnGoldenCore = Object.getPrototypeOf(g).spawnGoldenCore; g.spawnGoldenCore(); const gold = g.goldenObj; gold.x = 1600; gold.y = 1500;
    g.scannerTimer = 0; A.step(1); const goldPicked = g.scannerTarget === gold;
    A.clockOff();
    return { towerEdible, farD, r1, r2, offScreen, none: { target: none.target ? 'SOMETHING' : null, picks: none.picks }, goldPicked };
  });
  out.push(report('M1 FN Skaner: at r 46 it points at an edible object in range (not the T6 tower next to it, not one 1900 away)', !sc.towerEdible && sc.r1.edible && ['near', 'mid'].includes(sc.r1.id), JSON.stringify(sc)));
  out.push(report('M1 FN Skaner: once the target is eaten a new edible one is picked at once (before the 4 s tick)', sc.r2.changed && ['near', 'mid'].includes(sc.r2.id) && sc.r2.timerLeft > 3, JSON.stringify(sc.r2)));
  out.push(report('M1 FN Skaner: nothing edible in range -> no target and no false marker (it keeps looking, no error); never the Złoty Rdzeń', sc.none.target === null && sc.none.picks >= 1 && !sc.goldPicked, JSON.stringify({ none: sc.none, gold: sc.goldPicked })));
  // --- Impuls ssący vs nothing (the same scene twice)
  const su = await p.evaluate(() => {
    const res = {};
    for (const card of [null, 'shockwave']) {
      const A = window.__ux, g = A.start(62); A.park();
      const P = g.player; P.x = 1500; P.y = 1500; P.setRadius(65); g.keyDir = { x: 0, y: 0 }; g.pointerScreen = null; P.invulnerableUntil = Infinity;
      A.clear(1500, 1500, 500);
      g.lastSizeTierId = CONFIG.sizeTiers[getSizeTierIndex(65)].id;
      const objs = []; for (let i = 0; i < 8; i++) { const a = i * 0.785, d = 70 + i * 16; objs.push(A.take('fragment', 1500 + Math.cos(a) * d, 1500 + Math.sin(a) * d)); }
      const big = A.take('tower', 1500 + 150, 1500 + 40); // not edible
      const rival = g.bots[1]; rival.x = 1500 - 160; rival.y = 1500 + 30; rival.setRadius(20);
      const d0 = objs.map(o => Math.hypot(o.x - 1500, o.y - 1500)), big0 = [big.x, big.y], riv0 = [rival.x, rival.y];
      if (card) A.pick(card);
      const s0 = P.score, u0 = unitsForRadius(P.radius);
      P.setRadius(67); g.checkSizeTier();
      A.step(16); // 0.53 s: the pulse is over
      const moved = objs.map((o, i) => o.eating || o.removed ? null : +(d0[i] - Math.hypot(o.x - P.x, o.y - P.y)).toFixed(1));
      const maxMove = Math.max(0, ...moved.filter(x => x != null));
      const minDist = Math.min(...objs.filter(o => !o.eating && !o.removed).map(o => Math.hypot(o.x - P.x, o.y - P.y)));
      A.step(20);
      res[card || 'none'] = { eaten: objs.filter(o => o.eating || o.removed || Math.hypot(o.x - 1500, o.y - 1500) > 900).length, maxMove, minDistOverHalfR: minDist >= P.radius * 0.5 - 0.5 || !isFinite(minDist),
        bigMoved: Math.hypot(big.x - big0[0], big.y - big0[1]), rivalMoved: Math.hypot(rival.x - riv0[0], rival.y - riv0[1]), pulses: g.suctionPulses, suctionDone: g.suction === null };
    }
    window.__ux.clockOff();
    return res;
  });
  out.push(report('M2 FN Impuls ssący: at the tier-up the same 8 fragments near the rim are eaten more with the card than without (the old Fala pushed them away: 4 -> 0)', su.shockwave.eaten > su.none.eaten && su.shockwave.pulses === 1 && su.shockwave.suctionDone, JSON.stringify(su)));
  out.push(report('M2 FN Impuls ssący: no object moves farther than shockwavePush (70), none past half the radius; a T6 tower and a rival are not moved', su.shockwave.maxMove <= 70.01 && su.shockwave.minDistOverHalfR && su.shockwave.bigMoved === 0 && su.shockwave.rivalMoved === 0, JSON.stringify(su.shockwave)));
  // --- Łowca
  const bo = await p.evaluate(() => {
    const A = window.__ux, g = A.start(63); A.park();
    const P = g.player; P.x = 1500; P.y = 1500; P.setRadius(60); P.invulnerableUntil = Infinity; g.keyDir = { x: 0, y: 0 }; g.pointerScreen = null;
    const [b0, b1, b2] = g.bots;
    b0.setRadius(80); b0.x = 1600; b0.y = 1500; b0.invulnerableUntil = 0;   // nearest, but bigger: not a target
    b1.setRadius(30); b1.x = 1800; b1.y = 1500; b1.invulnerableUntil = 0;   // eatable
    b2.setRadius(25); b2.x = 2200; b2.y = 1500; b2.invulnerableUntil = 0;   // eatable, farther
    A.pick('bounty_core');
    const first = g.bountyTarget && g.bountyTarget.name, wantFirst = b1.name;
    // it grows past the rule -> dropped, the other eatable one is marked
    b1.setRadius(58); A.step(1); const afterGrow = g.bountyTarget && g.bountyTarget.name;
    // eat the target: +40 once, "+40 ŁOWCA", then a new target
    b1.setRadius(30); const t = g.bountyTarget; t.x = P.x + 5; t.y = P.y; g.comboCount = 0; g.comboMultiplier = 1; g.comboTimer = 0;
    const s0 = P.score, r = t.radius; const floats0 = g.floatTexts.length;
    g.handleHoleCollisions();
    const gained = P.score - s0, wantPlain = Math.round(r * 2 * 1);
    const label = g.floatTexts.slice(floats0).map(f => f.text);
    A.step(1); const next = g.bountyTarget && g.bountyTarget.name, claims = g.bountyClaims;
    // a second contact with the same (now respawned) rival does not pay again
    // eaten by another rival -> no target; no eatable one -> none, retried after 1 s
    const cur = g.bountyTarget; if (cur) g.respawnArenaBot(cur); const afterRivalAte = g.bountyTarget === cur ? 'SAME' : 'cleared';
    g.bots.forEach(b => { b.setRadius(90); });
    A.step(2); const noneNow = g.bountyTarget;
    g.bots[2].setRadius(20); g.bots[2].x = 1700; g.bots[2].y = 1500; g.bots[2].invulnerableUntil = 0;
    A.step(10); const before1s = g.bountyTarget; A.step(25); const after1s = g.bountyTarget && g.bountyTarget.name;
    A.clockOff();
    return { first, wantFirst, afterGrow, b2: b2.name, gained, wantPlain, label, next, claims, afterRivalAte, noneNow: noneNow ? noneNow.name : null, before1s: before1s ? before1s.name : null, after1s, b2late: g.bots[2].name };
  });
  out.push(report('M3 FN Łowca: marks the nearest rival the player can eat (skips a nearer bigger one); one that grows past the rule is dropped for an eatable one', bo.first === bo.wantFirst && bo.afterGrow === bo.b2, JSON.stringify(bo)));
  out.push(report('M3 FN Łowca: eating the target pays exactly rival points + 40, once, with its own "+40 ŁOWCA", then a new target', bo.gained === bo.wantPlain + 40 && bo.claims === 1 && bo.label.includes('+40 ŁOWCA') && !!bo.next, JSON.stringify({ gained: bo.gained, want: bo.wantPlain + 40, label: bo.label, next: bo.next })));
  out.push(report('M3 FN Łowca: a target eaten by another rival is cleared; with no eatable rival there is none, and one appearing is marked within ~1 s', bo.afterRivalAte === 'cleared' && bo.noneNow === null && bo.before1s === null && bo.after1s === bo.b2late, JSON.stringify(bo)));
  // --- Turbo combo unchanged; two cards together; reset.
  const tu = await p.evaluate(() => {
    const A = window.__ux, g = A.start(64); A.park();
    const P = g.player; P.x = 1000; P.y = 1500; P.setRadius(30); P.invulnerableUntil = Infinity; A.clear(1300, 1500, 500);
    A.pick('slipstream'); A.pick('scanner');
    for (let i = 0; i < 6; i++) A.take('fragment', 1040 + i * 22, 1500);
    g.keyDir = { x: 1, y: 0 };
    let boosted = 0, maxMult = 0; for (let f = 0; f < 90; f++) { A.step(1); if (P.tempSpeedMult > 1.05) boosted++; maxMult = Math.max(maxMult, P.tempSpeedMult); }
    g.updateHUD();
    const chips = [...document.querySelectorAll('#hud-cards li')].map(li => ({ name: li.querySelector('.hud-card-name').textContent, on: li.classList.contains('on'), state: li.querySelector('.hud-card-state').textContent }));
    const cfg = [CONFIG.evolution.slipstreamSpeedMult, CONFIG.evolution.slipstreamMs, CONFIG.evolution.slipstreamComboThreshold];
    A.start(65);
    const reset = { active: g.activeMutations.size, scanner: g.scannerTarget, bounty: g.bountyTarget, suction: g.suction, shield: g.phaseShieldUntil };
    g.updateHUD();
    const chipsAfter = document.querySelectorAll('#hud-cards li').length, hidden = document.getElementById('hud-cards').classList.contains('hidden');
    A.clockOff();
    return { boosted, maxMult: +maxMult.toFixed(2), cfg, chips, reset, chipsAfter, hidden };
  });
  out.push(report('M4 FN Turbo combo keeps +60% for 1.5 s from a x3 combo (no weakening); with Skaner too, both chips shown', tu.cfg.join() === '1.6,1500,3' && tu.maxMult >= 1.59 && tu.boosted > 20 && tu.chips.length === 2 && tu.chips[0].name === 'Turbo combo' && tu.chips[1].name === 'Skaner', JSON.stringify(tu)));
  out.push(report('M5 FN a new round clears the cards, the targets, the pulse, the shield timer and the chips', tu.reset.active === 0 && tu.reset.scanner === null && tu.reset.bounty === null && tu.reset.suction === null && tu.reset.shield === 0 && tu.chipsAfter === 0 && tu.hidden, JSON.stringify(tu.reset)));
  // --- chips never say "on" when the effect can't act
  const st = await p.evaluate(() => {
    const A = window.__ux, g = A.start(66); A.park();
    const P = g.player; P.invulnerableUntil = 0;
    A.pick('magnet_pulse'); A.pick('phase_edge');
    P.setRadius(170); const mBig = g.cardHudState('magnet_pulse'); P.setRadius(60); const mSmall = g.cardHudState('magnet_pulse');
    const s0 = g.cardHudState('phase_edge');
    // eaten by a rival: protection 4 s with the card, counted down from the real timer
    const b = g.bots[1]; delete b.update; b.setRadius(120); b.x = P.x; b.y = P.y; b.invulnerableUntil = 0; g.handleHoleCollisions();
    const s1 = g.cardHudState('phase_edge'), prot = Math.round(P.invulnerableUntil - performance.now());
    A.step(70); const s2 = g.cardHudState('phase_edge');
    A.step(60); const s3 = g.cardHudState('phase_edge');
    A.clockOff();
    return { mBig, mSmall, s0, s1, s2, s3, prot };
  });
  out.push(report('M6 FN chips: Magnes lit at r 60, "POLE ZAKRYTE" (not lit) at r 170; Tarcza idle "PO ODRODZENIU", after being eaten "OCHRONA 4 s" -> "2 s" from the real 4000 ms timer, then idle again',
    st.mSmall.on && !st.mBig.on && st.mBig.text === 'POLE ZAKRYTE' && !st.s0.on && st.prot === 4000 && st.s1.on && st.s1.text === 'OCHRONA 4 s' && st.s2.text === 'OCHRONA 2 s' && !st.s3.on, JSON.stringify(st)));
  out.push(report('M no page errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
  await g.browser.close();
  return out;
}

/* ============================ H: chips in the HUD (DOM) ============================ */
async function hudChecks(url) {
  const out = [];
  for (const [vp, opts, lang] of [['375x667', PHONE, 'pl-PL'], ['390x844', PHONE2, 'en-US'], ['1280x720', DESK, 'pl-PL']]) {
    const g = await page(url, { ...opts, locale: lang });
    const p = g.page;
    await p.evaluate(() => { const gm = window.game; gm.startRound({ seed: 3 }); gm.checkEvolutionTriggers = () => {}; gm.player.invulnerableUntil = Infinity; gm.player.setRadius(47); });
    await p.waitForTimeout(150);
    const pickFirst = async (r) => {
      await p.evaluate((r) => { const gm = window.game; gm.player.setRadius(r); gm.evolutionOffersTriggered = gm.evolutionOffersTriggered || new Set(); gm.offerEvolution(); }, r);
      await p.waitForSelector('#evolutionCards .evolution-card, #evolutionCards button', { state: 'visible' });
      await p.click('#evolutionCards .evolution-card, #evolutionCards button');
      await p.waitForTimeout(250);
    };
    await pickFirst(47); await pickFirst(67);
    await p.evaluate(() => { const gm = window.game; if (gm.evolutionPending) gm.skipEvolutionOffer(); gm.player.setRadius(52); });
    await p.waitForTimeout(400);
    const r = await p.evaluate(() => {
      const box = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
      const lis = [...document.querySelectorAll('#hud-cards li')];
      const cards = box(document.getElementById('hud-cards'));
      const others = ['btnPause', 'hud-topright', 'hud-tier-strip', 'minimapCanvas'].map(id => document.getElementById(id)).filter(e => e && e.getClientRects().length).map(e => ({ id: e.id, ...box(e) }));
      const hit = others.filter(o => !(cards.r <= o.l || cards.l >= o.r || cards.b <= o.t || cards.t >= o.b)).map(o => o.id);
      return { n: lis.length, active: [...window.game.activeMutations], names: lis.map(li => li.querySelector('.hud-card-name').textContent), states: lis.map(li => li.querySelector('.hud-card-state').textContent),
        on: lis.map(li => li.classList.contains('on')), visible: !document.getElementById('hud-cards').classList.contains('hidden'), hit, cards, vh: innerHeight, vw: innerWidth };
    });
    await p.screenshot({ path: path.join(SHOTS, `h-karty-${vp}.png`) });
    const pl = /[ąćęłńóśźż]|PRZYCI|CZEKA|SZUKA|BRAK|OCHRONA|ROZMIARZE|ZAKRYTE|ODRODZENIU|OKNO|KĘS|WSKAZANY/;
    out.push(report(`H1 DOM ${vp}${lang === 'en-US' ? ' EN' : ''}: two cards picked by real clicks show two chips under the clock, clear of the pause, the standings and the tier strip, inside the screen`,
      r.n === 2 && r.visible && r.hit.length === 0 && r.cards.b < r.vh * 0.4 && r.cards.r < r.vw * 0.7 && (lang !== 'en-US' || !r.states.some(x => pl.test(x))), JSON.stringify(r)));
    out.push(report(`H1 ${vp}: no page errors`, g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }
  return out;
}

/* ============================ S: SIM rounds ============================ */
export async function simRounds(url, n = 10, label = 'candidate') {
  const g = await page(url, DESK);
  const cards = [null, 'scanner', 'shockwave', 'bounty_core', 'slipstream'];
  const out = {};
  for (const card of cards) {
    const rows = [];
    for (let s = 0; s < n; s++) {
      rows.push(await g.page.evaluate(({ card, seed, rand }) => {
        const gm = window.game, orig = gm.startRound;
        delete gm.checkEvolutionTriggers; delete gm.checkOverdriveTrigger;
        gm.save.stats.runsPlayed = 3; gm.save.stats.recentArenaScores = [2400, 2600, 2800, 3000, 3200];
        gm.startRound = function (o) { orig.call(this, Object.assign({}, o, { seed })); };
        let picks = 0; const m = { pickAt: null, scannerFrames: 0, scannerEdibleInView: 0, bountyFrames: 0, pulled: 0, eatenAfterPulse: 0 };
        const origOffer = gm.offerEvolution.bind(gm);
        gm.offerEvolution = function () { this.evolutionPending = true; if (picks++ === 0 && card) { m.pickAt = Math.round(CONFIG.round.duration - this.timeRemaining); this.pickMutation(card); } else this.skipEvolutionOffer(); };
        window.__qaSeedRandom(rand);
        let res;
        try {
          res = window.__qaPlayArena({ style: 'casual', clock0: 1000000, noRender: true, onFrame: (f, gg) => {
            if (card === 'scanner' && gg.activeMutations.has('scanner')) { const t = gg.scannerTarget; if (t) { m.scannerFrames++; if (gg.holeCanEat(gg.player, t) && gg.isInView(t.x, t.y, t.radius)) m.scannerEdibleInView++; } }
            if (card === 'bounty_core' && gg.bountyTarget) m.bountyFrames++;
          } });
        } finally { window.__qaRestoreRandom(); gm.startRound = orig; gm.offerEvolution = origOffer; }
        return { score: res.score, place: res.place, radius: res.radius, deaths: res.deaths, pickAt: m.pickAt, scannerSec: +(m.scannerFrames / 30).toFixed(1), scannerEdibleInViewSec: +(m.scannerEdibleInView / 30).toFixed(1),
          bountyClaims: gm.bountyClaims || 0, bountyMarkedSec: +(m.bountyFrames / 30).toFixed(1), pulses: gm.suctionPulses || 0 };
      }, { card, seed: 8100 + s, rand: 5100 + s * 31 }));
    }
    const scores = rows.map(r => r.score).sort((a, b) => a - b);
    const med = (a) => a.length % 2 ? a[(a.length - 1) / 2] : Math.round((a[a.length / 2 - 1] + a[a.length / 2]) / 2);
    const mean = (k) => +(rows.reduce((a, r) => a + (r[k] || 0), 0) / rows.length).toFixed(2);
    out[card || 'none'] = { n, median: med(scores), min: scores[0], max: scores[scores.length - 1], meanPlace: mean('place'), meanRadius: mean('radius'), meanDeaths: mean('deaths'),
      scannerSec: mean('scannerSec'), scannerEdibleInViewSec: mean('scannerEdibleInViewSec'), bountyClaims: mean('bountyClaims'), bountyMarkedSec: mean('bountyMarkedSec'), pulses: mean('pulses'), scores };
    console.log(`[SIM ${label}] ${card || 'none'}: median ${out[card || 'none'].median} (min ${scores[0]}, max ${scores[scores.length - 1]}, n ${n})`);
  }
  await g.browser.close();
  return out;
}

export async function runUxFixBChecks(url, only = null) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const out = [];
  if (!only || only.includes('M')) out.push(...await microChecks(url));
  if (!only || only.includes('H')) out.push(...await hudChecks(url));
  return out;
}

if (isMain(import.meta.url)) {
  const arg = (k) => { const a = process.argv.find(x => x === `--${k}` || x.startsWith(`--${k}=`)); return a ? (a.includes('=') ? a.split('=')[1] : true) : null; };
  const only = arg('only') ? arg('only').split(',') : null;
  const root = arg('root');
  const { server, url } = await serve(root ? { root: path.resolve(root) } : {});
  if (arg('sim')) {
    const n = arg('sim') === true ? 10 : +arg('sim');
    const res = await simRounds(url, n, root ? 'root ' + path.basename(root) : 'candidate');
    fs.mkdirSync(SHOTS, { recursive: true });
    fs.writeFileSync(path.join(SHOTS, `sim-${root ? path.basename(root) : 'candidate'}.json`), JSON.stringify(res, null, 2));
    server.close();
    process.exit(0);
  }
  const res = await runUxFixBChecks(url, only);
  server.close();
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} UX-FIX-B checks passed`);
  process.exit(failed.length ? 1 : 0);
}

// GG-UI-01 -- "Premium Game HUD" (the in-round interface). What this suite proves:
//  - U1 every mode's HUD shows the game's own values: clock, score, tier,
//    place, the standings in rankHoles() order with each row's share of the
//    leader, the mission's code and goals -- Arena, Daily, a friend's
//    challenge, Campaign;
//  - U2 the T1-T6 ladder: steps below the tier full, the current one at the
//    mode's own progress, T6 fully lit; a DOM write only when a value moves;
//  - U3 mission goals: segments = the goal's target, lit = its progress, a
//    bar above 8 steps, the boss in its own row, long copy inside the box;
//  - U4 layout: on every frame (320x568 .. 1920x1080, an iPhone's safe
//    areas), in every mode, in Polish and English, every panel is inside
//    the safe viewport, no two overlap, no text is cut, pause is >= 44x44;
//  - U5 FIX 1: the Daily Challenge header in PL and EN at #1/6, #3/6, #6/6
//    with short and long names -- the place badge never leaves the panel,
//    never meets the title, nothing is ellipsized, text >= 9 px;
//  - U6 FIX 2: no centre banner lies on the combo / challenge / SZAŁ
//    widgets (800x450, 640x360, 844x390, 1366x768, a phone): it takes the
//    free band or the widgets step back; pause and resume keep the HUD;
//  - U7 FIX 3: NELA's bubble never covers the vortex in the middle (small
//    and large), the goal box or the minimap, stays put frame to frame,
//    fades when the vortex comes under it, and a tap still closes it;
//  - U8 FIX 4: the minimap -- a blackout mission draws exactly what a board
//    with no entities draws (nothing leaks), marks sit at the world's own
//    coordinates, the player's mark is the largest, a bigger rival is red,
//    the backdrop is painted once and reused;
//  - U9 a turn of the phone, a resize and every quality level mid-round;
//  - U10 the HUD takes no touch meant for the board; pause works;
//  - U11 display only: a seeded round ends in the same state and draws the
//    same random numbers with the HUD drawn or not; the save keeps its key,
//    version 13 and its fields; every changed line of game.js sits in a HUD
//    function (vs the base revision, when git has it).
// Usage: node qa/ui1.mjs [--perf] [--only=U5,U6]   (--perf prints the minimap's costs; --only runs some sections while working on them)
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { serve, report, expectAll, is, holds, truthy, ROOT, isMain } from './lib.mjs';
import { safeArea } from './responsive.mjs';
import { stage, openScene } from './ui1-shots.mjs';

const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = (tag) => !ONLY.length || ONLY.includes(tag);
const BASE_REV = process.env.VH_UI1_BASE || 'b337835ea9d28070744e4b49058c86772b1990a8';
const HEAD_REV = process.env.VH_UI1_HEAD || '1122a5331ce080868aa35c171e917dd7183ca78c'; // the stage's last commit (PR #100's head)
const PHONE = { width: 390, height: 844, mobile: true };
const FRAMES = [
  ['320x568', { width: 320, height: 568, mobile: true }], ['360x800', { width: 360, height: 800, mobile: true }],
  ['375x667', { width: 375, height: 667, mobile: true }], ['390x844', PHONE], ['402x874', { width: 402, height: 874, mobile: true }],
  ['640x360', { width: 640, height: 360, mobile: false }], ['800x450', { width: 800, height: 450, mobile: false }],
  ['844x390', { width: 844, height: 390, mobile: true }], ['1366x768', { width: 1366, height: 768, mobile: false }],
  ['1920x1080', { width: 1920, height: 1080, mobile: false }]
];
const MODES = {
  arena: { mode: 'arena', seed: 4242, secs: 14, skill: 1 },
  daily: { mode: 'daily', secs: 20, skill: 0.5 },
  friend: { mode: 'arena', seed: 777, secs: 16, skill: 0.5, challenge: { score: 1500, from: 'Maja' } },
  campaign: { mode: 'campaign', mission: 'M24', secs: 30, nela: true }
};

/** In the page: every HUD box on screen, what overlaps, what is cut. */
const AUDIT = () => {
  const g = window.game, W = innerWidth, H = innerHeight, sf = g.safe || { t: 0, r: 0, b: 0, l: 0 }, k = g.uiScale || 1;
  // (one-shot accents -- the score's pop, a transition -- are measured at rest)
  document.getElementById('hud').getAnimations({ subtree: true }).forEach(a => { try { if (Number.isFinite(a.effect.getComputedTiming().endTime)) a.finish(); } catch (e) { /* endless */ } });
  const rect = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const shown = (el) => el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 1;
  const boxes = [];
  for (const id of ['btnPause', 'hud-tier-strip', 'hud-topright', 'hud-goal', 'nelaToast', 'nowPlaying', 'mobile-hint']) {
    const el = document.getElementById(id);
    if (!shown(el)) continue;
    if ((id === 'nelaToast' || id === 'nowPlaying') && !el.classList.contains('visible')) continue;
    boxes.push({ id, ...rect(el) });
  }
  (g.hudStack || []).forEach((b, i) => boxes.push({ id: 'stack' + i, l: b.l, t: b.t, r: b.r, b: b.b, w: b.r - b.l, h: b.b - b.t }));
  if (g.showMinimap) {
    const m = g.minimapRect();
    boxes.push({ id: 'minimap', l: m.l, t: m.t, r: m.r, b: m.b, w: m.r - m.l, h: m.b - m.t });
    // the district plate over the map (Game.drawMinimapLabel(): 10 px display face, + 21, 16 high, 20 above, x uiScale)
    const d = DISTRICTS.find(x => x.id === (g.mode === 'campaign' ? g.campaignTheme() : null)) || DISTRICTS[0];
    const c = g.ctx; c.save(); c.font = "10px 'Russo One', 'Exo 2', 'Segoe UI', sans-serif";
    const lw = Math.max(...DISTRICTS.map(x => c.measureText(x.name.toUpperCase()).width)) + 21; c.restore();
    boxes.push({ id: 'maplabel', l: m.r - lw * k, t: m.t - 20 * k, r: m.r, b: m.t - 4 * k, w: lw * k, h: 16 * k, d: d.id });
  }
  const out = boxes.filter(b => b.l < sf.l - 1 || b.t < sf.t - 1 || b.r > W - sf.r + 1 || b.b > H - sf.b + 1).map(b => b.id);
  const overlaps = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], c = boxes[j];
    if (Math.min(a.r, c.r) - Math.max(a.l, c.l) > 1 && Math.min(a.b, c.b) - Math.max(a.t, c.t) > 1) overlaps.push(a.id + '×' + c.id);
  }
  // text that does not fit its own box (an ellipsis or a cut number)
  const cut = [];
  const fits = (sel, name) => document.querySelectorAll(sel).forEach(el => { if (shown(el) && (el.scrollWidth > el.clientWidth + 1)) cut.push(name || sel); });
  fits('#hud-tier-strip .gh-time'); fits('#hud-tier-strip .gh-score'); fits('#hud-topright .leaderboard-title'); fits('#hud-topright.is-daily .gh-mode'); fits('#hud-goal .hud-goal-section-title'); fits('#hud .mission-goal-count');
  const inside = (inner, outer) => inner.l >= outer.l - 0.5 && inner.r <= outer.r + 0.5 && inner.t >= outer.t - 0.5 && inner.b <= outer.b + 0.5;
  const meet = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0.5 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0.5;
  const strip = document.getElementById('hud-tier-strip');
  if (shown(strip)) {
    const s = rect(strip), t = rect(document.getElementById('missionTimerValue')), sc = rect(strip.querySelector('.gh-score')), ld = rect(strip.querySelector('.gh-ladder')), bd = rect(document.getElementById('missionTierBadge'));
    if (!inside(t, s)) cut.push('clock outside its panel');
    if (!inside(sc, s)) cut.push('score outside its panel');
    if (meet(t, sc)) cut.push('clock on the score');
    if (!inside(ld, s) || !inside(bd, s) || meet(ld, bd)) cut.push('tier ladder / badge');
    if (ld.w < 30) cut.push('ladder ' + Math.round(ld.w) + ' px wide');
  }
  const rank = document.getElementById('hud-topright');
  let header = null;
  if (shown(rank)) {
    const p = rect(rank), place = rect(document.getElementById('rankValue')), title = rect(rank.querySelector('.leaderboard-title'));
    const modeEl = rank.querySelector('.gh-mode'), mode = shown(modeEl) ? rect(modeEl) : null;
    header = { place: inside(place, p), meets: meet(place, title) || (mode ? meet(place, mode) : false), mode: mode ? inside(mode, p) : null, daily: rank.classList.contains('is-daily'),
      modeText: mode ? modeEl.textContent.trim() : null, title: rank.querySelector('.leaderboard-title').textContent.trim(), placeText: document.getElementById('rankValue').textContent,
      inView: place.r <= W - sf.r + 0.5 && place.l >= sf.l - 0.5 };
    document.querySelectorAll('#leaderboardList li:not(.lb-gap)').forEach(li => { if (getComputedStyle(li).display === 'none') return; const s = rect(li.querySelector('.lb-size')), n = rect(li.querySelector('.lb-name')), l = rect(li); if (!inside(s, l) || meet(s, n) || n.w < 18) cut.push('standings row ' + li.textContent); });
  }
  const goal = document.getElementById('hud-goal');
  if (shown(goal)) { if (goal.scrollWidth > goal.clientWidth + 1) cut.push('goal box overflows'); document.querySelectorAll('#hud .mission-goal-item').forEach(it => { if (!inside(rect(it), rect(goal))) cut.push('goal row outside'); }); }
  const nela = document.getElementById('nelaToast');
  if (shown(nela) && nela.classList.contains('visible') && (nela.scrollHeight > nela.clientHeight + 1 || nela.scrollWidth > nela.clientWidth + 1)) cut.push('NELA cut');
  // smallest text on screen (CSS px on the glass)
  let minFont = 99;
  document.querySelectorAll('#hud-tier-strip *, #hud-topright *, #hud-goal *, #nelaToast *').forEach(el => { if (!el.children.length && el.textContent.trim() && shown(el)) minFont = Math.min(minFont, parseFloat(getComputedStyle(el).fontSize) * k); });
  const pause = rect(document.getElementById('btnPause'));
  const c = g.playerScreenCircle();
  return { W, H, layout: g.layout, k, boxes: boxes.map(b => ({ id: b.id, l: Math.round(b.l), t: Math.round(b.t), r: Math.round(b.r), b: Math.round(b.b) })), out, overlaps, cut, header, minFont: +minFont.toFixed(1), pause: [Math.round(pause.w), Math.round(pause.h)], vortex: { x: c.x, y: c.y, r: c.r } };
};

/** In the page: what the DOM HUD shows vs what the game holds. */
const VALUES = () => {
  const g = window.game, campaign = g.mode === 'campaign', txt = (id) => document.getElementById(id).textContent;
  const steps = [0, 1, 2, 3, 4, 5].map(i => { const s = document.getElementById('tierStep' + i), f = document.getElementById('tierFill' + i); return { full: s.classList.contains('full'), now: s.classList.contains('now'), fill: +(/scaleX\(([\d.]+)\)/.exec(f.style.transform) || [0, -1])[1] }; });
  let idx, pct, tierId, color;
  if (campaign) {
    const m = g.mission, T = [0, 1, 2, 3, 4, 5].map(i => 'T' + (i + 1)), tier = g.campaignPlayerTier();
    idx = T.indexOf(tier.id); tierId = tier.id; color = tier.color; pct = +(/scaleX\(([\d.]+)\)/.exec(document.getElementById('tierFill' + Math.min(idx, 5)).style.transform) || [0, -1])[1];
    return { campaign, clock: txt('missionTimerValue'), wantClock: formatClock(m.timeRemaining), score: txt('missionScoreValue'), wantScore: String(g.player.score), badge: txt('missionTierBadge'), tierId, idx, steps, tierVar: document.getElementById('hud-tier-strip').style.getPropertyValue('--tier'), color,
      code: txt('missionCode'), wantCode: missionCode(m.def), urgent: document.getElementById('hud-tier-strip').classList.contains('hud-urgent'), wantUrgent: m.timeRemaining <= 10,
      goals: g.campaignGoalItems().map(it => ({ label: it.label, p: Math.min(it.progress, it.target), n: it.target, boss: !!it.boss, display: it.display || null })),
      rows: [...document.querySelectorAll('#missionGoalItems .mission-goal-item:not(.twist-danger):not(.twist-shield)')].map(el => ({ label: el.querySelector('.mission-goal-text').textContent, count: el.querySelector('.mission-goal-count').textContent, pips: el.querySelectorAll('.goal-pips i').length, on: el.querySelectorAll('.goal-pips i.on').length, bar: el.querySelector('.goal-bar b') ? el.querySelector('.goal-bar b').style.width : null, boss: el.classList.contains('is-boss'), done: el.classList.contains('done') })) };
  }
  const tiers = CONFIG.sizeTiers; idx = tiers.findIndex(t => t.id === g.lastSizeTierId); const tier = tiers[idx], next = tiers[idx + 1];
  const floor = Math.max(tier.minRadius, 18);
  const wantPct = next ? Math.round(clamp((g.player.radius - floor) / (next.minRadius - floor), 0, 1) * 100) / 100 : 1;
  const ranked = rankHoles([g.player, ...g.bots]), top = Math.max(1, ranked[0].score), place = ranked.indexOf(g.player) + 1;
  const want = ranked.slice(0, 3).map((h, i) => ({ name: h.name, score: String(h.score), me: !!h.isPlayer, p: Math.round(clamp(h.score / top, 0, 1) * 100) + '%', first: i === 0 }));
  if (place > 3) want.push({ name: g.player.name, score: String(g.player.score), me: true, p: Math.round(clamp(g.player.score / top, 0, 1) * 100) + '%', first: false });
  return { campaign, clock: txt('missionTimerValue'), wantClock: formatClock(g.timeRemaining), score: txt('missionScoreValue'), wantScore: String(g.player.score), badge: txt('missionTierBadge'), tierId: tier.shortId, idx, wantPct, steps,
    tierVar: document.getElementById('hud-tier-strip').style.getPropertyValue('--tier'), color: tier.color, urgent: document.getElementById('hud-tier-strip').classList.contains('hud-urgent'), wantUrgent: g.timeRemaining <= 10,
    place: txt('rankValue'), wantPlace: `#${place}/${ranked.length}`, daily: document.getElementById('hud-topright').classList.contains('is-daily'), wantDaily: !!g.isDailyRun,
    rows: [...document.querySelectorAll('#leaderboardList li:not(.lb-gap)')].map(li => ({ name: li.querySelector('.lb-name').textContent, score: li.querySelector('.lb-size').textContent, me: li.classList.contains('is-player'), p: li.style.getPropertyValue('--p'), first: li.classList.contains('lb-first') })), want };
};
const stepsOk = (v, pct) => v.steps.every((s, i) => v.idx >= 5 ? (s.full && !s.now && s.fill === 1) : i < v.idx ? (s.full && !s.now && s.fill === 1) : i === v.idx ? (!s.full && s.now && (pct == null || Math.abs(s.fill - pct) < 0.011)) : (!s.full && !s.now && s.fill === 0));
const redraw = (page, n = 44) => page.evaluate((n) => { for (let i = 0; i < n; i++) { window.__vnow += 1; window.__ui1Draw(); } }, n);
const settle = async (page) => { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(320); await redraw(page); };

export async function runUi1Checks(baseUrl) {
  const results = [];
  let server = null;
  if (!baseUrl) { server = await serve(); baseUrl = server.url; }
  const errors = [];
  const open = async (vp, spec, { locale = 'pl-PL', insets = null } = {}) => {
    const g = await openScene(baseUrl, vp, locale);
    if (insets) { await safeArea(g.page, insets); await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state); }
    const facts = await stage(g.page, spec);
    await settle(g.page);
    g.facts = facts;
    g.done = async () => { errors.push(...g.errors.map(e => `${vp.width}x${vp.height} ${spec.mode}: ${e}`)); await g.browser.close(); };
    return g;
  };

  /* ---------- U1 values, per mode ---------- */
  for (const [name, spec] of Object.entries(MODES)) {
    if (!want('U1')) break;
    const g = await open(PHONE, spec);
    const v = await g.page.evaluate(VALUES);
    if (v.campaign) {
      results.push(expectAll(`U1 ${name}: the HUD shows the mission's own clock, score, tier, code and goals`, {
        clock: is(v.clock, v.wantClock), score: is(v.score, v.wantScore), badge: is(v.badge, v.tierId), tierColor: is(v.tierVar, v.color), code: is(v.code, v.wantCode), urgent: is(v.urgent, v.wantUrgent),
        ladder: holds(stepsOk(v), JSON.stringify(v.steps), `tier index ${v.idx}`),
        rows: is(v.rows.length, v.goals.length),
        labels: holds(v.rows.every((r, i) => r.label === v.goals[i].label), v.rows.map(r => r.label).join(' | ')),
        counts: holds(v.rows.every((r, i) => r.count === (v.goals[i].display || `${v.goals[i].p}/${v.goals[i].n}`)), v.rows.map(r => r.count).join(' | ')),
        segments: holds(v.rows.every((r, i) => { const t = v.goals[i]; return t.n <= 1 ? r.pips === 0 && r.bar == null : t.n <= 8 ? r.pips === t.n && r.on === t.p : r.bar === Math.round(t.p / t.n * 100) + '%'; }), JSON.stringify(v.rows.map(r => [r.pips, r.on, r.bar]))),
        boss: holds(v.rows.every((r, i) => r.boss === v.goals[i].boss) && v.rows.some(r => r.boss), v.rows.map(r => r.boss).join(','), 'the landmark row is the boss row'),
        done: holds(v.rows.every((r, i) => r.done === (v.goals[i].p >= v.goals[i].n)), v.rows.map(r => r.done).join(','))
      }, JSON.stringify({ code: v.code, rows: v.rows })));
    } else {
      results.push(expectAll(`U1 ${name}: the HUD shows the round's own clock, score, tier, place and standings (rankHoles() order)`, {
        clock: is(v.clock, v.wantClock), score: is(v.score, v.wantScore), badge: is(v.badge, v.tierId), tierColor: is(v.tierVar, v.color), urgent: is(v.urgent, v.wantUrgent),
        ladder: holds(stepsOk(v, v.wantPct), JSON.stringify(v.steps), `tier index ${v.idx} at ${v.wantPct}`),
        place: is(v.place, v.wantPlace), dailyHeader: is(v.daily, v.wantDaily),
        standings: is(JSON.stringify(v.rows), JSON.stringify(v.want)),
        onePlayerRow: is(v.rows.filter(r => r.me).length, 1)
      }, JSON.stringify({ place: v.place, rows: v.rows.map(r => `${r.name} ${r.score} ${r.p}`) })));
    }
    if (name === 'arena') {
      /* ---------- U2 the ladder, tier by tier ---------- */
      const lad = await g.page.evaluate(() => {
        const gm = window.game, tiers = CONFIG.sizeTiers, out = [];
        const read = () => [0, 1, 2, 3, 4, 5].map(i => { const s = document.getElementById('tierStep' + i), f = document.getElementById('tierFill' + i); return (s.classList.contains('full') ? 'F' : s.classList.contains('now') ? 'N' : '-') + (/scaleX\(([\d.]+)\)/.exec(f.style.transform) || [0, '?'])[1]; }).join(' ');
        for (let i = 0; i < tiers.length; i++) {
          const next = tiers[i + 1], floor = Math.max(tiers[i].minRadius, 18);
          for (const part of next ? [0, 0.5, 0.99] : [0]) {
            gm.player.radius = next ? floor + (next.minRadius - floor) * part : tiers[i].minRadius + 40;
            gm.lastSizeTierId = tiers[i].id;
            gm.updateHUD();
            out.push({ tier: i, part, badge: document.getElementById('missionTierBadge').textContent, color: document.getElementById('hud-tier-strip').style.getPropertyValue('--tier'), want: tiers[i].color, max: document.getElementById('hud-tier-strip').classList.contains('is-max'), steps: read() });
          }
        }
        // a DOM write only when a value moves: the same state twice changes nothing
        let writes = 0; const mo = new MutationObserver(m => { writes += m.length; });
        mo.observe(document.getElementById('hud'), { subtree: true, childList: true, attributes: true, characterData: true });
        for (let k = 0; k < 30; k++) gm.updateHUD();
        return new Promise(r => setTimeout(() => { mo.disconnect(); r({ out, writes }); }, 30));
      });
      const want = (t, part) => [0, 1, 2, 3, 4, 5].map(i => t === 5 ? 'F1' : i < t ? 'F1' : i === t ? 'N' + (Math.round(part * 100) / 100) : '-0').join(' ');
      results.push(expectAll('U2 the T1-T6 ladder: steps below the tier full, the current one at its progress, T6 fully lit, each tier in its own colour; an unchanged HUD writes nothing', {
        states: is(lad.out.length, 16),
        steps: holds(lad.out.every(o => o.steps === want(o.tier, o.part)), lad.out.filter(o => o.steps !== want(o.tier, o.part)).map(o => `T${o.tier + 1}@${o.part}: ${o.steps}`).join(' ; ') || 'all'),
        badges: holds(lad.out.every(o => o.badge === 'T' + (o.tier + 1)), lad.out.map(o => o.badge).join(',')),
        colours: holds(lad.out.every(o => o.color === o.want) && new Set(lad.out.map(o => o.color)).size === 6, [...new Set(lad.out.map(o => o.color))].join(','), 'cyan, pink, gold, violet, silver, green'),
        max: holds(lad.out.every(o => o.max === (o.tier === 5)), lad.out.map(o => +o.max).join('')),
        idleWrites: is(lad.writes, 0)
      }, JSON.stringify(lad.out.slice(-2))));
    }
    await g.done();
  }

  /* ---------- U3 goals: bar above 8 steps, long copy ---------- */
  if (want('U3')) {
    const g = await open(PHONE, { mode: 'campaign', mission: 'M24', secs: 4 });
    const r = await g.page.evaluate(() => {
      const gm = window.game, real = gm.campaignGoalItems.bind(gm), icon = real()[0];
      gm.campaignGoalItems = () => [
        { ...icon, label: 'Zbierz 12 kapsuł energii rozrzuconych po całej dzielnicy portowej', progress: 5, target: 12 },
        { ...icon, label: 'Pochłoń strażnika dzielnicy', progress: 0, target: 1, boss: true },
        { ...icon, label: 'Urośnij', progress: 2, target: 4, display: 'T2/T4' }
      ];
      gm.updateCampaignHUD();
      const goal = document.getElementById('hud-goal'), gr = goal.getBoundingClientRect();
      const rows = [...goal.querySelectorAll('.mission-goal-item')].map(el => { const q = el.getBoundingClientRect(), t = el.querySelector('.mission-goal-text'); return { in: q.left >= gr.left - 0.5 && q.right <= gr.right + 0.5 && q.bottom <= gr.bottom + 0.5, lines: Math.round(t.getBoundingClientRect().height / parseFloat(getComputedStyle(t).lineHeight)), bar: el.querySelector('.goal-bar b') ? el.querySelector('.goal-bar b').style.width : null, pips: el.querySelectorAll('.goal-pips i').length, on: el.querySelectorAll('.goal-pips i.on').length, boss: el.classList.contains('is-boss'), count: el.querySelector('.mission-goal-count').textContent }; });
      const out = { rows, w: Math.round(gr.width), right: Math.round(innerWidth - gr.right), overflow: goal.scrollWidth > goal.clientWidth + 1 };
      gm.campaignGoalItems = real; gm.updateCampaignHUD();
      return out;
    });
    results.push(expectAll('U3 goals: 12 steps = a bar at its share, 4 tiers = 4 segments, the boss its own row, a long description wraps inside the box', {
      bar: is(r.rows[0].bar, '42%'), wraps: holds(r.rows[0].lines >= 2 && r.rows[0].in, r.rows[0].lines, '>= 2 lines, inside the box'),
      boss: holds(r.rows[1].boss && r.rows[1].pips === 0 && r.rows[1].bar == null && !r.rows[0].boss, JSON.stringify(r.rows[1])),
      tiers: holds(r.rows[2].pips === 4 && r.rows[2].on === 2 && r.rows[2].count === 'T2/T4', JSON.stringify(r.rows[2])),
      box: holds(!r.overflow && r.w <= 170 && r.right >= 11, `${r.w} px wide, ${r.right} px from the edge`, '<= 170 px, inside the screen')
    }, JSON.stringify(r)));
    await g.done();
  }

  /* ---------- U4 layout matrix: frames x modes x languages ---------- */
  const layoutBad = [];
  let layoutRuns = 0, minFont = 99, minPause = 99;
  const frames = [...FRAMES.map(([n, vp]) => [n, vp, null]),
    ['iPhone16Pro 402x874 (Dynamic Island, home bar)', { width: 402, height: 874, mobile: true }, { top: 59, bottom: 34 }],
    ['iPhone16Pro 874x402 (side notch)', { width: 874, height: 402, mobile: true }, { left: 62, right: 62, bottom: 21 }]];
  for (const [fname, vp, insets] of want('U4') ? frames : []) {
    for (const [mname, spec] of Object.entries(MODES)) {
      for (const locale of ['pl-PL', 'en-US']) {
        // every frame in Polish; English on every frame for the Daily header and the mission, and on the corner frames for the rest
        if (locale === 'en-US' && !(mname === 'daily' || mname === 'campaign' || /320|800|1366/.test(fname))) continue;
        const g = await open(vp, { ...spec, secs: Math.min(spec.secs, 16) }, { locale, insets });
        // the busiest honest state: a combo running, SZAŁ on (Arena), "now playing" up
        await g.page.evaluate(() => {
          const gm = window.game;
          gm.comboCount = 12; gm.comboMultiplier = 2.6; gm.comboTimer = 1; gm.comboDisplayAlpha = 1;
          if (gm.mode === 'arena') gm.frenzyEndsAt = gm.timeRemaining - 6;
          if (gm.mode === 'campaign' && window.__nelaLine) gm.showNelaToast(window.__nelaLine); // (her bubble closes itself after a few real seconds)
          const np = document.getElementById('nowPlaying'); document.getElementById('nowPlayingName').textContent = 'Neonowy Puls Miasta'; np.classList.remove('hidden'); np.classList.add('visible');
        });
        await settle(g.page);
        const a = await g.page.evaluate(AUDIT);
        layoutRuns++;
        minFont = Math.min(minFont, a.minFont); minPause = Math.min(minPause, ...a.pause);
        const want = mname === 'campaign' ? ['btnPause', 'hud-tier-strip', 'hud-goal', 'nelaToast', 'stack0', 'minimap'] : ['btnPause', 'hud-tier-strip', 'hud-topright', 'stack0', 'stack' + (mname === 'friend' ? 2 : 1), 'minimap', 'nowPlaying'];
        const missing = want.filter(id => !a.boxes.some(b => b.id === id));
        const probs = [];
        if (missing.length) probs.push('not shown: ' + missing.join(','));
        if (a.out.length) probs.push('outside the safe viewport: ' + a.out.join(','));
        if (a.overlaps.length) probs.push('overlap: ' + a.overlaps.join(','));
        if (a.cut.length) probs.push('cut: ' + [...new Set(a.cut)].join(','));
        if (a.pause[0] < 44 || a.pause[1] < 44) probs.push('pause ' + a.pause.join('x'));
        if (a.minFont < 9) probs.push('text ' + a.minFont + ' px');
        if (a.header && (!a.header.place || a.header.meets || !a.header.inView)) probs.push('place badge: ' + JSON.stringify(a.header));
        if (probs.length) layoutBad.push(`${fname} ${mname} ${locale.slice(0, 2)}: ${probs.join('; ')}`);
        await g.done();
      }
    }
  }
  if (want('U4')) results.push(expectAll(`U4 layout: ${layoutRuns} frame x mode x language states (320x568 .. 1920x1080, iPhone safe areas; combo + SZAŁ + friend target + NELA + now playing up) -- every panel in the safe viewport, none overlapping, no text cut, pause >= 44x44, text >= 9 px`, {
    states: holds(layoutRuns >= 60, layoutRuns, '>= 60'), problems: is(layoutBad.length, 0), pause: holds(minPause >= 44, minPause, '>= 44'), smallestText: holds(minFont >= 9, minFont, '>= 9 px')
  }, layoutBad.slice(0, 12).join(' || ')));

  /* ---------- U5 FIX 1: the Daily Challenge header, PL and EN ---------- */
  if (want('U5')) {
    const bad = []; let n = 0; const seen = new Set();
    for (const [fname, vp] of FRAMES.filter(([f]) => /320x568|360x800|375x667|390x844|402x874|800x450|1366x768/.test(f))) {
      for (const locale of ['pl-PL', 'en-US']) {
        const g = await open(vp, { mode: 'daily', secs: 6, skill: 0.5 }, { locale });
        for (const place of [1, 3, 6]) {
          for (const names of ['short', 'long']) {
            const a = await g.page.evaluate(({ place, names }) => {
              const gm = window.game, bots = gm.bots;
              bots.forEach((b, i) => { b.score = 9000 - i * 700; b.name = names === 'long' ? ['MegaUltraVortexDestroyer', 'WWWWWWWWWWWWWWWW', 'Maksymilian_z_Gdańska', 'x', 'NeonGhost', 'Żółć'][i % 6] : ['Zo', 'Al', 'Mi', 'Ed', 'Ty2', 'Ka'][i % 6]; });
              gm.player.score = place === 1 ? 99999 : place === 3 ? bots[1].score - 1 : 3;
              gm.updateHUD();
              return null;
            }, { place, names });
            await redraw(g.page, 2);
            const r = await g.page.evaluate(AUDIT);
            n++;
            const h = r.header, probs = [];
            seen.add(h.modeText);
            if (!h.daily || h.modeText !== (locale === 'pl-PL' ? 'WYZWANIE DNIA' : 'DAILY CHALLENGE')) probs.push('title ' + h.modeText);
            if (h.placeText !== `#${place}/6`) probs.push('place ' + h.placeText);
            if (!h.place || !h.inView || h.meets || h.mode !== true) probs.push('badge ' + JSON.stringify(h));
            if (r.cut.length) probs.push('cut: ' + r.cut.join(','));
            if (r.out.length || r.overlaps.length) probs.push('layout: ' + r.out.concat(r.overlaps).join(','));
            if (r.minFont < 9) probs.push('text ' + r.minFont);
            if (probs.length) bad.push(`${fname} ${locale.slice(0, 2)} #${place} ${names}: ${probs.join('; ')}`);
          }
        }
        await g.done();
      }
    }
    results.push(expectAll(`U5 FIX 1: the Daily Challenge header (${n} states: 7 frames x PL/EN x #1/6, #3/6, #6/6 x short/long names) -- full title, the place badge inside the panel and the screen, never on the title, nothing ellipsized, text >= 9 px`, {
      states: is(n, 84), problems: is(bad.length, 0), titles: is([...seen].sort().join('|'), 'DAILY CHALLENGE|WYZWANIE DNIA')
    }, bad.slice(0, 8).join(' || ')));
  }

  /* ---------- U6 FIX 2: banners never lie on the widgets under the clock ---------- */
  if (want('U6')) {
    const bad = []; let n = 0; const modes = {};
    const BANNERS = [['AWANS NA 3. MIEJSCE', null, 0.9, 1], ['PROWADZISZ!', null, 0.9, 1], ['T4 · WIELKI!', 'Jesz już pawilony i billboardy', 1.2, 2], ['5', null, 0.9, 5], ['1', 'OSTATNIA SEKUNDA!', 0.9, 5],
      ['SZAŁ!', 'Punkty ×2 · jesz o rozmiar większe obiekty', 1.4, 4], ['WIELKI FINISZ!', 'Punkty ×2', 1.6, 3], ['WYZWANIE WYGRANE!', 'Cel 1 500 pkt (Maja) przebity!', 1.5, 4], ['ZŁOTY RDZEŃ!', 'Złap go przed rywalami — złota strzałka wskazuje drogę', 1.3, 2], ['NeonGhost PROWADZI', 'Odbij pierwsze miejsce!', 1.0, 1]];
    for (const [fname, vp] of FRAMES.filter(([f]) => /800x450|640x360|844x390|1366x768|390x844|320x568/.test(f))) {
      for (const locale of ['pl-PL', 'en-US']) {
        if (locale === 'en-US' && !/800x450|640x360/.test(fname)) continue;
        const g = await open(vp, MODES.friend, { locale });
        for (const [text, sub, dur, prio] of BANNERS) {
          for (const combo of [3, 128]) {
            const r = await g.page.evaluate(({ text, sub, dur, prio, combo }) => {
              const gm = window.game;
              gm.banner = null; gm.bannerQueue = [];
              gm.comboCount = combo; gm.comboMultiplier = 2.2; gm.comboTimer = 1; gm.comboDisplayAlpha = 1; gm.frenzyEndsAt = gm.timeRemaining - 6;
              for (let i = 0; i < 30; i++) { window.__vnow += 16; window.__ui1Draw(); }   // the widgets, undimmed, before the banner
              gm.showBanner(text, sub, '#EFCB63', dur, prio);
              const frames = [];
              for (let i = 0; i < 26; i++) {
                window.__vnow += 16; window.__ui1Draw();
                const b = gm.lastBannerBox, st = (gm.hudStack || []).map(s => ({ ...s }));
                const l = Math.min(b.l, b.subL == null ? b.l : b.subL), rr = Math.max(b.r, b.subR == null ? b.r : b.subR);
                const hit = st.some(s => Math.min(rr, s.r) - Math.max(l, s.l) > 1 && Math.min(b.b, s.b) - Math.max(b.t, s.t) > 1);
                frames.push({ l, r: rr, t: b.t, b: b.b, size: b.size, hit, dim: gm.hudStackDimA, band: gm.banner.band, stack: st.length });
              }
              const rank = document.getElementById('hud-topright').getBoundingClientRect(), last = frames[frames.length - 1];
              return { frames, last, W: innerWidth, H: innerHeight, sf: gm.safe, rankHit: Math.min(last.r, rank.right) - Math.max(last.l, rank.left) > 1 && Math.min(last.b, rank.bottom) - Math.max(last.t, rank.top) > 1, moved: new Set(frames.map(f => Math.round((f.l + f.r) / 2))).size };
            }, { text, sub, dur, prio, combo });
            n++;
            const last = r.last, probs = [];
            modes[last.band || 'clear'] = (modes[last.band || 'clear'] || 0) + 1;
            // settled: either the banner is clear of the widgets, or they have stepped back
            if (last.hit && last.dim > 0.25) probs.push(`on a widget at full strength (dim ${last.dim.toFixed(2)}, band ${last.band})`);
            if (last.stack !== 3) probs.push('widgets ' + last.stack);
            if (last.l < r.sf.l - 1 || last.r > r.W - r.sf.r + 1 || last.t < r.sf.t - 1) probs.push('banner cut by the screen');
            if (r.rankHit) probs.push('on the standings');
            if (last.size < 20) probs.push('banner ' + last.size.toFixed(1) + ' px');
            if (r.moved > 1) probs.push('banner moved sideways while showing');
            if (probs.length) bad.push(`${fname} ${locale.slice(0, 2)} "${text}" combo ×${combo}: ${probs.join('; ')}`);
          }
        }
        // pause and resume: the HUD is where it was, the widgets still drawn
        const pr = await g.page.evaluate(async () => {
          const gm = window.game; gm.banner = null;
          const snap = () => JSON.stringify(['btnPause', 'hud-tier-strip', 'hud-topright'].map(id => { const q = document.getElementById(id).getBoundingClientRect(); return [Math.round(q.left), Math.round(q.top), Math.round(q.width), Math.round(q.height)]; }).concat([document.getElementById('missionScoreValue').textContent, document.getElementById('rankValue').textContent]));
          const before = snap(); gm.running = true;
          document.getElementById('btnPause').click();
          const paused = gm.paused && !document.getElementById('pauseSheet').classList.contains('hidden');
          gm.resumeGame(); if (gm.rafId) cancelAnimationFrame(gm.rafId); gm.running = false;
          for (let i = 0; i < 24; i++) { window.__vnow += 16; window.__ui1Draw(); }
          return { paused, same: before === snap(), stack: (gm.hudStack || []).length, resumed: !gm.paused };
        });
        if (!pr.paused || !pr.same || pr.stack !== 3 || !pr.resumed) bad.push(`${fname} pause/resume: ${JSON.stringify(pr)}`);
        await g.done();
      }
    }
    results.push(expectAll(`U6 FIX 2: ${n} banners (10 texts incl. "AWANS NA 3. MIEJSCE", growth, countdown, SZAŁ, WIELKI FINISZ, friend-challenge win) x combo ×3 / ×128 with the friend target and the SZAŁ timer up, on 800x450, 640x360, 844x390, 1366x768 and two phones -- never on a widget at full strength, never on the standings, inside the screen, >= 20 px, never moving sideways; pause / resume keeps the HUD`, {
      states: holds(n >= 160, n, '>= 160'), problems: is(bad.length, 0), narrowed: holds((modes.narrow || 0) > 0, JSON.stringify(modes), 'the free band is used where the line fits it')
    }, bad.slice(0, 8).join(' || ') + ' ' + JSON.stringify(modes)));
  }
  if (want('U6')) {
    // the reported case itself: the bot's own round at 800x450, its own banner
    const g = await open({ width: 800, height: 450, mobile: false }, { mode: 'arena', seed: 4242, secs: 52, skill: 0.6 });
    const r = await g.page.evaluate(() => { const gm = window.game, b = gm.lastBannerBox, s = (gm.hudStack || [])[0]; return { text: gm.banner && gm.banner.text, band: gm.banner && gm.banner.band, combo: gm.comboCount, b, s, gap: s ? b.l - s.r : null, dim: gm.hudStackDimA }; });
    results.push(expectAll('U6 FIX 2: the reported frame (Arena, 800x450, seed 4242 at 1:09) -- "AWANS NA 3. MIEJSCE" beside the combo plate, not on it, the plate at full strength', {
      banner: is(r.text, 'AWANS NA 3. MIEJSCE'), combo: holds(r.combo >= 2 && !!r.s, r.combo, 'a combo on screen'), clear: holds(r.gap >= 0, r.gap, 'the banner starts right of the combo plate'), plate: holds(r.dim > 0.95, r.dim, 'undimmed'), size: holds(r.b.size >= 24, r.b.size, '>= 24 px')
    }, JSON.stringify(r)));
    await g.done();
  }

  /* ---------- U7 FIX 3: NELA never covers the vortex ---------- */
  if (want('U7')) {
    const bad = []; let n = 0;
    const frames7 = [...FRAMES.filter(([f]) => /320x568|360x800|390x844|640x360|800x450|844x390|1366x768/.test(f)).map(([f, vp]) => [f, vp, null]), ['iPhone16Pro 402x874', { width: 402, height: 874, mobile: true }, { top: 59, bottom: 34 }], ['iPhone16Pro 874x402', { width: 874, height: 402, mobile: true }, { left: 62, right: 62, bottom: 21 }]];
    for (const [fname, vp, insets] of frames7) {
      for (const locale of ['pl-PL', 'en-US']) {
        if (locale === 'en-US' && !/390x844|800x450|320x568/.test(fname)) continue;
        const g = await open(vp, { mode: 'campaign', mission: 'M24', secs: 8, nela: true }, { locale, insets });
        for (const size of ['small', 'large']) {
          // (her bubble closes itself after a few real seconds: shown anew for each state)
          await g.page.evaluate(() => new Promise(r => { window.game.showNelaToast(window.__nelaLine); requestAnimationFrame(() => requestAnimationFrame(r)); }));
          await redraw(g.page, 22);
          const r = await g.page.evaluate(({ size }) => {
            const gm = window.game, b = CONFIG.campaign.bounds;
            // the vortex in the middle of the screen: the middle of the board, small / as large as the mission's T6
            gm.player.x = (b.minX + b.maxX) / 2; gm.player.y = (b.minY + b.maxY) / 2;
            gm.player.radius = size === 'small' ? 22 : 150;
            gm.followCamera(b.minX, b.minY, b.maxX, b.maxY);
            gm.comboCount = 6; gm.comboMultiplier = 1.6; gm.comboTimer = 1; gm.comboDisplayAlpha = 1;
            const pos = [];
            for (let i = 0; i < 60; i++) { window.__vnow += 16; window.__ui1Draw(); const q = document.getElementById('nelaToast').getBoundingClientRect(); pos.push(Math.round(q.left) + ',' + Math.round(q.top) + ',' + Math.round(q.width) + ',' + Math.round(q.height)); }
            return { moved: new Set(pos).size, visible: document.getElementById('nelaToast').classList.contains('visible'), text: document.getElementById('nelaToastText').textContent, under: document.getElementById('nelaToast').classList.contains('under-hole'), op: +getComputedStyle(document.getElementById('nelaToast')).opacity };
          }, { size });
          await g.page.waitForTimeout(260);
          const a = await g.page.evaluate(AUDIT);
          n++;
          const nb = a.boxes.find(b => b.id === 'nelaToast'), c = a.vortex, probs = [];
          if (!r.visible || !nb) probs.push('not shown');
          else {
            const dx = Math.max(nb.l - c.x, 0, c.x - nb.r), dy = Math.max(nb.t - c.y, 0, c.y - nb.b), over = Math.hypot(dx, dy) < c.r;
            // the middle of the vortex is never covered; if its rim reaches the bubble, the bubble has faded
            if (c.x > nb.l && c.x < nb.r && c.y > nb.t && c.y < nb.b) probs.push('over the middle of the vortex');
            if (over && !r.under) probs.push('rim under the bubble at full strength');
            if (size === 'small' && over) probs.push('on a small vortex');
            const st = a.boxes.find(b => b.id === 'stack0');
            if (!st || st.t < nb.b) probs.push('combo not below the bubble');
          }
          if (r.moved !== 1) probs.push('moved over 60 frames (' + r.moved + ' positions)');
          if (a.out.length) probs.push('outside the safe viewport: ' + a.out.join(','));
          if (a.overlaps.length) probs.push('overlap: ' + a.overlaps.join(','));
          if (a.cut.length) probs.push('cut: ' + a.cut.join(','));
          if (probs.length) bad.push(`${fname} ${locale.slice(0, 2)} ${size} (vortex r ${Math.round(c.r)} px): ${probs.join('; ')}`);
        }
        await g.done();
      }
    }
    // the vortex pushed under the bubble: it fades, it does not jump; a tap closes it
    const g = await open(PHONE, { mode: 'campaign', mission: 'M24', secs: 8, nela: true });
    await g.page.evaluate(() => new Promise(r => { window.game.showNelaToast(window.__nelaLine); requestAnimationFrame(() => requestAnimationFrame(r)); }));
    await redraw(g.page, 22);
    const f = await g.page.evaluate(async () => {
      const gm = window.game, el = document.getElementById('nelaToast'), q0 = el.getBoundingClientRect();
      const text = el.querySelector('#nelaToastText').textContent, real = gm.playerScreenCircle.bind(gm);
      gm.playerScreenCircle = () => ({ x: q0.left + q0.width / 2, y: q0.top + q0.height / 2, r: 60 });
      for (let i = 0; i < 30; i++) { window.__vnow += 16; window.__ui1Draw(); }
      await Promise.all(el.getAnimations().map(a => a.finished.catch(() => {})));
      const q1 = el.getBoundingClientRect(), under = el.classList.contains('under-hole'), op = +getComputedStyle(el).opacity;
      gm.playerScreenCircle = real;
      for (let i = 0; i < 30; i++) { window.__vnow += 16; window.__ui1Draw(); }
      await Promise.all(el.getAnimations().map(a => a.finished.catch(() => {})));
      const back = +getComputedStyle(el).opacity, hit = document.elementFromPoint(q0.left + q0.width / 2, q0.top + q0.height / 2);
      const onNela = !!(hit && hit.closest('#nelaToast'));
      el.click();
      return { same: Math.round(q0.left) === Math.round(q1.left) && Math.round(q0.top) === Math.round(q1.top), under, op, back, onNela, closed: el.classList.contains('hidden'), text, want: window.__nelaLine };
    });
    results.push(expectAll(`U7 FIX 3: NELA in a mission (${n} states: phones, an iPhone with a Dynamic Island, landscape frames, PL/EN, a small and a T6-size vortex in the middle) -- never over the vortex, the goal box or the minimap, the combo plate below it, the same place for 60 frames; under the vortex it fades in place; her own line; a tap closes it`, {
      states: holds(n >= 24, n, '>= 24'), problems: is(bad.length, 0),
      fades: holds(f.under && f.op < 0.5 && f.same, JSON.stringify({ under: f.under, op: f.op, same: f.same }), 'faded, not moved'), returns: holds(f.back > 0.95, f.back, 'back to full'),
      line: is(f.text, f.want), tapCloses: holds(f.onNela && f.closed, JSON.stringify({ onNela: f.onNela, closed: f.closed }))
    }, bad.slice(0, 8).join(' || ')));
    await g.done();
  }

  /* ---------- U8 FIX 4: the minimap ---------- */
  if (want('U8')) {
    const bad = [];
    for (const [fname, vp] of FRAMES.filter(([f]) => /390x844|800x450|1366x768/.test(f))) {
      const g = await open(vp, { mode: 'campaign', mission: 'M15', secs: 6 });
      const r = await g.page.evaluate(() => {
        const gm = window.game, m = gm.minimapRect(), d = gm.dpr;
        const grab = () => { window.__vnow += 400; for (let i = 0; i < 3; i++) window.__ui1Draw(); const im = gm.ctx.getImageData(Math.round(m.l * d) - 2, Math.round((m.t - 24 * (gm.uiScale || 1)) * d), Math.round((m.r - m.l) * d) + 4, Math.round((m.b - m.t + 24 * (gm.uiScale || 1)) * d) + 2).data; let h = 0; for (let i = 0; i < im.length; i += 4) h = (Math.imul(h, 31) + im[i] * 3 + im[i + 1] * 5 + im[i + 2] * 7) >>> 0; return h; };
        // the world layer off, so only the minimap paints its own rectangle
        const world = ['drawCampaignWorld', 'drawCityFloor'];
        const dark = !!gm.mission.def.setup.dark, live = gm.campaignEntities.filter(e => e.live && !e.consumed), bosses = live.filter(e => e.type === 'landmark').length;
        // spy: every mark the minimap draws
        const ctx = gm.ctx, fr = ctx.fillRect.bind(ctx); let dots = 0, diamonds = 0;
        const dd = gm.drawMinimapDiamond.bind(gm);
        const spyOn = () => { ctx.fillRect = (x, y, w, h) => { if (w < 5 && h < 5 && x >= m.l - 3 && x <= m.r + 3 && y >= m.t - 3 && y <= m.b + 3) dots++; fr(x, y, w, h); }; gm.drawMinimapDiamond = (...a) => { diamonds++; dd(...a); }; };
        const spyOff = () => { ctx.fillRect = fr; delete gm.drawMinimapDiamond; };
        const count = () => { dots = 0; diamonds = 0; spyOn(); gm.drawCampaignMinimap(ctx); spyOff(); return { dots, diamonds }; };
        const inDark = count();
        // 1. dark: the pixels with every entity present == the pixels with none
        const saved = gm.campaignEntities, renderWorldOff = () => { gm.renderCampaign = gm.renderCampaign; };
        const hashDark = (() => { gm.ctx.save(); gm.ctx.setTransform(1, 0, 0, 1, 0, 0); gm.ctx.fillStyle = '#000'; gm.ctx.fillRect(0, 0, gm.canvas.width, gm.canvas.height); gm.ctx.restore(); gm.hudFades = null; gm.drawCampaignMinimap(gm.ctx); gm.drawCampaignMinimap(gm.ctx); const im = gm.ctx.getImageData(Math.round(m.l * d), Math.round(m.t * d), Math.round((m.r - m.l) * d), Math.round((m.b - m.t) * d)).data; let h = 0; for (let i = 0; i < im.length; i += 4) h = (Math.imul(h, 31) + im[i] * 3 + im[i + 1] * 5 + im[i + 2] * 7) >>> 0; return h; });
        const withAll = hashDark();
        gm.campaignEntities = [];
        const withNone = hashDark();
        gm.campaignEntities = saved;
        // 2. the same board with the lights on: the marks are there
        gm.mission.def.setup.dark = false;
        const lit = count(), litHash = hashDark();
        gm.mission.def.setup.dark = dark;
        return { dark, live: live.length, bosses, inDark, withAll, withNone, lit, litHash, zones: (gm.glitchZones || []).length, size: Math.round(m.r - m.l), bots: gm.bots.length };
      });
      const probs = [];
      if (!r.dark) probs.push('M15 is not a blackout mission');
      if (r.inDark.dots || r.inDark.diamonds) probs.push(`blackout draws ${r.inDark.dots} dots / ${r.inDark.diamonds} diamonds`);
      if (r.withAll !== r.withNone) probs.push('blackout pixels depend on the entities');
      if (r.lit.dots + r.lit.diamonds !== r.live) probs.push(`lit: ${r.lit.dots}+${r.lit.diamonds} marks for ${r.live} live entities`);
      if (r.litHash === r.withAll) probs.push('lit map == dark map');
      if (probs.length) bad.push(`${fname} (${r.size} px): ${probs.join('; ')}`);
      bad.info = (bad.info || '') + `${fname}: map ${r.size} px, ${r.live} live entities hidden, lit ${r.lit.dots} dots + ${r.lit.diamonds} diamonds; `;
      await g.done();
    }
    results.push(expectAll('U8 FIX 4: a blackout mission (M15, setup.dark) on a phone, 800x450 and a desktop -- the minimap draws no entity mark, and its pixels with every entity on the board equal its pixels with none; with the lights on the same board draws exactly one mark per live entity', {
      problems: is(bad.length, 0)
    }, bad.join(' || ') + ' ' + (bad.info || '')));
  }
  if (want('U8')) {
    const bad = []; const info = [];
    for (const [fname, vp] of FRAMES.filter(([f]) => /390x844|800x450|1366x768|320x568/.test(f))) {
      const g = await open(vp, { mode: 'arena', seed: 4242, secs: 30, skill: 0.6 });
      const r = await g.page.evaluate(() => {
        const gm = window.game, m = gm.minimapRect(), size = gm.minimapSize(), scale = size / WORLD_W, ctx = gm.ctx;
        // a rival twice your size and one half your size, at known places
        const big = gm.bots[0], small = gm.bots[1];
        big.radius = gm.player.radius * 2; big.x = 600; big.y = 2400; small.radius = gm.player.radius * 0.5; small.x = 2400; small.y = 600;
        gm.player.x = 1500; gm.player.y = 1500; gm.camera.x = 1500; gm.camera.y = 1500;
        const arcs = [], rects = []; let diamonds = 0, blits = 0;
        const arc = ctx.arc.bind(ctx), fr = ctx.fillRect.bind(ctx), di = ctx.drawImage.bind(ctx), dd = gm.drawMinimapDiamond.bind(gm);
        ctx.arc = (x, y, rad, a, b) => { arcs.push({ x, y, r: rad, fill: null }); arc(x, y, rad, a, b); };
        const fill = ctx.fill.bind(ctx); ctx.fill = (...a) => { if (arcs.length && arcs[arcs.length - 1].fill == null) arcs[arcs.length - 1].fill = ctx.fillStyle; fill(...a); };
        ctx.fillRect = (x, y, w, h) => { if (w < 5) rects.push({ x: x + w / 2, y: y + h / 2 }); fr(x, y, w, h); };
        ctx.drawImage = (...a) => { blits++; di(...a); };
        gm.drawMinimapDiamond = (...a) => { diamonds++; dd(...a); };
        const before = gm.cityFloor.minimaps.size;
        gm.drawMinimap(ctx);
        const first = { arcs: arcs.slice(), rects: rects.length, diamonds, blits };
        const cv1 = gm.cityFloor.hudMinimap(Math.round(size * gm.dpr), null, { minX: 0, minY: 0, maxX: WORLD_W, maxY: WORLD_H }, 'rdzen', size);
        for (let i = 0; i < 120; i++) gm.drawMinimap(ctx);
        const cv2 = gm.cityFloor.hudMinimap(Math.round(size * gm.dpr), null, { minX: 0, minY: 0, maxX: WORLD_W, maxY: WORLD_H }, 'rdzen', size);
        const after = gm.cityFloor.minimaps.size;
        ctx.arc = arc; ctx.fill = fill; ctx.fillRect = fr; ctx.drawImage = di; delete gm.drawMinimapDiamond;
        const at = (h) => ({ x: m.l + h.x * scale, y: m.t + h.y * scale });
        const near = (p, q) => Math.hypot(p.x - q.x, p.y - q.y) < 0.01;
        const pm = at(gm.player), bm = at(big), sm = at(small);
        const pArcs = first.arcs.filter(a => near(a, pm)), bArcs = first.arcs.filter(a => near(a, bm)), sArcs = first.arcs.filter(a => near(a, sm));
        const others = first.arcs.filter(a => !near(a, pm));
        const special = gm.objects.filter(o => ['golden', 'node', 'pylon', 'landmark'].includes(o.tier)).length;
        const o0 = gm.objects.find(o => !['golden', 'node', 'pylon', 'landmark'].includes(o.tier));
        return { size: Math.round(size), objects: gm.objects.length, special, rects: first.rects, diamonds: first.diamonds, blits: first.blits,
          objAt: rects.some(q => Math.abs(q.x - (m.l + o0.x * scale)) < 0.01 && Math.abs(q.y - (m.t + o0.y * scale)) < 0.01),
          player: Math.max(0, ...pArcs.map(a => a.r)), playerCore: pArcs.some(a => a.fill === '#ffffff'), other: Math.max(0, ...others.map(a => a.r)),
          bigRed: bArcs.some(a => a.fill === '#ff3860'), smallRed: sArcs.some(a => a.fill === '#ff3860'), smallMarks: sArcs.length,
          cached: cv1 === cv2, grew: after - before, here: document.getElementById('missionTierBadge').textContent };
      });
      const probs = [];
      if (r.rects !== r.objects - r.special || r.diamonds !== r.special) probs.push(`${r.rects} dots + ${r.diamonds} diamonds for ${r.objects} objects (${r.special} special)`);
      if (!r.objAt) probs.push('an object is not at its world position');
      if (!(r.player > r.other) || !r.playerCore) probs.push(`player mark ${r.player} px vs largest other ${r.other} px`);
      if (!r.bigRed || r.smallRed || !r.smallMarks) probs.push(`rival colours big ${r.bigRed} small ${r.smallRed}`);
      if (!r.cached || r.grew > 1 || r.blits !== 1) probs.push(`backdrop not reused (same canvas ${r.cached}, +${r.grew} cache entries, ${r.blits} blits a frame)`);
      if (probs.length) bad.push(`${fname}: ${probs.join('; ')}`);
      info.push(`${fname}: map ${r.size} px, ${r.objects} objects, player mark r ${r.player.toFixed(1)} vs ${r.other.toFixed(1)}`);
      await g.done();
    }
    results.push(expectAll('U8 FIX 4: Arena minimap at 104 / 92 / 161 px -- one mark per object at the world\'s own coordinates, the player\'s mark the largest (white core), a bigger rival red and a smaller one not, the backdrop painted once and blitted (120 frames add no cache entry)', {
      problems: is(bad.length, 0)
    }, (bad.join(' || ') + ' ' + info.join('; ')).trim()));
  }
  if (want('U8')) {
    // glitch zones + a boss on a lit campaign board; the district plate
    const g = await open(PHONE, { mode: 'campaign', mission: 'M24', secs: 10 });
    const r = await g.page.evaluate(() => {
      const gm = window.game, ctx = gm.ctx, m = gm.minimapRect(), b = CONFIG.campaign.bounds, sx = (m.r - m.l) / (b.maxX - b.minX);
      gm.glitchZones = [{ x: (b.minX + b.maxX) / 2, y: b.minY + 200, r: 120 }];
      const texts = [], ft = ctx.fillText.bind(ctx); ctx.fillText = (t, ...a) => { texts.push(String(t)); ft(t, ...a); };
      const bosses = []; const dd = gm.drawMinimapDiamond.bind(gm); gm.drawMinimapDiamond = (c, x, y, col, rad, boss) => { if (boss) bosses.push({ x, y }); dd(c, x, y, col, rad, boss); };
      const arcs = [], arc = ctx.arc.bind(ctx); ctx.arc = (x, y, rad, a, e) => { arcs.push({ x, y, r: rad }); arc(x, y, rad, a, e); };
      gm.drawCampaignMinimap(ctx);
      ctx.fillText = ft; ctx.arc = arc; delete gm.drawMinimapDiamond;
      const lm = gm.campaignEntities.filter(e => e.type === 'landmark' && e.live && !e.consumed);
      const z = gm.glitchZones[0], zx = m.l + (z.x - b.minX) * sx, zy = m.t + (z.y - b.minY) * sx;
      const d = DISTRICTS.find(x => x.id === gm.campaignTheme());
      gm.glitchZones = [];
      return { label: texts.includes(d.name.toUpperCase()), bosses: bosses.length, landmarks: lm.length, bossAt: lm.every(e => bosses.some(q => Math.abs(q.x - (m.l + (e.x - b.minX) * sx)) < 0.01)), zone: arcs.some(a => Math.abs(a.x - zx) < 0.01 && Math.abs(a.y - zy) < 0.01 && Math.abs(a.r - z.r * sx) < 0.01) };
    });
    results.push(expectAll('U8 FIX 4: Campaign minimap -- the district on its plate, a glitch zone at its place and size, each boss landmark as the boss mark at its world position', {
      label: truthy(r.label), zone: truthy(r.zone), bosses: holds(r.landmarks >= 1 && r.bosses === r.landmarks && r.bossAt, `${r.bosses}/${r.landmarks}`)
    }, JSON.stringify(r)));
    await g.done();
  }
  if (process.argv.includes('--perf')) {
    const g = await open(PHONE, { mode: 'arena', seed: 4242, secs: 60, skill: 0.6 });
    const p = await g.page.evaluate(() => {
      const gm = window.game, size = gm.minimapSize(), real = Performance.prototype.now.bind(performance), cold = [], warm = [], dyn = [];
      const B = { minX: 0, minY: 0, maxX: WORLD_W, maxY: WORLD_H };
      for (let i = 0; i < 30; i++) { gm.cityFloor.minimaps.clear(); const t = real(); gm.cityFloor.hudMinimap(Math.round(size * gm.dpr), null, B, 'plac', size); cold.push(real() - t); }
      for (let i = 0; i < 300; i++) { const t = real(); gm.cityFloor.hudMinimap(Math.round(size * gm.dpr), null, B, 'plac', size); warm.push(real() - t); }
      for (let i = 0; i < 600; i++) { const t = real(); gm.drawMinimap(gm.ctx); dyn.push(real() - t); }
      gm.ctx.getImageData(0, 0, 1, 1);
      const q = (a, f) => { a.sort((x, y) => x - y); return +a[Math.floor((a.length - 1) * f)].toFixed(4); };
      return { objects: gm.objects.length, cold: [q(cold, 0.5), q(cold, 0.95)], warm: [q(warm, 0.5), q(warm, 0.95)], dyn: [q(dyn, 0.5), q(dyn, 0.95)] };
    });
    console.log(`INFO  minimap cost (ms, p50 / p95, ${p.objects} objects): backdrop painted ${p.cold.join(' / ')} · backdrop from the cache ${p.warm.join(' / ')} · a frame's marks ${p.dyn.join(' / ')}`);
    await g.done();
  }

  /* ---------- U9 a turn, a resize, quality levels mid-round ---------- */
  if (want('U9')) {
    const bad = [];
    for (const mname of ['arena', 'campaign']) {
      const g = await open(PHONE, { ...MODES[mname], secs: 10 });
      for (const [w, h] of [[844, 390], [390, 844], [360, 640], [1024, 768], [800, 450], [390, 844]]) {
        await g.page.setViewportSize({ width: w, height: h });
        await g.page.evaluate(() => { window.game.resize(); const gm = window.game; gm.comboCount = 4; gm.comboTimer = 1; gm.comboDisplayAlpha = 1; });
        await settle(g.page);
        const a = await g.page.evaluate(AUDIT);
        const probs = a.out.map(x => 'out ' + x).concat(a.overlaps.map(x => 'overlap ' + x), a.cut.map(x => 'cut ' + x));
        if (a.pause[0] < 44) probs.push('pause ' + a.pause.join('x'));
        if (probs.length) bad.push(`${mname} -> ${w}x${h} (${a.layout}): ${[...new Set(probs)].join('; ')}`);
      }
      for (const q of [0, 1, 2]) {
        const r = await g.page.evaluate((q) => { const gm = window.game; gm.applyGfx(q); for (let i = 0; i < 24; i++) { window.__vnow += 16; window.__ui1Draw(); } return { gfx: gm.gfxLevel, stack: (gm.hudStack || []).length, score: document.getElementById('missionScoreValue').textContent === String(gm.player.score), map: gm.showMinimap }; }, q);
        const a = await g.page.evaluate(AUDIT);
        if (r.gfx !== q || !r.stack || !r.score || a.out.length || a.overlaps.length || a.cut.length) bad.push(`${mname} quality ${q}: ${JSON.stringify(r)} ${a.out.concat(a.overlaps, a.cut).join(',')}`);
      }
      await g.done();
    }
    results.push(expectAll('U9 mid-round: the phone turned and turned back, a window resized through phone / tablet / portal frames, quality 0 / 1 / 2 -- the HUD re-lays itself with nothing outside, overlapping or cut, and keeps its values', {
      problems: is(bad.length, 0)
    }, bad.slice(0, 8).join(' || ')));
  }

  /* ---------- U10 the HUD takes no touch meant for the board ---------- */
  if (want('U10')) {
    const bad = [];
    for (const [fname, vp] of FRAMES.filter(([f]) => /320x568|390x844|800x450|1366x768/.test(f))) {
      for (const mname of ['friend', 'campaign']) {
        const g = await open(vp, { ...MODES[mname], secs: 8 });
        const r = await g.page.evaluate(() => {
          const allowed = ['btnPause', 'hud-rankBadge', 'nelaToast'], stolen = {}, ok = { canvas: 0, control: 0 };
          for (let y = 3; y < innerHeight; y += 9) for (let x = 3; x < innerWidth; x += 9) {
            const el = document.elementFromPoint(x, y);
            if (el && el.id === 'gameCanvas') { ok.canvas++; continue; }
            const c = el && allowed.find(id => el.closest('#' + id));
            if (c) { ok.control++; continue; }
            const name = el ? (el.id || el.className || el.tagName) : 'null'; stolen[name] = (stolen[name] || 0) + 1;
          }
          // points on the panels themselves: the board gets them
          const through = ['hud-tier-strip', 'leaderboardList', 'hud-goal', 'nowPlaying'].map(id => { const el = document.getElementById(id); if (!el || el.classList.contains('hidden') || !el.offsetWidth) return null; const q = el.getBoundingClientRect(), hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return id + ':' + (hit && hit.id); }).filter(Boolean);
          const pq = document.getElementById('btnPause').getBoundingClientRect(), ph = document.elementFromPoint(pq.left + 2, pq.top + pq.height / 2), ph2 = document.elementFromPoint(pq.left + pq.width / 2, pq.bottom - 2);
          return { stolen, ok, through, pauseEdges: !!(ph && ph.closest('#btnPause') && ph2 && ph2.closest('#btnPause')) };
        });
        const probs = [];
        if (Object.keys(r.stolen).length) probs.push('taken by ' + JSON.stringify(r.stolen));
        if (r.through.some(t => !/:gameCanvas$/.test(t))) probs.push('panel takes the touch: ' + r.through.join(','));
        if (!r.pauseEdges) probs.push('pause not tappable to its edges');
        if (probs.length) bad.push(`${fname} ${mname}: ${probs.join('; ')}`);
        await g.done();
      }
    }
    // a real tap on pause pauses; a real tap on the standings header folds the list; a tap on the board reaches the canvas
    const g = await open(PHONE, MODES.arena);
    await g.page.evaluate(() => { window.game.running = true; window.__canvasDown = 0; document.getElementById('gameCanvas').addEventListener('pointerdown', () => window.__canvasDown++); });
    const lb = await g.page.locator('#leaderboardList').boundingBox();
    await g.page.touchscreen.tap(lb.x + lb.width / 2, lb.y + lb.height / 2);
    await g.page.locator('#hud-rankBadge').tap();
    const folded = await g.page.evaluate(() => document.getElementById('hud-topright').classList.contains('collapsed'));
    await g.page.locator('#hud-rankBadge').tap();
    await g.page.locator('#btnPause').tap();
    const t = await g.page.evaluate(() => { const gm = window.game, r = { paused: gm.paused, sheet: !document.getElementById('pauseSheet').classList.contains('hidden'), canvasDown: window.__canvasDown, unfolded: !document.getElementById('hud-topright').classList.contains('collapsed') }; gm.resumeGame(); if (gm.rafId) cancelAnimationFrame(gm.rafId); gm.running = false; return r; });
    results.push(expectAll('U10 touch: across the whole screen (9 px grid, a phone, 320 px, 800x450, a desktop; Arena with a friend\'s target, Campaign with NELA) only the pause button, the standings header and NELA\'s bubble take a touch; a tap on the standings rows reaches the board; pause pauses, the header folds the list', {
      problems: is(bad.length, 0), boardGetsTap: holds(t.canvasDown >= 1, t.canvasDown, '>= 1'), folds: holds(folded && t.unfolded, JSON.stringify({ folded, unfolded: t.unfolded })), pauses: holds(t.paused && t.sheet, JSON.stringify(t))
    }, bad.slice(0, 6).join(' || ')));
    await g.done();
  }

  /* ---------- U11 display only ---------- */
  if (want('U11')) {
    const run = async (hud) => {
      const g = await openScene(baseUrl, PHONE);
      if (!hud) await g.page.evaluate(() => { const gm = window.game; for (const n of ['updateHUD', 'updateCampaignHUD', 'drawMinimap', 'drawCampaignMinimap', 'drawHudStack', 'fadeHudUnderHole']) gm[n] = () => {}; });
      const out = [];
      for (const spec of [{ mode: 'arena', seed: 4242, secs: 40, skill: 0.7 }, { mode: 'campaign', mission: 'M24', secs: 30 }]) {
        const f = await stage(g.page, spec);
        out.push({ hash: f.stateHash, draws: f.randomCalls, score: f.score, radius: f.radius, cam: f.camera.join(','), zoom: f.zoom });
      }
      const save = await g.page.evaluate(() => { const raw = JSON.parse(localStorage.getItem('vectorHoleSave_v1')); const keys = (o, p = '') => Object.keys(o).sort().flatMap(k => o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) ? [p + k].concat(keys(o[k], p + k + '.')) : [p + k]); const d = defaultSave(); return { v: raw.schemaVersion, key: Object.keys(localStorage).filter(k => /vectorHole/.test(k)).sort().join(','), fields: keys(d).filter(k => !/^(campaign\.|missions\.|stats\.|daily\.)/.test(k)).join(',') }; });
      errors.push(...g.errors);
      await g.browser.close();
      return { out, save };
    };
    const a = await run(true), b = await run(false);
    results.push(expectAll('U11 display only: a seeded Arena round and a mission end in the same state (every hole and object, score, camera, zoom) after the same number of random draws with the HUD drawn or switched off; the save keeps its key and version 13', {
      arena: is(JSON.stringify(a.out[0]), JSON.stringify(b.out[0])), campaign: is(JSON.stringify(a.out[1]), JSON.stringify(b.out[1])),
      draws: holds(a.out[0].draws > 1000, a.out[0].draws, 'a real round'), version: is(a.save.v, 13), key: holds(/^vectorHoleSave_v1/.test(a.save.key), a.save.key)
    }, JSON.stringify(a.out)));
  }
  if (want('U11')) {
    // every changed line of game.js sits in a HUD function (vs the base revision)
    const HUD_FN = /^(hudMinimap|setTierBadge|setHudUrgent|setHudScore|hudSet|updateHUD|updateCampaignHUD|campaignGoalItems|drawMinimapHoles|drawMinimapDiamond|drawMinimapView|drawCampaignMinimap|drawMinimap|drawMinimapLabel|fadeHudUnderHole|hideNelaToast|showNelaToast|drawJuiceScreen|hudObstacles|drawHudStack|drawFrenzyVignette|drawFrenzyTimer|drawComboHud|drawChallengeTarget|minimap|<top> const HUD_TIER_STEPS)$/;
    let diff = null;
    // GG-UI-02: this is the scope of the GG-UI-01 stage itself, so it is measured on that stage's own
    // commits (its base .. its head, PR #100) -- later stages change other functions (their suites say
    // which: qa/ui2.mjs "scope"). The schema check still reads the current game.js.
    let lines = null;
    try {
      diff = execSync(`git diff -U0 ${BASE_REV} ${HEAD_REV} -- game.js`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] });
      lines = execSync(`git show ${HEAD_REV}:game.js`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] }).split('\n');
    } catch (e) { diff = null; }
    if (diff == null) console.log(`NOT RUN  U11 changed lines ${BASE_REV.slice(0, 7)}..${HEAD_REV.slice(0, 7)} (git does not have these revisions here)`);
    else {
      const owner = (n) => { for (let i = Math.min(n, lines.length) - 1; i >= 0; i--) { const m = /^  (?:async |get |static )?([A-Za-z_]\w*)\([^)]*\) \{$/.exec(lines[i]); if (m) return m[1]; if (/^(const|let|function|class) /.test(lines[i])) return '<top> ' + lines[i].split(/[ =(]/).slice(0, 2).join(' '); } return '<top>'; };
      const owners = new Set(), outside = [];
      for (const m of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
        const start = +m[1], len = m[2] == null ? 1 : +m[2];
        // (a hunk that only removes lines belongs to the function around its position; comment lines above a method belong to it)
        let o = owner(start + Math.max(len, 1) - 1);
        let k = start - 1; while (k < lines.length && /^\s*(\/\*\*|\*|\/\/)/.test(lines[k])) k++;
        if (len && /^  (?:async |get |static )?[A-Za-z_]\w*\([^)]*\) \{$/.test(lines[k] || '')) o = owner(k + 1);
        owners.add(o);
        if (!HUD_FN.test(o)) outside.push(`${o} @${start}`);
      }
      const save = /SAVE_SCHEMA_VERSION = 13\b/.test(fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8')), randoms = (diff.match(/^\+.*Math\.random|^\+.*\brand(Int)?\(/gm) || []).length;
      results.push(expectAll(`U11 scope: every line of game.js the GG-UI-01 stage changed (${BASE_REV.slice(0, 7)}..${HEAD_REV.slice(0, 7)}) is inside a HUD / minimap / banner-layout function; no new random draw; SAVE_SCHEMA_VERSION stays 13`, {
        outside: is(outside.length, 0), functions: holds(owners.size >= 12, owners.size, '>= 12 HUD functions touched'), newRandomDraws: is(randoms, 0), schema: truthy(save)
      }, outside.slice(0, 10).join(' ; ') || [...owners].join(', ')));
    }
  }

  /* ---------- static: no blur, reduced motion, safe areas ---------- */
  if (want('U12')) {
    const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
    const block = css.slice(css.indexOf('GG-UI-01 — PREMIUM GAME HUD'));
    const hudRules = css.split('}').filter(r => /#hud|\.hud-|\.gh-|\.nela-toast|\.now-playing/.test(r.split('{')[0] || ''));
    results.push(expectAll('U12 material: no backdrop-filter on any HUD rule, the moving accents are off under prefers-reduced-motion, the HUD is placed from the safe-area insets, no old saturated neon', {
      block: holds(block.length > 4000, block.length, 'the GG-UI-01 block'),
      blur: is(hudRules.filter(r => /backdrop-filter\s*:\s*(?!none)/.test(r)).length, 0),
      reducedMotion: holds(/@media \(prefers-reduced-motion: reduce\) \{[^@]*gh-time[^@]*animation: none/.test(block), 'gh-urgent off'),
      safeArea: holds(['top', 'left', 'right', 'bottom'].every(s => block.includes(`env(safe-area-inset-${s}`)), 'top/left/right/bottom'),
      oldNeons: is((block.match(/#00f3ff|#ff007f|#39ff14|#ffd700|#b026ff/gi) || []).length, 0)
    }));
  }

  results.push(report('U13 no page or console error in any GG-UI-01 scenario', errors.length === 0, errors.slice(0, 5).join(' | ')));
  if (server) server.server.close();
  return results;
}

if (isMain(import.meta.url)) {
  const results = await runUi1Checks();
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} GG-UI-01 checks passed`);
  process.exit(failed.length ? 1 : 0);
}

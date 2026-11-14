// GG-UI-02 "Premium Game Experience" -- Miasto, Dzielnice, the briefing,
// Warsztat, results and reward cards after the approved A+B hybrid
// (design/ui2/). The suite acts on the real game and checks consequences,
// not pictures:
//  1. Miasto: the LVL 1-6 rail, the percent and the next reward are the
//     save's own (every level), GRAJ is the biggest action and reachable on
//     every frame, the vortex on GRAJ is the worn look, nothing is written.
//  2. Dzielnice: twelve numbered tiles with the save's states, the campaign
//     counters, mission codes, the boss mark; CRITICAL FIX 1 (320 px: the
//     whole title, every district reachable and whole) and CRITICAL FIX 2
//     (GRAJ always in view and clickable while every goal, time, reward and
//     star condition can be brought into view) on six frames; the briefing
//     of every boss mission in PL and EN.
//  3. Warsztat: four categories of real cosmetics, live previews, the status
//     plate, equip, a confirmed purchase (balance, ownership, a reload), no
//     purchase when short, prices and sources = the data, no rarity words;
//     CRITICAL FIX 3 (two columns at 320 px, three from 360 px, the look's
//     description kept).
//  4. Results and rewards: the first Arena result (no x2 ad, "Menu glowne"),
//     a later one, the reward tiles, a mission result, the daily calendar
//     (CALENDAR FIX: a collected day's mark never over an amount; paid
//     once), a Core City reward granted once, buttons that work.
//  5. Navigation (CRITICAL FIX 4: the plain bar, no floating dock; safe
//     area; nothing under it at a list's end), English, the screen entrance
//     never invisible, SAVE v13 with no new field.
//  6. Scope: every changed line of game.js sits in a menu-screen display
//     function; no random draw, no save write, no new export.
// Usage: node qa/ui2.mjs [--only=scope,miasto,dzielnice,warsztat,wyniki,nav]
import { serve, openGame, veteranSave, report, expectAll, holds, isMain, ARENA_BOT, QA_RANDOM, frozenDateScript } from './lib.mjs';
import { safeArea, settled } from './responsive.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { ROOT } from './lib.mjs';

/** The stage's base (origin/main before GG-UI-02: GG-UI-01, PR #100). */
const BASE_REV = process.env.VH_UI2_BASE || '1395c18814f4b775850d39b45859908e4c552704';

const READY = () => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state;
const allOf = (name, checks, context) => expectAll(name, Object.fromEntries(Object.entries(checks).map(([k, v]) => [k, holds(!!v)])), context);
const FROZEN = '2026-11-13T10:00:00Z';

/** In-page helpers (window.__u2). */
const HELPERS = `window.__u2 = (() => {
  const R = (el) => el.getBoundingClientRect();
  const shown = (el) => { if (!el) return false; for (let a = el; a && a !== document.documentElement; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0 || a.classList.contains('hidden')) return false; } const r = R(el); return r.width > 0.5 && r.height > 0.5; };
  const navTop = () => { const n = document.getElementById('bottomNav'); return document.body.classList.contains('wide') || !shown(n) ? innerHeight : R(n).top; };
  /** In view = inside the window and, on a nav screen of a phone, above the navigation bar (a sheet or card over everything covers the bar). */
  const inView = (el) => { const r = R(el), floor = el.closest('.overlay-screen, .unlock-overlay') ? innerHeight : navTop(); return r.top >= -1 && r.left >= -1 && r.right <= innerWidth + 1 && r.bottom <= floor + 1; };
  /** The element (or something inside it) is what a tap at its centre reaches. */
  const hit = (el) => { const r = R(el); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!t && (t === el || el.contains(t)); };
  const scroller = (el) => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a); if (/auto|scroll/.test(cs.overflowY) && a.scrollHeight > a.clientHeight + 1) return a; } return null; };
  /** Can this element be brought fully into view, uncovered (its centre reaches it)? Tries the scroll positions that put it at the top, middle and end. */
  const reachable = (el) => {
    if (inView(el) && hit(el)) return true;
    const sc = scroller(el); if (!sc) return false;
    const top0 = sc.scrollTop; let ok = false;
    for (const f of [0.15, 0.4, 0.7]) {
      const r = R(el), s = R(sc);
      sc.scrollTop += (r.top - s.top) - s.height * f;
      if (inView(el) && hit(el)) { ok = true; break; }
    }
    sc.scrollTop = top0;
    return ok;
  };
  const textCut = (el) => el.scrollWidth > el.clientWidth + 1;
  const painted = (cv) => { try { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 40) n++; return n / (d.length / 16); } catch (e) { return -1; } };
  const textRect = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); return rg.getBoundingClientRect(); };
  const cross = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  return { R, shown, navTop, inView, hit, scroller, reachable, textCut, painted, textRect, cross, wait };
})();`;

async function open(url, { w = 390, h = 844, mobile = true, locale = 'pl-PL', save = {}, edit = null, fresh = false } = {}) {
  const g = await openGame(url, { viewport: { width: w, height: h }, mobile, deviceScaleFactor: mobile ? 2 : 1, locale, initScript: frozenDateScript(FROZEN) + QA_RANDOM });
  if (!fresh) {
    const s = await veteranSave(g.page, { missions: 29, coins: 1240, runsPlayed: 23, ...save });
    const edited = edit ? await g.page.evaluate(({ s, src }) => { (0, eval)('(' + src + ')')(s); return s; }, { s, src: edit.toString() }) : s;
    await g.page.evaluate((v) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(v)), edited);
    await g.page.reload();
    await g.page.waitForFunction(READY);
  }
  await g.page.addScriptTag({ content: HELPERS });
  await g.page.addScriptTag({ content: ARENA_BOT });
  await g.page.evaluate(() => window.__qaSeedRandom(11));
  return g;
}
const SAVED = () => localStorage.getItem('vectorHoleSave_v1');
const closeUnlock = (page) => page.evaluate(() => { const g = window.game; g.unlockQueue = []; clearTimeout(g.unlockShowTimer); document.getElementById('unlockOverlay').classList.add('hidden'); });

/* ============================== 1. MIASTO ============================== */
async function miastoChecks(url) {
  const out = [];
  // every level, an uneven charge: the rail, the percent, the reward
  const g = await open(url);
  const seen = [];
  for (const [L, c] of [[1, 0], [1, 27], [2, 63], [3, 46], [4, 99], [5, 8], [6, 72]]) {
    seen.push(await g.page.evaluate(async ({ L, c }) => {
      const gm = window.game, u = window.__u2;
      gm.save.hub.coreLevel = L; gm.save.hub.coreCharge = c;
      gm.updateCoinDisplays();
      const nodes = [...document.querySelectorAll('#hubCoreRail .u2-rail-node')], bars = [...document.querySelectorAll('#hubCoreRail .u2-rail-bar i')];
      const chip = document.getElementById('hubRewardChip1').textContent;
      // the game's other rendering of the same reward: the roadmap sheet's row for the next level
      gm.openCoreCityRoadmap(); await u.wait(60);
      const rows = [...document.querySelectorAll('#infoSheetBody *')].filter(e => !e.childElementCount || e.matches('li, .core-road-row, div')).map(e => e.textContent);
      const body = document.getElementById('infoSheetBody').textContent;
      document.getElementById('btnInfoSheetClose').click();
      const label = chip.split(' + ')[0];
      return { L, c, n: nodes.length, on: nodes.filter(x => x.classList.contains('on')).map(x => +x.textContent), now: nodes.filter(x => x.classList.contains('now')).map(x => +x.textContent),
        bars: bars.map(b => parseFloat(b.style.width)), pct: document.getElementById('hubChargeValue').textContent, lvl: document.getElementById('hubLevelLabel').textContent,
        chip, inRoadmap: L >= 6 ? true : body.includes(label.replace(/^(Smuga|Wir|Efekt|Finisz|Zestaw)\s/, '').replace(/[„”"]/g, '').split(' ')[0]), built: document.getElementById('hubHeroStage').classList.contains('is-built'),
        barShown: u.shown(document.querySelector('#hubHeroStage .hub-city-progress')), barW: document.getElementById('hubCityBar').style.width };
    }, { L, c }));
  }
  const railOk = seen.every(s => s.n === 6 && s.on.join() === Array.from({ length: s.L - 1 }, (_, i) => i + 1).join() && s.now.join() === String(s.L)
    && s.bars.every((b, i) => b === (i + 1 < s.L ? 100 : i + 1 === s.L ? s.c : 0)) && s.pct === s.c + '%' && s.lvl === 'LVL ' + s.L && s.built === (s.L >= 6) && s.barShown === (s.L >= 6) && s.barW === s.c + '%');
  out.push(report('Miasto: the LVL 1-6 rail, the percent and the level are the save\'s own on every level (reached / current + its charge / ahead; a built LVL 6 city keeps the bar for its repeating premium)', railOk, JSON.stringify(seen.map(s => [s.L, s.c, s.on.length, s.now[0], s.bars.join('/'), s.pct, s.barShown]))));
  out.push(report('Miasto: the next reward on the capsule is the one the Core City roadmap lists for the next level', seen.every(s => s.inRoadmap && s.chip.length > 3), JSON.stringify(seen.map(s => [s.L, s.chip]))));
  // looking at Miasto writes nothing
  const wrote = await g.page.evaluate(async (SAVEDsrc) => {
    const gm = window.game, u = window.__u2, read = () => localStorage.getItem('vectorHoleSave_v1');
    gm.save = loadSave(); gm.showScreen('mainMenu'); gm.updateCoinDisplays();
    const a = read(); await u.wait(700); gm.updateCoinDisplays(); await u.wait(200);
    return { same: a === read(), v: JSON.parse(read()).schemaVersion !== undefined ? JSON.parse(read()).schemaVersion : JSON.parse(read()).v };
  }, null);
  out.push(report('Miasto: looking at it writes nothing to the save', wrote.same, JSON.stringify(wrote)));
  await g.browser.close();

  // frames: GRAJ the biggest action, the rail / reward / GRAJ whole, the vortex on GRAJ is the worn look
  for (const [w, h, mobile, loc] of [[390, 844, true, 'pl-PL'], [320, 568, true, 'pl-PL'], [320, 568, true, 'en-US'], [360, 800, true, 'pl-PL'], [800, 450, false, 'pl-PL'], [844, 390, true, 'pl-PL'], [1366, 768, false, 'en-US'], [2560, 1440, false, 'pl-PL']]) {
    const g2 = await open(url, { w, h, mobile, locale: loc, edit: (s) => { s.hub = { coreLevel: 3, coreCharge: 46 }; s.owned.push('pink'); s.selected = 'pink'; } });
    await settled(g2.page, '#mainMenu');
    await g2.page.waitForTimeout(500);
    const m = await g2.page.evaluate(() => {
      const u = window.__u2, q = (s) => document.querySelector(s);
      const play = q('#btnStart'), area = (el) => { const r = u.R(el); return r.width * r.height; };
      const others = [...document.querySelectorAll('#mainMenu button, #bottomNav button')].filter(b => b !== play && u.shown(b));
      const orb = q('#hubPlayOrb');
      const rail = q('#hubCoreRail'), foot = q('#hubHeroStage .hub-city-foot'), badge = q('#hubHeroStage .hub-city-badge'), pitch = q('#hubHeroStage .hub-city-pitch');
      const cv = q('#hubCityCanvas'), lab = cv.__siteLabel;
      const pr = u.R(pitch), cr = u.R(cv), fr = u.R(foot);
      // the crane's tag (canvas px = CSS px of the canvas) against the headline and the reward capsule
      const k = cr.width / (cv.clientWidth || 1);
      const tag = lab ? { left: cr.left + lab.x * k, right: cr.left + (lab.x + lab.w) * k, top: cr.top + lab.y * k, bottom: cr.top + (lab.y + lab.h) * k } : null;
      return { playIn: u.inView(play) && u.hit(play), biggest: others.every(b => area(b) < area(play)), railIn: u.inView(rail) && u.shown(rail), footIn: u.inView(foot), chipCut: u.textCut(q('#hubRewardChip1')), pctIn: u.inView(q('#hubChargeValue')),
        orb: u.painted(orb), orbSkin: orb._hole && orb._hole.skin, worn: window.game.save.selected, badgePitch: u.cross(u.R(badge), pr), tagOverText: !!tag && (u.cross(tag, pr) || u.cross(tag, fr)),
        nodes: document.querySelectorAll('#hubCoreRail .u2-rail-node').length, sideways: document.documentElement.scrollWidth > innerWidth + 1,
        tiles: ['#hubCampaignTile', '#btnDaily', '#hubFreeChest'].map(s => u.inView(q(s)) && u.hit(q(s))), layout: document.body.className };
    });
    out.push(allOf(`Miasto ${w}x${h} ${loc.slice(0, 2)}: GRAJ in view, clickable and the biggest action; the rail, the reward capsule and the percent whole; the worn vortex on GRAJ; the badge, headline, crane tag and capsule clear of each other`, {
      'GRAJ in view and hit': m.playIn, 'GRAJ is the biggest button': m.biggest, 'rail in view (6 nodes)': m.railIn && m.nodes === 6, 'reward capsule in view': m.footIn && m.pctIn,
      'the vortex on GRAJ is drawn': m.orb > 0.2, 'it is the worn look': m.orbSkin === m.worn, 'badge clear of the headline': !m.badgePitch, 'crane tag clear of the headline and the capsule (the 320x568 overlap)': !m.tagOverText,
      'campaign tile, daily tile, chest reachable': m.tiles.every(Boolean), 'no sideways scroll': !m.sideways
    }, JSON.stringify(m)));
    out.push(report(`Miasto ${w}x${h} ${loc.slice(0, 2)}: no runtime errors`, g2.errors.length === 0, g2.errors.slice(0, 2).join(' | ')));
    await g2.browser.close();
  }

  // unlock states: a first run shows only the welcome; a one-round profile keeps locked tabs locked
  const g3 = await open(url, { fresh: true });
  const first = await g3.page.evaluate(() => { const u = window.__u2; return { welcome: u.shown(document.getElementById('hubWelcome')), city: u.shown(document.getElementById('hubHeroStage')), play: u.shown(document.getElementById('btnStart')), nav: u.shown(document.getElementById('bottomNav')), cta: u.inView(document.getElementById('btnWelcomePlay')) && u.hit(document.getElementById('btnWelcomePlay')) }; });
  out.push(report('Miasto first run: only the welcome stage and its GRAJ (no city card, no navigation) -- unchanged', first.welcome && !first.city && !first.play && !first.nav && first.cta, JSON.stringify(first)));
  await g3.browser.close();
  return out;
}

/* ============================== 2. DZIELNICE ============================== */
async function dzielniceChecks(url) {
  const out = [];
  // --- states, counters, codes, the boss mark (iPhone frame: the 4 x 3 grid)
  const g = await open(url);
  await g.page.evaluate(() => window.game.openCampaignScreen());
  await settled(g.page, '#campaignScreen');
  const d = await g.page.evaluate(() => {
    const gm = window.game, u = window.__u2, c = gm.save.campaign;
    const tiles = [...document.querySelectorAll('#districtMap .district-tile')];
    const st = tiles.map((t, i) => {
      const dd = DISTRICTS[i], done = dd.missions.filter(id => c.completed[id]).length, unlocked = c.unlockedDistricts.includes(dd.id);
      const mark = t.querySelector('.u2-state');
      const want = done === dd.missions.length ? 'done' : unlocked ? 'now' : 'lock';
      return { num: t.querySelector('.u2-num').textContent, want, got: ['done', 'now', 'lock'].find(k => mark.classList.contains(k)), text: mark.textContent, wantText: want === 'now' ? `${done}/${dd.missions.length}` : '',
        locked: t.classList.contains('locked') === !unlocked, in: u.inView(t), left: Math.round(u.R(t).left), name: t.querySelector('.district-node-name').textContent, nameShown: u.shown(t.querySelector('.district-node-name')) };
    });
    const rebuilt = DISTRICTS.filter(dd => dd.missions.every(id => c.completed[id])).length, done = CAMPAIGN_MISSIONS.filter(m => c.completed[m.id]).length;
    const rows = [...document.querySelectorAll('#missionList .mission-row')], dist = DISTRICTS.find(x => x.id === gm.selectedDistrictId);
    return { st, cols: new Set(st.map(s => s.left)).size, route: [document.getElementById('districtRouteDone').textContent, document.getElementById('districtRouteMissions').textContent], want: [`${rebuilt}/12`, `${done}/240`],
      total: [DISTRICTS.length, CAMPAIGN_MISSIONS.length], active: tiles.findIndex(t => t.classList.contains('active')), current: DISTRICTS.findIndex(x => x.id === campaignMissionById(gm.nextCampaignMissionId()).district),
      codes: rows.map(r => r.querySelector('.mission-row-id').textContent), wantCodes: dist.missions.map(id => missionCode(campaignMissionById(id))),
      cur: rows.filter(r => r.classList.contains('current')).map(r => r.querySelector('.mission-row-id').textContent), next: missionCode(campaignMissionById(gm.nextCampaignMissionId())),
      title: document.getElementById('districtTitle').textContent, story: document.getElementById('districtStoryText').textContent.length };
  });
  out.push(allOf('Dzielnice 390x844: twelve tiles numbered 01-12 in a 4 x 3 grid, all in view, each with its state from the save (rebuilt / open x of y / locked)', {
    '12 tiles, 240 missions': d.st.length === 12 && d.total.join() === '12,240', 'numbers 01..12': d.st.map(s => s.num).join() === Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).join(),
    'state marks = the save': d.st.every(s => s.got === s.want && (s.want !== 'now' || s.text === s.wantText) && s.locked), 'four columns, all twelve in view': d.cols === 4 && d.st.every(s => s.in), 'every name shown': d.st.every(s => s.nameShown && s.name.length > 2)
  }, JSON.stringify({ cols: d.cols, st: d.st.map(s => [s.num, s.got, s.text]) })));
  out.push(report('Dzielnice: the counters are the save\'s (districts rebuilt / 12, missions done / 240)', d.route.join() === d.want.join(), JSON.stringify(d.route)));
  out.push(report('Dzielnice: opens on the district played now; the list shows that district\'s codes (missionCode()), the mission to play marked; NELA\'s story kept', d.active === d.current && d.codes.join() === d.wantCodes.join() && d.cur.join() === d.next && d.story > 20, JSON.stringify({ active: d.active, codes: d.codes, cur: d.cur, next: d.next })));
  // a locked tile explains itself and selects nothing; an open one selects
  const sel = await g.page.evaluate(async () => {
    const gm = window.game, u = window.__u2, tiles = [...document.querySelectorAll('#districtMap .district-tile')];
    const before = gm.selectedDistrictId;
    tiles[7].click(); await u.wait(80);
    const sheet = u.shown(document.getElementById('infoSheet')), still = gm.selectedDistrictId === before;
    document.getElementById('btnInfoSheetClose').click(); await u.wait(60);
    document.querySelectorAll('#districtMap .district-tile')[0].click(); await u.wait(120);
    return { sheet, still, picked: gm.selectedDistrictId, title: document.getElementById('districtTitle').textContent, activeIdx: [...document.querySelectorAll('#districtMap .district-tile')].findIndex(t => t.classList.contains('active')), headColor: getComputedStyle(document.getElementById('campaignScreen')).getPropertyValue('--d-color').trim(), want: DISTRICT_COLORS.plac };
  });
  out.push(report('Dzielnice: a locked district opens its explanation and selects nothing; an open one is selected (title, active tile, the header in its colour)', sel.sheet && sel.still && sel.picked === 'plac' && sel.title === 'PLAC NEONÓW' && sel.activeIdx === 0 && sel.headColor.toLowerCase() === sel.want.toLowerCase(), JSON.stringify(sel)));
  await g.browser.close();

  // --- the boss mark on every district's list and cards = the missions with a landmark goal
  const gb = await open(url, { save: { missions: 240 } });
  const boss = await gb.page.evaluate(async () => {
    const gm = window.game, u = window.__u2, bad = [];
    gm.openCampaignScreen(); await u.wait(100);
    let n = 0;
    for (const dd of DISTRICTS) {
      gm.selectCampaignDistrict(dd.id); await u.wait(20);
      const rows = [...document.querySelectorAll('#missionList .mission-row')];
      dd.missions.forEach((id, i) => {
        const def = campaignMissionById(id), want = def.goal.steps.some(s => s.landmark);
        if (want) n++;
        const row = rows[i];
        if (!row || row.classList.contains('is-boss') !== want || !!row.querySelector('.u2-boss-tag') !== want || row.querySelector('.mission-row-id').textContent !== missionCode(def)) bad.push(id);
      });
    }
    return { n, bad, rowsTotal: DISTRICTS.reduce((a, dd) => a + dd.missions.length, 0) };
  });
  out.push(report('Dzielnice: on all 12 lists (240 rows) the BOSS mark sits exactly on the missions whose goal names a landmark; every code is missionCode()', boss.bad.length === 0 && boss.n >= 12 && boss.rowsTotal === 240, JSON.stringify(boss)));
  await gb.browser.close();

  // --- CRITICAL FIX 1: 320 px -- the whole title, every district reachable and whole, its state readable
  for (const loc of ['pl-PL', 'en-US']) {
    const g1 = await open(url, { w: 320, h: 568, locale: loc, save: { coins: 54321 }, edit: (s) => { s.prisms = 88; } });
    await g1.page.evaluate(() => window.game.openCampaignScreen());
    await settled(g1.page, '#campaignScreen');
    const r = await g1.page.evaluate(async () => {
      const u = window.__u2, strip = document.getElementById('districtMap'), title = document.querySelector('#campaignScreen .app-title');
      const tiles = [...strip.querySelectorAll('.district-tile')], sr = () => u.R(strip);
      const whole = (t) => { const a = u.R(t), s = sr(); return a.left >= s.left - 1 && a.right <= s.right + 1; };
      const res = [];
      for (const t of tiles) {
        strip.scrollLeft = t.offsetLeft - strip.offsetLeft; await u.wait(30);
        // after the snap: the tile is whole, and no tile is cut at either edge
        const cut = tiles.filter(x => { const a = u.R(x), s = sr(); return a.right > s.left + 1 && a.left < s.right - 1 && !whole(x); }).length;
        res.push({ whole: whole(t), cut, mark: u.shown(t.querySelector('.u2-state')), num: u.shown(t.querySelector('.u2-num')), nameCut: u.R(t.querySelector('.district-node-name')).bottom > u.R(t).bottom + 1, tap: Math.round(Math.min(u.R(t).width, u.R(t).height)) });
      }
      strip.scrollLeft = 0; await u.wait(30);
      tiles[1].click(); await u.wait(120);
      const act = [...strip.querySelectorAll('.district-tile')].findIndex(x => x.classList.contains('active'));
      return { title: title.textContent, titleCut: u.textCut(title), wallet: u.inView(document.getElementById('coinCountDistricts')) && u.inView(document.getElementById('prismCountDistricts')), res, picked: window.game.selectedDistrictId, act,
        route: u.inView(document.getElementById('districtRoute')) && !u.textCut(document.getElementById('districtRoute')), headIn: u.inView(document.getElementById('districtTitle')), sideways: document.documentElement.scrollWidth > innerWidth + 1,
        scrollable: strip.scrollWidth > strip.clientWidth + 10, perPage: Math.round(strip.clientWidth / (u.R(tiles[0]).width + 8)) };
    });
    out.push(allOf(`CRITICAL FIX 1 -- Dzielnice 320x568 ${loc.slice(0, 2)}: the title whole next to a 5-digit wallet; all twelve districts can be scrolled to, each whole with its number and state; a tap selects; no page scroll sideways`, {
      'title not cut': !r.titleCut && r.title.length >= 8, 'wallet in view': r.wallet, 'every district whole when scrolled to': r.res.length === 12 && r.res.every(x => x.whole), 'no tile cut at an edge after a snap': r.res.every(x => x.cut === 0),
      'number and state mark on every tile': r.res.every(x => x.mark && x.num && !x.nameCut), 'touch target >= 44 px': r.res.every(x => x.tap >= 44), 'a tap selects the district': r.picked === 'park' && r.act === 1,
      'counters and the district header in view': r.route && r.headIn, 'no sideways page scroll': !r.sideways
    }, JSON.stringify({ title: r.title, perPage: r.perPage, tap: r.res[0].tap, cut: r.res.map(x => x.cut).join('') })));
    await g1.browser.close();
  }

  // --- CRITICAL FIX 2: GRAJ never hides the mission's data
  for (const [w, h, mobile] of [[320, 568, true], [360, 800, true], [390, 844, true], [640, 360, false], [800, 450, false], [844, 390, true]]) {
    for (const loc of w === 320 ? ['pl-PL', 'en-US'] : ['pl-PL']) {
      const g2 = await open(url, { w, h, mobile, locale: loc });
      await g2.page.evaluate(() => window.game.openCampaignScreen());
      await settled(g2.page, '#campaignScreen');
      const r = await g2.page.evaluate(async () => {
        const u = window.__u2, gm = window.game, card = document.getElementById('missionNextCard'), play = card.querySelector('.mc-play');
        const data = (root) => [...root.querySelectorAll('.mc-goal, .mc-meta-item, .mc-star, .mc-twist, .mc-name, .mc-code')].filter(u.shown);
        const dataAll = [...card.querySelectorAll('.mc-goal, .mc-meta-item, .mc-star, .mc-twist')];
        const hiddenByLayout = dataAll.filter(e => !u.shown(e)).map(e => e.className.split(' ')[0]);
        const first = { in: u.inView(play), hit: u.hit(play), navGap: Math.round(u.navTop() - u.R(play).bottom), tap: Math.round(u.R(play).height) };
        const unreach = data(card).filter(e => !u.reachable(e)).map(e => e.textContent.trim().slice(0, 24));
        // GRAJ stays reachable wherever the card is scrolled
        const sc = u.scroller(play); let always = true;
        if (sc) { const t0 = sc.scrollTop; for (const y of [0, 60, 140, 260]) { sc.scrollTop = y; await u.wait(20); const cr = u.R(card); if (cr.bottom > 120 && cr.top < u.navTop() - 120 && !(u.inView(play) && u.hit(play))) always = false; } sc.scrollTop = t0; }
        const nela = document.getElementById('districtStory');
        const nelaOver = u.shown(nela) && u.cross(u.R(nela), u.R(play)) && !u.hit(play);
        play.click(); await u.wait(350);
        const b = document.getElementById('missionBriefing'), bc = document.getElementById('briefingCard'), launch = bc.querySelector('[data-mc-launch]');
        const br = { open: u.shown(b), launchIn: !!launch && u.inView(launch) && u.hit(launch), unreach: data(bc).concat([...bc.querySelectorAll('.mc-boost, .mc-nela')].filter(u.shown)).filter(e => !u.reachable(e)).map(e => e.textContent.trim().slice(0, 24)), code: bc.querySelector('.mc-code').textContent, want: missionCode(campaignMissionById(gm.nextCampaignMissionId())) };
        document.getElementById('btnBriefingClose').click(); await u.wait(120);
        return { first, unreach, always, nelaOver, br, hiddenByLayout, sticky: getComputedStyle(play).position, layout: document.body.className };
      });
      out.push(allOf(`CRITICAL FIX 2 -- Dzielnice ${w}x${h} ${loc.slice(0, 2)}: GRAJ in view and clickable above the navigation at once and wherever the card is scrolled; every goal, the time, the reward and each star condition can be brought into view uncovered; the briefing the same`, {
        'GRAJ in view at once': r.first.in, 'GRAJ takes the tap': r.first.hit, 'clear of the navigation': r.first.navGap >= 4, 'GRAJ >= 44 px': r.first.tap >= 44, 'GRAJ reachable at every scroll position of the card': r.always,
        'every datum of the mission reachable (nothing stays under GRAJ or the navigation)': r.unreach.length === 0, 'no goal, time, reward or star condition hidden by the layout': r.hiddenByLayout.length === 0, 'NELA not over GRAJ': !r.nelaOver,
        'GRAJ opens the briefing of that mission': r.br.open && r.br.code === r.br.want, 'briefing: GRAJ in view and clickable': r.br.launchIn, 'briefing: goals, time, reward, stars, boosters, NELA reachable': r.br.unreach.length === 0
      }, JSON.stringify({ first: r.first, unreach: r.unreach, br: r.br.unreach, sticky: r.sticky, hiddenByLayout: r.hiddenByLayout })));
      await g2.browser.close();
    }
  }
  // ... and after coming back from a mission
  {
    const g3 = await open(url, { w: 320, h: 568 });
    const r = await g3.page.evaluate(async () => {
      const gm = window.game, u = window.__u2;
      gm.openCampaignScreen(); await u.wait(100);
      const id = gm.nextCampaignMissionId();
      gm.startCampaignMission(id); if (gm.introPending) gm.beginMissionPlay(); cancelAnimationFrame(gm.rafId); gm.running = false;
      gm.endCampaignMission(false); await u.wait(900);
      gm.unlockQueue = []; document.getElementById('unlockOverlay').classList.add('hidden');
      const back = [...document.querySelectorAll('#missionResultScreen button')].find(b => u.shown(b) && /DZIELNICE/.test(b.textContent));
      if (back) back.click(); else gm.openCampaignScreen();
      await u.wait(700);
      const play = document.querySelector('#missionNextCard .mc-play');
      return { hadBack: !!back, screen: u.shown(document.getElementById('campaignScreen')), in: !!play && u.inView(play), hit: !!play && u.hit(play), same: gm.nextCampaignMissionId() === id };
    });
    out.push(report('CRITICAL FIX 2 -- back from a (failed) mission on 320x568: Dzielnice again, GRAJ in view and clickable for the same mission', r.screen && r.in && r.hit && r.same, JSON.stringify(r)));
    await g3.browser.close();
  }

  // --- the briefing of every boss mission (T4-T6 landmarks), PL and EN, small phone and iPhone
  for (const [w, h, loc] of [[320, 568, 'pl-PL'], [320, 568, 'en-US'], [390, 844, 'en-US']]) {
    const g4 = await open(url, { w, h, locale: loc, save: { missions: 240 } });
    const r = await g4.page.evaluate(async () => {
      const gm = window.game, u = window.__u2, bad = [];
      gm.openCampaignScreen(); await u.wait(100);
      const bosses = CAMPAIGN_MISSIONS.filter(m => m.goal.steps.some(s => s.landmark));
      let longest = '';
      for (const def of bosses) {
        gm.openMissionBriefing(def.id); await u.wait(40);
        await Promise.allSettled(document.querySelector('#missionBriefing .briefing-sheet').getAnimations().map(x => x.finished)); // the sheet has finished sliding in
        const card = document.getElementById('briefingCard'), rows = [...card.querySelectorAll('.mc-goal')], launch = card.querySelector('[data-mc-launch]');
        const name = card.querySelector('.mc-name');
        if (name.textContent.length > longest.length) longest = name.textContent;
        const problems = [];
        def.goal.steps.forEach((s, i) => { const row = rows[i]; if (!row) return problems.push('row'); if (row.classList.contains('is-boss') !== !!s.landmark) problems.push('mark'); if (s.landmark && !row.querySelector('.u2-boss-tag')) problems.push('tag');
          const svg = row.querySelector('.mc-goal-icon svg'); if (!svg || !svg.innerHTML.trim()) problems.push('icon'); if (s.landmark && u.R(row.querySelector('.mc-goal-icon')).width <= u.R(rows.find(x => !x.classList.contains('is-boss')) ? rows.find(x => !x.classList.contains('is-boss')).querySelector('.mc-goal-icon') : row).width - 0.1 && rows.some(x => !x.classList.contains('is-boss'))) problems.push('size');
          const tx = row.querySelector('.mc-goal-text'), tag = row.querySelector('.u2-boss-tag'); if (tag && u.cross(u.textRect(tx), u.R(tag))) problems.push('tag-over-text'); });
        if (card.querySelector('.mc-code').textContent !== missionCode(def)) problems.push('code');
        if (u.R(name).right > innerWidth || name.scrollWidth > name.clientWidth + 1) problems.push('name-cut');
        if (!launch || !u.inView(launch) || !u.hit(launch)) problems.push('graj');
        if (!u.reachable(rows[rows.length - 1])) problems.push('goal-unreachable');
        if (problems.length) bad.push(def.id + ':' + problems.join('+'));
        document.getElementById('btnBriefingClose').click();
      }
      return { n: bosses.length, bad, longest, tiers: [...new Set(bosses.map(m => m.diff))] };
    });
    out.push(report(`Briefing ${w}x${h} ${loc.slice(0, 2)}: every boss mission (${r.n}) -- the boss goal on its own plate with the BOSS mark and a bigger icon, the real code, the whole name, GRAJ in view and clickable`, r.bad.length === 0 && r.n >= 12, JSON.stringify({ bad: r.bad.slice(0, 6), longest: r.longest })));
    out.push(report(`Briefing ${w}x${h} ${loc.slice(0, 2)}: no runtime errors`, g4.errors.length === 0, g4.errors.slice(0, 2).join(' | ')));
    await g4.browser.close();
  }
  // wide screens keep the game's grid with the marks
  for (const [w, h] of [[800, 450], [1366, 768], [2560, 1440]]) {
    const g5 = await open(url, { w, h, mobile: false });
    await g5.page.evaluate(() => window.game.openCampaignScreen());
    await settled(g5.page, '#campaignScreen');
    const r = await g5.page.evaluate(() => { const u = window.__u2, tiles = [...document.querySelectorAll('#districtMap .district-tile')];
      const over = tiles.filter(t => { const n = t.querySelector('.district-node-name'), num = t.querySelector('.u2-num'), mark = t.querySelector('.u2-state'); const tr = u.textRect(n); return u.cross(tr, u.R(num)) || u.cross(tr, u.R(mark)); }).length;
      const play = document.querySelector('#missionNextCard .mc-play');
      // desktop: the number and the state mark on the tile; low landscape frames: the number in front of the name, the state on the status line
      const compact = document.body.classList.contains('compact');
      const marks = tiles.every((t, i) => compact
        ? getComputedStyle(t.querySelector('.district-node-name'), '::before').content.replace(/"/g, '') === String(i + 1).padStart(2, '0') && u.shown(t.querySelector('.district-node-status'))
        : u.shown(t.querySelector('.u2-state')) && u.shown(t.querySelector('.u2-num')));
      const nameCut = tiles.filter(t => u.R(t.querySelector('.district-tile-info')).top < u.R(t).top - 0.5).length;
      return { n: tiles.length, in: tiles.every(u.inView), over, marks, compact, nameCut, play: u.inView(play) && u.hit(play), route: u.inView(document.getElementById('districtRoute')) }; });
    out.push(report(`Dzielnice ${w}x${h}: the game's grid of twelve, all in view, each numbered 01-12 with its state, nothing over the names, GRAJ in view`, r.n === 12 && r.in && r.over === 0 && r.marks && r.nameCut === 0 && r.play && r.route, JSON.stringify(r)));
    await g5.browser.close();
  }
  return out;
}

/* ============================== 3. WARSZTAT ============================== */
async function warsztatChecks(url) {
  const out = [];
  const g = await open(url, { edit: (s) => { s.prisms = 18; s.hub = { coreLevel: 3, coreCharge: 46 }; s.owned.push('cyan', 'krysztal'); s.selected = 'krysztal'; s.auras.owned.push('impuls'); } });
  await g.page.evaluate(() => window.game.openWarsztatScreen());
  await settled(g.page, '#shopScreen');
  await g.page.waitForTimeout(400);
  const cat = await g.page.evaluate(async () => {
    const gm = window.game, u = window.__u2, res = {};
    const T = { tabSkins: ['skinGrid', SKINS, gm.save.owned, gm.save.selected], tabAuras: ['auraGrid', AURAS, gm.save.auras.owned, gm.save.auras.selected], tabEffects: ['effectGrid', EAT_EFFECTS, gm.save.effects.owned, gm.save.effects.selected], tabOverdrive: ['overdriveSkinGrid', OVERDRIVE_SKINS, gm.save.overdriveSkins.owned, gm.save.overdriveSkins.selected] };
    for (const [tab, [grid, items, owned, worn]] of Object.entries(T)) {
      document.getElementById(tab).click(); await u.wait(350);
      const cards = [...document.querySelectorAll(`#${grid} .skin-card`)];
      const list = items.filter(it => !(it.unlockSource && it.unlockSource.type === 'iap' && !owned.includes(it.id) && !gm.monetization.canPurchase));
      const bad = [];
      cards.forEach((c, i) => {
        const it = list[i]; if (!it || c.dataset.item !== it.id) return bad.push('order:' + c.dataset.item);
        const has = owned.includes(it.id), prisms = it.priceType === 'prisms', price = prisms ? it.pricePrisms : (it.priceCoins != null ? it.priceCoins : (it.price || 0));
        const state = has ? (worn === it.id ? 'worn' : 'owned') : it.unlockSource ? 'reward' : ((prisms ? gm.save.prisms : gm.save.coins) >= price ? 'buyable' : 'short');
        const kind = it.unlockSource ? 'reward' : prisms ? 'prism' : price > 0 ? 'coin' : 'start';
        const meta = c.querySelector('.skin-owned-badge, .skin-price'), src = c.querySelector('.u2-src');
        if (!c.classList.contains('is-' + state)) bad.push('state:' + it.id);
        if (!src || !src.classList.contains(kind)) bad.push('source:' + it.id);
        if (!has && !it.unlockSource && meta.textContent.replace(/\D/g, '') !== String(price)) bad.push('price:' + it.id + '=' + meta.textContent);
        if (!has && !it.unlockSource && !meta.textContent.includes(prisms ? '◆' : '◇')) bad.push('currency:' + it.id);
        if (has && meta.textContent !== (worn === it.id ? 'ZAŁOŻONE' : 'ZAŁÓŻ')) bad.push('badge:' + it.id);
        if (c.querySelector('.skin-name').textContent !== it.name) bad.push('name:' + it.id);
        if (u.textCut(c.querySelector('.skin-name')) || u.R(meta).right > u.R(c).right + 0.5 || !u.shown(meta)) bad.push('cut:' + it.id);
        const sw = c.querySelector('canvas.hole-swatch'); if (sw && u.painted(sw) < 0.05) bad.push('preview:' + it.id);
        if (sw && grid === 'skinGrid' && sw._hole && sw._hole.skin !== it.id) bad.push('preview-skin:' + it.id);
      });
      res[tab] = { cards: cards.length, want: list.length, bad, active: document.getElementById(tab).classList.contains('active'), gridShown: u.shown(document.getElementById(grid)), count: document.getElementById('cosmeticUnlockedCount').textContent };
    }
    document.getElementById('tabSkins').click(); await u.wait(200);
    const txt = document.getElementById('shopScreen').textContent.toUpperCase();
    return { res, rarity: ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'RZADK', 'EPICK', 'LEGENDARN', 'POSPOLIT'].filter(wd => txt.includes(wd)) };
  });
  out.push(report('Warsztat: the four categories show the game\'s own cosmetics in order -- name, live preview of that item, state (worn / owned / affordable / out of reach / reward), the real price in its currency, the source mark',
    Object.values(cat.res).every(r => r.cards === r.want && r.bad.length === 0 && r.active && r.gridShown) && Object.keys(cat.res).length === 4, JSON.stringify(Object.fromEntries(Object.entries(cat.res).map(([k, r]) => [k, [r.cards, r.bad.slice(0, 4), r.count]])))));
  out.push(report('Warsztat: no rarity system anywhere (no COMMON / RARE / EPIC / LEGENDARY or their Polish forms)', cat.rarity.length === 0, cat.rarity.join()));

  // the status plate + equip + buy + short, with their consequences
  const flow = await g.page.evaluate(async () => {
    const gm = window.game, u = window.__u2, q = (s) => document.querySelector(s), status = () => [q('#warsztatStatus').textContent, q('#warsztatStatus').className.replace('u2-status ', '')];
    const card = (id) => q(`#skinGrid .skin-card[data-item="${id}"]`), shownBtn = (id) => u.shown(document.getElementById(id));
    const r = {};
    r.idle = { status: status(), name: q('#warsztatPreviewName').textContent, look: q('#warsztatLookValue').textContent, lookShown: u.shown(q('#warsztatLookValue')), buy: shownBtn('btnWarsztatBuy') };
    // equip an owned look
    card('cyan').click(); await u.wait(200);
    r.equip = { selected: gm.save.selected, saved: JSON.parse(localStorage.getItem('vectorHoleSave_v1')).selected, cardSel: card('cyan').classList.contains('selected'), old: card('krysztal').classList.contains('selected'), badge: card('cyan').querySelector('.skin-owned-badge').textContent, status: status(), name: q('#warsztatPreviewName').textContent, preview: q('#warsztatPreviewCanvas')._hole && q('#warsztatPreviewCanvas')._hole.skin };
    // out of reach: no purchase possible
    const coins0 = gm.save.coins, dear = SKINS.find(s => !s.unlockSource && !gm.save.owned.includes(s.id) && (s.priceCoins != null ? s.priceCoins : s.price) > coins0);
    card(dear.id).click(); await u.wait(200);
    r.short = { status: status(), buyText: q('#btnWarsztatBuy').textContent, line: q('#warsztatPreviewLoadout').textContent };
    gm.startArenaRound = () => { r.short.wentToArena = true; }; // (the button's real action: play a round)
    q('#btnWarsztatBuy').click(); await u.wait(150);
    delete gm.startArenaRound;
    r.short.coins = gm.save.coins === coins0; r.short.owned = gm.save.owned.includes(dear.id); r.short.id = dear.id;
    // a reward: nothing to buy
    const rew = SKINS.find(s => s.unlockSource && !gm.save.owned.includes(s.id));
    card(rew.id).click(); await u.wait(200);
    r.reward = { status: status(), buyShown: shownBtn('btnWarsztatBuy'), line: q('#warsztatPreviewLoadout').textContent, look: q('#warsztatLookValue').textContent, wantLook: rew.look };
    // affordable: look, then NIE TERAZ spends nothing
    const cheap = SKINS.find(s => !s.unlockSource && !gm.save.owned.includes(s.id) && (s.priceCoins != null ? s.priceCoins : s.price) <= coins0), price = cheap.priceCoins != null ? cheap.priceCoins : cheap.price;
    card(cheap.id).click(); await u.wait(200);
    r.offer = { status: status(), buyText: q('#btnWarsztatBuy').textContent, buyIn: u.inView(q('#btnWarsztatBuy')) && u.hit(q('#btnWarsztatBuy')), name: q('#warsztatPreviewName').textContent, look: q('#warsztatLookValue').textContent, wantLook: cheap.look, lookShown: u.shown(q('#warsztatLookValue')) };
    q('#btnWarsztatCancel').click(); await u.wait(150);
    r.cancel = { coins: gm.save.coins === coins0, owned: gm.save.owned.includes(cheap.id), status: status(), worn: gm.save.selected };
    // ... and the confirmed purchase
    card(cheap.id).click(); await u.wait(150);
    q('#btnWarsztatBuy').click(); await u.wait(300);
    const saved = JSON.parse(localStorage.getItem('vectorHoleSave_v1'));
    r.buy = { id: cheap.id, price, coins: gm.save.coins, want: coins0 - price, owned: gm.save.owned.filter(x => x === cheap.id).length, selected: gm.save.selected, savedCoins: saved.coins, savedOwned: saved.owned.includes(cheap.id), savedSel: saved.selected,
      card: card(cheap.id).className, badge: card(cheap.id).querySelector('.skin-owned-badge') && card(cheap.id).querySelector('.skin-owned-badge').textContent, status: status(), wallet: q('#coinCountShop').textContent, buyGone: !shownBtn('btnWarsztatBuy'), preview: q('#warsztatPreviewCanvas')._hole && q('#warsztatPreviewCanvas')._hole.skin };
    // a second tap on the bought card buys nothing again
    card(cheap.id).click(); await u.wait(150);
    r.again = { coins: gm.save.coins === coins0 - price, owned: gm.save.owned.filter(x => x === cheap.id).length };
    return r;
  });
  out.push(allOf('Warsztat: the status plate names the state of what the showroom shows -- WYPOSAŻONE, ZA MAŁO MONET, NAGRODA, DO KUPIENIA -- and the look\'s description stays beside the big preview', {
    'worn at rest': flow.idle.status.join() === 'WYPOSAŻONE,worn' && !flow.idle.buy, 'the description of the worn look shown': flow.idle.lookShown && flow.idle.look.length > 3,
    'out of reach': flow.short.status.join() === 'ZA MAŁO MONET,short', 'a reward': flow.reward.status.join() === 'NAGRODA,reward' && !flow.reward.buyShown && flow.reward.look === flow.reward.wantLook,
    'for sale and affordable': flow.offer.status.join() === 'DO KUPIENIA,buy' && flow.offer.look === flow.offer.wantLook && flow.offer.lookShown, 'back to worn after NIE TERAZ': flow.cancel.status.join() === 'WYPOSAŻONE,worn'
  }, JSON.stringify({ idle: flow.idle, short: flow.short.status, reward: flow.reward, offer: flow.offer.status })));
  out.push(allOf('Warsztat: tapping an owned look wears it (the save, the card, the old card, the preview)', {
    'save.selected and the stored save': flow.equip.selected === 'cyan' && flow.equip.saved === 'cyan', 'card marked, the old one unmarked': flow.equip.cardSel && !flow.equip.old && flow.equip.badge === 'ZAŁOŻONE', 'preview shows it': flow.equip.preview === 'cyan' && flow.equip.name === 'Cyjan', 'status worn': flow.equip.status[1] === 'worn'
  }, JSON.stringify(flow.equip)));
  out.push(allOf('Warsztat: too few coins -- nothing can be bought (the button plays a round), the balance and ownership stay', {
    'the button is not a purchase': flow.short.buyText === 'ZAGRAJ RUNDĘ' && flow.short.wentToArena === true, 'coins unchanged': flow.short.coins, 'not owned': !flow.short.owned, 'the line says what is missing': /Brakuje \d+ ◇/.test(flow.short.line)
  }, JSON.stringify(flow.short)));
  out.push(allOf('Warsztat: a purchase happens only on KUP I ZAŁÓŻ -- looking and NIE TERAZ spend nothing; the confirmed one takes exactly the price, adds the look once, wears it, updates the card, the wallet and the preview; a second tap buys nothing', {
    'the offer names the price': flow.offer.buyText === `KUP I ZAŁÓŻ · ${flow.buy.price} ◇` && flow.offer.buyIn, 'NIE TERAZ: nothing spent or owned': flow.cancel.coins && !flow.cancel.owned,
    'coins = before - price': flow.buy.coins === flow.buy.want && flow.buy.savedCoins === flow.buy.want, 'owned once, saved': flow.buy.owned === 1 && flow.buy.savedOwned, 'worn': flow.buy.selected === flow.buy.id && flow.buy.savedSel === flow.buy.id,
    'card: owned and selected': /is-worn/.test(flow.buy.card) && /selected/.test(flow.buy.card) && flow.buy.badge === 'ZAŁOŻONE', 'wallet shows the new balance': flow.buy.wallet === String(flow.buy.want), 'status worn, offer gone': flow.buy.status[1] === 'worn' && flow.buy.buyGone,
    'preview shows the bought look': flow.buy.preview === flow.buy.id, 'no second purchase': flow.again.coins && flow.again.owned === 1
  }, JSON.stringify({ buy: flow.buy, again: flow.again })));
  // ownership after a reload
  await g.page.reload(); await g.page.waitForFunction(READY); await g.page.addScriptTag({ content: HELPERS });
  const after = await g.page.evaluate(async ({ id }) => { const gm = window.game; gm.openWarsztatScreen(); await window.__u2.wait(300); const c = document.querySelector(`#skinGrid .skin-card[data-item="${id}"]`); return { owned: gm.save.owned.includes(id), selected: gm.save.selected === id, card: c.className, coins: gm.save.coins, v: gm.save.schemaVersion }; }, { id: flow.buy.id });
  out.push(report('Warsztat: after a reload the bought look is still owned and worn, the balance kept', after.owned && after.selected && /is-worn/.test(after.card) && after.coins === flow.buy.want, JSON.stringify(after)));
  out.push(report('Warsztat: no runtime errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
  await g.browser.close();

  // prisms: the plate names the real currency
  {
    const gp = await open(url, { edit: (s) => { s.prisms = 1; } });
    const r = await gp.page.evaluate(async () => { const gm = window.game, u = window.__u2; gm.openWarsztatScreen(); await u.wait(200); const it = AURAS.find(a => a.priceType === 'prisms' && a.pricePrisms > 1 && !a.unlockSource); document.getElementById('tabAuras').click(); await u.wait(150); document.querySelector(`#auraGrid .skin-card[data-item="${it.id}"]`).click(); await u.wait(150); return { status: document.getElementById('warsztatStatus').textContent, prisms: gm.save.prisms, owned: gm.save.auras.owned.includes(it.id) }; });
    out.push(report('Warsztat: an item priced in prisms and out of reach says ZA MAŁO PRYZMATÓW (the real currency), nothing bought', r.status === 'ZA MAŁO PRYZMATÓW' && r.prisms === 1 && !r.owned, JSON.stringify(r)));
    await gp.browser.close();
  }

  // --- CRITICAL FIX 3: columns follow the width; names, states and prices readable; the description kept
  for (const [w, h, mobile, loc, wantCols] of [[320, 568, true, 'pl-PL', 2], [320, 568, true, 'en-US', 2], [360, 800, true, 'pl-PL', 3], [390, 844, true, 'pl-PL', 3], [390, 844, true, 'en-US', 3], [800, 450, false, 'pl-PL', null], [844, 390, true, 'en-US', null], [1366, 768, false, 'pl-PL', null], [2560, 1440, false, 'pl-PL', null]]) {
    const g2 = await open(url, { w, h, mobile, locale: loc, edit: (s) => { s.prisms = 18; s.owned.push('cyan', 'krysztal'); s.selected = 'krysztal'; } });
    await g2.page.evaluate(() => window.game.openWarsztatScreen());
    await settled(g2.page, '#shopScreen');
    await g2.page.waitForTimeout(300);
    const r = await g2.page.evaluate(async () => {
      const u = window.__u2, gm = window.game, res = { tabs: {} };
      for (const [tab, grid] of [['tabSkins', 'skinGrid'], ['tabAuras', 'auraGrid'], ['tabEffects', 'effectGrid'], ['tabOverdrive', 'overdriveSkinGrid']]) {
        document.getElementById(tab).click(); await u.wait(200);
        const cards = [...document.querySelectorAll(`#${grid} .skin-card`)];
        const fonts = cards.flatMap(c => [...c.querySelectorAll('.skin-name, .skin-owned-badge, .skin-price')].map(e => parseFloat(getComputedStyle(e).fontSize)));
        const cut = cards.filter(c => { const meta = c.querySelector('.skin-owned-badge, .skin-price'), nm = c.querySelector('.skin-name'); return u.textCut(nm) || u.R(nm).right > u.R(c).right + 0.5 || u.R(meta).right > u.R(c).right + 0.5 || u.R(meta).bottom > u.R(c).bottom + 0.5 || (meta.classList.contains('skin-owned-badge') || !c.classList.contains('is-reward') ? u.textCut(meta) : false); }).map(c => c.dataset.item);
        const unreach = cards.filter(c => !u.reachable(c)).map(c => c.dataset.item);
        const marks = cards.filter(c => { const nm = u.textRect(c.querySelector('.skin-name')); return [...c.querySelectorAll('.u2-src, .skin-card-lock, .skin-card-check')].some(m => u.cross(nm, u.R(m))); }).map(c => c.dataset.item);
        res.tabs[tab] = { cols: new Set(cards.map(c => Math.round(u.R(c).left))).size, n: cards.length, minFont: Math.min(...fonts), cut, unreach, marks, minTap: Math.round(Math.min(...cards.map(c => Math.min(u.R(c).width, u.R(c).height)))), tabIn: u.inView(document.getElementById(tab)) || !!u.scroller(document.getElementById(tab)) };
      }
      document.getElementById('tabSkins').click(); await u.wait(200);
      const sc = u.scroller(document.querySelector('#skinGrid .skin-card')); if (sc) sc.scrollTop = 0;
      res.look = { shown: u.shown(document.getElementById('warsztatLookValue')), text: document.getElementById('warsztatLookValue').textContent, want: SKINS.find(s => s.id === gm.save.selected).look };
      res.status = u.shown(document.getElementById('warsztatStatus')) && !u.textCut(document.getElementById('warsztatStatus'));
      // the last card clears the navigation
      const cards = [...document.querySelectorAll('#skinGrid .skin-card')], last = cards[cards.length - 1];
      res.lastReach = u.reachable(last);
      res.sideways = document.documentElement.scrollWidth > innerWidth + 1;
      res.cardLook = u.shown(cards[0].querySelector('.skin-look'));
      return res;
    });
    const tabs = Object.values(r.tabs);
    out.push(allOf(`CRITICAL FIX 3 -- Warsztat ${w}x${h} ${loc.slice(0, 2)}: ${wantCols ? wantCols + ' cards to a row' : 'two or more cards to a row'}; every name, state and price whole and >= 9 px; every card can be tapped; the look's description beside the preview`, {
      'columns': wantCols ? r.tabs.tabSkins.cols === wantCols : r.tabs.tabSkins.cols >= 2, 'no name / state / price cut on any of the four tabs': tabs.every(t => t.cut.length === 0), 'text >= 9 px': tabs.every(t => t.minFont >= 9),
      'every card reachable (none left under the navigation)': tabs.every(t => t.unreach.length === 0) && r.lastReach, 'cards >= 44 px': tabs.every(t => t.minTap >= 44), 'marks clear of the names': tabs.every(t => t.marks.length === 0),
      'the description of the look is shown at the preview': r.look.shown && r.look.text === (loc.startsWith('en') ? r.look.text : r.look.want) && r.look.text.length > 3, 'status plate whole': r.status, 'no sideways scroll': !r.sideways
    }, JSON.stringify({ cols: tabs.map(t => t.cols), minFont: tabs.map(t => t.minFont), cut: tabs.flatMap(t => t.cut), unreach: tabs.flatMap(t => t.unreach), marks: tabs.flatMap(t => t.marks), look: r.look, cardLook: r.cardLook })));
    out.push(report(`Warsztat ${w}x${h} ${loc.slice(0, 2)}: no runtime errors`, g2.errors.length === 0, g2.errors.slice(0, 2).join(' | ')));
    await g2.browser.close();
  }
  return out;
}

/* ============================== 4. WYNIKI I NAGRODY ============================== */
async function wynikiChecks(url) {
  const out = [];
  const RESULT = () => {
    const u = window.__u2, q = (s) => document.querySelector(s), gm = window.game;
    const rc = u.R(q('.result-coins-card')), rx = u.R(q('#resultXpCard')), rk = u.R(q('.result-core-card')), rw = u.R(q('.result-rewards'));
    const order = ['.result-hero', '.result-badges', '.result-rewards', '#finalLeaderboard'].map(s => u.R(q(s)).top);
    return { screen: u.shown(q('#gameOverScreen')), score: q('#finalScore').textContent, coinsShown: +q('#finalCoins').textContent, xpGain: q('#resultXpGain').textContent, place: q('#finalPlace').textContent, tier: q('#resultTierLabel').textContent,
      ad: u.shown(q('#btnWatchAd')), menu: q('#btnMenu').textContent, share: u.shown(q('#btnShare')), again: u.inView(q('#btnPlayAgain')) && u.hit(q('#btnPlayAgain')), newbie: u.shown(q('#resultNewbieTag')),
      tilesSideBySide: Math.abs(rc.top - rx.top) < 2 && rc.right <= rx.left + 1, coreWide: rk.top >= rc.bottom - 1 && rk.width >= rw.width - 2, tilesInView: document.body.classList.contains('compact') || (u.reachable(q('.result-coins-card')) && u.reachable(q('.result-core-card'))),
      badgesAsTiles: getComputedStyle(q('.result-badge')).flexDirection === 'column' && getComputedStyle(q('.result-badge')).borderRadius !== '999px', order: order.every((t, i) => i === 0 || t >= order[i - 1]),
      core: [q('#resultCoreBefore').textContent, q('#resultCoreAfter').textContent, q('#resultCoreGain').textContent], coins: gm.save.coins, runs: gm.save.stats.runsPlayed, hub: { ...gm.save.hub }, xp: { ...gm.save.player },
      rank: [...document.querySelectorAll('#finalLeaderboard li')].map(li => li.textContent).slice(0, 3), cut: [q('.result-coins-value'), q('#resultXpGain'), q('#resultTierLabel')].some(u.textCut), sideways: document.documentElement.scrollWidth > innerWidth + 1 };
  };
  const round = async (page, seed, style = 'casual') => { await page.evaluate(({ seed, style }) => { window.__qaSeedRandom(seed); window.__qaPlayArena({ round: { seed }, style, clock0: 500000 }); }, { seed, style }); await page.waitForFunction(() => !document.getElementById('gameOverScreen').classList.contains('hidden'), null, { timeout: 60000 }); await page.waitForTimeout(1900); };

  // --- the first Arena result of a new player (FTUE)
  for (const [w, h, loc] of [[390, 844, 'pl-PL'], [320, 568, 'en-US']]) {
    const g = await open(url, { w, h, locale: loc, fresh: true });
    await g.page.evaluate(() => { const s = window.game.save; s.privacy = { decided: true, analytics: false, ads: false, ts: Date.now() }; window.game.applyConsent && 0; });
    const before = await g.page.evaluate(() => ({ coins: window.game.save.coins, xp: window.game.save.player.xp, lvl: window.game.save.player.level }));
    await round(g.page, 4242);
    const cards = await g.page.evaluate(() => !document.getElementById('unlockOverlay').classList.contains('hidden'));
    const r = await g.page.evaluate(RESULT);
    out.push(allOf(`First Arena result ${w}x${h} ${loc.slice(0, 2)} (FTUE): no x2 ad, the way back is "Menu główne", nothing over the result, the round's coins paid as shown; coins and XP as two tiles, Core City one wide card`, {
      'no reward card over the first result': !cards, 'no x2-for-an-ad offer': !r.ad, 'Menu główne (not Wróć do Miasta)': r.menu === (loc.startsWith('en') ? 'Main menu' : 'Menu główne'), 'ZAGRAJ JESZCZE RAZ in view and clickable': r.again, 'WYZWIJ ZNAJOMEGO shown': r.share,
      'coins on the tile = coins paid': r.coinsShown > 0 && r.coins - before.coins >= r.coinsShown, 'one finished round counted': r.runs === 1, 'the newcomer bonus tag shown': r.newbie,
      'coins and XP side by side': r.tilesSideBySide, 'Core City wide under them': r.coreWide, 'size and place stay plain tiles (not pills)': r.badgesAsTiles, 'order: score, size + place, rewards, ranking': r.order, 'nothing cut, no sideways scroll': !r.cut && !r.sideways
    }, JSON.stringify({ ...r, rank: undefined, before })));
    // ZAGRAJ JESZCZE RAZ starts a round at once
    const again = await g.page.evaluate(async () => { document.getElementById('btnPlayAgain').click(); await window.__u2.wait(500); const gm = window.game; const st = { state: gm.state, hud: !document.getElementById('hud').classList.contains('hidden'), over: document.getElementById('gameOverScreen').classList.contains('hidden') }; return st; });
    out.push(report(`First Arena result ${w}x${h}: ZAGRAJ JESZCZE RAZ starts the next round`, again.over && (again.hud || /PLAY|SETUP/i.test(String(again.state))), JSON.stringify(again)));
    out.push(report(`First Arena result ${w}x${h}: no runtime errors`, g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // --- a later Arena result: the ad offer as before, rewards = the save's change, Core City
  for (const [w, h, mobile] of [[390, 844, true], [320, 568, true], [800, 450, false], [1366, 768, false]]) {
    const g = await open(url, { w, h, mobile, edit: (s) => { s.hub = { coreLevel: 3, coreCharge: 46 }; s.player = { level: 7, xp: 310 }; s.stats.recentArenaScores = [2950, 3310]; s.stats.bestArenaScore = 3310; } });
    const before = await g.page.evaluate(() => ({ coins: window.game.save.coins, hub: { ...window.game.save.hub }, ads: window.game.monetization.adsAvailable, runs: window.game.save.stats.runsPlayed }));
    await round(g.page, 777, 'greedy');
    await closeUnlock(g.page);
    const r = await g.page.evaluate(RESULT);
    const gained = r.hub.coreLevel > before.hub.coreLevel ? r.hub.coreCharge + 100 - before.hub.coreCharge : r.hub.coreCharge - before.hub.coreCharge;
    out.push(allOf(`Later Arena result ${w}x${h}: the x2 offer as the rules say, "Wróć do Miasta", coins and Core City on the cards = what the save got, the reward tiles`, {
      'x2 offer shown when ads are available': r.ad === before.ads, 'Wróć do Miasta': r.menu === 'Wróć do Miasta', 'coins shown = coins paid (plus any level reward)': r.coinsShown > 0 && r.coins - before.coins >= r.coinsShown, 'run counted once': r.runs === before.runs + 1,
      'Core City: before -> after = the save': r.core[0] === before.hub.coreCharge + '%' && r.core[1] === r.hub.coreCharge + '%' && r.core[2] === `+${gained}%`, 'ranking: three or more rows, by points': r.rank.length >= 3,
      'tiles side by side, Core City wide': r.tilesSideBySide && r.coreWide, 'rewards can be brought into view': r.tilesInView, 'ZAGRAJ JESZCZE RAZ in view and clickable': r.again, 'nothing cut, no sideways scroll': !r.cut && !r.sideways
    }, JSON.stringify({ ...r, rank: r.rank.length, before })));
    if (w === 390) {
      const back = await g.page.evaluate(async () => { document.getElementById('btnMenu').click(); await window.__u2.wait(700); return window.__u2.shown(document.getElementById('mainMenu')) && document.getElementById('gameOverScreen').classList.contains('hidden'); });
      out.push(report('Later Arena result: "Wróć do Miasta" returns to Miasto', back, ''));
    }
    out.push(report(`Later Arena result ${w}x${h}: no runtime errors`, g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // --- a Core City level reached: the reward granted once, the trophy card
  {
    const g = await open(url, { edit: (s) => { s.hub = { coreLevel: 3, coreCharge: 94 }; s.owned.push('krysztal'); s.auras.owned.push('impuls'); s.stats.recentArenaScores = [2950, 3310]; } });
    const before = await g.page.evaluate(() => ({ effects: window.game.save.effects.owned.slice(), coins: window.game.save.coins }));
    await round(g.page, 777, 'greedy');
    await g.page.waitForFunction(() => !document.getElementById('unlockOverlay').classList.contains('hidden'), null, { timeout: 15000 }).catch(() => {});
    await g.page.waitForTimeout(1800);
    const r = await g.page.evaluate(() => {
      const u = window.__u2, q = (s) => document.querySelector(s), gm = window.game, panel = q('#unlockOverlay .unlock-panel'), kicker = q('#unlockOverlay .unlock-kicker'), pr = u.R(panel), kr = u.R(kicker);
      return { open: u.shown(q('#unlockOverlay')), kicker: kicker.textContent, title: q('#unlockTitle').textContent, eyebrow: q('#unlockEyebrow').textContent, icon: q('#unlockIcon').innerHTML.length > 20,
        ribbon: kr.left >= pr.left - 1 && kr.right <= pr.right + 1 && Math.abs(kr.top - pr.top) < 4 && !u.textCut(kicker), color: getComputedStyle(q('#unlockOverlay')).getPropertyValue('--unlock-color').trim() || getComputedStyle(panel).getPropertyValue('--unlock-color').trim(),
        btns: [...document.querySelectorAll('#unlockOverlay .unlock-actions button')].filter(u.shown).map(b => [b.textContent, u.inView(b) && u.hit(b)]), panelIn: pr.top >= -1 && pr.bottom <= innerHeight + 1, lvl: gm.save.hub.coreLevel,
        effects: gm.save.effects.owned.slice(), coins: gm.save.coins, titleCut: u.R(q('#unlockTitle')).right > pr.right + 1 };
    });
    const got = r.effects.filter(x => !before.effects.includes(x));
    out.push(allOf('Core City reward (LVL 4): granted once, shown on the trophy card -- the event\'s title on the ribbon, the reward\'s own icon and name, working buttons', {
      'level reached': r.lvl === 4, 'the cosmetic granted exactly once': got.length === 1 && r.effects.filter(x => x === got[0]).length === 1, 'card open and whole': r.open && r.panelIn, 'ribbon with the event title inside the card': r.ribbon && r.kicker.length > 3,
      'reward icon and name': r.icon && r.title.length > 3 && !r.titleCut, 'eyebrow names the source': /CORE CITY/.test(r.eyebrow), 'buttons in view and clickable': r.btns.length >= 1 && r.btns.every(b => b[1])
    }, JSON.stringify({ ...r, got })));
    // closing the card and opening Miasto again grants nothing more
    const again = await g.page.evaluate(async () => { const gm = window.game, u = window.__u2; const b = [...document.querySelectorAll('#unlockOverlay .unlock-actions button')].filter(u.shown).pop(); b.click(); await u.wait(700); gm.unlockQueue = []; document.getElementById('unlockOverlay').classList.add('hidden'); const c = gm.save.coins, e = gm.save.effects.owned.length; gm.showScreen('mainMenu'); gm.updateCoinDisplays(); await u.wait(400); return { coins: gm.save.coins === c, effects: gm.save.effects.owned.length === e, lvl: gm.save.hub.coreLevel }; });
    out.push(report('Core City reward: no second grant after the card is closed', again.coins && again.effects && again.lvl === 4, JSON.stringify(again)));
    await g.browser.close();
  }

  // --- the free chest: paid once, its card
  {
    const g = await open(url, { edit: (s) => { s.freeChest = { nextAt: 0, opened: 4 }; } });
    const r = await g.page.evaluate(async () => {
      const gm = window.game, u = window.__u2, q = (s) => document.querySelector(s); window.__qaSeedRandom(21);
      const c0 = gm.save.coins, p0 = gm.save.prisms || 0;
      q('#hubFreeChest').click(); await u.wait(2300);
      const c1 = gm.save.coins, p1 = gm.save.prisms || 0, title = q('#unlockTitle').textContent, open = u.shown(q('#unlockOverlay')), kicker = q('#unlockOverlay .unlock-kicker').textContent;
      const b = [...document.querySelectorAll('#unlockOverlay .unlock-actions button')].filter(u.shown).pop(); if (b) b.click(); await u.wait(500);
      q('#hubFreeChest').click(); await u.wait(400);
      return { gain: c1 - c0, prisms: p1 - p0, title, open, kicker, second: gm.save.coins - c1, ready: q('#hubFreeChest').classList.contains('ready'), opened: gm.save.freeChest.opened };
    });
    out.push(report('Free chest: opened from Miasto it pays once, shows its trophy card with the amount, and waits for the cooldown (a second tap pays nothing)', r.open && (r.gain > 0 || r.prisms > 0) && r.title.includes(String(r.gain || r.prisms)) && r.second === 0 && !r.ready && r.opened === 5, JSON.stringify(r)));
    await g.browser.close();
  }

  // --- the mission result: stars, conditions, XP, the next mission, buttons
  for (const [w, h, loc] of [[390, 844, 'pl-PL'], [320, 568, 'en-US']]) {
    const g = await open(url, { w, h, locale: loc, edit: (s) => { s.player = { level: 7, xp: 310 }; } });
    const r = await g.page.evaluate(async () => {
      const gm = window.game, u = window.__u2, q = (s) => document.querySelector(s); window.__qaSeedRandom(5);
      const port = DISTRICTS.find(d => d.id === 'port'), id = port.missions[7], next0 = gm.nextCampaignMissionId();
      const c0 = gm.save.coins, xp0 = { ...gm.save.player }, stars0 = gm.save.campaign.stars[id] || 0;
      gm.startCampaignMission(id); if (gm.introPending) gm.beginMissionPlay(); cancelAnimationFrame(gm.rafId); gm.running = false; gm.mission.elapsed = 24; gm.endCampaignMission(true);
      await u.wait(2300); gm.unlockQueue = []; q('#unlockOverlay').classList.add('hidden');
      const lit = [...document.querySelectorAll('#missionResultStars .mr-star')].filter(s => s.classList.contains('on') || s.classList.contains('earned')).length, all = document.querySelectorAll('#missionResultStars .mr-star').length;
      const bits = gm.save.campaign.stars[id] || 0, count = [1, 2, 4].filter(b => bits & b).length;
      const nextCard = q('#missionResultNextCard'), nb = q('#btnMissionNext');
      const res = { screen: u.shown(q('#missionResultScreen')), stars: [lit, all, count], plate: getComputedStyle(q('#missionResultStars')).borderTopStyle === 'solid' && u.shown(q('#missionResultStars')), conds: document.querySelectorAll('#missionResultMedal .mr-star-row').length,
        xp: q('#missionXpGain').textContent, xpSave: gm.save.player.level * 100000 + gm.save.player.xp > xp0.level * 100000 + xp0.xp, nela: q('#missionResultNela').textContent.length > 3 && u.shown(q('#missionResultNelaBubble')),
        nextCode: nextCard.querySelector('.mc-code') ? nextCard.querySelector('.mc-code').textContent : null, wantNext: missionCode(campaignMissionById(next0)), bossMark: !!nextCard.querySelector('.mc-goal.is-boss .u2-boss-tag'), wantBoss: campaignMissionById(next0).goal.steps.some(s => s.landmark),
        nextBtn: u.inView(nb) && u.hit(nb), retry: u.shown(q('#btnMissionRetry')), map: u.shown(q('#btnMissionMap')), menu: u.shown(q('#btnMissionMenu')), stillNext: gm.nextCampaignMissionId() === next0, coins: gm.save.coins - c0, sideways: document.documentElement.scrollWidth > innerWidth + 1 };
      nb.click(); await u.wait(500);
      res.afterNext = { briefing: u.shown(q('#missionBriefing')), code: q('#briefingCard .mc-code') ? q('#briefingCard .mc-code').textContent : null };
      return res;
    });
    out.push(allOf(`Mission result ${w}x${h} ${loc.slice(0, 2)}: the stars on their plate = the stars earned, the three conditions, XP paid, NELA, the next mission's card (its real code, the boss marked), the buttons`, {
      'result screen': r.screen, 'stars lit = stars in the save': r.stars[1] === 3 && r.stars[0] === r.stars[2], 'the plate': r.plate, 'three star conditions listed': r.conds === 3, 'XP shown and paid': /\+\d+ XP/.test(r.xp) && r.xpSave, 'NELA': r.nela,
      'next mission = the campaign\'s next': r.nextCode === r.wantNext && r.stillNext, 'boss marked on its card': r.bossMark === r.wantBoss, 'DALEJ in view and clickable; retry / districts / city present': r.nextBtn && r.retry && r.map && r.menu,
      'a replay pays no mission reward again': r.coins === 0, 'the main button leads to that mission\'s briefing': r.afterNext.briefing && r.afterNext.code === r.wantNext, 'no sideways scroll': !r.sideways
    }, JSON.stringify(r)));
    out.push(report(`Mission result ${w}x${h} ${loc.slice(0, 2)}: no runtime errors`, g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // --- CALENDAR FIX: every state of the week, the mark never over an amount; paid once
  for (const [w, h, loc] of [[320, 568, 'pl-PL'], [320, 568, 'en-US'], [360, 800, 'pl-PL'], [390, 844, 'pl-PL'], [390, 844, 'en-US'], [800, 450, 'pl-PL']]) {
    const g = await open(url, { w, h, mobile: w < 700, locale: loc });
    const r = await g.page.evaluate(async () => {
      const gm = window.game, u = window.__u2, q = (s) => document.querySelector(s), days = [];
      for (let day = 0; day < 7; day++) {
        gm.save.login.day = day; gm.save.login.lastClaimDate = '2026-11-12';
        q('#loginRewardScreen').classList.add('hidden');
        gm.bootFirstRun = false; gm.maybeShowLoginReward(); await u.wait(450);
        const tiles = [...document.querySelectorAll('#loginRewardGrid .login-tile')];
        const over = [], amounts = [];
        tiles.forEach((t, i) => {
          const chk = t.querySelector('.login-tile-check'), texts = [...t.querySelectorAll('.login-tile-day, .login-tile-coins, .login-tile-prisms')];
          amounts.push([...t.querySelectorAll('.login-tile-coins, .login-tile-prisms')].map(e => +e.textContent.replace(/\D/g, '')).join('+'));
          if (chk && texts.some(e => u.cross(u.textRect(e), u.R(chk)))) over.push(i + 1);
          if (!!chk !== (i < day)) over.push('state' + (i + 1));
          if (texts.some(e => u.R(e).right > u.R(t).right + 0.5 || parseFloat(getComputedStyle(e).fontSize) < 9)) over.push('cut' + (i + 1));
        });
        const panel = q('#loginRewardScreen .login-panel'), pr = u.R(panel), claim = q('#btnLoginClaim');
        days.push({ day, n: tiles.length, over, amounts: amounts.join(), current: tiles.findIndex(t => t.classList.contains('current')), claimIn: u.inView(claim) && u.hit(claim), marksInPanel: [...panel.querySelectorAll('.login-tile-check')].every(c => u.R(c).right <= pr.right && u.R(c).top >= pr.top), panelIn: pr.top >= -1 && pr.bottom <= innerHeight + 1 });
      }
      const want = CONFIG.loginRewards.map(x => [x.coins, x.prisms].filter(Boolean).join('+')).join();
      // claim day 4 once; a second claim pays nothing
      gm.save.login.day = 3; gm.save.login.lastClaimDate = '2026-11-12'; q('#loginRewardScreen').classList.add('hidden'); gm.maybeShowLoginReward(); await u.wait(300);
      const c0 = gm.save.coins, p0 = gm.save.prisms || 0, rw = CONFIG.loginRewards[3];
      q('#btnLoginClaim').click(); await u.wait(500);
      const c1 = gm.save.coins, p1 = gm.save.prisms || 0, saved = JSON.parse(localStorage.getItem('vectorHoleSave_v1'));
      gm.claimLoginReward(); await u.wait(100);
      const tiles = [...document.querySelectorAll('#loginRewardGrid .login-tile')];
      const overAfter = tiles.filter(t => { const chk = t.querySelector('.login-tile-check'); return chk && [...t.querySelectorAll('.login-tile-day, .login-tile-coins, .login-tile-prisms')].some(e => u.cross(u.textRect(e), u.R(chk))); }).length;
      return { days, want, pay: [c1 - c0, p1 - p0], rw: [rw.coins || 0, rw.prisms || 0], twice: gm.save.coins - c1, savedDay: saved.login.day, savedDate: saved.login.lastClaimDate, claimedMarks: tiles.filter(t => t.querySelector('.login-tile-check')).length, overAfter };
    });
    out.push(allOf(`CALENDAR FIX -- daily reward ${w}x${h} ${loc.slice(0, 2)}: on every day of the week the collected days' marks touch no amount or day label, the amounts are the game's, ODBIERZ in view; one claim pays once and is saved`, {
      'seven tiles, the game\'s amounts, every day state': r.days.every(d => d.n === 7 && d.amounts === r.want && d.current === d.day), 'no mark over an amount or a day label (days 1-7)': r.days.every(d => d.over.length === 0), 'marks inside the panel': r.days.every(d => d.marksInPanel),
      'the panel and ODBIERZ in view': r.days.every(d => d.claimIn && d.panelIn), 'the claim pays the day\'s reward': r.pay.join() === r.rw.join(), 'saved (next day, today\'s date)': r.savedDay === 4 && r.savedDate === '2026-11-13',
      'a second claim pays nothing': r.twice === 0, 'after the claim: four marks, still clear of the amounts': r.claimedMarks === 4 && r.overAfter === 0
    }, JSON.stringify({ over: r.days.map(d => d.over), pay: r.pay, rw: r.rw, twice: r.twice, amounts: r.want })));
    await g.browser.close();
  }
  return out;
}

/* ============================== 5. NAWIGACJA, EN, WEJŚCIE, SAVE ============================== */
async function navChecks(url) {
  const out = [];
  // --- CRITICAL FIX 4: the plain bar (no floating dock), safe area, the active tab, lists end above it
  for (const [w, h, inset] of [[390, 844, 0], [390, 844, 34], [320, 568, 0], [360, 800, 20]]) {
    const g = await open(url, { w, h, save: { missions: 60 } });
    if (inset) { await safeArea(g.page, { bottom: inset }); await g.page.addScriptTag({ content: HELPERS }); }
    const r = await g.page.evaluate(async (inset) => {
      const gm = window.game, u = window.__u2, q = (s) => document.querySelector(s), nav = q('#bottomNav'), res = { tabs: [] };
      const nr = () => u.R(nav), cs = getComputedStyle(nav);
      res.docked = Math.abs(nr().left) < 1 && Math.abs(nr().right - innerWidth) < 1 && Math.abs(nr().bottom - innerHeight) < 1 && parseFloat(cs.borderTopLeftRadius) === 0;
      res.padBottom = parseFloat(cs.paddingBottom); res.inset = inset; res.blur = cs.backdropFilter && cs.backdropFilter !== 'none';
      for (const [btn, screen, list] of [['btnNavMiasto', 'mainMenu', null], ['btnNavDzielnice', 'campaignScreen', '#missionList .mission-row:last-child'], ['btnNavWarsztat', 'shopScreen', '#shopScreen .store-card, #skinGrid .skin-card:last-child'], ['btnNavWyzwania', 'challengesScreen', null]]) {
        const b = document.getElementById(btn); b.click(); await u.wait(450);
        const t = { btn, open: u.shown(document.getElementById(screen)), active: [...nav.querySelectorAll('.nav-tab.active')].map(x => x.id).join(), tap: Math.round(Math.min(u.R(b).width, u.R(b).height)), aboveInset: u.R(b.querySelector('.nav-tab-label')).bottom <= innerHeight - inset + 1, locked: b.classList.contains('locked') };
        if (list) {
          const els = [...document.querySelectorAll(list)].filter(u.shown), last = els[els.length - 1], sc = u.scroller(last);
          // to the very end, and wait until the scroll (and the pinned showroom card's resize) has come to rest
          if (sc) { let prev = -1, same = 0; for (let i = 0; i < 40 && same < 3; i++) { sc.scrollTop = sc.scrollHeight; await u.wait(60); same = Math.abs(sc.scrollTop - prev) < 0.5 ? same + 1 : 0; prev = sc.scrollTop; } }
          t.lastClear = Math.round(nr().top - u.R(last).bottom); t.lastHit = u.hit(last);
          if (sc) sc.scrollTop = 0;
        }
        res.tabs.push(t);
      }
      // the navigation never takes GRAJ's tap or the purchase's
      q('#btnNavMiasto').click(); await u.wait(400);
      res.playHit = u.hit(q('#btnStart')) && u.R(q('#btnStart')).bottom <= nr().top;
      q('#btnNavWarsztat').click(); await u.wait(400);
      const it = SKINS.find(s => !s.unlockSource && !gm.save.owned.includes(s.id)); q(`#skinGrid .skin-card[data-item="${it.id}"]`).click(); await u.wait(200);
      const buy = q('#btnWarsztatBuy'); res.buyHit = u.shown(buy) && u.hit(buy) && u.R(buy).bottom <= nr().top;
      return res;
    }, inset);
    out.push(allOf(`CRITICAL FIX 4 -- navigation ${w}x${h}${inset ? ' (safe area ' + inset + ' px)' : ''}: the plain bar docked to the bottom edge (no floating dock, no blur), padded by the safe area; every tab opens its screen and is the one marked; the lists end above it; GRAJ and the purchase keep their taps`, {
      'docked edge to edge, square corners': r.docked, 'no backdrop-filter': !r.blur, 'bottom padding includes the safe area': r.padBottom >= inset + 6, 'every tab opens its screen': r.tabs.every(t => t.open), 'exactly that tab is marked active': r.tabs.every(t => t.active === t.btn),
      'tabs >= 44 px and above the home indicator': r.tabs.every(t => t.tap >= 44 && t.aboveInset), 'the last mission / the last Warsztat item clears the bar and takes a tap': r.tabs.filter(t => 'lastClear' in t).every(t => t.lastClear >= 0 && t.lastHit),
      'GRAJ above the bar and clickable': r.playHit, 'the purchase button above the bar and clickable': r.buyHit
    }, JSON.stringify(r)));
    await g.browser.close();
  }
  // a locked tab stays locked (a one-round profile)
  {
    const g = await open(url, { save: { missions: 0, runsPlayed: 1, coins: 0 }, edit: (s) => { s.unlocks.announced = []; } });
    const r = await g.page.evaluate(async () => { const u = window.__u2, gm = window.game; const want = { btnNavWarsztat: !FEATURE_GATES.warsztat(gm.save), btnNavWyzwania: !FEATURE_GATES.wyzwania(gm.save) }; const got = {}; for (const id of Object.keys(want)) { const b = document.getElementById(id); got[id] = b.classList.contains('locked'); b.click(); await u.wait(250); got[id + ':opened'] = u.shown(document.getElementById(b.dataset.nav)); document.getElementById('btnInfoSheetClose').click(); await u.wait(80); } return { want, got }; });
    out.push(report('Navigation: a tab the save has not unlocked stays locked and opens nothing (the unlock rules are the game\'s)', Object.keys(r.want).every(k => r.got[k] === r.want[k] && (!r.want[k] || !r.got[k + ':opened'])), JSON.stringify(r)));
    await g.browser.close();
  }
  // turning the phone: the bar becomes the rail and back, the active tab kept
  {
    const g = await open(url, { w: 390, h: 844 });
    const r = await g.page.evaluate(async () => { const u = window.__u2; document.getElementById('btnNavDzielnice').click(); await u.wait(300); return true; });
    await g.page.setViewportSize({ width: 844, height: 390 }); await g.page.waitForTimeout(700);
    const land = await g.page.evaluate(() => { const u = window.__u2, nav = document.getElementById('bottomNav'), r = u.R(nav), play = document.querySelector('#missionNextCard .mc-play'); return { rail: r.width < 120 && r.height > innerHeight * 0.9, active: nav.querySelector('.nav-tab.active').id, screen: u.shown(document.getElementById('campaignScreen')), play: !!play && u.inView(play) && u.hit(play), tiles: [...document.querySelectorAll('#districtMap .district-tile')].every(u.inView) }; });
    await g.page.setViewportSize({ width: 390, height: 844 }); await g.page.waitForTimeout(700);
    const back = await g.page.evaluate(() => { const u = window.__u2, nav = document.getElementById('bottomNav'), r = u.R(nav), play = document.querySelector('#missionNextCard .mc-play'); return { bar: Math.abs(r.bottom - innerHeight) < 1 && r.width >= innerWidth - 1, active: nav.querySelector('.nav-tab.active').id, play: !!play && u.inView(play) && u.hit(play), cols: new Set([...document.querySelectorAll('#districtMap .district-tile')].map(t => Math.round(u.R(t).left))).size }; });
    out.push(report('Navigation: turning the phone on Dzielnice -- a rail in landscape, the bar again in portrait, the same tab active, GRAJ reachable both ways, all twelve districts in view', r && land.rail && land.active === 'btnNavDzielnice' && land.screen && land.play && land.tiles && back.bar && back.active === 'btnNavDzielnice' && back.play && back.cols === 4, JSON.stringify({ land, back })));
    await g.browser.close();
  }

  // --- English: the new copy is translated, nothing Polish left on the new parts
  {
    const g = await open(url, { locale: 'en-US', save: { missions: 29 }, edit: (s) => { s.prisms = 1; s.owned.push('cyan'); } });
    const r = await g.page.evaluate(async () => {
      const gm = window.game, u = window.__u2, q = (s) => document.querySelector(s), res = {};
      gm.openCampaignScreen(); await u.wait(300);
      res.route = q('#districtRoute').textContent.replace(/\s+/g, ' ').trim(); res.boss = [...document.querySelectorAll('.u2-boss-tag')].map(e => e.textContent)[0]; res.nums = q('#districtMap .u2-num').textContent;
      gm.openWarsztatScreen(); await u.wait(300);
      const st = () => q('#warsztatStatus').textContent; res.worn = st();
      const dear = SKINS.find(s => !s.unlockSource && !gm.save.owned.includes(s.id) && (s.priceCoins != null ? s.priceCoins : s.price) > gm.save.coins), cheap = SKINS.find(s => !s.unlockSource && !gm.save.owned.includes(s.id) && (s.priceCoins != null ? s.priceCoins : s.price) <= gm.save.coins), rew = SKINS.find(s => s.unlockSource && !gm.save.owned.includes(s.id));
      q(`#skinGrid .skin-card[data-item="${dear.id}"]`).click(); await u.wait(150); res.short = st();
      q(`#skinGrid .skin-card[data-item="${cheap.id}"]`).click(); await u.wait(150); res.buy = st();
      q(`#skinGrid .skin-card[data-item="${rew.id}"]`).click(); await u.wait(150); res.reward = st();
      document.getElementById('tabAuras').click(); await u.wait(150); const pa = AURAS.find(a => a.priceType === 'prisms' && a.pricePrisms > 1 && !a.unlockSource); q(`#auraGrid .skin-card[data-item="${pa.id}"]`).click(); await u.wait(150); res.shortPrisms = st();
      gm.clearWarsztatFocus(); gm.showScreen('mainMenu'); gm.updateCoinDisplays(); await u.wait(300);
      res.prefix = q('.hub-city-next-prefix').textContent; res.lang = document.documentElement.lang;
      // Polish letters left on the three screens' new nodes
      res.polish = [...document.querySelectorAll('.u2-route, .u2-status, .u2-boss-tag, .u2-rail, #hubHeroStage, #missionNextCard')].map(e => e.textContent).filter(t => /[ąćęłńóśźż]/i.test(t)).map(t => t.slice(0, 40));
      res.misses = I18N.misses ? [...I18N.misses].filter(m => /ODBUDOWANE|MISJE|WYPOSAŻONE|DO KUPIENIA|ZA MAŁO|NAGRODA|BOSS/.test(m)) : [];
      return res;
    });
    out.push(allOf('English: the new copy is translated in I18N_EN (counters, BOSS, the Warsztat status plate), nothing Polish left on the new parts', {
      'lang = en': r.lang === 'en', 'counters': /^DISTRICTS REBUILT 2\/12 ?MISSIONS 29\/240$/.test(r.route), 'BOSS': r.boss === 'BOSS', 'EQUIPPED': r.worn === 'EQUIPPED', 'NOT ENOUGH COINS': r.short === 'NOT ENOUGH COINS', 'AVAILABLE TO BUY': r.buy === 'AVAILABLE TO BUY',
      'REWARD': r.reward === 'REWARD', 'NOT ENOUGH PRISMS': r.shortPrisms === 'NOT ENOUGH PRISMS', 'no Polish letters on the new nodes': r.polish.length === 0, 'no untranslated new string': r.misses.length === 0
    }, JSON.stringify(r)));
    await g.browser.close();
  }

  // --- the entrance: a screen is never invisible while it comes in; SAVE v13 with the default's fields only
  {
    const g = await open(url, { w: 2560, h: 1440, mobile: false });
    const r = await g.page.evaluate(async () => {
      const gm = window.game, seen = [];
      for (const open of [() => gm.openCampaignScreen(), () => gm.openWarsztatScreen(), () => gm.showScreen('mainMenu'), () => gm.openChallengesScreen()]) {
        open();
        const scr = document.querySelector('.screen:not(.hidden):not(.overlay-screen)'), inner = scr.querySelector(':scope > .screen-inner');
        const samples = [];
        for (let i = 0; i < 4; i++) { samples.push(Math.min(+getComputedStyle(scr).opacity, +getComputedStyle(inner).opacity)); await new Promise(res => requestAnimationFrame(() => res())); }
        seen.push({ id: scr.id, min: Math.min(...samples), anim: getComputedStyle(inner).animationName });
        await new Promise(res => setTimeout(res, 120));
      }
      const keys = (o, p = '') => Object.keys(o).flatMap(k => o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) && !['completed', 'stars', 'attempts', 'boosters', 'seen', 'bests'].includes(k) ? keys(o[k], p + k + '.') : [p + k]);
      const def = defaultSave(), cur = JSON.parse(localStorage.getItem('vectorHoleSave_v1'));
      const dk = new Set(keys(def)), extra = keys(cur).filter(k => !dk.has(k) && !/^(_|seal|sig|hash|checksum)/.test(k));
      return { seen, version: cur.schemaVersion !== undefined ? cur.schemaVersion : cur.version, extra, key: !!localStorage.getItem('vectorHoleSave_v1') };
    });
    out.push(report('Entrance (2560x1440): from its first frame a menu screen is visible (opacity never 0) -- the old fade-from-nothing left it unseen where frames are slow', r.seen.length === 4 && r.seen.every(s => s.min >= 0.3), JSON.stringify(r.seen)));
    out.push(report('SAVE: schema 13 under vectorHoleSave_v1, and no field the default save does not have (the new screens read existing data only)', r.version === 13 && r.key && r.extra.length === 0, JSON.stringify({ version: r.version, extra: r.extra })));
    await g.browser.close();
  }
  return out;
}

/** Scope: what the stage changed in game.js, by function -- display code of the menu screens only. */
function scopeChecks() {
  const out = [];
  const OK = /^(renderCoreRail|renderHubCity|startScreenAnim|updateCoinDisplays|renderCampaignMap|missionStepRows|missionCardHtml|showMissionStartCard|selectCampaignDistrict|renderCosmeticGrid|renderWarsztatAction|<top> function drawCityScene|<top> const U2_CHECK|<top> const U2_LOCK|<top> const U2_BOSS_TAG|<top> const I18N_EN)$/;
  let diff = null;
  try { diff = execSync(`git diff -U0 ${BASE_REV} -- game.js`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { diff = null; }
  if (diff == null) { console.log(`NOT RUN  ui2 scope: changed lines vs the base revision ${BASE_REV.slice(0, 7)} (git does not have it here)`); return out; }
  const src = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8'), lines = src.split('\n');
  const owner = (n) => { for (let i = Math.min(n, lines.length) - 1; i >= 0; i--) { const m = /^  (?:async |get |static )?([A-Za-z_]\w*)\([^)]*\) \{$/.exec(lines[i]); if (m) return m[1]; if (/^(const|let|function|class) /.test(lines[i])) return '<top> ' + lines[i].split(/[ =(]/).slice(0, 2).join(' '); } return '<top>'; };
  const owners = new Set(), outside = [];
  for (const m of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = +m[1], len = m[2] == null ? 1 : +m[2];
    let o = owner(start + Math.max(len, 1) - 1);
    let k = start - 1; while (k < lines.length && /^\s*(\/\*\*|\/\*|\*|\/\/)/.test(lines[k])) k++;
    if (len && /^  (?:async |get |static )?[A-Za-z_]\w*\([^)]*\) \{$/.test(lines[k] || '')) o = owner(k + 1);
    if (len && /^(const|let|function|class) /.test(lines[k] || '')) o = '<top> ' + lines[k].split(/[ =(]/).slice(0, 2).join(' ');
    owners.add(o);
    if (!OK.test(o)) outside.push(`${o} @${start}`);
  }
  const added = diff.split('\n').filter(l => /^\+[^+]/.test(l)).join('\n');
  const exportsOf = (t) => { const m = /\nexport \{([\s\S]*?)\};/.exec(t); return m ? m[1].replace(/\s+/g, ' ').trim() : null; };
  let baseSrc = null; try { baseSrc = execSync(`git show ${BASE_REV}:game.js`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { /* reported above */ }
  out.push(expectAll(`ui2 scope: every line of game.js changed since ${BASE_REV.slice(0, 7)} is inside a menu-screen display function (Miasto rail and vortex, the district map, mission cards, the Warsztat grid and status plate, the crane's tag, I18N_EN); no random draw, no save write, no new export; SAVE_SCHEMA_VERSION stays 13`, {
    outside: holds(outside.length === 0, outside.join(' ; ')), functions: holds(owners.size >= 8, owners.size, '>= 8 display functions touched'),
    newRandomDraws: holds(!/Math\.random|\brand(Int)?\(|SeededRNG/.test(added), 'none'), saveWrites: holds(!/saveGame\(|localStorage|SAVE_SLOT|this\.save[\w.]*\.push\(|this\.save\.[\w.]+\s*(\+=|-=|\+\+|--|=[^=])/.test(added), 'none'),
    exportsUnchanged: holds(baseSrc != null && exportsOf(baseSrc) === exportsOf(src), 'the module export list is the base revision\'s'),
    schema: holds(/SAVE_SCHEMA_VERSION = 13\b/.test(src) && /'vectorHoleSave_v1'/.test(src), 'v13, vectorHoleSave_v1')
  }, [...owners].join(', ')));
  return out;
}

export async function runUi2Checks(url, only = null) {
  const parts = { scope: async () => scopeChecks(), miasto: miastoChecks, dzielnice: dzielniceChecks, warsztat: warsztatChecks, wyniki: wynikiChecks, nav: navChecks };
  const out = [];
  for (const [name, fn] of Object.entries(parts)) {
    if (only && !only.includes(name)) continue;
    try { out.push(...await fn(url)); } catch (e) { out.push(report(`ui2 ${name}: step crashed`, false, String(e && e.stack || e).slice(0, 600))); }
  }
  return out;
}

if (isMain(import.meta.url)) {
  const o = process.argv.find(x => x.startsWith('--only='));
  const { server, url } = await serve();
  const res = await runUi2Checks(url, o ? o.slice(7).split(',') : null);
  server.close();
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} GG-UI-02 checks passed`);
  process.exit(failed.length ? 1 : 0);
}

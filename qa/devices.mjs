// FTUE-2 FIX: what the owner saw on real devices (2026-10-25: iPhone 13 in
// Chrome, iPhone 16 Pro as a home-screen app, a Windows laptop in Chrome),
// replayed in Chromium with each device's frame, safe areas and bars:
//  - an iPhone turned while its resize event comes too early (the app box
//    settles later): layout, canvas and the vortex follow the real frame;
//  - the vortex is fully on screen, clear of notches, at every size T1-T6,
//    also at the city's edges and corners; a HUD panel it is under fades;
//  - edge arrows to off-screen goals sit on the visible field, not under HUD;
//  - big in-round messages (tiers, Złoty Rdzeń, Szał, the countdown) fit;
//  - tab switches after a round never show the round's frame (frames caught
//    mid-transition);
//  - Core City: the skyline and "NOWY BUDYNEK" stay clear of the headline,
//    also while a desktop window is resized;
//  - Profil: POWRÓT never lies over a setting; modals don't scroll for
//    nothing (the daily reward's burst made a scrollbar);
//  - results: "Wróć do Miasta" in view and tappable, ZAGRAJ JESZCZE RAZ in
//    at most two lines;
//  - the owner's TEST panel stays out of a player's reach.
// Screenshots -> qa/out/devices/. Usage: node qa/devices.mjs [--only=turn,vortex,bleed,screens]
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, veteranSave, report, isMain, OUT } from './lib.mjs';
import { safeArea } from './responsive.mjs';

const SHOTS = path.join(OUT, 'devices');
// [w, h, label, safe-area insets, desktop?]
export const DEVICES = {
  i13p: [390, 664, 'iPhone 13 Chrome pionowo', null],
  i13l: [775, 328, 'iPhone 13 Chrome poziomo', { left: 47, bottom: 21 }],
  i16p: [402, 812, 'iPhone 16 Pro z ikonki pionowo', { bottom: 34 }],
  i16l: [874, 402, 'iPhone 16 Pro z ikonki poziomo', { left: 62, right: 62, bottom: 21 }],
  poki: [640, 360, 'Poki (mała ramka)', null, true],
  lap: [1536, 730, 'laptop Dell / Chrome', null, true],
};
const READY = () => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state;
// Lets a test swallow the window's resize events (registered before the
// game's own listener): an iOS home-screen app fired its resize while the
// app box still had the old size and never again once it settled.
const RESIZE_GATE = `window.__blockResize = false; window.addEventListener('resize', (e) => { if (window.__blockResize) e.stopImmediatePropagation(); }, true);`;

async function open(url, key, { gate = false } = {}) {
  const [w, h, , insets, desk] = DEVICES[key];
  const g = await openGame(url, { viewport: { width: w, height: h }, mobile: !desk, deviceScaleFactor: desk ? 1 : 3, initScript: gate ? RESIZE_GATE : null });
  if (insets) await safeArea(g.page, insets);
  return g;
}
async function veteran(page, o = {}) {
  const s = await veteranSave(page, { missions: 30, coins: 900, runsPlayed: 6, ...o });
  if (o.loginDue) s.login.lastClaimDate = '2000-01-01';
  await page.evaluate((x) => { localStorage.setItem('vectorHoleSave_v1', JSON.stringify(x)); sessionStorage.setItem('__qaSeeded', '1'); }, s);
  await page.reload();
  await page.waitForFunction(READY);
  await page.waitForTimeout(300);
}
const shot = (page, name) => { fs.mkdirSync(SHOTS, { recursive: true }); return page.screenshot({ path: path.join(SHOTS, name + '.png') }).catch(() => {}); };

/* In the page: the player's vortex on screen vs the visible viewport. */
const VORTEX = () => {
  const gm = window.game, W = innerWidth, H = innerHeight;
  const cr = gm.canvas.getBoundingClientRect();
  const c = { x: cr.left + (gm.player.x - gm.camera.x) * gm.zoom + gm.width / 2, y: cr.top + (gm.player.y - gm.camera.y) * gm.zoom + gm.height / 2, r: gm.player.radius * gm.zoom };
  const sf = gm.safe || { t: 0, r: 0, b: 0, l: 0 };
  const inside = c.x - c.r >= sf.l - 1 && c.x + c.r <= W - sf.r + 1 && c.y - c.r >= sf.t - 1 && c.y + c.r <= H - sf.b + 1;
  const canvasFits = Math.abs(cr.width - W) <= 1 && Math.abs(cr.height - H) <= 1 && Math.abs(cr.left) <= 1 && Math.abs(cr.top) <= 1;
  return { c: { x: Math.round(c.x), y: Math.round(c.y), r: Math.round(c.r) }, inside, canvasFits, W, H, layout: gm.layout, gw: gm.width, gh: gm.height };
};

/* ---------- 1. a phone turned, its resize event too early ---------- */
async function turnChecks(url) {
  const out = [];
  for (const [key, toKey] of [['i16p', 'i16l'], ['i16l', 'i16p'], ['i13p', 'i13l']]) {
    const g = await open(url, key, { gate: true });
    await veteran(g.page);
    const [w2, h2, , ins2] = DEVICES[toKey];
    // a round, then the turn with the resize event swallowed
    await g.page.evaluate(() => { const gm = window.game; gm.startArenaRound(); });
    await g.page.waitForTimeout(400);
    await g.page.evaluate(() => { window.__blockResize = true; });
    if (ins2) { const cdp = await g.context.newCDPSession(g.page); await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, right: 0, bottom: 0, left: 0, ...ins2 } }); }
    await g.page.setViewportSize({ width: w2, height: h2 });
    await g.page.waitForTimeout(700);
    const round = await g.page.evaluate(VORTEX);
    await shot(g.page, `turn-${key}-to-${toKey}-round`);
    // and Miasto turned back and forth the same way
    await g.page.evaluate(() => { const gm = window.game; gm.leaveRun ? gm.leaveRun() : gm.stopRun(); gm.showScreen('mainMenu'); });
    await g.page.setViewportSize({ width: DEVICES[key][0], height: DEVICES[key][1] });
    await g.page.waitForTimeout(500);
    await g.page.setViewportSize({ width: w2, height: h2 });
    await g.page.waitForTimeout(600);
    const hub = await g.page.evaluate(() => ({ layout: window.game.layout, w: window.game.width, h: window.game.height, W: innerWidth, H: innerHeight, wide: document.body.classList.contains('wide') }));
    await shot(g.page, `turn-${key}-to-${toKey}-hub`);
    const want = h2 > w2 ? 'phone' : 'compact';
    out.push(report(`${DEVICES[key][2]} → ${DEVICES[toKey][2]} (resize event too early, as on an iPhone home-screen app): the layout, the canvas and the vortex follow the real frame, mid-round and on Miasto`,
      round.canvasFits && round.inside && round.layout === want && round.gw === w2 && round.gh === h2 && hub.layout === want && hub.w === w2 && hub.h === h2,
      JSON.stringify({ round, hub })));
    out.push(report(`${DEVICES[key][2]} turned: no runtime errors`, g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }
  return out;
}

/* ---------- 2. the vortex at T1-T6, everywhere in the city ---------- */
const HOLD_AT = ([x, y, r]) => {
  const gm = window.game;
  gm.bots = [];
  gm.running = true;
  gm.timeRemaining = 100;
  const W = 3000, H = 3000; // WORLD_W/H
  const px = x === 'min' ? r : x === 'max' ? W - r : x, py = y === 'min' ? r : y === 'max' ? H - r : y;
  for (let i = 0; i < 90; i++) {
    gm.player.radius = r; gm.player.x = px; gm.player.y = py;
    gm.pointerScreen = null; gm.keyDir = { x: 0, y: 0 };
    gm.update(1 / 30);
  }
  gm.player.radius = r; gm.player.x = px; gm.player.y = py;
  gm.render(performance.now() / 1000);
  gm.running = false;
  return true;
};
// (HUD fades ease over ~0.2 s of real time: a few more frames after a pause)
const SETTLE = async () => { const gm = window.game; for (let i = 0; i < 4; i++) { await new Promise(r => setTimeout(r, 90)); gm.render(performance.now() / 1000); } return true; };
const UNDER_HUD = () => {
  const gm = window.game;
  const c = gm.playerScreenCircle();
  const bad = [];
  for (const id of ['hud-topright', 'hud-goal', 'hud-tier-strip']) {
    const el = document.getElementById(id);
    if (!el || el.classList.contains('hidden') || getComputedStyle(el).display === 'none') continue;
    const r = el.getBoundingClientRect();
    const hit = c.x + c.r > r.left && c.x - c.r < r.right && c.y + c.r > r.top && c.y - c.r < r.bottom;
    if (hit && !el.classList.contains('under-hole')) bad.push(id);
  }
  if (gm.showMinimap) {
    const m = gm.minimapRect();
    const hit = c.x + c.r > m.l && c.x - c.r < m.r && c.y + c.r > m.t && c.y - c.r < m.b;
    if (hit && !(gm.hudFades && gm.hudFades.minimap && gm.hudFades.minimap.a < 0.6)) bad.push('minimap');
  }
  return bad;
};
async function vortexChecks(url) {
  const out = [];
  for (const key of Object.keys(DEVICES)) {
    const g = await open(url, key);
    await veteran(g.page);
    await g.page.evaluate(() => { const gm = window.game; gm.checkEvolutionTriggers = () => {}; gm.startRound({ seed: 777 }); cancelAnimationFrame(gm.rafId); gm.running = false; });
    const radii = await g.page.evaluate(() => [...CONFIG.sizeTiers.map(t => Math.max(18, t.minRadius + 4)), 300, CONFIG.hole.maxRadius]);
    const spots = [['min', 'min'], ['max', 'min'], ['min', 'max'], ['max', 'max'], [1500, 'max'], ['max', 1500], [1500, 1500]];
    const bad = [], hud = [];
    for (const r of radii) for (const [x, y] of spots) {
      await g.page.evaluate(HOLD_AT, [x, y, r]);
      await g.page.evaluate(SETTLE);
      const v = await g.page.evaluate(VORTEX);
      if (!v.inside || !v.canvasFits) bad.push({ r, at: `${x},${y}`, ...v.c, inside: v.inside, canvasFits: v.canvasFits });
      const u = await g.page.evaluate(UNDER_HUD);
      if (u.length) hud.push({ r, at: `${x},${y}`, under: u });
      if (r === radii[5] && x === 'max' && y === 'max') await shot(g.page, `vortex-T6-corner-${key}`);
    }
    out.push(report(`${DEVICES[key][2]}: the vortex is fully on screen inside the safe area at T1-T6 (up to the largest radius) in the middle, at every edge and corner of the city`, bad.length === 0, bad.length ? JSON.stringify(bad.slice(0, 4)) : `${radii.length * spots.length} positions`));
    out.push(report(`${DEVICES[key][2]}: a HUD panel / the minimap the vortex is under fades (never an opaque panel over it)`, hud.length === 0, hud.length ? JSON.stringify(hud.slice(0, 4)) : 'ok'));
    // edge arrows: on the visible field, clear of the HUD / minimap
    const arrows = await g.page.evaluate(() => {
      const gm = window.game; const sf = gm.safe; const bad = [];
      gm.fadeHudUnderHole(); gm.hudBoxes = null; gm.hudFadeTick = 19; gm.fadeHudUnderHole();
      const boxes = (gm.hudBoxes || []).map(b => ({ id: b.el.id, l: b.l, t: b.t, r: b.r, b: b.b })).concat(gm.showMinimap ? [{ id: 'minimap', ...gm.minimapRect() }] : []);
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 24) {
        const p = gm.edgeMarkerPos(a, 30);
        const inField = p.x >= sf.l + 10 && p.x <= gm.width - sf.r - 10 && p.y >= sf.t + 10 && p.y <= gm.height - sf.b - 10;
        const under = boxes.filter(b => p.x > b.l - 4 && p.x < b.r + 4 && p.y > b.t - 4 && p.y < b.b + 4).map(b => b.id);
        if (!inField || under.length) bad.push({ a: +a.toFixed(2), x: Math.round(p.x), y: Math.round(p.y), under });
      }
      return bad;
    });
    out.push(report(`${DEVICES[key][2]}: edge arrows to off-screen goals sit on the visible field, never under the HUD strip, the standings or the minimap`, arrows.length === 0, JSON.stringify(arrows.slice(0, 4))));
    // big messages fit
    const banners = await g.page.evaluate(() => {
      const gm = window.game; const sf = gm.safe; const bad = [];
      const list = [...CONFIG.sizeTiers.map(t => [`${t.label}!`, 'NOWE OBIEKTY DO POCHŁONIĘCIA', 2]), ['ZŁOTY RDZEŃ!', 'Złap go przed rywalami — złota strzałka wskazuje drogę', 2],
        ['SZAŁ!', 'Punkty ×2 · jesz o rozmiar większe obiekty', 4], ['WIELKI FINISZ!', 'Wir finałowy', 3], ['LEGENDARNE!', 'COMBO ×22', 1], ['3', null, 5], ['1', 'OSTATNIA SEKUNDA!', 5], ['WYZWANIE WYGRANE!', 'Cel 12 345 pkt (Ania) przebity!', 4]];
      for (const [t, s, p] of list) {
        gm.banner = null; gm.bannerQueue = []; gm.showBanner(t, s, '#EFCB63', 1.3, p);
        gm.render(performance.now() / 1000);
        const b = gm.lastBannerBox;
        const l = Math.min(b.l, b.subL == null ? b.l : b.subL), r = Math.max(b.r, b.subR == null ? b.r : b.subR);
        const hud = ['hud-tier-strip', 'hud-topright', 'btnPause'].filter(id => { const el = document.getElementById(id); if (!el || el.classList.contains('hidden')) return false; const q = el.getBoundingClientRect(); return q.width > 1 && l < q.right && r > q.left && b.t < q.bottom && b.b > q.top; });
        if (l < sf.l - 1 || r > gm.width - sf.r + 1 || b.t < sf.t - 1 || b.b > gm.height - sf.b || hud.length) bad.push({ t, l: Math.round(l), r: Math.round(r), top: Math.round(b.t), bottom: Math.round(b.b), W: gm.width, hud });
      }
      gm.banner = null;
      return bad;
    });
    out.push(report(`${DEVICES[key][2]}: big in-round messages (T1-T6, ZŁOTY RDZEŃ, SZAŁ, WIELKI FINISZ, combo, the countdown) fit between the safe edges at their pop's peak and never cover the clock strip, the standings or pause`, banners.length === 0, JSON.stringify(banners.slice(0, 3))));
    out.push(report(`${DEVICES[key][2]} vortex/HUD: no runtime errors`, g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }
  return out;
}

/* ---------- 3. tab switches after a round: no frame of the round ---------- */
async function vividShare(page) {
  // share of vivid (saturated, bright) pixels in a screenshot -- the round's
  // rainbow vortex; the menus fading in are dark at that moment
  const png = await page.screenshot({ type: 'png' });
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let n = 0, v = 0;
    for (let i = 0; i < d.length; i += 16) { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); n++; if (mx > 140 && mx - mn > 110) v++; }
    return v / n;
  }, png.toString('base64'));
}
async function bleedChecks(url) {
  const out = [];
  for (const key of ['lap', 'i16l', 'i13p']) {
    const g = await open(url, key);
    await veteran(g.page);
    // a round with a huge rainbow vortex, then its results, then Miasto
    await g.page.evaluate(() => { const gm = window.game; gm.checkEvolutionTriggers = () => {}; gm.startRound({ seed: 777 }); cancelAnimationFrame(gm.rafId); gm.player.radius = 260; gm.zoom = 0.6; gm.render(performance.now() / 1000); gm.player.score = 4200; gm.endRound(); });
    await g.page.waitForTimeout(2500);
    await g.page.evaluate(() => { const gm = window.game; gm.unlockQueue = []; document.getElementById('unlockOverlay').classList.add('hidden'); gm.showScreen('mainMenu'); clearTimeout(gm.loginPopupTimer); });
    await g.page.waitForTimeout(600);
    const frames = [];
    for (const [tab, at] of [['btnNavDzielnice', 30], ['btnNavWarsztat', 15], ['btnNavWyzwania', 60], ['btnNavMiasto', 30], ['btnNavWarsztat', 120], ['btnNavDzielnice', 5]]) {
      await g.page.evaluate(([id, t]) => { document.getElementById(id).click(); document.getAnimations().forEach(a => { try { a.pause(); a.currentTime = t; } catch (e) { /* finished */ } }); }, [tab, at]);
      const share = await vividShare(g.page);
      const canvasShown = await g.page.evaluate(() => getComputedStyle(window.game.canvas).visibility !== 'hidden' && !document.body.classList.contains('board-idle'));
      frames.push({ tab, at, vivid: +(share * 100).toFixed(2), canvasShown });
      if (frames.length === 1) await shot(g.page, `bleed-${key}-mid-transition`);
      await g.page.evaluate(() => document.getAnimations().forEach(a => { try { a.finish(); } catch (e) { /* infinite */ } }));
      await g.page.waitForTimeout(80);
    }
    // the same, fast: six switches inside a second, a frame caught after each
    const fast = [];
    for (const tab of ['btnNavMiasto', 'btnNavDzielnice', 'btnNavWyzwania', 'btnNavWarsztat', 'btnNavMiasto', 'btnNavDzielnice']) {
      await g.page.evaluate((id) => document.getElementById(id).click(), tab);
      await g.page.waitForTimeout(40);
      await g.page.evaluate(() => document.getAnimations().forEach(a => { try { a.pause(); if (a.currentTime > 60) a.currentTime = 60; } catch (e) { /* finished */ } }));
      fast.push(+((await vividShare(g.page)) * 100).toFixed(2));
      await g.page.evaluate(() => document.getAnimations().forEach(a => { try { a.play(); } catch (e) { /* ok */ } }));
    }
    const bad = frames.filter(f => f.vivid > 1.5 || f.canvasShown);
    out.push(report(`${DEVICES[key][2]}: switching Miasto ↔ Dzielnice ↔ Warsztat ↔ Wyzwania after a round never shows the round (frames caught mid-transition: no vortex colours, the board hidden)`,
      bad.length === 0 && fast.every(v => v <= 1.5), JSON.stringify({ frames, fast })));
    // and a new round shows the board again
    await g.page.evaluate(() => { const gm = window.game; gm.startArenaRound(); });
    await g.page.waitForTimeout(500);
    const live = await g.page.evaluate(() => ({ shown: getComputedStyle(window.game.canvas).visibility === 'visible', running: window.game.running }));
    await g.page.evaluate(() => { const gm = window.game; gm.stopRun(); gm.showScreen('mainMenu'); });
    out.push(report(`${DEVICES[key][2]}: the next round shows the board again`, live.shown && live.running, JSON.stringify(live)));
    out.push(report(`${DEVICES[key][2]} tab switches: no runtime errors`, g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }
  return out;
}

/* ---------- 4. Core City, modals, Profil, results, TEST ---------- */
const CITY = () => {
  const cv = document.getElementById('hubCityCanvas');
  const pitch = document.querySelector('#hubHeroStage .hub-city-pitch');
  const badge = document.querySelector('#hubHeroStage .hub-city-badge');
  const textBottom = pitch.offsetTop + pitch.offsetHeight - cv.offsetTop;
  const lab = cv.__siteLabel, sky = cv.__skyline;
  const labelOk = !lab || lab.y >= textBottom - 1 || lab.x > pitch.offsetLeft + pitch.offsetWidth || lab.x + lab.w < pitch.offsetLeft;
  const skyOk = !sky || sky.top >= textBottom - 2;
  const b = badge.getBoundingClientRect(), p = pitch.getBoundingClientRect();
  const badgeOk = b.bottom <= p.top + 1 || b.top >= p.bottom - 1;
  return { ok: labelOk && skyOk && badgeOk, labelOk, skyOk, badgeOk, textBottom: Math.round(textBottom), label: lab && { y: Math.round(lab.y), above: lab.above }, skyline: sky && Math.round(sky.top), W: innerWidth, H: innerHeight };
};
async function screenChecks(url) {
  const out = [];
  // Core City on every device, and a desktop window resized live
  for (const key of Object.keys(DEVICES)) {
    const g = await open(url, key);
    for (const [label, o] of [['LVL 1', {}], ['LVL 3, mid-build', { core: [3, 60] }]]) {
      await veteran(g.page);
      if (o.core) await g.page.evaluate(([lv, ch]) => { const gm = window.game; gm.save.hub.coreLevel = lv; gm.save.hub.coreCharge = ch; gm.hubCityShown = null; gm.showScreen('mainMenu'); }, o.core);
      await g.page.waitForTimeout(700);
      const c = await g.page.evaluate(CITY);
      out.push(report(`${DEVICES[key][2]} Miasto (${label}): the skyline, the crane and "NOWY BUDYNEK" stay under the headline; the badge never overlaps it`, c.ok, JSON.stringify(c)));
      await shot(g.page, `city-${key}-${o.core ? 'lvl3' : 'lvl1'}`);
    }
    // results: the way back in view and tappable; ZAGRAJ JESZCZE RAZ ≤ 2 lines
    await g.page.evaluate(() => { const gm = window.game; gm.startRound({ seed: 777 }); cancelAnimationFrame(gm.rafId); gm.player.score = 4200; gm.endRound(); });
    await g.page.waitForTimeout(2600);
    await g.page.evaluate(() => { window.game.unlockQueue = []; document.getElementById('unlockOverlay').classList.add('hidden'); });
    const res = await g.page.evaluate(() => {
      const m = document.getElementById('btnMenu').getBoundingClientRect(), a = document.getElementById('btnPlayAgain');
      const hit = document.elementFromPoint(m.left + m.width / 2, m.top + m.height / 2);
      const cs = getComputedStyle(a); const lines = Math.round((a.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / (parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2));
      return { inView: m.top >= 0 && m.bottom <= innerHeight && m.left >= 0 && m.right <= innerWidth, tappable: !!hit && (hit.id === 'btnMenu' || !!hit.closest('#btnMenu')), lines };
    });
    await shot(g.page, `results-${key}`);
    out.push(report(`${DEVICES[key][2]} results: "Wróć do Miasta" in view and tappable without scrolling; ZAGRAJ JESZCZE RAZ in at most two lines`, res.inView && res.tappable && res.lines <= 2, JSON.stringify(res)));
    out.push(report(`${DEVICES[key][2]} screens: no runtime errors`, g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }
  {
    const g = await openGame(url, { viewport: { width: 1536, height: 730 }, mobile: false, deviceScaleFactor: 1 });
    await veteran(g.page);
    const rows = [];
    for (const [w, h] of [[1536, 730], [1200, 640], [900, 560], [760, 420], [640, 360], [1100, 900], [700, 900], [1366, 600], [1536, 730]]) {
      await g.page.setViewportSize({ width: w, height: h });
      await g.page.waitForTimeout(700);
      rows.push({ at: `${w}x${h}`, ...(await g.page.evaluate(CITY)) });
    }
    const bad = rows.filter(r => !r.ok);
    out.push(report('laptop window resized live (1536×730 → … → 640×360 → 700×900 → back): Core City\'s text never collides with the skyline or "NOWY BUDYNEK"', bad.length === 0, bad.length ? JSON.stringify(bad.slice(0, 3)) : `${rows.length} sizes`));
    // Profil: POWRÓT never over a setting, at any scroll; the scrollbar on the screen's edge
    const prof = [];
    for (const [w, h] of [[1536, 730], [900, 560], [640, 360]]) {
      await g.page.setViewportSize({ width: w, height: h });
      await g.page.evaluate(() => window.game.openProfileScreen());
      await g.page.waitForTimeout(400);
      prof.push(await g.page.evaluate(async () => {
        const sc = document.querySelector('#profileScreen > .screen-inner'), back = document.getElementById('btnProfileBack');
        const bad = []; const sr = sc.getBoundingClientRect();
        for (let k = 0; k <= 4; k++) {
          sc.scrollTop = (sc.scrollHeight - sc.clientHeight) * k / 4;
          await new Promise(r => requestAnimationFrame(r));
          for (const el of sc.querySelectorAll('button, input')) {
            const r = el.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            if (cy < sr.top || cy > sr.bottom || r.height < 2) continue;
            const hit = document.elementFromPoint(cx, cy);
            if (hit && (hit === back || back.contains(hit))) bad.push(el.textContent.trim().slice(0, 20));
          }
        }
        const br = back.getBoundingClientRect();
        return { bad, backInView: br.bottom <= innerHeight && br.top >= 0, scrollerEdge: Math.round(innerWidth - sr.right), W: innerWidth };
      }));
    }
    out.push(report('Profil (1536×730, 900×560, 640×360): POWRÓT is a footer -- never over a setting at any scroll position, always in view; the settings scroll at the screen\'s edge', prof.every(p => !p.bad.length && p.backInView && p.scrollerEdge <= 1), JSON.stringify(prof)));
    await g.page.evaluate(() => window.game.showScreen('mainMenu'));
    // modals that fit don't scroll: the daily reward before/after the claim, unlock, info sheet, briefing, pause
    const modal = [];
    for (const [w, h] of [[1536, 730], [1280, 720], [1366, 768], [900, 560]]) {
      await g.page.setViewportSize({ width: w, height: h });
      await veteran(g.page, { loginDue: true });
      await g.page.evaluate(() => { const gm = window.game; gm.bootFirstRun = false; gm.maybeShowLoginReward(); });
      await g.page.waitForTimeout(700);
      const sc = (sel) => g.page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const cs = getComputedStyle(el); return { sel: s, scrolls: /auto|scroll/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1, sh: el.scrollHeight, ch: el.clientHeight }; }, sel);
      const before = await sc('.login-panel');
      await g.page.evaluate(() => document.getElementById('btnLoginClaim').click());
      await g.page.waitForTimeout(250);
      const after = await sc('.login-panel');
      if (w === 900) await shot(g.page, 'login-claimed-900x560');
      await g.page.evaluate(() => { document.getElementById('loginRewardScreen').classList.add('hidden'); const gm = window.game; const f = { id: 'wyzwania', kind: 'feature', color: '#EFCB63', icon: '', eyebrow: 'NOWA ZAKŁADKA', title: 'WYZWANIA', desc: 'Wyzwanie dnia: ta sama mapa dla wszystkich.', cta: 'ZOBACZ' }; gm.unlockQueue = [f]; gm.unlockQueueTotal = 1; gm.showNextUnlock(); });
      await g.page.waitForTimeout(1600);
      const unlock = await sc('.unlock-panel');
      await g.page.evaluate(() => { document.getElementById('unlockOverlay').classList.add('hidden'); window.game.openCampaignScreen(); window.game.openMissionBriefing('M01'); });
      await g.page.waitForTimeout(500);
      const brief = await sc('#briefingCard .mc-scroll');
      modal.push({ at: `${w}x${h}`, rows: [before, after, unlock, brief].filter(Boolean).filter(x => x.scrolls) });
      await g.page.evaluate(() => { window.game.closeMissionBriefing(); window.game.showScreen('mainMenu'); });
    }
    out.push(report('laptop sizes (1536×730, 1280×720, 1366×768, 900×560): the daily reward (also after the claim and its burst), an unlock and a short briefing show no scrollbar when their content fits', modal.every(m => !m.rows.length), JSON.stringify(modal)));
    out.push(report('laptop: no runtime errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }
  // the daily reward on a Windows laptop at 125 % scaling: its claim burst
  // made the panel scroll (reproduced on the base at 1000×610 / 1180×600)
  {
    const g = await openGame(url, { viewport: { width: 1000, height: 610 }, mobile: false, deviceScaleFactor: 1.25 });
    const rows = [];
    for (const [w, h] of [[1000, 610], [1180, 600], [1229, 560], [1300, 545]]) {
      await g.page.setViewportSize({ width: w, height: h });
      await veteran(g.page, { loginDue: true });
      await g.page.evaluate(() => { const gm = window.game; gm.bootFirstRun = false; gm.maybeShowLoginReward(); });
      await g.page.waitForTimeout(700);
      await g.page.evaluate(() => document.getElementById('btnLoginClaim').click());
      let worst = 0;
      for (let i = 0; i < 8; i++) { await g.page.waitForTimeout(120); worst = Math.max(worst, await g.page.evaluate(() => { const el = document.querySelector('.login-panel'); return el.scrollHeight - el.clientHeight; })); }
      rows.push({ at: `${w}x${h}`, overflow: worst });
    }
    out.push(report('daily reward on a 125 % Windows laptop (1000×610, 1180×600, 1229×560, 1300×545): the claim and its burst never make the panel scroll', rows.every(r => r.overflow <= 1), JSON.stringify(rows)));
    await g.browser.close();
  }
  // the owner's TEST panel: nothing a player can reach
  {
    const g = await open(url, 'i16p');
    await veteran(g.page);
    const st = async () => g.page.evaluate(() => ({ fab: !!document.getElementById('devFab'), panel: !!document.getElementById('devPanel'), access: !!DEV.access, sandbox: !!DEV.sandbox, slot: SAVE_SLOT }));
    const plain = await st();
    await g.page.evaluate(() => { localStorage.setItem('vectorHoleDevAccess_v1', 'a'.repeat(64)); localStorage.setItem('vectorHoleDevState_v1', JSON.stringify({ sandbox: true, openMissions: true })); });
    await g.page.reload(); await g.page.waitForFunction(READY); await g.page.waitForTimeout(300);
    const forged = await st();
    out.push(report('TEST panel: a player has no TEST/DEV tab, no access and the real save slot -- also with a forged access token and "test mode" written into localStorage',
      !plain.fab && !plain.access && !forged.fab && !forged.panel && !forged.access && !forged.sandbox && forged.slot === 'vectorHoleSave_v1', JSON.stringify({ plain, forged })));
    await g.browser.close();
  }
  return out;
}

const PARTS = { turn: turnChecks, vortex: vortexChecks, bleed: bleedChecks, screens: screenChecks };
export async function runDeviceChecks(url, only = null) {
  const out = [];
  for (const [k, fn] of Object.entries(PARTS)) if (!only || only.includes(k)) out.push(...await fn(url));
  return out;
}

if (isMain(import.meta.url)) {
  const { server, url } = await serve();
  const o = process.argv.find(x => x.startsWith('--only='));
  const res = await runDeviceChecks(url, o ? o.slice(7).split(',') : null);
  server.close();
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} device checks passed`);
  process.exit(failed.length ? 1 : 0);
}

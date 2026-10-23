// v21 „Komputer”: on a laptop/monitor the game no longer looks like a tiny
// phone in the middle (owner: "cały interface wygląda jak na telefon
// ucięty taki mały").
//  - In a round the world is scaled to the screen (Game.viewScale): a big
//    screen sees about as much city as a phone, with a big vortex -- and
//    no "sees farther" edge. Phones keep their framing (scale 1).
//  - Menus, sheets and the HUD grow with --ui-scale (CSS zoom on every
//    layer but the canvas); the minimap (canvas) grows with them.
//  - The district strip scrolls with a mouse wheel and fades where it's
//    cut off; the picked district is never hidden past its edge.
//  - A wide landscape screen (body.wide) gets the desktop layout: the nav
//    as a rail on the left and two columns on every hub screen (Miasto:
//    Core City | GRAJ + tiles; Dzielnice: all 12 districts | the missions;
//    Warsztat: preview | items; Wyzwania: the map | play + streak;
//    results: what you got | what's next), nothing cut off or scrolling
//    sideways, also in a small 960×540 portal frame.
// Usage: node qa/v21.mjs
import { serve, openGame, veteranSave, report, expectAll, truthy, falsy } from './lib.mjs';

const PHONES = [[375, 667], [402, 874], [430, 932]];
const DESKTOPS = [[1366, 768], [1440, 900], [1920, 1080]];
const PHONE_AREA = 402 * 874;

async function seeded(url, [width, height], desktop) {
  const g = await openGame(url, { viewport: { width, height }, mobile: !desktop, deviceScaleFactor: desktop ? 1 : 2 });
  const save = await veteranSave(g.page, { missions: 30, coins: 500, runsPlayed: 6 });
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
  await g.page.waitForTimeout(500);
  return g;
}

// The world view in a mission and at an Arena round's start.
const VIEW = () => {
  const gm = window.game, out = {};
  gm.startCampaignMission('M05'); gm.beginMissionPlay(); cancelAnimationFrame(gm.rafId); gm.running = false;
  gm.updateCampaign(1 / 30);
  out.mission = { zoom: +gm.zoom.toFixed(2), area: Math.round(gm.viewHalfW * 2 * gm.viewHalfH * 2), holePx: +(gm.player.radius * gm.zoom).toFixed(1) };
  // Steering: a cursor 200 px right of the vortex on screen aims 200/zoom
  // world px right of it.
  const sx = gm.width / 2 + (gm.player.x - gm.camera.x) * gm.zoom + 200, sy = gm.height / 2 + (gm.player.y - gm.camera.y) * gm.zoom;
  gm.pointerScreen = { x: sx, y: sy };
  const x0 = gm.player.x;
  for (let i = 0; i < 6; i++) gm.updateCampaign(1 / 30);
  out.steersRight = gm.player.x > x0 + 5;
  gm.pointerScreen = null;
  gm.leaveRun && gm.leaveRun();
  gm.startRound(); cancelAnimationFrame(gm.rafId); gm.running = false;
  out.arena = { zoom: +gm.zoom.toFixed(2), area: Math.round(gm.viewHalfW * 2 * gm.viewHalfH * 2), holePx: +(gm.player.radius * gm.zoom).toFixed(1) };
  out.viewScale = +gm.viewScale.toFixed(2); out.uiScale = +gm.uiScale.toFixed(2);
  gm.leaveRun && gm.leaveRun();
  return out;
};

export async function runV21Checks(url) {
  const results = [];

  // --- Phones: nothing changes -------------------------------------------
  for (const vp of PHONES) {
    const g = await seeded(url, vp, false);
    const r = await g.page.evaluate(VIEW);
    results.push(report(`phone ${vp.join('×')}: framing unchanged (view scale 1, UI scale 1, mission zoom 1, Arena start zoom 1.08)`,
      r.viewScale === 1 && r.uiScale === 1 && r.mission.zoom === 1 && r.arena.zoom === 1.08, JSON.stringify(r)));
    await g.browser.close();
  }

  // --- Desktops: a phone's worth of city, a big vortex, big UI -------------
  let phoneHole = null;
  {
    const g = await seeded(url, [402, 874], false);
    phoneHole = (await g.page.evaluate(VIEW)).mission.holePx;
    await g.browser.close();
  }
  for (const vp of DESKTOPS) {
    const g = await seeded(url, vp, true);
    const r = await g.page.evaluate(VIEW);
    const ratio = r.mission.area / PHONE_AREA;
    results.push(report(`desktop ${vp.join('×')}: a mission shows about a phone's worth of city (0.75–2.2× its area), not the whole box`, ratio > 0.75 && ratio < 2.2, `${ratio.toFixed(2)}× · ${JSON.stringify(r.mission)}`));
    results.push(report(`desktop ${vp.join('×')}: the vortex is drawn ≥ 1.4× as big as on a phone`, r.mission.holePx >= phoneHole * 1.4, `${r.mission.holePx} px vs phone ${phoneHole} px`));
    results.push(report(`desktop ${vp.join('×')}: the cursor still steers the vortex where it points (zoomed projection)`, r.steersRight, JSON.stringify(r)));
    // In-round HUD: the pause button is hit where it is drawn; minimap on screen and scaled.
    const hud = await g.page.evaluate(() => {
      const gm = window.game;
      gm.startRound(); cancelAnimationFrame(gm.rafId); gm.running = false; gm.render(performance.now() / 1000);
      const b = document.getElementById('btnPause').getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      const m = gm.minimapSize(), mg = gm.minimapMargin();
      const out = { pauseHit: !!hit && (hit.id === 'btnPause' || !!hit.closest('#btnPause')), pauseW: Math.round(b.width), mini: Math.round(m), miniFits: gm.width - m - mg >= 0 && gm.height - m - mg >= 0 };
      gm.leaveRun && gm.leaveRun();
      return out;
    });
    results.push(report(`desktop ${vp.join('×')}: HUD scales with the UI (pause hit-tests where drawn, minimap grows and stays on screen)`,
      hud.pauseHit && hud.miniFits && hud.mini >= 130 * (vp[1] >= 900 ? 1.2 : 1) - 0.5, JSON.stringify(hud)));
    results.push(report(`desktop ${vp.join('×')}: no runtime errors`, g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // --- Desktop layout (body.wide): rail + two columns on every hub screen --
  for (const vp of [...DESKTOPS, [960, 540], [1180, 820]]) {
    const g = await seeded(url, vp, true);
    const tag = `wide ${vp.join('×')}`;
    const measure = () => {
      const R = el => { const b = (typeof el === 'string' ? document.querySelector(el) : el).getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
      const scr = [...document.querySelectorAll('.screen:not(.hidden)')].pop();
      const inner = scr.querySelector('.screen-inner');
      const sideways = inner.scrollWidth > inner.clientWidth + 2 || document.documentElement.scrollWidth > innerWidth + 1;
      return { R, scr, sideways };
    };
    const hub = await g.page.evaluate((m) => {
      const { R, sideways } = eval(`(${m})`)();
      const nav = R('#bottomNav'), city = R('#hubHeroStage'), play = R('#btnStart'), chest = R('#hubFreeChest');
      const mm = document.getElementById('mainMenu'); mm.scrollTop = 9999; const scrolls = mm.scrollTop > 0; mm.scrollTop = 0;
      return { wide: document.body.classList.contains('wide'), rail: nav.w < 150 && nav.h > innerHeight * 0.9 && nav.l === 0, cityLeftOfPlay: city.r <= play.l, cityLeftOfRail: city.l >= nav.r, playInView: play.b <= innerHeight && play.t >= 0, chestInView: chest.b <= innerHeight, scrolls, sideways };
    }, measure.toString());
    results.push(report(`${tag}: desktop layout on (nav as a left rail)`, hub.wide && hub.rail, JSON.stringify(hub)));
    // E1 pilot: expectAll() names each failed field per viewport (same terms as the old && chain).
    results.push(expectAll(`${tag}: Miasto — Core City on the left, GRAJ + tiles + chest on the right, all in view, no scrolling`, {
      cityLeftOfPlay: truthy(hub.cityLeftOfPlay), cityLeftOfRail: truthy(hub.cityLeftOfRail), playInView: truthy(hub.playInView), chestInView: truthy(hub.chestInView), scrolls: falsy(hub.scrolls), sideways: falsy(hub.sideways)
    }, JSON.stringify(hub)));
    await g.page.click('#btnNavDzielnice'); await g.page.waitForTimeout(500);
    const dz = await g.page.evaluate((m) => {
      const { R, sideways } = eval(`(${m})`)();
      const map = document.getElementById('districtMap');
      const tiles = [...map.querySelectorAll('.district-tile')].map(t => t.getBoundingClientRect());
      const allIn = tiles.length === 12 && tiles.every(b => b.top >= 0 && b.bottom <= innerHeight && b.right <= map.getBoundingClientRect().right + 1 && b.left >= map.getBoundingClientRect().left - 1);
      const next = R('#missionNextCard'), list = R('#missionList');
      const play = document.querySelector('#missionNextCard [data-mc-play], #missionNextCard button'); // GRAJ, or „DO DZIELNICY…” when it's done
      return { allIn, stripScroll: map.scrollWidth > map.clientWidth + 2, mapLeftOfMissions: R('#districtMap').r <= next.l, listRight: list.l >= R('#districtMap').r, nextPlayInView: !!play && play.getBoundingClientRect().bottom <= innerHeight, sideways };
    }, measure.toString());
    results.push(expectAll(`${tag}: Dzielnice — all 12 districts in view (no strip to scroll), the next mission and the list on the right`, {
      allIn: truthy(dz.allIn), stripScroll: falsy(dz.stripScroll), mapLeftOfMissions: truthy(dz.mapLeftOfMissions), listRight: truthy(dz.listRight), nextPlayInView: truthy(dz.nextPlayInView), sideways: falsy(dz.sideways)
    }, JSON.stringify(dz)));
    await g.page.click('#btnNavWarsztat'); await g.page.waitForTimeout(500);
    const ws = await g.page.evaluate((m) => {
      const { R, sideways } = eval(`(${m})`)();
      const pv = R('.warsztat-preview'), grid = R('#skinGrid');
      const cols = new Set([...document.querySelectorAll('#skinGrid > *')].map(n => Math.round(n.getBoundingClientRect().left))).size;
      return { previewLeft: pv.r <= grid.l, cols, previewInView: pv.b <= innerHeight, sideways };
    }, measure.toString());
    results.push(report(`${tag}: Warsztat — the live preview on the left, the items in 2 columns on the right`, ws.previewLeft && ws.cols === 2 && ws.previewInView && !ws.sideways, JSON.stringify(ws)));
    await g.page.click('#btnNavWyzwania'); await g.page.waitForTimeout(500);
    const wy = await g.page.evaluate((m) => {
      const { R, sideways } = eval(`(${m})`)();
      const hero = R('.daily-hero-card'), play = R('#btnPlayDaily');
      return { heroLeft: hero.r <= play.l, playInView: play.b <= innerHeight && play.t >= 0, sideways };
    }, measure.toString());
    results.push(report(`${tag}: Wyzwania — today's map on the left, ZAGRAJ on the right in view`, wy.heroLeft && wy.playInView && !wy.sideways, JSON.stringify(wy)));
    await g.page.evaluate(() => { game.startRound(); game.endRound(); });
    await g.page.waitForTimeout(3000);
    const res = await g.page.evaluate((m) => {
      const { R, sideways } = eval(`(${m})`)();
      const score = R('#finalScore'), lb = R('#finalLeaderboard'), again = R('#btnPlayAgain'), menu = R('#btnMenu');
      return { lbRight: lb.l >= score.r, againInView: again.b <= innerHeight && again.t >= 0, menuUnderActions: menu.t >= again.b, sideways };
    }, measure.toString());
    results.push(report(`${tag}: round results — score + rewards on the left, ranking + ZAGRAJ JESZCZE RAZ on the right, in view`, res.lbRight && res.againInView && res.menuUnderActions && !res.sideways, JSON.stringify(res)));
    results.push(report(`${tag}: no runtime errors`, g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // --- Phones / tablets in portrait never get the desktop layout ----------
  for (const vp of [[402, 874], [820, 1180], [844, 390]]) {
    const g = await seeded(url, vp, false);
    const r = await g.page.evaluate(() => ({ wide: document.body.classList.contains('wide'), navBottom: Math.round(document.getElementById('bottomNav').getBoundingClientRect().bottom), H: innerHeight }));
    results.push(report(`${vp.join('×')}: phone layout kept (no rail, the nav at the bottom)`, !r.wide && Math.abs(r.navBottom - r.H) <= 1, JSON.stringify(r)));
    await g.browser.close();
  }

  // --- District strip (narrow windows): wheel, edge fades, picked district in view
  {
    const g = await seeded(url, [1000, 1300], true);
    const r = await g.page.evaluate(async () => {
      const gm = window.game;
      gm.openCampaignScreen();
      await new Promise(res => setTimeout(res, 400));
      const strip = document.getElementById('districtMap');
      const start = { left: strip.classList.contains('more-left'), right: strip.classList.contains('more-right'), x: strip.scrollLeft };
      const b = strip.getBoundingClientRect();
      return { start, box: [b.left + b.width / 2, b.top + b.height / 2] };
    });
    await g.page.mouse.move(r.box[0], r.box[1]);
    await g.page.mouse.wheel(0, 400);
    await g.page.waitForTimeout(300);
    const after = await g.page.evaluate(async () => {
      const strip = document.getElementById('districtMap');
      const out = { x: strip.scrollLeft, left: strip.classList.contains('more-left') };
      // Pick the last unlocked district: its tile must be fully in view.
      const gm = window.game;
      const ids = gm.save.campaign.unlockedDistricts;
      strip.scrollLeft = 0;
      gm.selectCampaignDistrict(ids[ids.length - 1]);
      await new Promise(res => setTimeout(res, 100));
      const act = strip.querySelector('.district-node.active');
      if (act) { const a = act.getBoundingClientRect(), s = strip.getBoundingClientRect(); out.activeInView = a.left >= s.left - 1 && a.right <= s.right + 1; }
      return out;
    });
    results.push(report('district strip: cut off on the right → it fades there (more districts that way)', r.start.right && !r.start.left, JSON.stringify(r.start)));
    results.push(report('district strip: a mouse wheel scrolls it sideways (no swipe on a desktop)', after.x > r.start.x + 100 && after.left, JSON.stringify(after)));
    results.push(report('district strip: the picked district is scrolled into view', after.activeInView === true, JSON.stringify(after)));
    results.push(report('district strip: no runtime errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // --- Thumb pad on a big touch screen: it sits under the finger ------------
  // (it lives in the HUD, which --ui-scale zooms; screen px must go in
  // divided by the scale)
  {
    const g = await openGame(url, { viewport: { width: 1180, height: 820 }, mobile: true, deviceScaleFactor: 1 });
    const save = await veteranSave(g.page, { missions: 30, runsPlayed: 6 });
    save.settings.inputMode = 'thumbpad';
    await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
    await g.page.reload();
    await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
    const r = await g.page.evaluate(async () => {
      game.startRound();
      await new Promise(res => setTimeout(res, 300));
      const c = document.getElementById('gameCanvas'), x = 300, y = 720;
      const t = (type, px, py) => c.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true,
        touches: [new Touch({ identifier: 1, target: c, clientX: px, clientY: py })], changedTouches: [new Touch({ identifier: 1, target: c, clientX: px, clientY: py })] }));
      t('touchstart', x, y);
      const b = document.getElementById('thumbpadBase').getBoundingClientRect();
      return { ui: +game.uiScale.toFixed(2), off: Math.round(Math.hypot(b.left + b.width / 2 - x, b.top + b.height / 2 - y)) };
    });
    results.push(report('thumb pad (iPad landscape, UI scaled): the pad appears under the finger', r.ui > 1 && r.off <= 3, JSON.stringify(r)));
    results.push(report('thumb pad: no runtime errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { server, url } = await serve();
  const res = await runV21Checks(url);
  server.close();
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} v21 checks passed`);
  process.exit(failed.length ? 1 : 0);
}

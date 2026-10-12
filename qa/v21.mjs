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
// Usage: node qa/v21.mjs
import { serve, openGame, veteranSave, report } from './lib.mjs';

const PHONES = [[375, 667], [402, 874], [430, 932]];
const DESKTOPS = [[1366, 768], [1440, 900], [1920, 1080]];
const PHONE_AREA = 402 * 874;

async function seeded(url, [width, height], desktop) {
  const g = await openGame(url, { viewport: { width, height }, mobile: !desktop, deviceScaleFactor: desktop ? 1 : 2 });
  const save = await veteranSave(g.page, { missions: 30, coins: 500, runsPlayed: 6 });
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.game.state);
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
    // Miasto: bigger UI, GRAJ and the nav on screen without scrolling.
    const hub = await g.page.evaluate(() => {
      const play = document.getElementById('btnStart').getBoundingClientRect(), nav = document.getElementById('bottomNav').getBoundingClientRect();
      const chest = document.getElementById('hubFreeChest').getBoundingClientRect();
      return { playW: Math.round(play.width), playBottom: Math.round(play.bottom), chestBottom: Math.round(chest.bottom), navTop: Math.round(nav.top), navBottom: Math.round(nav.bottom), H: innerHeight, scroll: (() => { const m = document.getElementById('mainMenu'); m.scrollTop = 9999; const moved = m.scrollTop > 0; m.scrollTop = 0; return moved; })() };
    });
    const wantPlayW = vp[1] >= 900 ? 500 : 440;
    results.push(report(`desktop ${vp.join('×')}: Miasto grows with the screen (GRAJ ≥ ${wantPlayW} px wide) and still fits without scrolling`,
      hub.playW >= wantPlayW && hub.chestBottom <= hub.navTop + 1 && hub.navBottom <= hub.H + 1 && !hub.scroll, JSON.stringify(hub)));
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

  // --- District strip: wheel, edge fades, picked district in view ----------
  {
    const g = await seeded(url, [1440, 900], true);
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

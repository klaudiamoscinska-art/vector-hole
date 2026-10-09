// Golden Shot v12 "VISUAL" bots: the Neon City floor (Arena + Campaign +
// menu art), the swallow animation, the leader crown, the cached HUD, the
// late-round camera/radius cap, the sticky result actions, the settings
// rows, and a render budget with real rasterization (forced flushes).
// Usage: node qa/visual.mjs
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, veteranSave, report, ARENA_BOT, QA_TICK, OUT } from './lib.mjs';

async function veteranPage(url, saveOpts = {}, opts = {}) {
  const g = await openGame(url, opts);
  const save = await veteranSave(g.page, saveOpts);
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.game.state);
  await g.page.addScriptTag({ content: ARENA_BOT });
  await g.page.addScriptTag({ content: QA_TICK });
  return g;
}

/** Share of canvas pixels (device px, centre 60% of the screen) that are
 *  not near-black -- the old floor was a black void with a 1px grid. */
const LIT_SHARE = `(() => {
  const gm = window.game, c = gm.canvas, ctx = gm.ctx;
  const x0 = Math.round(c.width * 0.2), y0 = Math.round(c.height * 0.2), w = Math.round(c.width * 0.6), h = Math.round(c.height * 0.6);
  const d = ctx.getImageData(x0, y0, w, h).data;
  let lit = 0, n = 0;
  for (let i = 0; i < d.length; i += 4 * 7) { n++; if (d[i] + d[i + 1] + d[i + 2] > 36) lit++; }
  return +(lit / n).toFixed(3);
})()`;

export async function runVisualChecks(url) {
  const results = [];

  // --- Arena: floor, crown, HUD, camera, radius cap -------------------------
  {
    const g = await veteranPage(url, { coins: 500, runsPlayed: 6, missions: 40 });
    const start = await g.page.evaluate((LIT) => {
      const gm = window.game;
      gm.startRound({ seed: 2024 }); cancelAnimationFrame(gm.rafId); gm.running = false;
      window.__qaTick(10);
      return { lit: eval(LIT), chunks: gm.cityFloor.cache.size, renders: gm.cityFloor.renders };
    }, LIT_SHARE);
    results.push(report('floor: Arena is played on a lit Neon City floor (not a black void)', start.lit > 0.35 && start.chunks > 0, JSON.stringify(start)));

    const mid = await g.page.evaluate(() => {
      const gm = window.game;
      const lb = document.getElementById('leaderboardList');
      let mutations = 0;
      const mo = new MutationObserver((l) => { mutations += l.length; });
      window.__qaTick(600);
      const leaders = [gm.player, ...gm.bots].filter(h => h.isLeader);
      const rows = lb.querySelectorAll('li:not(.lb-gap)').length;
      // Freeze the standings: a few HUD updates with nothing changed must
      // not touch the DOM (the old HUD rebuilt the list every frame).
      mo.observe(lb, { childList: true, subtree: true, characterData: true });
      for (let k = 0; k < 20; k++) gm.updateHUD();
      mo.disconnect();
      return {
        leaders: leaders.length, leaderIsTop: leaders[0] === rankHoles([gm.player, ...gm.bots])[0], rows,
        clock: document.getElementById('missionTimerValue').textContent, idleMutations: mutations,
        playerRow: !!lb.querySelector('li.is-player')
      };
    });
    results.push(report('crown: exactly one hole wears the leader crown, and it is the #1 by score', mid.leaders === 1 && mid.leaderIsTop, JSON.stringify(mid)));
    results.push(report('hud: compact standings (podium + you) and an m:ss clock', mid.rows <= 4 && mid.playerRow && /^\d:\d\d$/.test(mid.clock), `${mid.rows} rows · ${mid.clock}`));
    results.push(report('hud: unchanged standings cause zero DOM writes', mid.idleMutations === 0, `${mid.idleMutations} mutations over 20 HUD updates`));

    const late = await g.page.evaluate(() => {
      const gm = window.game, p = gm.player;
      p.growUnits(1e6);
      gm.bots[0].growUnits(1e6);
      window.__qaTick(240, 3);
      const maxR = CONFIG.hole.maxRadius;
      const onScreen = 2 * p.radius * gm.zoom;
      return {
        r: Math.round(p.radius), bot: Math.round(gm.bots[0].radius), maxR, zoom: +gm.zoom.toFixed(3),
        holeShare: +(onScreen / Math.min(gm.width, gm.height)).toFixed(2),
        viewInWorld: gm.viewHalfW * 2 <= WORLD_W + 1 && gm.viewHalfH * 2 <= WORLD_H + 1,
        pixels: gm.cityFloor.pixels, chunks: gm.cityFloor.cache.size, renders: gm.cityFloor.renders
      };
    });
    results.push(report('camera: a capped late-round hole never swallows the screen', late.r <= late.maxR && late.bot <= late.maxR && late.holeShare <= 0.75 && late.viewInWorld, JSON.stringify(late)));
    results.push(report('floor: chunk cache stays within its pixel budget', late.pixels <= 10.5e6 && late.chunks <= 64, `${(late.pixels / 1e6).toFixed(1)} Mpx in ${late.chunks} chunks, ${late.renders} paints`));

    const sw = await g.page.evaluate(() => {
      const gm = window.game;
      let swallowDraws = 0;
      const orig = gm.drawSwallowed;
      gm.drawSwallowed = function (...a) { swallowDraws += a[2].length; return orig.apply(this, a); };
      const r = window.__qaSwallowScene();
      gm.drawSwallowed = orig;
      return { ...r, swallowDraws };
    });
    results.push(report('swallow: eaten objects and a rival are drawn falling into the vortex', sw.eating > 0 && sw.ghosts > 0 && sw.swallowDraws >= sw.eating + sw.ghosts, JSON.stringify(sw)));

    // Results: the next-action bar is on screen without scrolling.
    const res = await g.page.evaluate(() => {
      window.__qaPlayArena({});
      const vis = (id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight + 1; };
      return { state: window.game.state, again: vis('btnPlayAgain'), ad: vis('btnWatchAd'), share: vis('btnShare') };
    });
    await g.page.waitForTimeout(700);
    const res2 = await g.page.evaluate(() => {
      const vis = (id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight + 1; };
      return { again: vis('btnPlayAgain'), ad: vis('btnWatchAd'), share: vis('btnShare'), score: document.getElementById('finalScore').textContent };
    });
    results.push(report('results: play again / x2 coins / challenge visible without scrolling', res2.again && res2.ad && res2.share, JSON.stringify({ ...res, ...res2 })));
    results.push(report('results: score count-up finishes (not stuck at 0)', Number(String(res2.score).replace(/\D/g, '')) > 0, `score shown ${res2.score}`));
    results.push(report('visual: no runtime errors in Arena', g.errors.length === 0, g.errors.slice(0, 3).join(' | ')));
    await g.browser.close();
  }

  // --- Campaign floor per district + mission hero ---------------------------
  {
    const g = await veteranPage(url, { coins: 0, runsPlayed: 2, missions: 61 });
    const out = await g.page.evaluate((LIT) => {
      const gm = window.game, rows = [];
      for (const id of ['M02', 'M05', 'M09', 'M13', 'M17', 'M21']) {
        gm.startCampaignMission(id); if (gm.introPending) gm.dismissTutorialIntro();
        cancelAnimationFrame(gm.rafId); gm.running = false;
        gm.updateCampaign(0.016); gm.renderCampaign(1);
        rows.push({ id, theme: gm.campaignTheme(), lit: eval(LIT) });
      }
      gm.endCampaignMission(true);
      const hero = document.getElementById('missionHero');
      return { rows, hero: !!hero && getComputedStyle(hero).display !== 'none' && !hero.classList.contains('fail') && !!hero.style.getPropertyValue('--mh-color') };
    }, LIT_SHARE);
    const themes = new Set(out.rows.map(r => r.theme));
    results.push(report('floor: every Campaign district has its own lit floor theme', themes.size === 6 && out.rows.every(r => r.lit > 0.3), out.rows.map(r => `${r.id}:${r.theme}:${r.lit}`).join(' ')));
    results.push(report('mission result: hero emblem shown in the district color', out.hero));
    results.push(report('visual: no runtime errors in Campaign', g.errors.length === 0, g.errors.slice(0, 3).join(' | ')));
    await g.browser.close();
  }

  // --- Menus: welcome city, daily map, settings rows -------------------------
  {
    const g = await openGame(url);
    await g.page.waitForTimeout(500);
    const welcome = await g.page.evaluate(() => ({ paints: SCREEN_FLOOR.renders, first: window.game.isFirstRun() }));
    results.push(report('menu: first-run welcome scene shows the Neon City', welcome.first && welcome.paints > 0, JSON.stringify(welcome)));
    await g.browser.close();
  }
  {
    const g = await veteranPage(url, { coins: 100, runsPlayed: 3, missions: 8 });
    const m = await g.page.evaluate(async () => {
      const gm = window.game;
      gm.openProfileScreen();
      const row = document.querySelector('.settings-block .control-row');
      const dir = getComputedStyle(row).flexDirection;
      gm.openChallengesScreen();
      await new Promise(r => setTimeout(r, 300));
      return { dir, minimaps: SCREEN_FLOOR.minimaps.size };
    });
    results.push(report('menu: settings are label/switch rows; daily map draws the city districts', m.dir === 'row' && m.minimaps > 0, JSON.stringify(m)));
    await g.browser.close();
  }

  // --- Chunk cache must be idle when the camera is still (review finding:
  // ring prefetch + eviction used to thrash 2 paints/frame on DPR 2-3) -----
  for (const dpr of [2, 3]) {
    const g = await openGame(url, { viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr });
    await g.page.waitForTimeout(300);
    const welcome = await g.page.evaluate(() => new Promise((res) => {
      // first-run welcome scene: let its RAF loop run, then count paints
      setTimeout(() => { const a = SCREEN_FLOOR.renders; setTimeout(() => res({ paints: SCREEN_FLOOR.renders - a }), 1000); }, 1500);
    }));
    const save = await veteranSave(g.page, { coins: 0, runsPlayed: 6, missions: 40 });
    await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
    await g.page.reload();
    await g.page.waitForFunction(() => window.game && window.game.state);
    const idle = await g.page.evaluate(() => {
      const gm = window.game, out = {};
      gm.applyGfx(2);
      const still = (renderFn) => { for (let k = 0; k < 40; k++) renderFn(k); const a = gm.cityFloor.renders; for (let k = 0; k < 60; k++) renderFn(k); return gm.cityFloor.renders - a; };
      gm.startRound({ seed: 77 }); cancelAnimationFrame(gm.rafId); gm.running = false;
      gm.update(1 / 60);
      for (const z of [1.08, 0.8, 0.58, 0.3]) { gm.zoom = z; out['arena@' + z] = still((k) => gm.render(k / 60)); }
      gm.startCampaignMission('M05'); if (gm.introPending) gm.dismissTutorialIntro(); cancelAnimationFrame(gm.rafId); gm.running = false;
      gm.updateCampaign(1 / 60);
      out.campaign = still((k) => gm.renderCampaign(k / 60));
      return out;
    });
    const total = Object.values(idle).reduce((a, b) => a + b, 0) + welcome.paints;
    results.push(report(`floor: no chunk repaints while the camera is still (gfx 2, DPR ${dpr})`, total === 0, JSON.stringify({ ...idle, welcome: welcome.paints })));
    await g.browser.close();
  }

  // --- Render budget with real rasterization --------------------------------
  {
    const g = await veteranPage(url, { coins: 0, runsPlayed: 6, missions: 40 });
    const perf = await g.page.evaluate(() => {
      const gm = window.game, out = {};
      for (const gfx of [0, 2]) {
        gm.applyGfx(gfx);
        gm.startRound({ seed: 31337 }); cancelAnimationFrame(gm.rafId); gm.running = false;
        const times = [];
        for (let step = 0; step < 12; step++) {
          window.__qaTick(150, 5); // renders like real play, so caches are warm
          gm.ctx.getImageData(0, 0, 1, 1); // flush the tick's queued frames first
          const t0 = performance.now();
          for (let k = 0; k < 3; k++) { gm.render(step + k / 10); gm.ctx.getImageData(0, 0, 1, 1); }
          times.push((performance.now() - t0) / 3);
          if (gm.state !== GameState.PLAYING) break;
        }
        times.sort((a, b) => a - b);
        out['gfx' + gfx] = { median: +times[Math.floor(times.length / 2)].toFixed(2), max: +times[times.length - 1].toFixed(2) };
      }
      gm.applyGfx(2);
      return out;
    });
    results.push(report('perf: low-end level renders a full frame (rasterized) under 12 ms median', perf.gfx0.median < 12, JSON.stringify(perf)));
    await g.browser.close();
  }

  fs.writeFileSync(path.join(OUT, 'visual.json'), JSON.stringify(results, null, 2));
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { server, url } = await serve();
  const res = await runVisualChecks(url);
  server.close();
  process.exit(res.every(r => r.ok) ? 0 : 1);
}

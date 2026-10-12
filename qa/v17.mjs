// v17 „Pierwsze wrażenie”: the first screen is a live mini round (the
// demo eats, grows through the size tiers and eats a rival), Miasto opens
// on a live Arena stage right above GRAJ (a tap plays), GRAJ names the
// record to beat, the next mission's full name fits its tile, and labels
// over animated canvases sit on their own layer (iPhone showed a district
// tile without its name).
// Usage: node qa/v17.mjs
import { serve, openGame, veteranSave, report } from './lib.mjs';

export async function runV17Checks(url) {
  const results = [];

  // --- First screen: the demo plays the whole loop by itself ---------------
  {
    const g = await openGame(url, { viewport: { width: 402, height: 874 } });
    await g.page.waitForTimeout(1200);
    const early = await g.page.evaluate(() => {
      const st = document.getElementById('hubWelcomeScene')._scene;
      return { objs: st ? st.objs.length : 0, first: !document.getElementById('hubWelcome').classList.contains('hidden') };
    });
    // Watch a full loop (~15 s): score, tiers and the rival.
    const seen = await g.page.evaluate(async () => {
      const cv = document.getElementById('hubWelcomeScene');
      let maxTier = 0, maxScore = 0, rival = false, loops = 0, lastT = 0;
      for (let i = 0; i < 90; i++) {
        await new Promise(r => setTimeout(r, 200));
        const st = cv._scene;
        maxTier = Math.max(maxTier, st.tier); maxScore = Math.max(maxScore, st.score);
        rival = rival || st.rivalDone;
        if (st.T < lastT) loops++;
        lastT = st.T;
        if (rival && loops) break;
      }
      return { maxTier, maxScore, rival, loops };
    });
    results.push(report('first screen: the live demo has food on screen from the first second', early.first && early.objs >= 20, JSON.stringify(early)));
    results.push(report('first screen: the demo eats, scores, grows to T3+, eats a rival and loops', seen.maxScore >= 150 && seen.maxTier >= 2 && seen.rival && seen.loops >= 1, JSON.stringify(seen)));
    results.push(report('first screen: no runtime errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // --- Miasto: live Arena stage above GRAJ, record hook, full mission name ---
  for (const [W, H] of [[375, 667], [402, 874]]) {
    const g = await openGame(url, { viewport: { width: W, height: H } });
    const save = await veteranSave(g.page, { missions: 12, runsPlayed: 6 });
    save.stats.bestArenaScore = 1840;
    await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
    await g.page.reload();
    await g.page.waitForFunction(() => window.game && window.game.state);
    await g.page.waitForTimeout(2500);
    const hub = await g.page.evaluate(() => {
      const rect = id => document.getElementById(id).getBoundingClientRect();
      const stage = rect('hubArenaStage'), play = rect('btnStart'), city = rect('hubHeroStage'), chest = rect('hubFreeChest');
      const nav = document.querySelector('.bottom-nav, #bottomNav');
      const navTop = nav ? nav.getBoundingClientRect().top : innerHeight;
      const st = document.getElementById('hubArenaScene')._scene;
      const title = document.getElementById('hubCampaignTitle');
      return {
        order: stage.bottom <= play.top && play.bottom <= city.top,
        stageH: Math.round(stage.height), alive: !!st && st.objs.length > 10,
        chestVisible: chest.bottom <= navTop + 1,
        sub: document.getElementById('hubPlaySub').textContent,
        titleFull: title.scrollHeight <= title.clientHeight + 1 && !/…$/.test(title.textContent)
      };
    });
    results.push(report(`Miasto ${W}×${H}: a live Arena stage sits right above GRAJ, Core City below`, hub.order && hub.stageH >= 110 && hub.alive, JSON.stringify(hub)));
    results.push(report(`Miasto ${W}×${H}: everything down to the free chest fits above the nav (no scrolling)`, hub.chestVisible));
    results.push(report(`Miasto ${W}×${H}: GRAJ names the record to beat; the next mission's name is not cut`, /rekord: 1\s?840 pkt/.test(hub.sub) && hub.titleFull, JSON.stringify({ sub: hub.sub })));
    if (W === 375) {
      const started = await g.page.evaluate(async () => {
        document.getElementById('hubArenaStage').click();
        await new Promise(r => setTimeout(r, 400));
        // Past the first 3 runs GRAJ opens the run-tool screen first.
        return { running: window.game.running, runSetup: !document.getElementById('runSetupScreen').classList.contains('hidden') };
      });
      results.push(report('Miasto: tapping the live stage does what GRAJ does (never a dead tap)', started.running || started.runSetup, JSON.stringify(started)));
    }
    results.push(report(`Miasto ${W}×${H}: no runtime errors`, g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // --- Labels over live canvases have their own layer (WebKit fix) ----------
  {
    const g = await openGame(url, { viewport: { width: 402, height: 874 } });
    const save = await veteranSave(g.page, { missions: 1 });
    await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
    await g.page.reload();
    await g.page.waitForFunction(() => window.game && window.game.state);
    const tiles = await g.page.evaluate(async () => {
      window.game.openCampaignScreen();
      await new Promise(r => setTimeout(r, 400));
      return [...document.querySelectorAll('#districtMap .district-tile')].slice(0, 4).map(n => {
        const info = n.querySelector('.district-tile-info'), cv = n.querySelector('canvas');
        const ci = getComputedStyle(info), cc = getComputedStyle(cv);
        return { name: n.querySelector('.district-node-name').textContent, layered: +ci.zIndex > +cc.zIndex && ci.willChange.includes('transform'), visible: ci.visibility === 'visible' && +ci.opacity > 0 };
      });
    });
    results.push(report('Dzielnice: every tile label (name + status) sits on its own layer above the animated skyline', tiles.length === 4 && tiles.every(t => t.layered && t.visible && t.name), JSON.stringify(tiles)));
    await g.browser.close();
  }

  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { server, url } = await serve();
  const res = await runV17Checks(url);
  server.close();
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} v17 checks passed`);
  process.exit(failed.length ? 1 : 0);
}

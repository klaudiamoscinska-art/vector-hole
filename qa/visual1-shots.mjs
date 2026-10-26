// VISUAL-1: before/after screenshots of the screens the visual pass
// touches (Miasto at three Core City stages, Dzielnice, Warsztat before /
// after equipping, Arena HUD, results, Wyzwania, Profil, modals).
// Not a pass/fail suite -- evidence for review, written to
// qa/out/visual1/<label>/. Usage:
//   node qa/visual1-shots.mjs [--root DIR] [--label after]
// --root serves another checkout (e.g. a worktree of the base commit) so
// the same script shoots BEFORE and AFTER on the same machine.
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, veteranSave, ARENA_BOT, QA_TICK, OUT, isMain } from './lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

export async function shootAll({ root, label, only = null }) {
  const want = (k) => !only || only.split(',').includes(k);
  const dir = path.join(OUT, 'visual1', label);
  fs.mkdirSync(dir, { recursive: true });
  const { server, url } = await serve(root ? { root: path.resolve(root) } : {});
  const errors = [];
  const shot = (page, name) => page.screenshot({ path: path.join(dir, name + '.png') });
  const boot = async (vp, overrides, patch) => {
    const g = await openGame(url, { viewport: vp });
    const save = await veteranSave(g.page, overrides);
    if (patch) patch(save);
    await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
    await g.page.reload();
    await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
    return g;
  };
  const PHONE = { width: 390, height: 844 };
  const LAND = { width: 844, height: 390 };
  const DESK = { width: 1280, height: 720 };

  // 1-3: Miasto at a low, middle and high Core City stage (+ the roadmap).
  const stages = !want('city') ? [] : [['01-city-low', 1, 30], ['02-city-mid', 3, 55], ['03-city-high', 6, 40]];
  for (const [name, level, charge] of stages) {
    for (const [vp, suf] of [[PHONE, ''], [LAND, '-land'], [DESK, '-desk']]) {
      const g = await boot(vp, { coins: 900, runsPlayed: 4 + level * 5, missions: 12 }, (s) => { s.hub.coreLevel = level; s.hub.coreCharge = charge; s.prisms = 30; });
      await g.page.waitForTimeout(2600);
      await shot(g.page, name + suf);
      if (!suf) {
        await g.page.evaluate(() => window.game.openCoreCityRoadmap());
        await g.page.waitForTimeout(500);
        await shot(g.page, name + '-roadmap');
      }
      errors.push(...g.errors);
      await g.browser.close();
    }
  }
  // 3b: a level-up moment -- a round just filled Core City past 100 %.
  if (want('levelup')) {
    const g = await boot(PHONE, { coins: 900, runsPlayed: 12, missions: 12 }, (s) => { s.hub.coreLevel = 2; s.hub.coreCharge = 95; });
    await g.page.addScriptTag({ content: ARENA_BOT });
    await g.page.evaluate(() => window.__qaPlayArena({ round: { seed: 4242 } }));
    await g.page.waitForTimeout(1600);
    await shot(g.page, '03b-levelup-result');
    await g.page.evaluate(() => { const gm = window.game; gm.unlockQueue = []; document.getElementById('unlockOverlay').classList.add('hidden'); gm.showScreen('mainMenu'); });
    await g.page.waitForTimeout(900);
    await shot(g.page, '03c-levelup-city-0.9s');
    await g.page.waitForTimeout(1600);
    await shot(g.page, '03d-levelup-city-2.5s');
    errors.push(...g.errors);
    await g.browser.close();
  }
  // 4: Dzielnice -- open, done, current and locked districts.
  for (const [vp, suf] of want('districts') ? [[PHONE, ''], [DESK, '-desk']] : []) {
    const g = await boot(vp, { coins: 600, runsPlayed: 10, missions: 46 });
    await g.page.evaluate(() => window.game.openCampaignScreen());
    await g.page.waitForTimeout(900);
    await shot(g.page, '04-dzielnice' + suf);
    if (!suf) {
      await g.page.evaluate(() => { const s = document.querySelector('#campaignScreen .screen-body, #campaignScreen'); s.scrollTop = 99999; document.querySelectorAll('#campaignScreen *').forEach(e => { if (e.scrollHeight > e.clientHeight + 4) e.scrollTop = 99999; }); });
      await g.page.waitForTimeout(300);
      await shot(g.page, '04b-dzielnice-scrolled');
      await g.page.evaluate(() => window.game.selectCampaignDistrict('dachy'));
      await g.page.waitForTimeout(500);
      await shot(g.page, '04c-dzielnice-locked');
    }
    errors.push(...g.errors);
    await g.browser.close();
  }
  // 5: Warsztat -- before and after equipping an owned vortex; a purchase sheet.
  if (want('warsztat')) {
    const g = await boot(PHONE, { coins: 1500, runsPlayed: 10, missions: 12 }, (s) => { s.owned = ['rainbow', 'cyan', 'pink']; s.prisms = 30; });
    await g.page.evaluate(() => window.game.openWarsztatScreen());
    await g.page.waitForTimeout(700);
    await shot(g.page, '05a-warsztat-before-equip');
    await g.page.evaluate(() => { const c = [...document.querySelectorAll('#skinGrid .skin-card')].find(el => /cyan|Cyjan/i.test(el.textContent + (el.dataset.skin || ''))); (c || document.querySelectorAll('#skinGrid .skin-card')[1]).click(); });
    await g.page.waitForTimeout(350);
    await shot(g.page, '05b-warsztat-equip-0.35s');
    await g.page.waitForTimeout(900);
    await shot(g.page, '05c-warsztat-after-equip');
    await g.page.evaluate(() => { const cards = [...document.querySelectorAll('#skinGrid .skin-card')]; cards[cards.length - 3].click(); });
    await g.page.waitForTimeout(500);
    await shot(g.page, '05d-warsztat-buy-sheet');
    errors.push(...g.errors);
    await g.browser.close();
  }
  // 6: Arena HUD mid-round.
  if (want('hud')) {
    const g = await boot(PHONE, { coins: 900, runsPlayed: 8, missions: 12 });
    await g.page.addScriptTag({ content: QA_TICK });
    await g.page.evaluate(() => { const gm = window.game; gm.checkEvolutionTriggers = () => {}; gm.startRound({ seed: 777 }); cancelAnimationFrame(gm.rafId); gm.running = false; });
    await g.page.evaluate(() => window.__qaTick(1100));
    await shot(g.page, '06-arena-hud');
    errors.push(...g.errors);
    await g.browser.close();
  }
  // 7: results -- Arena and a mission.
  if (want('results')) {
    const g = await boot(PHONE, { coins: 900, runsPlayed: 8, missions: 12 });
    await g.page.addScriptTag({ content: ARENA_BOT });
    await g.page.evaluate(() => window.__qaPlayArena({ round: { seed: 12345 } }));
    await g.page.waitForTimeout(1600);
    await g.page.evaluate(() => { window.game.unlockQueue = []; document.getElementById('unlockOverlay').classList.add('hidden'); });
    await shot(g.page, '07a-arena-result');
    await g.page.evaluate(() => { const gm = window.game; gm.startCampaignMission(gm.nextCampaignMissionId()); if (gm.introPending) gm.beginMissionPlay(); cancelAnimationFrame(gm.rafId); gm.running = false; gm.mission.elapsed = 20; gm.endCampaignMission(true); });
    await g.page.waitForTimeout(1500);
    await g.page.evaluate(() => { window.game.unlockQueue = []; document.getElementById('unlockOverlay').classList.add('hidden'); document.getElementById('missionConfetti').innerHTML = ''; });
    await shot(g.page, '07b-mission-result');
    errors.push(...g.errors);
    await g.browser.close();
  }
  // 8: Wyzwania, Profil, the login calendar and an unlock overlay.
  if (want('meta')) {
    const g = await boot(PHONE, { coins: 900, runsPlayed: 8, missions: 12 });
    await g.page.evaluate(() => window.game.openChallengesScreen());
    await g.page.waitForTimeout(700);
    await shot(g.page, '08a-wyzwania');
    await g.page.evaluate(() => window.game.openProfileScreen());
    await g.page.waitForTimeout(500);
    await shot(g.page, '08b-profil');
    await g.page.evaluate(() => { const gm = window.game; gm.save.login.lastClaimDate = null; gm.bootFirstRun = false; gm.showScreen('mainMenu'); gm.maybeShowLoginReward(); });
    await g.page.waitForTimeout(600);
    await shot(g.page, '08c-calendar');
    errors.push(...g.errors);
    await g.browser.close();
  }
  server.close();
  return { dir, errors };
}

if (isMain(import.meta.url)) {
  const { dir, errors } = await shootAll({ root: arg('--root', null), label: arg('--label', 'after'), only: arg('--only', null) });
  if (errors.length) console.log('page errors:\n' + errors.join('\n'));
  console.log('screenshots in', dir);
}

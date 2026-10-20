// Screenshot bot: captures every v11/v12 screen state at phone size into
// qa/out/screens/ for visual review. Usage: node qa/screens.mjs
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, veteranSave, ARENA_BOT, QA_TICK, OUT } from './lib.mjs';

const dir = path.join(OUT, 'screens');
fs.mkdirSync(dir, { recursive: true });
const { server, url } = await serve();
const shot = (page, name) => page.screenshot({ path: path.join(dir, name + '.png') });

{ // first launch
  const g = await openGame(url);
  await g.page.waitForTimeout(600);
  await shot(g.page, '01-first-launch');
  await g.browser.close();
}
{
  const g = await openGame(url);
  const save = await veteranSave(g.page, { coins: 900, runsPlayed: 8 });
  save.challenge = { seed: 12345, score: 4321, from: 'Ania', receivedAt: Date.now() };
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
  await g.page.addScriptTag({ content: ARENA_BOT });
  await g.page.waitForTimeout(800);
  await shot(g.page, '02-hub-challenge');
  await g.page.evaluate(() => window.game.openWarsztatScreen());
  await g.page.waitForTimeout(400);
  await shot(g.page, '03-warsztat-store');
  await g.page.evaluate(() => window.game.openProfileScreen());
  await g.page.waitForTimeout(300);
  await shot(g.page, '04-profile-settings');
  await g.page.evaluate(() => { window.game.acceptChallenge(); });
  await g.page.waitForTimeout(1500);
  await shot(g.page, '05-round-challenge-hud');
  await g.page.evaluate(() => window.__qaPlayArena({ round: { seed: 12345, challenge: { score: 99999, from: 'Ania' } } }));
  await g.page.waitForTimeout(1600);
  await g.page.evaluate(() => { window.game.unlockQueue = []; document.getElementById('unlockOverlay').classList.add('hidden'); });
  await shot(g.page, '06-results-hook');
  await g.page.evaluate(() => {
    const gm = window.game;
    gm.startCampaignMission('M02'); if (gm.introPending) gm.beginMissionPlay();
    const m = gm.mission; const st = m.def.goal.steps || [];
    if (st[0] && st[0].eat) m.eatenByType[st[0].eat] = Math.ceil(gm.campaignGoalItems()[0].target * 0.7);
    m.elapsed = m.def.timeLimit; gm.updateCampaign(0.016);
  });
  await g.page.waitForTimeout(500);
  await shot(g.page, '07-mission-revive');
  await g.browser.close();
}
{ // v12 visual pass: in-round Neon City floor, swallow animation, menus
  const g = await openGame(url);
  const save = await veteranSave(g.page, { coins: 900, runsPlayed: 8, missions: 40 });
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
  await g.page.addScriptTag({ content: QA_TICK });
  await g.page.evaluate(() => { const gm = window.game; gm.checkEvolutionTriggers = () => {}; gm.startRound({ seed: 777 }); cancelAnimationFrame(gm.rafId); gm.running = false; });
  await g.page.evaluate(() => window.__qaTick(900));
  await shot(g.page, '08-arena-mid');
  await g.page.evaluate(() => window.__qaTick(1700));
  await shot(g.page, '09-arena-late');
  await g.page.evaluate(() => window.__qaSwallowScene());
  const c = await g.page.evaluate(() => ({ x: window.game.width / 2 - 130, y: window.game.height / 2 - 130 }));
  await g.page.screenshot({ path: path.join(dir, '10-swallow-closeup.png'), clip: { x: c.x, y: c.y, width: 260, height: 260 } });
  await g.page.evaluate(() => { const gm = window.game; gm.running = true; gm.pauseGame(); });
  await g.page.waitForTimeout(350);
  await shot(g.page, '11-pause-sheet');
  await g.page.evaluate(() => { const gm = window.game; gm.resumeGame(); cancelAnimationFrame(gm.rafId); gm.running = false; gm.evolutionOffersTriggered = new Set(); gm.offerEvolution(); gm.render(performance.now() / 1000); });
  await g.page.waitForTimeout(500);
  await shot(g.page, '12-evolution-cards');
  await g.page.evaluate(() => { const gm = window.game; gm.skipEvolutionOffer(); gm.startCampaignMission('M05'); if (gm.introPending) gm.beginMissionPlay(); cancelAnimationFrame(gm.rafId); gm.running = false; gm.hideNelaToast(); gm.updateCampaign(0.016); gm.renderCampaign(1); });
  await g.page.waitForTimeout(200);
  await shot(g.page, '13-campaign-park');
  await g.page.evaluate(() => { const gm = window.game; gm.endCampaignMission(true); });
  await g.page.waitForTimeout(1400);
  await g.page.evaluate(() => { window.game.unlockQueue = []; document.getElementById('unlockOverlay').classList.add('hidden'); });
  await shot(g.page, '14-mission-result');
  await g.page.evaluate(() => window.game.openCampaignScreen());
  await g.page.waitForTimeout(600);
  await shot(g.page, '15-dzielnice');
  await g.page.evaluate(() => window.game.openChallengesScreen());
  await g.page.waitForTimeout(600);
  await shot(g.page, '16-wyzwania');
  if (g.errors.length) console.log('errors', g.errors);
  await g.browser.close();
}
{ // v14: the campaign flow at the frontier -- hub, Dzielnice, briefing,
  // in-mission NELA bubble, result with the next mission's preview
  const g = await openGame(url);
  const save = await veteranSave(g.page, { coins: 240, runsPlayed: 2, missions: 3 });
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
  await g.page.waitForTimeout(700);
  await shot(g.page, '17-hub-frontier');
  await g.page.evaluate(() => window.game.openCampaignScreen());
  await g.page.waitForTimeout(500);
  await shot(g.page, '18-dzielnice-frontier');
  await g.page.evaluate(() => document.querySelector('#missionList .mission-row:nth-child(2)').click());
  await g.page.waitForTimeout(450);
  await shot(g.page, '19-briefing');
  await g.page.evaluate(() => document.querySelector('#briefingCard [data-mc-launch]').click());
  await g.page.waitForTimeout(900);
  await g.page.evaluate(() => { const gm = window.game; cancelAnimationFrame(gm.rafId); gm.running = false; gm.renderCampaign(1); });
  await shot(g.page, '20-mission-start-nela');
  await g.page.evaluate(() => { const gm = window.game; gm.mission.elapsed = 21; gm.endCampaignMission(true); });
  await g.page.waitForTimeout(1300);
  await g.page.evaluate(() => { window.game.unlockQueue = []; document.getElementById('unlockOverlay').classList.add('hidden'); document.getElementById('missionConfetti').innerHTML = ''; });
  await shot(g.page, '21-mission-result-next');
  await g.page.evaluate(() => { const gm = window.game; gm.startCampaignMission('M03'); cancelAnimationFrame(gm.rafId); gm.running = false; gm.mission.elapsed = 999; gm.endCampaignMission(false); });
  await g.page.waitForTimeout(900);
  await shot(g.page, '22-mission-result-fail');
  if (g.errors.length) console.log('errors', g.errors);
  await g.browser.close();
}
for (const vp of [{ width: 375, height: 667 }]) { // SE-class phone
  const g = await openGame(url, { viewport: vp });
  const save = await veteranSave(g.page, { coins: 240, runsPlayed: 4, missions: 5 });
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
  await g.page.waitForTimeout(700);
  await shot(g.page, '23-hub-se');
  await g.page.evaluate(() => window.game.openCampaignScreen());
  await g.page.waitForTimeout(500);
  await shot(g.page, '24-dzielnice-se');
  await g.page.evaluate(() => window.game.openMissionBriefing(window.game.nextCampaignMissionId()));
  await g.page.waitForTimeout(450);
  await shot(g.page, '25-briefing-se');
  await g.page.evaluate(() => { const gm = window.game; const id = gm.nextCampaignMissionId(); gm.closeMissionBriefing(); gm.startCampaignMission(id); cancelAnimationFrame(gm.rafId); gm.running = false; gm.mission.elapsed = 31; gm.endCampaignMission(true); });
  await g.page.waitForTimeout(1300);
  await g.page.evaluate(() => { window.game.unlockQueue = []; document.getElementById('unlockOverlay').classList.add('hidden'); document.getElementById('missionConfetti').innerHTML = ''; });
  await shot(g.page, '26-mission-result-se');
  await g.page.evaluate(() => { const gm = window.game; gm.save.coins = 900; gm.openWarsztatScreen(); });
  await g.page.waitForTimeout(400);
  await g.page.evaluate(() => [...document.querySelectorAll('#skinGrid .skin-card')][1].click());
  await g.page.waitForTimeout(400);
  await shot(g.page, '27-warsztat-buy-se');
  if (g.errors.length) console.log('errors', g.errors);
  await g.browser.close();
}
// v15: briefing with boosters, tap-to-start card, twists, stars.
{
  const g = await openGame(url, { viewport: { width: 402, height: 874 } });
  const save = await veteranSave(g.page, { coins: 600, runsPlayed: 6, missions: 75 });
  save.prisms = 20;
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
  await g.page.waitForTimeout(500);
  await g.page.evaluate(() => { window.game.openCampaignScreen(); window.game.selectCampaignDistrict('metro'); });
  await g.page.waitForTimeout(400);
  await shot(g.page, '28-v15-dzielnice-metro');
  await g.page.evaluate(() => { const gm = window.game; gm.openMissionBriefing(gm.nextCampaignMissionId()); gm.toggleBriefingBooster('time'); gm.toggleBriefingBooster('magnet'); });
  await g.page.waitForTimeout(400);
  await shot(g.page, '29-v15-briefing-boosters');
  await g.page.evaluate(() => { document.querySelector('[data-mc-launch]').click(); const gm = window.game; cancelAnimationFrame(gm.rafId); gm.running = false; gm.renderCampaign(1); });
  await g.page.waitForTimeout(400);
  await shot(g.page, '30-v15-start-card');
  for (const [id, name] of [['M61', '31-v15-dark'], ['M110', '32-v15-glitch'], ['M91', '33-v15-racer']]) {
    await g.page.evaluate((mid) => {
      const gm = window.game; gm.leaveCampaignMission(); gm.startCampaignMission(mid); gm.beginMissionPlay(); cancelAnimationFrame(gm.rafId); gm.running = false;
      const realNow = performance.now.bind(performance); let v = realNow(); performance.now = () => v;
      for (let f = 0; f < 120; f++) { v += 33.3; gm.keyDir = { x: Math.cos(f / 40), y: -Math.abs(Math.sin(f / 50)) }; gm.updateCampaign(1 / 30); }
      gm.keyDir = { x: 0, y: 0 }; gm.banner = null; gm.renderCampaign(v / 1000); performance.now = realNow;
    }, id);
    await shot(g.page, name);
  }
  await g.page.evaluate(() => { const gm = window.game; gm.leaveCampaignMission(); gm.startCampaignMission('M61'); gm.beginMissionPlay(); cancelAnimationFrame(gm.rafId); gm.running = false; gm.mission.elapsed = 10; gm.endCampaignMission(true); });
  await g.page.waitForTimeout(1600);
  await g.page.evaluate(() => { window.game.unlockQueue = []; document.getElementById('unlockOverlay').classList.add('hidden'); document.getElementById('missionConfetti').innerHTML = ''; });
  await shot(g.page, '34-v15-result-stars');
  if (g.errors.length) console.log('errors', g.errors);
  await g.browser.close();
}
// v22: the first play is an Arena round; a player who does not steer gets
// the steering hint (nothing for one who just plays).
{
  const g = await openGame(url, { viewport: { width: 402, height: 874 } });
  await g.page.waitForTimeout(400);
  await g.page.evaluate(() => document.getElementById('btnWelcomePlay').click());
  await g.page.waitForTimeout(2400);
  await shot(g.page, '35-v22-first-round-hint');
  if (g.errors.length) console.log('errors', g.errors);
  await g.browser.close();
}
server.close();
console.log('screenshots in', dir);

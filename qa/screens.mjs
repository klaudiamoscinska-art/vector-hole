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
  await g.page.waitForFunction(() => window.game && window.game.state);
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
    gm.startCampaignMission('M02'); if (gm.introPending) gm.dismissTutorialIntro();
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
  await g.page.waitForFunction(() => window.game && window.game.state);
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
  await g.page.evaluate(() => { const gm = window.game; gm.skipEvolutionOffer(); gm.startCampaignMission('M05'); if (gm.introPending) gm.dismissTutorialIntro(); cancelAnimationFrame(gm.rafId); gm.running = false; gm.hideNelaToast(); gm.updateCampaign(0.016); gm.renderCampaign(1); });
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
server.close();
console.log('screenshots in', dir);

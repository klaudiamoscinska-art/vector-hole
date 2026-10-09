// Screenshot bot: captures every v11 screen state at phone size into
// qa/out/screens/ for visual review. Usage: node qa/screens.mjs
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, veteranSave, ARENA_BOT, OUT } from './lib.mjs';

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
server.close();
console.log('screenshots in', dir);

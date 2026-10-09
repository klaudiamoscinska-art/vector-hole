// Campaign bot-tester: a greedy bot plays the first N missions in virtual
// time (goal objects first, then growth food, gates/portals/bridges by
// touch, rivals when they are prey) and reports clears and clear times
// against each mission's limit. Usage: node qa/campaign-bots.mjs [count]
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, veteranSave, report, OUT } from './lib.mjs';

const CAMPAIGN_BOT = `
window.__qaPlayMission = function (id) {
  const g = window.game;
  const realNow = window.__realNow || (window.__realNow = performance.now.bind(performance));
  let vnow = realNow();
  performance.now = () => vnow;
  g.startCampaignMission(id);
  if (g.introPending) g.dismissTutorialIntro();
  if (g.rafId) cancelAnimationFrame(g.rafId);
  g.running = false;
  const dt = 1 / 30;
  const m = g.mission;
  let frames = 0, wander = 0;
  let clearAt = null;
  while (!m.ended && !m.finishing && frames < 30 * 400) {
    if (g.evolutionPending) { const c = document.querySelector('#evolutionCards .evolution-card'); if (c) c.click(); else g.skipEvolutionOffer(); continue; }
    if (g.introPending) g.dismissTutorialIntro();
    const p = g.player;
    const tier = g.campaignTierIndex(g.campaignPlayerTier().id);
    const goalTypes = g.campaignGoalEntityTypes();
    let fx = 0, fy = 0;
    for (const b of g.bots) {
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (b.radius > p.radius * 1.1 && d < 160 + b.radius) { fx -= (b.x - p.x) / (d + 1); fy -= (b.y - p.y) / (d + 1); }
    }
    let target = null, best = -1;
    if (!(fx || fy)) {
      for (const e of g.campaignEntities) {
        if (e.consumed || e.eating || !e.live) continue;
        const touch = e.type === 'gate' || (e.type === 'node' && e.glyph === 'mostek' && !e.mostekPowered);
        if (!touch) {
          if ((e.type === 'node' || e.type === 'pylon') && !e.active) continue;
          if (e.type === 'landmark' && !e.unlocked) continue;
          if (tier < e.stats.minTier) continue;
        }
        if (e.type === 'gate' && (!goalTypes.has('gate') || m.gatesPassed.has(e))) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        const s = (goalTypes.has(e.type) ? 4 : 1) * ((e.stats && e.stats.growth) || 2) / (d + 60);
        if (s > best) { best = s; target = e; }
      }
      for (const b of g.bots) {
        const d = Math.hypot(b.x - p.x, b.y - p.y);
        if (p.radius > b.radius * 1.2 && d < 700) { const s = 6 / (d + 60); if (s > best) { best = s; target = b; } }
      }
    }
    if (fx || fy) { const n = Math.hypot(fx, fy); g.keyDir = { x: fx / n, y: fy / n }; }
    else if (target && target.type === 'gate' && target.isGateOpen === false && Math.hypot(target.x - p.x, target.y - p.y) < p.radius + 60) { g.keyDir = { x: 0, y: 0 }; g.pointerWorld = { x: p.x, y: p.y }; }
    else if (target) { const n = Math.hypot(target.x - p.x, target.y - p.y) || 1; g.keyDir = { x: (target.x - p.x) / n, y: (target.y - p.y) / n }; }
    else { wander += 0.04; g.keyDir = { x: Math.cos(wander), y: Math.sin(wander) }; }
    vnow += dt * 1000;
    g.updateCampaign(dt);
    if (frames % 30 === 0 && !m.ended) g.renderCampaign(frames * dt);
    frames++;
  }
  // Success has a short celebration delay (beginMissionSuccess uses a
  // real setTimeout) -- commit it directly instead of waiting on it.
  const success = !!m.finishing && !m.ended;
  if (success) g.endCampaignMission(true);
  g.keyDir = { x: 0, y: 0 };
  performance.now = realNow;
  return { id, success: success && !!g.save.campaign.completed[id], elapsed: +m.elapsed.toFixed(1), limit: m.def.timeLimit };
};
`;

export async function runCampaignBots(url, count = 12) {
  const results = [];
  const { browser, page, errors } = await openGame(url);
  const save = await veteranSave(page, { missions: 0 });
  save.campaign.unlockedDistricts = ['plac', 'park', 'port', 'galeria', 'dachy', 'rdzen'];
  await page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await page.reload();
  await page.waitForFunction(() => window.game && window.game.state);
  await page.addScriptTag({ content: CAMPAIGN_BOT });
  const ids = await page.evaluate((n) => CAMPAIGN_MISSIONS.slice(0, n).map(m => m.id), count);
  const runs = [];
  for (const id of ids) {
    const r = await page.evaluate((mid) => window.__qaPlayMission(mid), id);
    runs.push(r);
    console.log(`  ${r.id}: ${r.success ? 'clear' : 'FAIL '} ${r.elapsed}s / ${r.limit}s`);
  }
  const cleared = runs.filter(r => r.success).length;
  results.push(report(`campaign: greedy bot clears the first ${ids.length} missions`, cleared === ids.length, `${cleared}/${ids.length}`));
  results.push(report('campaign: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | ')));
  fs.writeFileSync(path.join(OUT, 'campaign.json'), JSON.stringify(runs, null, 2));
  await browser.close();
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { server, url } = await serve();
  const res = await runCampaignBots(url, Number(process.argv[2]) || 12);
  server.close();
  process.exit(res.every(r => r.ok) ? 0 : 1);
}

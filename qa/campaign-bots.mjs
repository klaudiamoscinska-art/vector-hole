// Campaign bot-tester: the expert bot (lib.mjs CAMPAIGN_BOT) plays the first N missions in virtual
// time (goal objects first, then growth food, bridges by
// touch, rivals when they are prey) and reports clears and clear times
// against each mission's limit. Usage: node qa/campaign-bots.mjs [count]
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, allDistrictsSave, report, OUT, CAMPAIGN_BOT, isMain } from './lib.mjs';


export async function runCampaignBots(url, count = 12) {
  const results = [];
  const { browser, page, errors } = await openGame(url);
  const save = await allDistrictsSave(page);
  await page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await page.reload();
  await page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
  await page.addScriptTag({ content: CAMPAIGN_BOT });
  // v15: in play order (district by district), every mission under its
  // real time limit.
  const ids = await page.evaluate((n) => DISTRICTS.flatMap(d => d.missions).slice(0, n), count);
  const runs = [];
  for (const id of ids) {
    const r = await page.evaluate((mid) => window.__qaPlayMission(mid), id);
    runs.push(r);
    console.log(`  ${r.id}: ${r.success ? 'clear' : 'FAIL '} ${r.elapsed}s / ${r.limit}s`);
  }
  const cleared = runs.filter(r => r.success).length;
  // The first districts are friendly: the expert clears all but at most one.
  results.push(report(`campaign: expert bot clears the first ${ids.length} missions (play order)`, cleared >= ids.length - 1, `${cleared}/${ids.length}${runs.filter(r => !r.success).map(r => ' ' + r.id + ':' + r.fail).join('')}`));
  results.push(report('campaign: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | ')));
  fs.writeFileSync(path.join(OUT, 'campaign.json'), JSON.stringify(runs, null, 2));
  await browser.close();
  return results;
}

if (isMain(import.meta.url)) {
  const { server, url } = await serve();
  const res = await runCampaignBots(url, Number(process.argv[2]) || 12);
  server.close();
  process.exit(res.every(r => r.ok) ? 0 : 1);
}

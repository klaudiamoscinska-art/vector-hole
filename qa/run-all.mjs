// Runs every QA bot suite against a local static server and prints a
// summary. Exit code 1 if anything failed. Usage: node qa/run-all.mjs
import fs from 'node:fs';
import path from 'node:path';
import { serve, OUT } from './lib.mjs';
import { runEdgeCases } from './edge-cases.mjs';
import { runArenaBots } from './arena-bots.mjs';
import { runCampaignBots } from './campaign-bots.mjs';
import { runFeatureChecks } from './features.mjs';
import { runVisualChecks } from './visual.mjs';
import { runDesignChecks } from './design.mjs';
import { runFlowChecks } from './flow.mjs';
import { runDifficultyChecks } from './difficulty.mjs';
import { runV15Checks } from './v15.mjs';
import { runAudioChecks } from './audio.mjs';
import { runV17Checks } from './v17.mjs';
import { runV18Checks } from './v18.mjs';
import { runV19Checks } from './v19.mjs';

const { server, url } = await serve();
const all = [];
for (const [name, fn] of [['edge cases', () => runEdgeCases(url)], ['features', () => runFeatureChecks(url)], ['visual', () => runVisualChecks(url)], ['design', () => runDesignChecks(url)], ['flow', () => runFlowChecks(url)], ['arena bots', () => runArenaBots(url, 20)], ['campaign bots', () => runCampaignBots(url, 30)], ['v15 systems', () => runV15Checks(url)], ['audio (v16)', () => runAudioChecks(url)], ['v17 first impression', () => runV17Checks(url)], ['v18 economy', () => runV18Checks(url, 2)], ['v19 launch (English, energy, saves)', () => runV19Checks(url)], ['difficulty (all 240 missions, expert + casual)', () => runDifficultyChecks(url, 2, 4)]]) {
  console.log(`\n=== ${name} ===`);
  try { all.push(...await fn()); } catch (e) { all.push({ name: `${name} crashed`, ok: false, details: String(e && e.stack || e) }); console.log('CRASH', e); }
}
server.close();
const failed = all.filter(r => !r.ok);
console.log(`\n${all.length - failed.length}/${all.length} checks passed`);
failed.forEach(f => console.log('  FAIL', f.name, f.details || ''));
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(all, null, 2));
process.exit(failed.length ? 1 : 0);

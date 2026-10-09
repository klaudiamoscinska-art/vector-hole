// Runs every QA bot suite against a local static server and prints a
// summary. Exit code 1 if anything failed. Usage: node qa/run-all.mjs
import fs from 'node:fs';
import path from 'node:path';
import { serve, OUT } from './lib.mjs';
import { runEdgeCases } from './edge-cases.mjs';
import { runArenaBots } from './arena-bots.mjs';
import { runCampaignBots } from './campaign-bots.mjs';
import { runFeatureChecks } from './features.mjs';

const { server, url } = await serve();
const all = [];
for (const [name, fn] of [['edge cases', () => runEdgeCases(url)], ['features', () => runFeatureChecks(url)], ['arena bots', () => runArenaBots(url, 20)], ['campaign bots', () => runCampaignBots(url, 22)]]) {
  console.log(`\n=== ${name} ===`);
  try { all.push(...await fn()); } catch (e) { all.push({ name: `${name} crashed`, ok: false, details: String(e && e.stack || e) }); console.log('CRASH', e); }
}
server.close();
const failed = all.filter(r => !r.ok);
console.log(`\n${all.length - failed.length}/${all.length} checks passed`);
failed.forEach(f => console.log('  FAIL', f.name, f.details || ''));
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(all, null, 2));
process.exit(failed.length ? 1 : 0);

// Runs every QA bot suite against a local static server and prints a
// summary. Exit code 1 if anything failed. Usage: node qa/run-all.mjs
import fs from 'node:fs';
import path from 'node:path';
import { serve, OUT, environmentInfo } from './lib.mjs';
import { runBootChecks } from './boot.mjs';
import { runBridgeChecks } from './bridge.mjs';
import { runReleaseChecks } from './release.mjs';
import { runRecoveryChecks } from './release-recovery.mjs';
import { runTraceChecks } from './trace.mjs';
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
import { runV20Checks } from './v20.mjs';
import { runV21Checks } from './v21.mjs';
import { runV22Checks } from './v22.mjs';
import { runDevPanelChecks } from './dev-panel.mjs';
import { runSaveSafetyChecks } from './save-safety.mjs';
import { runPx02Checks } from './px02-isolation.mjs';

const { server, url } = await serve();
// E1: where this run happened (Node, Playwright, Chromium, HEAD, runtime file hashes).
const env = await environmentInfo();
console.log(`env: node ${env.node} · playwright ${env.playwright} · chromium ${env.chromium} · HEAD ${env.head} (${env.worktreeChanges} changed paths) · ${Object.entries(env.runtime).map(([f, h]) => f + ' ' + h.slice(0, 12)).join(' · ')}`);
fs.writeFileSync(path.join(OUT, 'environment.json'), JSON.stringify(env, null, 2));
const all = [];
for (const [name, fn] of [['boot (E1: starts, exact runtime files, no errors, nothing external)', () => runBootChecks(url)], ['bridge (E2: game.js as an ES module, QA bridge on live bindings)', () => runBridgeChecks(url)], ['release (E3: assembled artifact, frozen classic root, v/<id>/, retention, rollback)', () => runReleaseChecks()], ['release recovery (K2: break-glass run -- authorization, damaged live release, live/ledger mismatch, STOPs, back to standard)', () => runRecoveryChecks()], ['trace (E1: deterministic Arena round + M01, two runs identical)', () => runTraceChecks(url)], ['edge cases', () => runEdgeCases(url)], ['features', () => runFeatureChecks(url)], ['visual', () => runVisualChecks(url)], ['design', () => runDesignChecks(url)], ['flow', () => runFlowChecks(url)], ['arena bots', () => runArenaBots(url, 20)], ['campaign bots', () => runCampaignBots(url, 30)], ['v15 systems', () => runV15Checks(url)], ['audio (v16)', () => runAudioChecks(url)], ['v17 first impression', () => runV17Checks(url)], ['v18 economy', () => runV18Checks(url, 2)], ['v19 launch (English, saves)', () => runV19Checks(url)], ['v20 gates (impulse pads, portals)', () => runV20Checks(url)], ['v21 big screens', () => runV21Checks(url)], ['v22 two modes (no energy, independent Arena/Dzielnice, first-round coach, prisms)', () => runV22Checks(url)], ['v23 dev panel (access, test-mode isolation, every category, phones)', () => runDevPanelChecks(url)], ['PX01 save safety (future/broken saves, two tabs, quota, cloud copy)', () => runSaveSafetyChecks(url)], ['PX02 D+ isolation (vortices are looks, no Arena advantage for sale, one-time refund)', () => runPx02Checks(url)], ['difficulty (all 240 missions, expert + casual)', () => runDifficultyChecks(url, 2, 4)]]) {
  console.log(`\n=== ${name} ===`);
  try { all.push(...await fn()); } catch (e) { all.push({ name: `${name} crashed`, ok: false, details: String(e && e.stack || e) }); console.log('CRASH', e); }
}
server.close();
const failed = all.filter(r => !r.ok);
console.log(`\n${all.length - failed.length}/${all.length} checks passed`);
failed.forEach(f => console.log('  FAIL', f.name, f.details || ''));
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(all, null, 2));
process.exit(failed.length ? 1 : 0);

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
import { runFtue1Checks } from './ftue1.mjs';
import { runFtue3Checks } from './ftue3.mjs';
import { runLeaveRunChecks } from './leave-run.mjs';
import { runInstructionChecks } from './instructions.mjs';
import { runResponsiveChecks, runPlatformInputChecks } from './responsive.mjs';
import { runDeviceChecks } from './devices.mjs';
import { runVisual1Checks } from './visual1.mjs';
import { runContentAudit } from './content.mjs';
import { runBalance1Checks } from './balance1.mjs';
import { runPerf1Checks } from './perf1.mjs';
import { runGameReady1Checks } from './gameready1.mjs';

const { server, url } = await serve();
// E1: where this run happened (Node, Playwright, Chromium, HEAD, runtime file hashes).
const env = await environmentInfo();
console.log(`env: node ${env.node} · playwright ${env.playwright} · chromium ${env.chromium} · HEAD ${env.head} (${env.worktreeChanges} changed paths) · ${Object.entries(env.runtime).map(([f, h]) => f + ' ' + h.slice(0, 12)).join(' · ')}`);
fs.writeFileSync(path.join(OUT, 'environment.json'), JSON.stringify(env, null, 2));
const all = [];
for (const [name, fn] of [['instructions (OPT-2: CLAUDE.md keeps every non-negotiable rule, references exist, size budget)', async () => runInstructionChecks()], ['boot (E1: starts, exact runtime files, no errors, nothing external)', () => runBootChecks(url)], ['bridge (E2: game.js as an ES module, QA bridge on live bindings)', () => runBridgeChecks(url)], ['release (E3: assembled artifact, frozen classic root, v/<id>/, retention, rollback)', () => runReleaseChecks()], ['release recovery (K2: break-glass run -- authorization, damaged live release, live/ledger mismatch, STOPs, back to standard)', () => runRecoveryChecks()], ['trace (E1: deterministic Arena round + M01, two runs identical)', () => runTraceChecks(url)], ['edge cases', () => runEdgeCases(url)], ['features', () => runFeatureChecks(url)], ['visual', () => runVisualChecks(url)], ['design', () => runDesignChecks(url)], ['flow', () => runFlowChecks(url)], ['arena bots', () => runArenaBots(url, 20)], ['campaign bots', () => runCampaignBots(url, 30)], ['v15 systems', () => runV15Checks(url)], ['audio (v16)', () => runAudioChecks(url)], ['v17 first impression', () => runV17Checks(url)], ['v18 economy', () => runV18Checks(url, 2)], ['v19 launch (English, saves)', () => runV19Checks(url)], ['v20 gates (impulse pads, portals)', () => runV20Checks(url)], ['v21 big screens', () => runV21Checks(url)], ['v22 two modes (no energy, independent Arena/Dzielnice, first-round coach, prisms)', () => runV22Checks(url)], ['v23 dev panel (access, test-mode isolation, every category, phones)', () => runDevPanelChecks(url)], ['PX01 save safety (future/broken saves, two tabs, quota, cloud copy)', () => runSaveSafetyChecks(url)], ['PX02 D+ isolation (vortices are looks, no Arena advantage for sale, one-time refund)', () => runPx02Checks(url)], ['FTUE-1 second round (no card over the first result, replay, campaign on the Miasto tile after round 3, no first-result ad, calendar on the 2nd Miasto visit)', () => runFtue1Checks(url)], ['leave run (a round left at score 0 grants and counts nothing; a played round keeps its partial reward)', () => runLeaveRunChecks(url)], ['FTUE-3 first five minutes (round 1 without evolution cards, the vortex reaches the city edge and corners, the result says what the next round brings; the first session measured, every platform frame, existing saves, a reload)', () => runFtue3Checks(url)], ['FTUE-2 platforms (every Poki / CrazyGames / phone / tablet frame: nothing cut off, covered or scrolling; the portal page never scrolls; resize, turn, fullscreen, mouse, keys, touch, focus)', async () => [...await runResponsiveChecks(url), ...await runPlatformInputChecks(url)]], ['FTUE-2 FIX real devices (iPhone 13 Chrome, iPhone 16 Pro home-screen app, laptop: a turn with a late resize, the vortex at T1-T6 on every edge, edge arrows, big messages, no round frame between tabs, Core City text, Profil footer, modals without needless scrollbars, the way back from results, TEST panel)', () => runDeviceChecks(url)], ['VISUAL-1 city, districts, Warsztat (the Core City stage from the saved level, the level-up reveal once, roadmap thumbnails, TERAZ / NASTĘPNA, Warsztat card states and feedback, the result LVL chip, nothing written, frame cost)', () => runVisual1Checks(url)], ['CONTENT-1 campaign content (all 240 missions: goal copy, one icon per board object, goal objects on the board, progress, EN, expert-bot clear, vortex size on a phone)', () => runContentAudit(url)], ['BALANCE-1 economy and progression (simulated weak / average / strong / quitting players over the first hour, every booster does what it says, Magnes reach and value, saves and gear untouched, R1)', () => runBalance1Checks(url)], ['MOBILE-PERF-1 performance and stability (heavy scenes: the biggest vortex, late Arena, M59 -- no hitches, repeatable; Core City LVL 6 and the menus without layout-driving animations; the pause sheet idle; pause / tab / focus never resume by themselves; a turn on the pause sheet and mid-round; a long session without piling-up memory, nodes, listeners, timers; a small self-contained release)', () => runPerf1Checks(url)], ['GAME-READY-1 pre-release fixes (the Daily date in Polish and English on any day; English on the FTUE-2 screens fits like Polish, no text clipped only in English; the page head says 240 missions / 12 districts, a web game in PL + EN, viewport unchanged)', () => runGameReady1Checks(url)], ['difficulty (all 240 missions, expert + casual)', () => runDifficultyChecks(url, 2, 4)]]) {
  console.log(`\n=== ${name} ===`);
  try { all.push(...await fn()); } catch (e) { all.push({ name: `${name} crashed`, ok: false, details: String(e && e.stack || e) }); console.log('CRASH', e); }
}
server.close();
const failed = all.filter(r => !r.ok);
console.log(`\n${all.length - failed.length}/${all.length} checks passed`);
failed.forEach(f => console.log('  FAIL', f.name, f.details || ''));
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(all, null, 2));
process.exit(failed.length ? 1 : 0);

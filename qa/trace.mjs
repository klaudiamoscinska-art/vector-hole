// E1 (modularization safety net): a deterministic trace of real play, to
// compare the game's behaviour before and after a refactor that must not
// change it (game.js -> ES modules). Two scenarios on synthetic profiles in
// fresh browser profiles (never a real save):
//   arena    -- one Arena round (layout seed + greedy bot), start to results
//   campaign -- the FIRST clear of mission M01 (expert campaign bot,
//               --mission=Mxx for another) on a profile with no campaign
//               progress; asserts not completed before, cleared, completed
//               after, and coins / prisms / XP / stars / the stored save
//               exactly as the first-clear rules give them
// Each is played with a seeded Math.random (QA_RANDOM), a frozen wall clock
// (frozenDateScript) and a pinned virtual clock (bots' clock0), and sampled
// once per simulated second: player x/y/radius/score, objects swallowed,
// rivals, time left / elapsed, goal progress, Math.random draws so far.
// The end state adds the bot's result, the save's progression (coins,
// prisms, XP, stats, Core City, campaign) and the stored save itself.
//
// Normalized (left out of the comparison) -- and why:
//   result.avgUpdateMs / maxUpdateMs / avgRenderMs  wall-clock speed of the
//     machine, not the game's behaviour (kept in the file as `perf`).
// Held fixed in the synthetic profile -- and why:
//   settings.music / settings.sfx = off: the music sequencer schedules notes
//     on the AudioContext clock, which runs in real time even inside the
//     bots' synchronous loop, and draws Math.random per note -- with audio
//     on, the number of draws (and so the rest of the round) depends on how
//     fast the machine is. Audio has its own suite (qa/audio.mjs).
// Everything else is compared exactly, including the stored save's bytes
// (its SHA-256): with the clock frozen and the stream seeded they repeat.
// If a run ever shows they don't, that field goes on this list with the
// reason, it is not dropped silently.
//
// Usage:
//   node qa/trace.mjs                     both scenarios twice, must match (self-check)
//   node qa/trace.mjs --record FILE       self-check, then write the trace to FILE (baseline)
//   node qa/trace.mjs --compare FILE      self-check, then compare with a recorded baseline
//   --seed=N / VH_QA_SEED=N               another seed (default 20261018); --only=arena|campaign
//   --mission=Mxx                         the campaign scenario's mission (default M01)
// Record the baseline on the base commit, compare on the change: the first
// difference is printed with its path (sample, frame, field) and both values.
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, veteranSave, report, expectAll, is, truthy, falsy, holds, ARENA_BOT, CAMPAIGN_BOT, QA_RANDOM, frozenDateScript, environmentInfo, OUT, isMain } from './lib.mjs';

export const TRACE_VERSION = 2; // 2: the campaign scenario is a first clear (v1 replayed an already completed M01)
export const TRACE_DEFAULT_SEED = 20261018;
const FROZEN_AT = '2026-10-18T10:00:00.000Z';
const CLOCK0 = 1000000; // virtual performance.now() at the first frame (ms)
const SAMPLE_EVERY = { arena: 30, campaign: 10 }; // frames (dt 1/30): 1 s in a 2-minute round, 1/3 s in a short mission
const PERF_FIELDS = ['avgUpdateMs', 'maxUpdateMs', 'avgRenderMs'];

/** The in-page part: seeds, plays and samples one scenario in ONE
 *  page.evaluate (menu animations draw Math.random between calls). */
const TRACE_PAGE = `
window.__qaTraceRun = function (scenario, seed) {
  const g = window.game;
  const read = () => { try { return localStorage.getItem(SAVE_SLOT); } catch (e) { return null; } };
  const prog = (s) => ({
    coins: s.coins, prisms: s.prisms, xp: s.player.xp, level: s.player.level,
    runsPlayed: s.stats.runsPlayed, bestArenaScore: s.stats.bestArenaScore, recentArenaScores: s.stats.recentArenaScores.slice(),
    coreCharge: s.hub.coreCharge, coreLevel: s.hub.coreLevel, dailyMission: s.mission.completed,
    completed: Object.keys(s.campaign.completed).sort(), stars: Object.assign({}, s.campaign.stars),
    attempts: Object.assign({}, s.campaign.attempts), fails: Object.assign({}, s.campaign.fails), boosters: Object.assign({}, s.boosters)
  });
  const before = prog(g.save);
  const savedBefore = read();
  // Campaign: the state the first-clear rules start from (endCampaignMission():
  // completed + reward coins on a first clear, +xpMissionSuccess XP with its
  // level-ups, star bits, star chests).
  const missionId = scenario === 'arena' ? null : (scenario.slice(9) || 'M01');
  const popcount = (n) => { let k = 0; for (n = n >>> 0; n; n &= n - 1) k++; return k; };
  const pre = missionId && {
    completed: !!g.save.campaign.completed[missionId], attempts: g.save.campaign.attempts[missionId] || 0,
    starsBits: g.save.campaign.stars[missionId] || 0, coins: g.save.coins, prisms: g.save.prisms || 0,
    xp: g.save.player.xp, level: g.save.player.level, starTotal: g.totalStars(), starChests: g.save.campaign.starChests,
    unlocked: g.save.campaign.unlockedDistricts.slice()
  };
  window.__qaSeedRandom(seed);
  const samples = [];
  const swallowing = new Map();
  let eats = 0;
  const countEats = () => {
    const list = g.mode === 'campaign' ? g.campaignEntities : g.objects;
    for (const o of list) {
      const now = !!(o.eating && o.eater === g.player);
      if (now && !swallowing.get(o)) eats++;
      swallowing.set(o, now);
    }
  };
  const holes = () => [g.player, ...g.bots].map(h => [h.x, h.y, h.radius, h.score || 0]);
  const onFrame = (f) => {
    countEats();
    if (f % (scenario === 'arena' ? ${SAMPLE_EVERY.arena} : ${SAMPLE_EVERY.campaign}) !== 0) return;
    const p = g.player;
    const s = { f, mode: g.mode, state: g.state, x: p.x, y: p.y, r: p.radius, score: p.score || 0, eats, rnd: window.__qaRandomCalls, holes: holes() };
    if (g.mode === 'campaign') {
      const m = g.mission;
      s.elapsed = m.elapsed;
      s.goals = g.campaignGoalItems().map(it => [it.label, it.progress, it.target]);
      s.entities = g.campaignEntities.filter(e => !e.consumed).length;
    } else {
      s.timeRemaining = g.timeRemaining;
      s.objects = g.objects.length;
      s.rivalsEaten = g.rivalsEatenThisRun;
    }
    samples.push(s);
  };
  let result;
  if (scenario === 'arena') result = window.__qaPlayArena({ style: 'greedy', round: { seed: seed % 100000 }, clock0: ${CLOCK0}, onFrame });
  else result = window.__qaPlayMission(missionId, { style: 'expert', clock0: ${CLOCK0}, onFrame });
  const savedAfter = read();
  let firstClear = null;
  if (missionId) {
    // What a first clear must leave, computed from the rules' constants (not
    // from the game's result): reward coins, XP with level-ups, star chests.
    const def = campaignMissionById(missionId), P = CONFIG.progression, S = CONFIG.stars;
    const bits = result.success ? (result.stars || 0) : 0;
    let coins = pre.coins + (pre.completed ? 0 : def.reward.coins), prisms = pre.prisms, xp = pre.xp + P.xpMissionSuccess, level = pre.level;
    while (xp >= P.xpForLevel(level)) { xp -= P.xpForLevel(level); level++; coins += P.levelCoins(level); if (level % P.levelPrismsEvery === 0) prisms += P.levelPrisms; }
    const starTotal = pre.starTotal + popcount(bits & ~pre.starsBits);
    let chests = pre.starChests;
    while (chests < Math.floor(starTotal / S.chestEvery)) { chests++; coins += S.chest.coins; prisms += S.chest.prisms; }
    const unlocked = pre.unlocked.slice();
    if (def.reward.unlockDistrict && !unlocked.includes(def.reward.unlockDistrict)) unlocked.push(def.reward.unlockDistrict);
    const view = (s) => s && ({
      completed: !!s.campaign.completed[missionId], attempts: s.campaign.attempts[missionId] || 0, starsBits: s.campaign.stars[missionId] || 0,
      fails: s.campaign.fails[missionId] || 0, coins: s.coins, prisms: s.prisms || 0, xp: s.player.xp, level: s.player.level,
      starChests: s.campaign.starChests, unlocked: s.campaign.unlockedDistricts.slice()
    });
    let disk = null; try { disk = JSON.parse(savedAfter); } catch (e) { /* null: fails the disk checks */ }
    firstClear = {
      missionId, reward: def.reward, pre,
      expected: { completed: true, attempts: pre.attempts + 1, starsBits: pre.starsBits | bits, fails: 0, coins, prisms, xp, level, starChests: chests, unlocked },
      memory: view(g.save), disk: view(disk)
    };
  }
  const out = {
    samples, eats, randomCalls: window.__qaRandomCalls, result,
    final: { mode: g.mode, state: g.state, before, after: prog(g.save), firstClear },
    saveRaw: savedAfter, saveChanged: savedAfter !== savedBefore
  };
  window.__qaRestoreRandom();
  return out;
};
`;

async function sha256Hex(text) {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(text == null ? '' : text).digest('hex');
}

/** One scenario in a fresh browser profile with a synthetic save. */
export async function traceScenario(url, scenario, seed) {
  const init = QA_RANDOM + frozenDateScript(FROZEN_AT) + `window.__qaSeedRandom(${seed});`;
  const g = await openGame(url, { initScript: init, viewport: { width: 420, height: 860 } });
  try {
    // veteranSave() reads `missions` as `o.missions || 6`, so 0 would still
    // mean 6 cleared missions (trace v1 fell into that). Arena: 6 on purpose
    // (a profile that has played both modes). Campaign: no campaign progress
    // at all -- the campaign block is a fresh defaultSave() one, so the
    // scenario is the mission's first clear.
    const save = await veteranSave(g.page, scenario === 'arena' ? { missions: 6, runsPlayed: 3, coins: 100 } : { missions: 6, runsPlayed: 0, coins: 100 });
    if (scenario !== 'arena') save.campaign = await g.page.evaluate(() => defaultSave().campaign);
    save.guestId = 'guest_qa_trace';
    save.displayName = 'QA';
    save.settings.music = false; save.settings.sfx = false; // see "Held fixed" above
    await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
    await g.page.reload();
    await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
    await g.page.addScriptTag({ content: scenario === 'arena' ? ARENA_BOT : CAMPAIGN_BOT });
    await g.page.addScriptTag({ content: TRACE_PAGE });
    const run = await g.page.evaluate(([sc, sd]) => window.__qaTraceRun(sc, sd), [scenario, seed]);
    const perf = {};
    for (const k of PERF_FIELDS) { if (run.result && k in run.result) { perf[k] = run.result[k]; delete run.result[k]; } }
    let save1 = null;
    try { save1 = JSON.parse(run.saveRaw); } catch (e) { /* compared as raw below */ }
    return {
      scenario, seed, samples: run.samples, eats: run.eats, randomCalls: run.randomCalls, result: run.result, final: run.final,
      save: { changed: run.saveChanged, sha256: await sha256Hex(run.saveRaw), schemaVersion: save1 && save1.schemaVersion, data: save1 },
      perf, errors: g.errors.slice()
    };
  } finally {
    await g.browser.close();
  }
}

/** First difference between two values: { path, a, b } or null. */
export function firstDiff(a, b, at = '') {
  if (Object.is(a, b)) return null;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return { path: at || '(root)', a, b };
  if (Array.isArray(a) !== Array.isArray(b)) return { path: at, a: 'array:' + Array.isArray(a), b: 'array:' + Array.isArray(b) };
  if (Array.isArray(a)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const tag = a[i] && typeof a[i] === 'object' && 'f' in a[i] ? `[${i}](frame ${a[i].f})` : `[${i}]`;
      const d = firstDiff(a[i], b[i], at + tag);
      if (d) return d;
    }
    return a.length === b.length ? null : { path: at + '.length', a: a.length, b: b.length };
  }
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  for (const k of keys) {
    if (!(k in a) || !(k in b)) return { path: at + '.' + k, a: k in a ? a[k] : '(missing)', b: k in b ? b[k] : '(missing)' };
    const d = firstDiff(a[k], b[k], at + '.' + k);
    if (d) return d;
  }
  return null;
}

/** What is compared: everything except the machine-speed fields (perf),
 *  the page errors (checked separately) and the run's environment. */
const comparable = (t) => ({ scenario: t.scenario, seed: t.seed, samples: t.samples, eats: t.eats, randomCalls: t.randomCalls, result: t.result, final: t.final, save: t.save });
const short = (v) => { const s = JSON.stringify(v); return s && s.length > 160 ? s.slice(0, 157) + '...' : s; };
export const describeDiff = (d) => d ? `first difference at ${d.path}: ${short(d.a)} vs ${short(d.b)}` : 'identical';

export async function runTraceChecks(url, { seed = TRACE_DEFAULT_SEED, only = null, mission = 'M01', record = null, compare = null } = {}) {
  const results = [];
  const campaign = 'campaign:' + mission;
  const scenarios = only === 'arena' ? ['arena'] : only === 'campaign' ? [campaign] : ['arena', campaign];
  const env = await environmentInfo();
  const traces = {};
  for (const sc of scenarios) {
    const t1 = await traceScenario(url, sc, seed);
    const t2 = await traceScenario(url, sc, seed);
    traces[sc] = t1;
    const d = firstDiff(comparable(t1), comparable(t2));
    const last = t1.samples[t1.samples.length - 1] || {};
    const summary = sc === 'arena'
      ? `seed ${seed}: ${t1.samples.length} samples, place ${t1.result.place}, score ${t1.result.score}, eats ${t1.eats}, draws ${t1.randomCalls}, save ${t1.save.sha256.slice(0, 12)}`
      : `seed ${seed}: ${t1.samples.length} samples, ${t1.result.success ? 'cleared' : 'failed ' + t1.result.fail} in ${t1.result.elapsed} s, eats ${t1.eats}, draws ${t1.randomCalls}, save ${t1.save.sha256.slice(0, 12)}`;
    results.push(report(`trace ${sc}: two independent runs with seed ${seed} are identical (samples, result, progression, save bytes)`, !d, d ? describeDiff(d) : summary));
    const played = sc === 'arena' ? t1.final.state === 'RESULTS' && t1.samples.length >= 100 && last.mode === 'arena'
      : t1.final.mode === 'campaign' && t1.samples.length >= 5 && t1.result.id === mission && typeof t1.result.success === 'boolean';
    const progressed = sc === 'arena' ? t1.final.after.runsPlayed === t1.final.before.runsPlayed + 1 && t1.save.changed
      : t1.final.after.attempts[mission] > (t1.final.before.attempts[mission] || 0) && t1.save.changed;
    results.push(report(`trace ${sc}: the scenario really played to its end and saved (not an empty trace)`, played && progressed && t1.eats > 0, JSON.stringify({ samples: t1.samples.length, state: t1.final.state, eats: t1.eats, saveChanged: t1.save.changed, before: sc === 'arena' ? t1.final.before.runsPlayed : t1.final.before.attempts, after: sc === 'arena' ? t1.final.after.runsPlayed : t1.final.after.attempts })));
    if (sc !== 'arena') {
      const fc = t1.final.firstClear || {}, pre = fc.pre || {}, exp = fc.expected || {}, mem = fc.memory || {}, disk = fc.disk || {};
      results.push(expectAll(`trace ${sc}: the FIRST clear on a synthetic profile -- not completed before, cleared by the bot, completed after; coins, prisms, XP, stars and the stored save follow the first-clear rules`, {
        notCompletedBefore: falsy(pre.completed), noAttemptsBefore: is(pre.attempts, 0), noStarsBefore: is(pre.starsBits, 0),
        botCleared: is(t1.result.success, true), clearStar: holds((mem.starsBits & 1) === 1, mem.starsBits, 'bit 1 (clear) set'),
        completedAfter: is(mem.completed, true), attempts: is(mem.attempts, exp.attempts), starsBits: is(mem.starsBits, exp.starsBits), fails: is(mem.fails, 0),
        coins: is(mem.coins, exp.coins), rewardPaid: holds(mem.coins - pre.coins >= ((fc.reward || {}).coins || 0), mem.coins - pre.coins, `>= reward ${(fc.reward || {}).coins}`),
        prisms: is(mem.prisms, exp.prisms), xp: is(mem.xp, exp.xp), level: is(mem.level, exp.level), starChests: is(mem.starChests, exp.starChests),
        unlockedDistricts: is(JSON.stringify(mem.unlocked), JSON.stringify(exp.unlocked)),
        saveWritten: truthy(t1.save.changed), diskSameAsMemory: is(JSON.stringify(disk), JSON.stringify(mem))
      }, JSON.stringify({ reward: fc.reward, pre, expected: exp, memory: mem })));
    }
    results.push(report(`trace ${sc}: no runtime errors`, t1.errors.length === 0 && t2.errors.length === 0, [...t1.errors, ...t2.errors].slice(0, 2).join(' | ')));
  }
  const file = { traceVersion: TRACE_VERSION, seed, normalized: PERF_FIELDS.map(f => 'result.' + f + ' (machine speed)'), env, traces };
  const dir = path.join(OUT, 'trace');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'last.json'), JSON.stringify(file, null, 1));
  if (record && results.every(r => r.ok)) {
    fs.writeFileSync(record, JSON.stringify(file, null, 1));
    console.log(`  recorded ${record} (HEAD ${env.head}, game.js ${(env.runtime['game.js'] || '').slice(0, 12)})`);
  } else if (record) console.log('  NOT recorded: the self-check failed');
  if (compare) {
    const base = JSON.parse(fs.readFileSync(compare, 'utf8'));
    for (const sc of scenarios) {
      const b = base.traces && base.traces[sc];
      if (!b || base.seed !== seed || base.traceVersion !== TRACE_VERSION) {
        results.push(report(`trace ${sc}: matches the baseline ${path.basename(compare)}`, false, `baseline has no comparable ${sc} trace (seed ${base.seed}, version ${base.traceVersion})`));
        continue;
      }
      const d = firstDiff(comparable(b), comparable(traces[sc]));
      results.push(report(`trace ${sc}: matches the baseline ${path.basename(compare)} (recorded at ${String(base.env && base.env.head).slice(0, 7)})`, !d, describeDiff(d)));
    }
  }
  return results;
}

if (isMain(import.meta.url)) {
  const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
  const seedArg = process.argv.find(a => /^--seed=\d+$/.test(a));
  const seed = seedArg ? Number(seedArg.slice(7)) : (process.env.VH_QA_SEED ? Number(process.env.VH_QA_SEED) : TRACE_DEFAULT_SEED);
  const onlyArg = process.argv.find(a => /^--only=(arena|campaign)$/.test(a));
  const missionArg = process.argv.find(a => /^--mission=M\d+$/.test(a));
  const { server, url } = await serve();
  const env = await environmentInfo();
  console.log(`env: node ${env.node} · playwright ${env.playwright} · chromium ${env.chromium} · HEAD ${env.head} (${env.worktreeChanges} changed paths) · seed ${seed}`);
  const res = await runTraceChecks(url, { seed, only: onlyArg ? onlyArg.slice(7) : null, mission: missionArg ? missionArg.slice(10) : 'M01', record: arg('--record'), compare: arg('--compare') });
  server.close();
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} trace checks passed`);
  process.exit(failed.length ? 1 : 0);
}

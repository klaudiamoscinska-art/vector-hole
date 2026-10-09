// v13 design/gameplay bot checks: the first seconds of a round, the race
// against the pacer rival, direct-drag steering, the tutorial, the newbie
// path into the first round, the shared Daily layout, locked-object
// feedback and gender-neutral copy. Usage: node qa/design.mjs
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, veteranSave, report, ARENA_BOT, ROOT, OUT } from './lib.mjs';

async function seeded(url, saveOpts = {}, mutate = null, opts = {}) {
  const g = await openGame(url, opts);
  const save = await veteranSave(g.page, saveOpts);
  if (mutate) mutate(save);
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.game.state);
  await g.page.addScriptTag({ content: ARENA_BOT });
  return g;
}

export async function runDesignChecks(url) {
  const results = [];
  const out = {};

  // --- First seconds + the race (casual "human" bot career) ----------------
  {
    const g = await seeded(url);
    const runs = [];
    for (let i = 0; i < 12; i++) runs.push(await g.page.evaluate(() => window.__qaPlayArena({ style: 'casual' })));
    out.casualCareer = runs;
    const avg = (k) => runs.reduce((a, r) => a + (r[k] ?? 9), 0) / runs.length;
    results.push(report('design: first bite in under 1 s (casual player, avg)', avg('firstEatSec') < 1, `avg ${avg('firstEatSec').toFixed(2)} s`));
    results.push(report('design: at least 12 bites in the first 10 s (casual, avg)', avg('eats10') >= 12, `avg ${avg('eats10').toFixed(1)}`));
    // A race, not a blowout: in most rounds the gap between the player and
    // the nearest rival is under half the winner's score.
    const close = runs.filter(r => r.gapToSecond < 0.5 * Math.max(r.score, r.score + (r.place > 1 ? r.gapToSecond : 0))).length;
    results.push(report('design: most casual rounds are a close race (gap < 50% of the winning score)', close >= runs.length * 0.6, `${close}/${runs.length} close · places ${runs.map(r => r.place).join(' ')}`));
    results.push(report('design: a casual newbie wins most of the first 3 rounds', runs.slice(0, 3).filter(r => r.place === 1).length >= 2, runs.slice(0, 3).map(r => '#' + r.place).join(' ')));
    const pacer = await g.page.evaluate(() => ({ par: window.game.parScore, recent: window.game.save.stats.recentArenaScores.length }));
    results.push(report('design: pacer par comes from the last finished rounds', pacer.recent === 5 && pacer.par > 0, JSON.stringify(pacer)));
    results.push(report('design: no runtime errors in the casual career', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // --- Steering: no self-driving at start, a held finger keeps steering ----
  {
    const g = await seeded(url, {}, null, { viewport: { width: 390, height: 844 } });
    const r = await g.page.evaluate(async () => {
      const gm = window.game;
      gm.save.settings.inputMode = 'legacy';
      gm.startRound({ seed: 4242 });
      const p0 = { x: gm.player.x, y: gm.player.y };
      await new Promise(res => setTimeout(res, 1200));
      const idle = Math.hypot(gm.player.x - p0.x, gm.player.y - p0.y);
      return { idle };
    });
    // Hold a finger 120 px right of the hole without moving it.
    const box = await g.page.evaluate(() => ({ x: window.game.width / 2, y: window.game.height / 2 }));
    const p1 = await g.page.evaluate(() => ({ x: window.game.player.x, y: window.game.player.y }));
    await g.page.touchscreen.tap(box.x + 120, box.y).catch(() => {});
    await g.page.evaluate((b) => {
      const c = document.getElementById('gameCanvas') || document.querySelector('canvas');
      const t = new Touch({ identifier: 7, target: c, clientX: b.x + 120, clientY: b.y });
      c.dispatchEvent(new TouchEvent('touchstart', { touches: [t], changedTouches: [t], bubbles: true, cancelable: true }));
    }, box);
    await g.page.waitForTimeout(1500);
    const held = await g.page.evaluate((p) => Math.hypot(window.game.player.x - p.x, window.game.player.y - p.y), p1);
    await g.page.evaluate(() => {
      const c = document.getElementById('gameCanvas') || document.querySelector('canvas');
      c.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [], bubbles: true, cancelable: true }));
    });
    const p2 = await g.page.evaluate(() => ({ x: window.game.player.x, y: window.game.player.y }));
    await g.page.waitForTimeout(600);
    const after = await g.page.evaluate((p) => Math.hypot(window.game.player.x - p.x, window.game.player.y - p.y), p2);
    results.push(report('input: the hole does not drive itself before the first touch', r.idle < 1, `moved ${r.idle.toFixed(1)} px`));
    results.push(report('input: a finger held still keeps the hole moving', held > 150, `moved ${held.toFixed(0)} px in 1.5 s`));
    results.push(report('input: lifting the finger stops the hole', after < 1, `drift ${after.toFixed(1)} px`));
    await g.browser.close();
  }

  // --- Tutorial: untimed, one step at a time, early later-step = no freeze --
  {
    const g = await openGame(url);
    const t = await g.page.evaluate(() => {
      const gm = window.game;
      gm.startCampaignMission('M00');
      const res = { introAtStart: gm.introPending, rows: gm.campaignGoalItems().length, timer: document.getElementById('missionTimerValue').textContent };
      gm.dismissTutorialIntro();
      cancelAnimationFrame(gm.rafId); gm.running = false;
      const ring = gm.campaignEntities.filter(e => e.type === 'fragment' && Math.hypot(e.x - gm.player.x, e.y - gm.player.y) < 200).length;
      // A vehicle eaten before the 6 fragments (out of order).
      gm.mission.eatenByType.vehicle = 1;
      gm.updateTutorialGuidance();
      res.freezeOnEarlyStep = gm.introPending;
      // Way past the 90 s "limit".
      gm.mission.elapsed = 400;
      gm.updateCampaign(0.016);
      res.ended = gm.mission.ended; res.revive = !document.getElementById('reviveOverlay').classList.contains('hidden');
      res.ring = ring;
      // Current step done -> the next step's window.
      gm.mission.eatenByType.fragment = 6; gm.updateTutorialGuidance();
      res.nextIntro = gm.introPending; res.rowsAfter = gm.campaignGoalItems().length;
      return res;
    });
    results.push(report('tutorial: opens on step 1 only (one goal row)', t.introAtStart && t.rows === 1, JSON.stringify(t)));
    results.push(report('tutorial: food around the start (>= 5 fragments within 200 px)', t.ring >= 5, `${t.ring}`));
    results.push(report('tutorial: untimed — no fail and no revive ad past 90 s', !t.ended && !t.revive && t.timer === '∞'));
    results.push(report('tutorial: an early later step does not freeze the game', !t.freezeOnEarlyStep));
    results.push(report('tutorial: finishing the current step opens the next one', t.nextIntro && t.rowsAfter === 2));
    await g.browser.close();
  }

  // --- Newbie path: GRAJ 2:00 starts at once, no login calendar yet; no Rush Hour at t=0
  {
    const g = await seeded(url, { runsPlayed: 0 }, (s) => { s.login.lastClaimDate = null; });
    await g.page.waitForTimeout(1200);
    const loginShown = await g.page.evaluate(() => !document.getElementById('loginRewardScreen').classList.contains('hidden'));
    await g.page.evaluate(() => document.getElementById('btnStart').click());
    const st = await g.page.evaluate(() => ({ state: window.game.state, setup: !document.getElementById('runSetupScreen').classList.contains('hidden') }));
    const rush = await g.page.evaluate(() => {
      const gm = window.game; let n = 0;
      for (let seed = 1; seed <= 40; seed++) { gm.startRound({ seed }); if (gm.modifier !== 'none') n++; }
      gm.leaveRun && gm.leaveRun();
      return n;
    });
    results.push(report('newbie: no login calendar before the first finished round', !loginShown));
    results.push(report('newbie: GRAJ 2:00 starts the round straight away', st.state === 'PLAYING' && !st.setup, JSON.stringify(st)));
    results.push(report('newbie: no Rush Hour modifier in the easy ramp', rush === 0, `${rush}/40 seeds`));
    await g.browser.close();
  }

  // --- Daily preview = the real Daily layout (trails + feasts included) ---
  {
    const g = await seeded(url, { runsPlayed: 9 });
    const d = await g.page.evaluate(() => {
      const gm = window.game;
      const L = gm.computeDailyLayout();
      gm.startDailyChallenge();
      cancelAnimationFrame(gm.rafId); gm.running = false;
      const real = gm.objects.map(o => ({ tier: o.tier, x: Math.round(o.x), y: Math.round(o.y) }));
      const prev = L.objects.map(o => ({ tier: o.tier, x: Math.round(o.x), y: Math.round(o.y) }));
      const same = real.length === prev.length && real.every((o, i) => o.tier === prev[i].tier && o.x === prev[i].x && o.y === prev[i].y);
      const trails = gm.objects.filter(o => o.trail).length;
      return { same, n: real.length, spawn: Math.round(L.spawn.x) === Math.round(gm.player.x) && Math.round(L.spawn.y) === Math.round(gm.player.y), trails };
    });
    results.push(report('daily: map preview is exactly the round layout', d.same && d.spawn, JSON.stringify(d)));
    results.push(report('arena: street trails are laid', d.trails >= 40, `${d.trails} trail fragments`));
    await g.browser.close();
  }

  // --- Locked object: rolling over it explains why it can't be eaten ------
  {
    const g = await seeded(url);
    const lb = await g.page.evaluate(() => {
      const gm = window.game;
      gm.startRound({ seed: 77 }); cancelAnimationFrame(gm.rafId); gm.running = false;
      const car = gm.objects.find(o => o.tier === 'vehicle');
      car.x = gm.player.x; car.y = gm.player.y;
      gm.floatTexts = [];
      gm.update(1 / 30);
      return gm.floatTexts.map(f => f.text).join(' | ');
    });
    results.push(report('feedback: a too-big object says which size it needs', /ZA DUŻE/.test(lb), lb));
    await g.browser.close();
  }

  // --- Copy: the player is never addressed as female/male -----------------
  {
    const src = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const strings = (src.match(/'[^'\n]*'|`[^`\n]*`|>[^<\n]+</g) || []).join('\n');
    const bad = ['Urosłaś', 'urosłaś', 'większa od', 'Gotowa.', 'nietykalna', 'strażniczk', 'kuratork', 'Najszybsza', 'uruchomiłaś', 'będziesz gotowa', 'Złap go pierwsza', 'naprawdę duża']
      .filter(w => strings.includes(w));
    results.push(report('copy: gender-neutral player address', bad.length === 0, bad.join(', ')));
    const jargon = ['NEON GOD', 'BLACKOUT FINISH', 'PORTAL STORM', 'RUSH HOUR', 'NOWY PB'].filter(w => strings.includes(w));
    results.push(report('copy: no leftover English jargon in player-facing strings', jargon.length === 0, jargon.join(', ')));
  }

  fs.writeFileSync(path.join(OUT, 'design.json'), JSON.stringify(out, null, 2));
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { server, url } = await serve();
  const res = await runDesignChecks(url);
  server.close();
  console.log(`\n${res.filter(r => r.ok).length}/${res.length} design checks passed`);
  process.exit(res.every(r => r.ok) ? 0 : 1);
}

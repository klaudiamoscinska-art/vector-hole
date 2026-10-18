// v18 „Złoty strzał: ekonomia”: the booster loop as a monetization funnel
// and its balance.
//  - Sprint (+15% speed, 70 coins after two bot-balance passes) joins Zegar / Turbo start / Magnes / Tarcza;
//  - a defeat proposes the booster that answers it ("SPRÓBUJ Z: …"), the
//    briefing opens with it pre-picked and its price on GRAJ (POWTÓRZ =
//    without), never spending on the tap itself;
//  - short on coins in the briefing: one booster for a rewarded ad (3/day);
//  - the store sells boosters (Pakiet wzmocnień, Pakiet Startowy);
//  - balance: the casual bot on hard missions with and without each
//    booster -- every booster must clearly help, none may make EKSTREMALNA
//    trivial.
// Usage: node qa/v18.mjs [runs=3] [--seed=N]
//   E1: every balance attempt plays from its own seeded Math.random stream
//   (audio off in the bot profile -- see balancePage())
//   (seedFor(base, config, mission, k)); the base seed is new each run
//   (the suite samples fresh layouts as before) and is printed and written
//   to qa/out/v18-balance.json -- `--seed=N` / VH_QA_SEED=N replays a run.
//   Diagnostics (not the PASS criteria, which are unchanged):
//   node qa/v18.mjs --calibrate=K [runs]    the balance on K base seeds: how often each check passes
//   add --paired                            the same layouts for every booster (common random numbers)
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, CAMPAIGN_BOT, QA_RANDOM, allDistrictsSave, veteranSave, report, seedFor, baseSeed, environmentInfo, OUT } from './lib.mjs';

const BALANCE_CONFIGS = { none: [], time: ['time'], start: ['start'], sprint: ['sprint'], magnet: ['magnet'] };

/** The casual bot on the hard missions with each booster config. Each
 *  attempt reseeds Math.random inside its own page.evaluate. `paired`
 *  gives the same seed to the same (mission, k) under every config. */
async function playBalance(page, ids, runs, base, paired = false) {
  const table = {}, attempts = [];
  for (const [name, boosters] of Object.entries(BALANCE_CONFIGS)) {
    let wins = 0, n = 0, d5w = 0, d5n = 0;
    for (const id of ids) {
      for (let k = 0; k < runs; k++) {
        const seed = paired ? seedFor(base, 'v18', id, k) : seedFor(base, 'v18', name, id, k);
        const r = await page.evaluate(([mid, b, sd]) => {
          window.__qaSeedRandom(sd);
          try { return window.__qaPlayMission(mid, { style: 'casual', boosters: b, clock0: 1000000 }); } finally { window.__qaRestoreRandom(); }
        }, [id, boosters, seed]);
        attempts.push({ config: name, id, k, seed, success: r.success, elapsed: r.elapsed, fail: r.fail });
        n++; wins += r.success ? 1 : 0;
        if (r.diff === 5) { d5n++; d5w += r.success ? 1 : 0; }
      }
    }
    table[name] = { all: Math.round(wins / n * 100), d5: Math.round(d5w / d5n * 100) };
  }
  return { table, attempts };
}
const balanceVerdicts = (table) => {
  const lift = k => table[k].all - table.none.all;
  return {
    lift: { time: lift('time'), start: lift('start'), sprint: lift('sprint'), magnet: lift('magnet') },
    lifts: lift('time') >= 5 && lift('start') >= 5 && lift('sprint') >= 5 && (lift('time') + lift('start') + lift('sprint')) / 3 >= 8,
    d5: Object.entries(table).every(([, v]) => v.d5 <= 85),
    sprint: table.sprint.all <= table.time.all + 8
  };
};
async function balancePage(url) {
  const g = await openGame(url);
  const save = await allDistrictsSave(g.page);
  // E1: audio off for the bot profile. The music/SFX engine draws from the
  // same Math.random as the game, paced by the real-time AudioContext clock,
  // so with audio on a seeded attempt doesn't repeat (measured: 30/40
  // identical with audio, 40/40 without). Audio never touches the rules.
  save.settings.music = false; save.settings.sfx = false;
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.game.state);
  await g.page.addScriptTag({ content: CAMPAIGN_BOT });
  await g.page.addScriptTag({ content: QA_RANDOM });
  const ids = await g.page.evaluate(() => {
    const pick = d => CAMPAIGN_MISSIONS.filter(m => m.diff === d && !m.setup.fragile).filter((m, i) => i % 3 === 0).slice(0, 12).map(m => m.id);
    return [...pick(4), ...pick(5)];
  });
  return { ...g, ids };
}

async function seeded(url, mutate, opts = {}) {
  const g = await openGame(url, opts);
  const save = await veteranSave(g.page, { missions: 40, runsPlayed: 10, coins: 1000 });
  if (mutate) mutate(save);
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.game.state);
  await g.page.addScriptTag({ content: CAMPAIGN_BOT });
  return g;
}

export async function runV18Checks(url, runs = 3, { seed: base = baseSeed().seed, paired = false } = {}) {
  const results = [];

  // --- Sprint + five tiles + the gift for existing players -------------------
  {
    const g = await seeded(url, s => { s.boosters = { time: 1, start: 1, magnet: 1, shield: 1, gift: true }; });
    const r = await g.page.evaluate(() => {
      const gm = window.game;
      const giftOnce = gm.save.boosters.sprint === 1 && gm.save.boosters.sprintGift === true;
      gm.openMissionBriefing('M26');
      const tiles = document.querySelectorAll('#briefingCard .mc-boost').length;
      const sprintTile = !!document.querySelector('#briefingCard [data-booster="sprint"]');
      gm.toggleBriefingBooster('sprint');
      document.querySelector('[data-mc-launch]').click();
      const sp = gm.player.getSpeed();
      const used = gm.save.boosters.sprint;
      gm.leaveCampaignMission();
      gm.startCampaignMission('M26');
      const base = gm.player.getSpeed();
      gm.leaveCampaignMission();
      return { giftOnce, tiles, sprintTile, ratio: +(sp / base).toFixed(3), used };
    });
    results.push(report('Sprint: a 5th booster tile; existing booster owners get one Sprint as a gift (once)', r.tiles === 5 && r.sprintTile && r.giftOnce, JSON.stringify(r)));
    results.push(report('Sprint: the vortex is 15% faster for the whole mission (stock used first)', Math.abs(r.ratio - 1.15) < 0.01 && r.used === 0, JSON.stringify(r)));
    // Reload: the gift is not handed out again.
    await g.page.reload();
    await g.page.waitForFunction(() => window.game && window.game.state);
    const again = await g.page.evaluate(() => window.game.save.boosters.sprint);
    results.push(report('Sprint: the gift is not repeated on the next load', again === 0, String(again)));
    results.push(report('v18: no runtime errors (Sprint)', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // --- Defeat -> the booster that answers it, pre-picked in the briefing -----
  {
    const g = await seeded(url, s => { s.boosters = { time: 0, start: 0, magnet: 0, shield: 0, sprint: 0, gift: true, sprintGift: true }; s.coins = 1000; }, { viewport: { width: 375, height: 667 } });
    const cases = await g.page.evaluate(async () => {
      const gm = window.game, out = {};
      const lose = (id, reason, progress) => {
        gm.startCampaignMission(id); gm.beginMissionPlay();
        gm.campaignGoalFraction = () => progress;
        if (reason === 'time') { gm.mission.failReason = 'time'; gm.endCampaignMission(false); }
        else gm.failCampaignMission(reason);
        delete gm.campaignGoalFraction;
        const btn = document.getElementById('btnMissionNext');
        return { text: btn.innerText.replace(/\s+/g, ' '), retry: !document.getElementById('btnMissionRetry').classList.contains('hidden'), nela: document.getElementById('missionResultNela').textContent };
      };
      out.timeClose = lose('M33', 'time', 0.8);
      out.timeFar = lose('M33', 'time', 0.2);
      // The Złodziej race and a fragile vortex (find such missions).
      const racer = CAMPAIGN_MISSIONS.find(m => m.setup.racer);
      const fragile = CAMPAIGN_MISSIONS.find(m => m.setup.fragile);
      out.racer = racer ? lose(racer.id, 'racer', 0.5) : null;
      out.hit = fragile ? lose(fragile.id, 'hit', 0.5) : null;
      // The button opens the briefing with the booster picked, price on GRAJ.
      lose('M33', 'time', 0.8);
      const c0 = gm.save.coins;
      document.getElementById('btnMissionNext').click();
      out.briefing = { open: !document.getElementById('missionBriefing').classList.contains('hidden'), picked: [...(gm.briefingBoosters || [])], grajs: document.querySelector('[data-mc-launch]').innerText.replace(/\s+/g, ' '), coinsSame: gm.save.coins === c0, stock: gm.save.boosters.time || 0 };
      gm.closeMissionBriefing();
      // Before boosters unlock: no suggestion, plain SPRÓBUJ PONOWNIE.
      gm.save.campaign.completed[CONFIG.boosters.unlockMission] = false;
      out.locked = lose('M02', 'time', 0.3);
      gm.save.campaign.completed[CONFIG.boosters.unlockMission] = true;
      return out;
    });
    results.push(report('defeat: out of time close to the goal → "SPRÓBUJ Z: ZEGAR" (+ price), POWTÓRZ stays', /SPRÓBUJ Z: ZEGAR/.test(cases.timeClose.text) && /60 ◇/.test(cases.timeClose.text) && cases.timeClose.retry, JSON.stringify(cases.timeClose)));
    results.push(report('defeat: out of time far from the goal → Turbo start', /SPRÓBUJ Z: TURBO START/.test(cases.timeFar.text), cases.timeFar.text));
    results.push(report('defeat: lost the race → Sprint; cracked vortex → Tarcza', (!cases.racer || /SPRINT/.test(cases.racer.text)) && (!cases.hit || /TARCZA/.test(cases.hit.text)), JSON.stringify({ racer: cases.racer && cases.racer.text, hit: cases.hit && cases.hit.text })));
    results.push(report('defeat: the retry opens the briefing with the booster picked and its price on GRAJ -- nothing spent yet', cases.briefing.open && cases.briefing.picked.length === 1 && (/−\d+ ◇/.test(cases.briefing.grajs) || cases.briefing.stock > 0) && cases.briefing.coinsSame, JSON.stringify(cases.briefing)));
    results.push(report('defeat: before boosters unlock the plain SPRÓBUJ PONOWNIE stays', /SPRÓBUJ PONOWNIE/.test(cases.locked.text), cases.locked.text));
    const lay = await g.page.evaluate(() => {
      const gm = window.game;
      gm.startCampaignMission('M33'); gm.beginMissionPlay(); gm.failCampaignMission('hit');
      const r = document.getElementById('btnMissionNext').getBoundingClientRect();
      return { bottom: Math.round(r.bottom), h: innerHeight, lines: Math.round(r.height) };
    });
    results.push(report('layout 375×667: the "SPRÓBUJ Z" button is on screen', lay.bottom <= lay.h, JSON.stringify(lay)));
    results.push(report('v18: no runtime errors (defeat)', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // --- Short on coins: a booster for a rewarded ad (capped) ------------------
  {
    const g = await seeded(url, s => { s.boosters = { time: 0, start: 0, magnet: 0, shield: 0, sprint: 0, gift: true, sprintGift: true }; s.coins = 10; });
    await g.page.evaluate(() => { CONFIG.ads.demoSeconds = 0.05; });
    const ad = await g.page.evaluate(async () => {
      const gm = window.game;
      gm.openMissionBriefing('M33', { preselect: ['time'] });
      const btn = document.querySelector('[data-booster-ad]');
      const label = btn && btn.textContent;
      btn.click();
      const wait = ms => new Promise(r => setTimeout(r, ms));
      for (let i = 0; i < 40 && !(gm.save.boosters.time > 0); i++) {
        await wait(150);
        const skip = document.querySelector('#adOverlay:not(.hidden) button:not([disabled])');
        if (skip && /ODBIERZ|ZAMKNIJ|DALEJ|GOTOWE/i.test(skip.textContent)) skip.click();
      }
      const stock = gm.save.boosters.time;
      const grajs = document.querySelector('[data-mc-launch]').innerText.replace(/\s+/g, ' ');
      const picked = [...gm.briefingBoosters];
      return { label, stock, grajs, picked, left: gm.monetization.placementLeft('booster_ad'), coins: gm.save.coins };
    });
    results.push(report('briefing: short on coins → "▶ Zegar za reklamę"; the ad puts it in stock, still picked, GRAJ now free of coins', /Zegar za reklamę/.test(ad.label || '') && ad.stock === 1 && ad.picked.includes('time') && !/−\d+ ◇/.test(ad.grajs) && ad.coins === 10, JSON.stringify(ad)));
    results.push(report('briefing: the booster ad is capped (3 a day)', ad.left === 2, String(ad.left)));
    results.push(report('v18: no runtime errors (booster ad)', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // --- Store: boosters in the packs -----------------------------------------
  {
    const g = await seeded(url, s => { s.boosters = { time: 0, start: 0, magnet: 0, shield: 0, sprint: 0, gift: true, sprintGift: true }; });
    const iap = await g.page.evaluate(() => {
      const gm = window.game;
      gm.grantProduct(IAP_PRODUCTS.find(p => p.sku === 'booster_pack'));
      const afterPack = { ...gm.save.boosters };
      gm.grantProduct(IAP_PRODUCTS.find(p => p.sku === 'starter_pack'));
      return { afterPack, afterStarter: { ...gm.save.boosters }, starterDesc: IAP_PRODUCTS.find(p => p.sku === 'starter_pack').desc };
    });
    const each = (o, n) => ['time', 'start', 'magnet', 'shield', 'sprint'].every(k => o[k] === n);
    results.push(report('store: Pakiet wzmocnień gives 5 of every booster; Pakiet Startowy adds 3 of each (and says so)', each(iap.afterPack, 5) && each(iap.afterStarter, 8) && /3× każde wzmocnienie/.test(iap.starterDesc), JSON.stringify(iap)));
    await g.browser.close();
  }

  // --- Start card's back link (owner: "Zmień wzmocnienia" was a huge
  // spaced-out label and opened a briefing with no boosters on M04) -------
  for (const [label, missions, id] of [['before the unlock', 4, null], ['after the unlock', 40, 'M26']]) {
    const g = await openGame(url, { viewport: { width: 402, height: 874 } });
    const save = await veteranSave(g.page, { missions, runsPlayed: 10, coins: 1000 });
    save.boosters = { time: 2, start: 0, magnet: 0, shield: 0, sprint: 0, gift: true, sprintGift: true };
    await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
    await g.page.reload();
    await g.page.waitForFunction(() => window.game && window.game.state);
    const r = await g.page.evaluate(async (id) => {
      const gm = window.game;
      gm.openMissionBriefing(id || gm.nextCampaignMissionId());
      if (gm.boostersUnlocked()) gm.toggleBriefingBooster('time');
      document.querySelector('[data-mc-launch]').click();
      await new Promise(res => setTimeout(res, 400));
      const back = document.getElementById('btnMissionBack'), go = document.getElementById('btnMissionGo');
      const cs = getComputedStyle(back), b = back.getBoundingClientRect(), gb = go.getBoundingClientRect();
      const look = { text: back.textContent.trim(), font: parseFloat(cs.fontSize), spacing: parseFloat(cs.letterSpacing) || 0, w: Math.round(b.width), goW: Math.round(gb.width), h: Math.round(b.height) };
      back.click();
      await new Promise(res => setTimeout(res, 300));
      const sheet = document.getElementById('missionBriefing');
      const briefing = !sheet.classList.contains('hidden');
      return { unlocked: gm.boostersUnlocked(), ...look, briefing, tiles: sheet.querySelectorAll('#briefingCard [data-booster]').length,
        kept: !!sheet.querySelector('#briefingCard [data-booster="time"].selected'), stock: gm.save.boosters.time, screen: !document.getElementById('campaignScreen').classList.contains('hidden') };
    }, id);
    const small = r.font <= 14 && r.spacing <= 1 && r.w < r.goW * 0.7 && r.h >= 32;
    const ok = r.unlocked
      ? r.text === 'Zmień wzmocnienia' && r.briefing && r.tiles > 0 && r.kept && r.stock === 2
      : r.text === 'Wróć do mapy' && !r.briefing && r.screen;
    results.push(report(`start card ${label}: the back link is a small pill under START, not a second big button`, small, JSON.stringify(r)));
    results.push(report(`start card ${label}: ${r.unlocked ? '"Zmień wzmocnienia" reopens the briefing with the boosters (picks kept, stock refunded)' : 'no boosters yet -- "Wróć do mapy" goes back to the map'}`, ok && g.errors.length === 0, JSON.stringify(r) + g.errors.slice(0, 1).join('')));
    await g.browser.close();
  }

  // --- Balance: does each booster earn its price on hard missions? ----------
  {
    const { browser, page, errors, ids } = await balancePage(url);
    const { table, attempts } = await playBalance(page, ids, runs, base, paired);
    const seedNote = ` · seed ${base}${paired ? ' (paired diagnostic)' : ''}`;
    fs.writeFileSync(path.join(OUT, 'v18-balance.json'), JSON.stringify({ seed: base, paired, runs, ids, table, attempts }, null, 1));
    console.log(`\n  v18 balance seed ${base}${paired ? ' (paired)' : ''} -- replay: VH_QA_SEED=${base} node qa/v18.mjs ${runs}`);
    console.log('\n  booster   hard (d4+d5)   EKSTREMALNA (d5)   — casual bot, ' + ids.length + ' missions × ' + runs);
    for (const [k, v] of Object.entries(table)) console.log(`  ${k.padEnd(8)}  ${String(v.all).padStart(3)}%          ${String(v.d5).padStart(3)}%`);
    const lift = k => table[k].all - table.none.all;
    // ~50 attempts per booster: ±7 points of noise, so each must clearly
    // help (≥ 5) and the three main ones together by ≥ 8 on average.
    results.push(report('balance: Zegar, Turbo start and Sprint each lift the casual pass rate on hard missions (each ≥ 5, mean ≥ 8 points)', lift('time') >= 5 && lift('start') >= 5 && lift('sprint') >= 5 && (lift('time') + lift('start') + lift('sprint')) / 3 >= 8, JSON.stringify(table) + seedNote));
    results.push(report('balance: no single booster makes EKSTREMALNA a sure thing (casual ≤ 85% at d5)', Object.entries(table).every(([, v]) => v.d5 <= 85), JSON.stringify(table) + seedNote));
    results.push(report('balance: Sprint is not a must-buy (no better than Zegar + 8 points overall)', table.sprint.all <= table.time.all + 8, JSON.stringify({ sprint: table.sprint, time: table.time }) + seedNote));
    results.push(report('v18: no runtime errors (balance)', errors.length === 0, errors.slice(0, 2).join(' | ')));
    await browser.close();
  }

  return results;
}

/** Diagnostic, not a gate: the balance block on `k` base seeds, how often
 *  each check would pass, and the lift per booster per seed. */
export async function calibrateV18Balance(url, k, runs = 3, { first = baseSeed().seed, paired = false } = {}) {
  const { browser, ids, page } = await balancePage(url);
  const rows = [];
  for (let i = 0; i < k; i++) {
    const base = (first + i) >>> 0;
    const { table } = await playBalance(page, ids, runs, base, paired);
    const v = balanceVerdicts(table);
    rows.push({ seed: base, table, ...v });
    console.log(`  seed ${base}: none ${table.none.all}% · lift time ${v.lift.time} start ${v.lift.start} sprint ${v.lift.sprint} magnet ${v.lift.magnet} · lifts ${v.lifts ? 'PASS' : 'FAIL'} · d5 ${v.d5 ? 'PASS' : 'FAIL'} · sprint ${v.sprint ? 'PASS' : 'FAIL'}`);
  }
  await browser.close();
  const rate = key => rows.filter(r => r[key]).length + '/' + rows.length;
  const mean = key => +(rows.reduce((a, r) => a + r.lift[key], 0) / rows.length).toFixed(1);
  const out = { first, k, runs, paired, ids, rows, passRate: { lifts: rate('lifts'), d5: rate('d5'), sprint: rate('sprint') }, meanLift: { time: mean('time'), start: mean('start'), sprint: mean('sprint'), magnet: mean('magnet') } };
  fs.writeFileSync(path.join(OUT, `v18-calibration${paired ? '-paired' : ''}.json`), JSON.stringify(out, null, 1));
  console.log(`\n  pass rate over ${k} seeds${paired ? ' (paired)' : ''}: lifts ${out.passRate.lifts} · d5 ${out.passRate.d5} · sprint ${out.passRate.sprint} · mean lift ${JSON.stringify(out.meanLift)}`);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { server, url } = await serve();
  const env = await environmentInfo();
  const num = process.argv.slice(2).find(a => /^\d+$/.test(a));
  const cal = process.argv.find(a => /^--calibrate=\d+$/.test(a));
  const paired = process.argv.includes('--paired');
  const { seed, fixed } = baseSeed();
  console.log(`env: node ${env.node} · playwright ${env.playwright} · chromium ${env.chromium} · HEAD ${env.head} (${env.worktreeChanges} changed paths) · base seed ${seed}${fixed ? ' (given)' : ' (new)'}`);
  if (cal) { await calibrateV18Balance(url, Number(cal.slice(12)), +(num || 3), { first: seed, paired }); server.close(); process.exit(0); }
  const res = await runV18Checks(url, +(num || 3), { seed, paired });
  server.close();
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} v18 checks passed`);
  process.exit(failed.length ? 1 : 0);
}

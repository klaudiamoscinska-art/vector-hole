// VISUAL-1 -- the city, the districts and the Warsztat show progress.
//  - V1-1: Miasto's Core City canvas draws the stage of the SAVED level --
//    an existing save opens on its city as it stands (stage = coreLevel,
//    no reveal), LVL 1 / 3 / 6 look clearly different (lit pixels grow).
//  - V1-2: a level reached in the session plays the stage's reveal once,
//    under the headline; reduced motion keeps only the banner.
//  - V1-3: the Core City roadmap shows every level's city (a thumbnail)
//    and what that level adds.
//  - V1-4: Dzielnice opens on the district played now (TERAZ), marks the
//    one its boss opens (NASTĘPNA); a district opened since the last visit
//    pops once.
//  - V1-5: Warsztat cards say worn / owned / affordable / out of reach /
//    reward; putting an item on or buying it bursts (prices, owned lists
//    and the purchase flow unchanged).
//  - V1-6: a round that levels Core City says so on its result (LVL chip +
//    the new stage); one that doesn't, doesn't.
//  - V1-7: looking never writes: the stored save is byte-identical after
//    every screen above; schemaVersion stays 13.
//  - V1-8: drawing the LVL 6 city stays cheap (ms per frame, phone).
// Usage: node qa/visual1.mjs
import { serve, openGame, veteranSave, report, isMain, ARENA_BOT } from './lib.mjs';

async function boot(url, overrides, patch, opts = {}) {
  const g = await openGame(url, { viewport: opts.viewport || { width: 390, height: 844 }, ...opts });
  const save = await veteranSave(g.page, overrides);
  if (patch) patch(save);
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
  return g;
}

const CITY_STATE = () => {
  const cv = document.getElementById('hubCityCanvas');
  const pitch = document.querySelector('#hubHeroStage .hub-city-pitch');
  const ctx = cv.getContext('2d');
  const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
  let lit = 0;
  for (let i = 0; i < d.length; i += 16) if (d[i] + d[i + 1] + d[i + 2] > 300) lit++;
  return { stage: cv.__skyline && cv.__skyline.stage, reveal: cv.__reveal || 0, skyTop: cv.__skyline && cv.__skyline.skyTop,
    skyline: cv.__skyline && cv.__skyline.top, textBottom: pitch.offsetTop + pitch.offsetHeight - cv.offsetTop, lit: lit / (d.length / 16) };
};

export async function runVisual1Checks(url) {
  const out = [];
  const push = (name, ok, details) => out.push(report(name, ok, details));

  // V1-1 / V1-7: three saves, three cities; nothing written by looking.
  const stages = {};
  for (const [lv, ch] of [[1, 20], [3, 50], [6, 30]]) {
    const g = await boot(url, { coins: 900, runsPlayed: 12, missions: 12 }, (s) => { s.hub.coreLevel = lv; s.hub.coreCharge = ch; });
    const stored0 = await g.page.evaluate(() => localStorage.getItem('vectorHoleSave_v1'));
    await g.page.waitForTimeout(1200);
    stages[lv] = await g.page.evaluate(CITY_STATE);
    await g.page.evaluate(() => window.game.openCoreCityRoadmap());
    await g.page.waitForTimeout(200);
    const road = await g.page.evaluate(() => [...document.querySelectorAll('#infoSheet .info-roadmap-row')].map(r => {
      const cv = r.querySelector('canvas.info-roadmap-city');
      let lit = 0;
      if (cv && cv.width) { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 300) lit++; }
      return { level: r.querySelector('.info-roadmap-level').textContent, drawn: !!cv && cv.width > 0, stage: cv && cv.__skyline && cv.__skyline.stage, lit };
    }));
    await g.page.evaluate(() => window.game.closeInfoSheet());
    if (lv === 1) {
      push('V1-3 roadmap: LVL 2-6 each show a drawn thumbnail of that level\'s city and name what it adds', road.length === 5 && road.every((r, i) => r.drawn && r.stage === i + 2 && r.lit > 0 && /LVL \d · \S/.test(r.level)), JSON.stringify(road));
    }
    for (const fn of [() => window.game.openCampaignScreen(), () => window.game.openWarsztatScreen(), () => window.game.showScreen('mainMenu')]) { await g.page.evaluate(fn); await g.page.waitForTimeout(250); }
    const stored1 = await g.page.evaluate(() => localStorage.getItem('vectorHoleSave_v1'));
    const schema = await g.page.evaluate(() => JSON.parse(localStorage.getItem('vectorHoleSave_v1')).schemaVersion);
    push(`V1-7 LVL ${lv}: Miasto, the roadmap, Dzielnice and Warsztat only look -- the stored save is unchanged, schemaVersion 13`, stored0 === stored1 && schema === 13, `same=${stored0 === stored1} schema=${schema}`);
    push(`V1-1 LVL ${lv}: an existing save opens on its own city stage at once (no reveal on load)`, stages[lv].stage === lv && stages[lv].reveal === 0, JSON.stringify(stages[lv]));
    push(`V1-1 LVL ${lv}: nothing rises over the headline`, stages[lv].skyline >= stages[lv].textBottom - 2, JSON.stringify(stages[lv]));
    push(`V1-1 LVL ${lv}: no runtime errors`, g.errors.length === 0, g.errors.slice(0, 2).join(' | '));
    await g.browser.close();
  }
  push('V1-1 three clearly different cities: lit share LVL 1 < LVL 3 < LVL 6, LVL 6 at least twice LVL 1', stages[1].lit < stages[3].lit && stages[3].lit < stages[6].lit && stages[6].lit >= 2 * stages[1].lit, JSON.stringify({ 1: stages[1].lit.toFixed(4), 3: stages[3].lit.toFixed(4), 6: stages[6].lit.toFixed(4) }));

  // V1-2 / V1-6: a round that crosses 100 % -- the result says LVL 3 and the
  // stage; back in Miasto the reveal plays once, under the headline.
  for (const reduced of [false, true]) {
    const g = await boot(url, { coins: 900, runsPlayed: 12, missions: 12 }, (s) => { s.hub.coreLevel = 2; s.hub.coreCharge = 95; });
    if (reduced) await g.page.emulateMedia({ reducedMotion: 'reduce' });
    await g.page.waitForTimeout(500);
    await g.page.addScriptTag({ content: ARENA_BOT });
    await g.page.evaluate(() => window.__qaPlayArena({ round: { seed: 4242 } }));
    await g.page.waitForTimeout(900);
    const res = await g.page.evaluate(() => ({ level: window.game.save.hub.coreLevel, chip: document.getElementById('resultCoreLvl').classList.contains('hidden') ? null : document.getElementById('resultCoreLvl').textContent, stage: document.getElementById('resultCoreStage').classList.contains('hidden') ? null : document.getElementById('resultCoreStage').textContent }));
    if (!reduced) push('V1-6 result: a round that reaches Core City LVL 3 shows the LVL chip and the new city stage', res.level === 3 && res.chip === 'LVL 3' && /Nowy etap miasta: Neonowe szyldy/.test(res.stage || ''), JSON.stringify(res));
    await g.page.evaluate(() => { const gm = window.game; gm.unlockQueue = []; document.getElementById('unlockOverlay').classList.add('hidden'); gm.showScreen('mainMenu'); });
    let seen = 0, under = true, max = 0;
    for (let i = 0; i < 14; i++) {
      await g.page.waitForTimeout(250);
      const c = await g.page.evaluate(CITY_STATE);
      if (c.reveal) { seen++; max = Math.max(max, c.reveal); if (c.skyTop < c.textBottom) under = false; }
    }
    await g.page.waitForTimeout(800);
    const after = await g.page.evaluate(CITY_STATE);
    push(`V1-2 ${reduced ? 'reduced motion' : 'Miasto'}: the level reached plays the LVL 3 stage reveal under the headline, then ends`, seen >= 3 && max === 3 && under && after.reveal === 0 && after.stage === 3, JSON.stringify({ seen, max, under, after: after.reveal }));
    // ...and only once: reopening Miasto does not replay it.
    await g.page.evaluate(() => { window.game.openCampaignScreen(); });
    await g.page.waitForTimeout(200);
    await g.page.evaluate(() => { window.game.showScreen('mainMenu'); });
    await g.page.waitForTimeout(600);
    const again = await g.page.evaluate(CITY_STATE);
    if (!reduced) push('V1-2 the reveal plays once -- back to Miasto later, the city just stands', again.reveal === 0 && again.stage === 3, JSON.stringify(again));
    push(`V1-2 ${reduced ? 'reduced motion' : 'reveal'}: no runtime errors`, g.errors.length === 0, g.errors.slice(0, 2).join(' | '));
    await g.browser.close();
  }
  {
    const g = await boot(url, { coins: 900, runsPlayed: 12, missions: 12 }, (s) => { s.hub.coreLevel = 2; s.hub.coreCharge = 40; });
    await g.page.addScriptTag({ content: ARENA_BOT });
    await g.page.evaluate(() => window.__qaPlayArena({ round: { seed: 4242 } }));
    await g.page.waitForTimeout(700);
    const res = await g.page.evaluate(() => ({ level: window.game.save.hub.coreLevel, chipHidden: document.getElementById('resultCoreLvl').classList.contains('hidden'), stageHidden: document.getElementById('resultCoreStage').classList.contains('hidden'), leveled: document.querySelector('#gameOverScreen .result-core-card').classList.contains('leveled') }));
    push('V1-6 result: a round that does not level Core City shows no LVL chip and no stage line', res.level === 2 && res.chipHidden && res.stageHidden && !res.leveled, JSON.stringify(res));
    await g.browser.close();
  }

  // V1-4: Dzielnice -- TERAZ / NASTĘPNA, opens on the current district, a
  // freshly opened district pops once.
  {
    const g = await boot(url, { coins: 600, runsPlayed: 10, missions: 46 }, (s) => { s.unlocks.fresh = ['district:dachy']; });
    await g.page.evaluate(() => window.game.openCampaignScreen());
    await g.page.waitForTimeout(400);
    const d = await g.page.evaluate(() => {
      const tiles = [...document.querySelectorAll('#districtMap .district-tile')];
      const strip = document.getElementById('districtMap');
      const cur = tiles.find(t => t.classList.contains('current'));
      const vis = cur && cur.offsetLeft - strip.offsetLeft + cur.offsetWidth <= strip.scrollLeft + strip.clientWidth + 1 && cur.offsetLeft - strip.offsetLeft >= strip.scrollLeft - 1;
      return {
        current: tiles.filter(t => t.classList.contains('current')).map(t => t.querySelector('.district-node-name').textContent + '|' + (t.querySelector('.district-tile-chip') || {}).textContent),
        next: tiles.filter(t => t.classList.contains('next-up')).map(t => t.querySelector('.district-node-name').textContent + '|' + (t.querySelector('.district-tile-chip') || {}).textContent),
        popped: tiles.filter(t => t.classList.contains('just-unlocked')).map(t => t.querySelector('.district-node-name').textContent),
        selected: window.game.selectedDistrictId, currentInView: !!vis,
        chipLayer: (() => { const c = document.querySelector('.district-tile-chip'); return c ? +getComputedStyle(c).zIndex >= 1 && getComputedStyle(c).willChange.includes('transform') : false; })()
      };
    });
    push('V1-4 Dzielnice: the district played now is marked TERAZ, the one its boss opens NASTĘPNA (one each)', d.current.length === 1 && /Dachy Prądu\|TERAZ/.test(d.current[0]) && d.next.length === 1 && /Rdzeń Miasta\|NASTĘPNA/.test(d.next[0]) && d.chipLayer, JSON.stringify(d));
    push('V1-4 Dzielnice opens on the current district, scrolled into view', d.selected === 'dachy' && d.currentInView, JSON.stringify(d));
    push('V1-4 a district opened since the last visit pops once', d.popped.length === 1 && d.popped[0] === 'Dachy Prądu', JSON.stringify(d.popped));
    await g.page.evaluate(() => { window.game.showScreen('mainMenu'); window.game.openCampaignScreen(); });
    await g.page.waitForTimeout(200);
    const again = await g.page.evaluate(() => document.querySelectorAll('#districtMap .district-tile.just-unlocked').length);
    push('V1-4 ...and not again on the next visit', again === 0, String(again));
    push('V1-4 Dzielnice: no runtime errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | '));
    await g.browser.close();
  }

  // V1-5: Warsztat card states and feedback; the purchase flow is unchanged.
  {
    const g = await boot(url, { coins: 500, runsPlayed: 10, missions: 12 }, (s) => { s.owned = ['rainbow', 'cyan']; s.selected = 'rainbow'; s.prisms = 0; });
    await g.page.evaluate(() => window.game.openWarsztatScreen());
    await g.page.waitForTimeout(300);
    const w = await g.page.evaluate(() => {
      const gm = window.game;
      const st = (id) => { const c = document.querySelector(`#skinGrid .skin-card[data-item="${id}"]`); return c ? [...c.classList].filter(k => k.startsWith('is-')).join() : null; };
      const expect = {};
      SKINS.forEach(s => {
        const owned = gm.save.owned.includes(s.id);
        expect[s.id] = owned ? (gm.save.selected === s.id ? 'is-worn' : 'is-owned') : (s.unlockSource ? 'is-reward' : ((s.priceCoins != null ? s.priceCoins : s.price) <= gm.save.coins ? 'is-buyable' : 'is-short'));
      });
      const got = {}; SKINS.forEach(s => { got[s.id] = st(s.id); });
      return { expect, got, lockOnShort: !!document.querySelector('#skinGrid .skin-card.is-short .skin-card-lock'), pill: !!document.querySelector('#skinGrid .skin-card.is-buyable .skin-price-buy') };
    });
    const allMatch = Object.keys(w.expect).every(k => w.expect[k] === w.got[k]);
    push('V1-5 Warsztat: every vortex card says worn / owned / affordable / out of reach / reward, matching the save and the coins', allMatch && w.lockOnShort && w.pill, JSON.stringify(w.got));
    const eq = await g.page.evaluate(async () => {
      const gm = window.game, coins = gm.save.coins;
      document.querySelector('#skinGrid .skin-card[data-item="cyan"]').click();
      await new Promise(r => setTimeout(r, 60));
      return { worn: gm.save.selected, coins: gm.save.coins === coins, pop: !!document.querySelector('#skinGrid .skin-card[data-item="cyan"].just-equipped'), fx: !!gm.warsztatFx, flash: document.getElementById('warsztatPreviewName').classList.contains('flash') };
    });
    push('V1-5 putting an owned vortex on: worn, free, its card pops and the showroom bursts', eq.worn === 'cyan' && eq.coins && eq.pop && eq.fx && eq.flash, JSON.stringify(eq));
    const buy = await g.page.evaluate(async () => {
      const gm = window.game, coins = gm.save.coins;
      const item = SKINS.find(s => !gm.save.owned.includes(s.id) && !s.unlockSource && (s.priceCoins != null ? s.priceCoins : s.price) <= coins);
      document.querySelector(`#skinGrid .skin-card[data-item="${item.id}"]`).click();
      await new Promise(r => setTimeout(r, 60));
      document.getElementById('btnInfoSheetAction').click();
      await new Promise(r => setTimeout(r, 60));
      const price = item.priceCoins != null ? item.priceCoins : item.price;
      return { id: item.id, price, paid: coins - gm.save.coins, owned: gm.save.owned.includes(item.id), worn: gm.save.selected === item.id, bought: !!document.querySelector(`#skinGrid .skin-card[data-item="${item.id}"].just-bought`), gold: gm.warsztatFx && gm.warsztatFx.kind === 'buy' };
    });
    push('V1-5 buying: the same price is paid, the item is owned and worn, with the gold burst', buy.paid === buy.price && buy.owned && buy.worn && buy.bought && buy.gold, JSON.stringify(buy));
    push('V1-5 Warsztat: no runtime errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | '));
    await g.browser.close();
  }

  // V1-8: the LVL 6 city's frame cost on a phone canvas.
  {
    const g = await boot(url, { coins: 900, runsPlayed: 12, missions: 12 }, (s) => { s.hub.coreLevel = 6; s.hub.coreCharge = 30; });
    await g.page.waitForTimeout(600);
    const ms = await g.page.evaluate(() => {
      const gm = window.game; cancelAnimationFrame(gm.screenAnimRaf); gm.screenAnimRaf = null;
      const t0 = performance.now();
      for (let i = 0; i < 120; i++) gm.renderHubCity(10 + i / 60);
      return (performance.now() - t0) / 120;
    });
    console.log(`  (LVL 6 city: ${ms.toFixed(2)} ms per frame)`);
    push('V1-8 the LVL 6 city draws in under 8 ms a frame (phone canvas; compare with the base on the same machine)', ms < 8, ms.toFixed(2) + ' ms');
    await g.browser.close();
  }
  return out;
}

if (isMain(import.meta.url)) {
  const { server, url } = await serve();
  const res = await runVisual1Checks(url);
  server.close();
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} VISUAL-1 checks passed`);
  process.exit(failed.length ? 1 : 0);
}

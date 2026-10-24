// PX01 (VH-03) save safety: a save the game can't fully read -- a newer
// schema, broken JSON, a field of the wrong type, a second tab with newer
// progress, a full or refusing storage -- is never silently replaced. The
// original bytes stay on the save key through loading AND every later
// automatic save (login reward, free chest, Arena round, mission, tab
// switch, reload); migrations commit only after a backup of the original
// bytes; an unlock happens only on the player's explicit choice, and keeps
// the original under a rescue key. Usage: node qa/save-safety.mjs
// Synthetic fixtures only (no player data); each case runs in a fresh
// browser context, i.e. its own isolated localStorage.
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, report, ARENA_BOT, CAMPAIGN_BOT, OUT, isMain } from './lib.mjs';

const KEY = 'vectorHoleSave_v1';
const FIXTURES = path.join(OUT, 'save-fixtures');

/** Builds every fixture in a page of the game itself (defaultSave() /
 *  sealSave() of the code under test), returned as raw storage strings. */
async function buildFixtures(url) {
  const g = await openGame(url);
  const fx = await g.page.evaluate(() => {
    const today = new Date().toISOString().slice(0, 10);
    const rich = () => {
      const s = defaultSave();
      s.coins = 4321; s.prisms = 77;
      s.owned = ['rainbow', 'cyan', 'green']; s.selected = 'cyan';
      s.auras = { owned: ['none', 'spark'], selected: 'spark' };
      s.effects = { owned: ['classic', 'pixel_burst'], selected: 'pixel_burst' };
      s.overdriveSkins = { owned: ['classic', 'fala'], selected: 'fala' };
      s.player = { level: 12, xp: 345 };
      s.stats = { runsPlayed: 21, bestArenaScore: 987, recentArenaScores: [400, 520, 610] };
      s.hub = { coreCharge: 40, coreLevel: 3 };
      ['M01', 'M02', 'M03'].forEach(id => { s.campaign.completed[id] = true; s.campaign.stars[id] = 3; });
      s.campaign.starChests = 1;
      s.boosters = { time: 2, start: 1, magnet: 3, shield: 0, sprint: 1, gift: true, sprintGift: true };
      s.entitlements = { noAds: true, purchased: ['starter_pack', 'energy_hour'] };
      s.login = { lastClaimDate: today, day: 3, totalClaims: 3 };
      s.freeChest = { nextAt: Date.now() + 3600e3, opened: 5 };
      s.badges = ['plac'];
      s.unlocks.announced = Array.from(new Set([...unlockedFeatureIds(s), 'warsztat', 'wyzwania', 'kampania']));
      s.coach = { moved: true, ate: true, rival: true, danger: true };
      s.privacy = { decided: true, analytics: false, ads: false, ts: 1 };
      s.retention = { installDate: '2026-09-01', activeDays: ['2026-09-01'], sessions: 9 };
      return s;
    };
    const out = {};
    out.current = sealSave(rich());
    // SAVE-01/02: a v12 save (energy era) with everything a player can own.
    const v12 = rich();
    v12.schemaVersion = 12; delete v12.coach;
    v12.energy = { value: 2, lastTick: Date.now() - 60000, infiniteUntil: 0, freeDailyDate: null };
    v12.campaign.discoveredTypes = ['fragment', 'prop'];
    v12.campaign.completed.M00 = true;
    v12.unlocks.announced = ['arena', 'warsztat', 'wyzwania'];
    out.v12 = sealSave(v12);
    // Older supported shapes (no false "broken save" on a real old player).
    out.v1 = JSON.stringify({ coins: 50, owned: ['rainbow', 'cyan'], selected: 'cyan' });
    out.v5 = JSON.stringify({ schemaVersion: 5, coins: 120, prisms: 3, owned: ['rainbow'], selected: 'rainbow', guestId: 'guest_old5',
      settings: { inputMode: 'thumbpad', sensitivity: 1, haptics: true, minimap: 'auto' }, stats: { runsPlayed: 4 },
      auras: { owned: ['none'], selected: 'none' }, displayName: null, hub: { coreCharge: 10 }, daily: { lastSeedDate: null, lastSeedScore: 0 }, mission: { dateKey: null, completed: false } });
    const v10 = rich(); v10.schemaVersion = 10;
    ['entitlements', 'ads', 'privacy', 'retention', 'challenge', 'integrity', 'boosters', 'coach', 'meta'].forEach(k => delete v10[k]);
    v10.campaign = { unlockedDistricts: ['plac'], completed: { M01: true }, medals: { M01: true } };
    out.v10 = JSON.stringify(v10);
    // SAVE-08: written by a newer game (schema 99), with fields and an owned
    // item shape this version doesn't know.
    const fut = rich();
    fut.schemaVersion = 99;
    fut.owned = ['rainbow', 'cyan', { id: 'future_skin', tier: 2 }];
    fut.seasonPass = { tier: 4, claimed: ['s1', 's2'] };
    fut.campaign.chapterIII = { unlocked: true };
    out.future = sealSave(fut);
    // SAVE-09a/b: one field of the wrong type, the rest valid.
    const a = rich(); a.coins = '500'; out.badCoins = sealSave(a);
    const b = rich(); b.owned = { rainbow: true, cyan: true }; out.badOwned = sealSave(b);
    // SAVE-09c: truncated JSON (a write cut off half-way).
    out.truncated = out.current.slice(0, Math.floor(out.current.length * 0.6));
    // SAVE-05: one mode's data broken, the other intact.
    const c = rich(); c.campaign = 'garbage'; out.badCampaign = sealSave(c);
    const d = rich(); d.stats = 'garbage'; out.badStats = sealSave(d);
    // Partly valid: a current-schema save missing most fields.
    out.partial = JSON.stringify({ schemaVersion: 13, coins: 50, player: { level: 4, xp: 10 } });
    return out;
  });
  await g.browser.close();
  fs.mkdirSync(FIXTURES, { recursive: true });
  for (const [k, v] of Object.entries(fx)) fs.writeFileSync(path.join(FIXTURES, `${k}.txt`), v);
  return fx;
}

async function boot(url, raw, opts = {}) {
  const g = await openGame(url, { ...opts, save: raw == null ? null : raw });
  await g.page.addScriptTag({ content: ARENA_BOT });
  await g.page.addScriptTag({ content: CAMPAIGN_BOT });
  await g.page.waitForTimeout(250);
  return g;
}
const rawOf = (g, key = KEY) => g.page.evaluate((k) => localStorage.getItem(k), key);
const guard = (g) => g.page.evaluate(() => (typeof SAVE_GUARD === 'object' ? SAVE_GUARD.state : 'none'));
const sheet = (g) => g.page.evaluate(() => {
  const el = document.getElementById('infoSheet');
  return el && !el.classList.contains('hidden') ? document.getElementById('infoSheetTitle').textContent : null;
});

/** Every automatic save path a session hits: the login calendar, the free
 *  chest, a whole Arena round (finalizeRun), a mission, screen changes, a
 *  tab switch, the tamper report and a direct saveGame(). */
async function autoOps(g) {
  return g.page.evaluate(() => {
    const gm = window.game, log = [];
    const step = (n, f) => { try { f(); log.push(n); } catch (e) { log.push(n + ':' + e.message); } };
    step('login', () => { gm.save.login.lastClaimDate = null; gm.claimLoginReward(); });
    step('chest', () => { gm.save.freeChest.nextAt = 0; gm.openFreeChest(); });
    step('closeSheet', () => gm.closeInfoSheet());
    step('arena', () => window.__qaPlayArena({ style: 'greedy' }));
    step('menu', () => gm.showScreen('mainMenu'));
    step('mission', () => window.__qaPlayMission('M01'));
    step('hidden', () => document.dispatchEvent(new Event('visibilitychange')));
    step('direct', () => saveGame(gm.save));
    return log;
  });
}

export async function runSaveSafetyChecks(url) {
  const results = [];
  const push = (name, ok, details) => results.push(report(name, ok, details));
  const fx = await buildFixtures(url);
  const noErr = (g, label) => push(`save-safety: no runtime errors (${label})`, g.errors.length === 0, g.errors.slice(0, 3).join(' | '));

  // --- SAVE-01: v12 (energy) -> v13, backup of the original, reload ---------
  {
    const g = await boot(url, fx.v12);
    const r = await g.page.evaluate((k) => {
      const s = window.game.save;
      return { v: s.schemaVersion, energy: 'energy' in s, m00: 'M00' in s.campaign.completed, done: Object.keys(s.campaign.completed).sort().join(','),
        wyz: window.game.isWyzwaniaUnlocked(), warsztat: window.game.isWarsztatUnlocked(), bak: localStorage.getItem(k + '.bak'), stored: JSON.parse(localStorage.getItem(k)).schemaVersion };
    }, KEY);
    push('SAVE-01 v12 with energy -> v13: no energy, unlocks and missions kept, migration committed', r.v === 13 && !r.energy && !r.m00 && r.done === 'M01,M02,M03' && r.wyz && r.warsztat && r.stored === 13, JSON.stringify({ ...r, bak: !!r.bak }));
    push('SAVE-01 the original v12 bytes are kept under the backup key before the migration commit', r.bak === fx.v12, r.bak ? `bak ${r.bak.length} B` : 'no backup');
    // loadSave() of an already-migrated save performs no write at all.
    const w = await g.page.evaluate((k) => {
      const before = localStorage.getItem(k);
      let writes = 0;
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, v) { writes++; return set.call(this, key, v); };
      try { loadSave(); loadSave(); } finally { Storage.prototype.setItem = set; }
      return { writes, same: localStorage.getItem(k) === before };
    }, KEY);
    push('SAVE-01 reading an already-migrated save writes nothing (no write on read)', w.writes === 0 && w.same, JSON.stringify(w));
    noErr(g, 'SAVE-01');
    await g.browser.close();
  }

  // --- SAVE-02: balances, items, rewards survive; nothing granted twice ----
  {
    const g = await boot(url, fx.v12);
    const pick = () => g.page.evaluate(() => { const s = window.game.save; return JSON.stringify({ c: s.coins, p: s.prisms, o: s.owned, a: s.auras, e: s.effects, od: s.overdriveSkins, b: s.boosters, ent: s.entitlements, l: s.login, ch: s.freeChest, sc: s.campaign.starChests, st: s.campaign.stars, lv: s.player, badges: s.badges, best: s.stats.bestArenaScore }); });
    const first = await pick();
    const snaps = [first];
    for (let i = 0; i < 3; i++) { await g.page.reload(); await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state); await g.page.waitForTimeout(150); snaps.push(await pick()); }
    const f = JSON.parse(first);
    const kept = f.c === 4321 && f.p === 77 && f.o.join() === 'rainbow,cyan,green' && f.a.owned.includes('spark') && f.e.owned.includes('pixel_burst') && f.od.owned.includes('fala')
      && f.b.time === 2 && f.b.magnet === 3 && f.b.sprint === 1 && f.ent.noAds && f.ent.purchased.includes('starter_pack') && f.l.totalClaims === 3 && f.ch.opened === 5 && f.sc === 1 && f.lv.level === 12 && f.best === 987;
    push('SAVE-02 coins, prisms, skins, trails, effects, finishes, boosters, purchases, login/chest claims, star chests, level kept', kept, first.slice(0, 300));
    push('SAVE-02 three reloads: identical balances and items (no reward granted twice)', snaps.every(s => s === first), snaps.map(s => s.length).join(','));
    noErr(g, 'SAVE-02');
    await g.browser.close();
  }

  // --- SAVE-03: double migration, repeated loadSave -------------------------
  {
    const g = await boot(url, null);
    const r = await g.page.evaluate((raws) => {
      const res = {};
      for (const [k, raw] of Object.entries(raws)) {
        const once = sanitizeSave(migrateSave(JSON.parse(raw)));
        const twice = sanitizeSave(migrateSave(JSON.parse(JSON.stringify(once))));
        res[k] = JSON.stringify(once) === JSON.stringify(twice);
      }
      return res;
    }, { v12: fx.v12, v10: fx.v10, v5: fx.v5, current: fx.current });
    push('SAVE-03 migrate(migrate(x)) == migrate(x) for v5, v10, v12 and current saves', Object.values(r).every(Boolean), JSON.stringify(r));
    noErr(g, 'SAVE-03');
    await g.browser.close();
  }

  // --- Older supported saves load as normal saves (no false lock) -----------
  for (const k of ['v1', 'v5', 'v10', 'current', 'partial']) {
    const g = await boot(url, fx[k]);
    const r = await g.page.evaluate(() => ({ state: typeof SAVE_GUARD === 'object' ? SAVE_GUARD.state : 'none', coins: window.game.save.coins, v: window.game.save.schemaVersion, level: window.game.save.player.level }));
    // PX02 D+: the v1 save owns Cyjan (a paid vortex whose bonus went away) -> +100 refund, once.
    const want = { v1: 150, v5: 120, v10: 4321, current: 4321, partial: 50 }[k];
    push(`legacy/partial ${k}: loads as a normal writable save with its coins (${want})`, r.state === 'ok' && r.coins === want && r.v === 13, JSON.stringify(r));
    noErr(g, k);
    await g.browser.close();
  }
  // No save at all: a fresh profile that saves normally.
  {
    const g = await boot(url, null);
    await g.page.evaluate(() => { window.game.save.coins = 9; saveGame(window.game.save); });
    const raw = await rawOf(g);
    push('no save: fresh profile, first save is written', !!raw && JSON.parse(raw).coins === 9, raw ? 'written' : 'nothing stored');
    noErr(g, 'no save');
    await g.browser.close();
  }

  // --- SAVE-08 / SAVE-09a-c: the original never changes ------------------------
  const lockCases = [
    ['SAVE-08 future schema 99 (unknown fields, unknown item shape)', 'future', 'future', s => s.coins === 4321 && s.player.level === 12],
    ['SAVE-09a coins "500" (rest valid)', 'badCoins', 'invalid', s => s.coins === 500 && s.player.level === 12 && Object.keys(s.campaign.completed).length === 3],
    ['SAVE-09b owned not an array', 'badOwned', 'invalid', s => s.coins === 4321 && s.player.level === 12 && Object.keys(s.campaign.completed).length === 3],
    ['SAVE-09c truncated JSON', 'truncated', 'corrupt', () => true],
    ['SAVE-05 broken campaign, intact Arena data', 'badCampaign', 'invalid', s => s.stats.runsPlayed >= 21 && s.stats.bestArenaScore >= 987 && s.coins >= 4321],
    ['SAVE-05 broken Arena stats, intact campaign', 'badStats', 'invalid', s => Object.keys(s.campaign.completed).length >= 3 && s.coins >= 4321]
  ];
  for (const [label, k, state, progressOk] of lockCases) {
    const g = await boot(url, fx[k]);
    const raw0 = await rawOf(g);
    const st = await guard(g);
    const title = await sheet(g);
    const prog = await g.page.evaluate(() => JSON.parse(JSON.stringify(window.game.save)));
    push(`${label}: original bytes unchanged after loading`, raw0 === fx[k], raw0 === fx[k] ? 'identical' : `changed (${(raw0 || '').length} B)`);
    push(`${label}: read-only "${state}" state with a notice instead of a silent reset`, st === state && !!title, `state ${st}, sheet ${JSON.stringify(title)}`);
    push(`${label}: the readable progress is playable in memory`, progressOk(prog), JSON.stringify({ coins: prog.coins, level: prog.player.level, done: Object.keys(prog.campaign.completed).length }));
    const ops = await autoOps(g);
    const raw1 = await rawOf(g);
    push(`${label}: original bytes unchanged after every automatic save (login, chest, Arena round, mission, tab switch, saveGame)`, raw1 === fx[k], `${ops.join(' ')} -> ${raw1 === fx[k] ? 'identical' : 'CHANGED'}`);
    await g.page.reload(); await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state); await g.page.waitForTimeout(200);
    await g.page.addScriptTag({ content: ARENA_BOT }); await g.page.addScriptTag({ content: CAMPAIGN_BOT });
    await autoOps(g);
    const raw2 = await rawOf(g);
    push(`${label}: still unchanged after a reload and a second session`, raw2 === fx[k], raw2 === fx[k] ? 'identical' : 'CHANGED');
    noErr(g, label);
    await g.browser.close();
  }

  // --- Explicit player choice: repair / start over keep a rescue copy ----------
  for (const [label, k, expect] of [['SAVE-09a repair', 'badCoins', s => s.coins >= 500 && s.player.level === 12], ['SAVE-09b repair', 'badOwned', s => s.player.level === 12 && Object.keys(s.campaign.completed).length === 3], ['SAVE-09c start over', 'truncated', s => s.schemaVersion === 13]]) {
    const g = await boot(url, fx[k]);
    const r = await g.page.evaluate((key) => {
      const btn = document.getElementById('btnInfoSheetAction');
      const label = btn && !btn.classList.contains('hidden') ? btn.textContent : null;
      if (label) btn.click();
      return { label, state: typeof SAVE_GUARD === 'object' ? SAVE_GUARD.state : 'none', rescue: localStorage.getItem(key + '.rescue'), stored: localStorage.getItem(key) };
    }, KEY);
    let stored = null; try { stored = JSON.parse(r.stored); } catch (e) { /* not JSON */ }
    push(`${label}: the player's choice (${r.label}) keeps the original bytes under the rescue key, then saves`, r.rescue === fx[k] && r.state === 'ok' && !!stored && expect(stored), JSON.stringify({ label: r.label, state: r.state, rescue: r.rescue === fx[k], stored: stored && { coins: stored.coins, level: stored.player && stored.player.level } }));
    noErr(g, label);
    await g.browser.close();
  }
  // Future save: the notice only offers a reload, never an overwrite.
  {
    const g = await boot(url, fx.future);
    const action = await g.page.evaluate(() => { const btn = document.getElementById('btnInfoSheetAction'); return btn.classList.contains('hidden') ? null : btn.textContent; });
    push('SAVE-08 future save: the notice offers a reload, not an overwrite', !!action && /ODŚWIEŻ/.test(action), JSON.stringify({ action }));
    noErr(g, 'SAVE-08 notice');
    await g.browser.close();
  }

  // --- SAVE-09d: two tabs -------------------------------------------------------
  {
    const g = await boot(url, fx.current);
    const b = await g.context.newPage();
    await b.goto(url); await b.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state); await b.waitForTimeout(250);
    await g.page.waitForTimeout(200);
    // Tab B earns 500 coins and saves; tab A (opened first, stale) then saves its own change.
    await b.evaluate(() => { window.game.save.coins += 500; saveGame(window.game.save); });
    await g.page.waitForTimeout(200);
    const a = await g.page.evaluate(() => { window.game.save.coins += 7; saveGame(window.game.save); return { state: typeof SAVE_GUARD === 'object' ? SAVE_GUARD.state : 'none' }; });
    await g.page.waitForTimeout(100);
    const coins = JSON.parse(await rawOf(g)).coins;
    const title = await sheet(g);
    push('SAVE-09d two tabs: the stale tab does not overwrite the newer progress from the other tab', coins === 4821, `stored coins ${coins} (B wrote 4821, stale A had 4328)`);
    push('SAVE-09d two tabs: the stale tab stops saving and tells the player to reload', a.state === 'stale' && !!title, JSON.stringify({ ...a, title }));
    // A writer this tab never heard about (no storage event): read-before-write.
    const r = await b.evaluate((k) => {
      const other = JSON.parse(localStorage.getItem(k)); other.coins = 1; localStorage.setItem(k, JSON.stringify(other));
      window.game.save.coins += 3; saveGame(window.game.save);
      return { stored: JSON.parse(localStorage.getItem(k)).coins, state: typeof SAVE_GUARD === 'object' ? SAVE_GUARD.state : 'none' };
    }, KEY);
    push('SAVE-09d a change made behind the tab\'s back (no storage event) is detected before writing', r.stored === 1 && r.state === 'stale', JSON.stringify(r));
    noErr(g, 'SAVE-09d');
    await g.browser.close();
  }

  // --- SAVE-04 / SAVE-09e: storage full or refusing -----------------------------
  {
    const quotaAll = () => { Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); }; };
    const g = await boot(url, fx.v12, { initScript: quotaAll });
    const ops = await autoOps(g);
    const raw = await rawOf(g);
    const s = await g.page.evaluate(() => ({ v: window.game.save.schemaVersion, coins: window.game.save.coins, state: window.game.state }));
    push('SAVE-04 QuotaExceededError on every write: original bytes intact, game keeps running from memory', raw === fx.v12 && s.v === 13 && s.coins >= 4321 && !!s.state, `${ops.join(' ')} -> ${raw === fx.v12 ? 'identical' : 'CHANGED'}`);
    noErr(g, 'SAVE-04 quota');
    await g.browser.close();
  }
  {
    // The backup can't be written (but the save key could): the migration must not commit.
    const bakFails = () => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (/\.bak$/.test(k) && !window.__allowBak) throw new DOMException('full', 'QuotaExceededError'); return set.call(this, k, v); }; };
    const g = await boot(url, fx.v12, { initScript: bakFails });
    await autoOps(g);
    const raw = await rawOf(g);
    push('SAVE-09e backup write refused: the migration is not committed over the original (every later save waits for the backup)', raw === fx.v12, raw === fx.v12 ? 'identical' : 'CHANGED without a backup');
    const r = await g.page.evaluate((k) => { window.__allowBak = true; saveGame(window.game.save); return { bak: localStorage.getItem(k + '.bak'), v: JSON.parse(localStorage.getItem(k)).schemaVersion }; }, KEY);
    push('SAVE-09e once the backup succeeds, the original is backed up first, then the migrated save is written', r.bak === fx.v12 && r.v === 13, JSON.stringify({ bak: r.bak === fx.v12, v: r.v }));
    noErr(g, 'SAVE-09e');
    await g.browser.close();
  }
  {
    // Closed between the backup and the commit: the next start redoes the same migration.
    const mainFails = () => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'vectorHoleSave_v1' && !sessionStorage.getItem('__qaLift')) throw new DOMException('aborted', 'QuotaExceededError'); return set.call(this, k, v); }; };
    const g = await boot(url, fx.v12, { initScript: mainFails });
    const raw = await rawOf(g);
    const bak = await rawOf(g, KEY + '.bak');
    await g.page.evaluate(() => sessionStorage.setItem('__qaLift', '1'));
    await g.page.reload(); await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state); await g.page.waitForTimeout(200);
    const r = await g.page.evaluate((k) => ({ stored: JSON.parse(localStorage.getItem(k)), bak: localStorage.getItem(k + '.bak') }), KEY);
    const ref = await g.page.evaluate((raw) => { const p = JSON.parse(raw); delete p._sig; const m = sanitizeSave(migrateSave(p)); return { coins: m.coins, done: Object.keys(m.campaign.completed).sort().join(), v: m.schemaVersion }; }, fx.v12);
    const st = r.stored;
    push('SAVE-09f interrupted commit (closed after the backup): original intact, the next start migrates the same way', raw === fx.v12 && st.schemaVersion === 13 && st.coins === ref.coins && Object.keys(st.campaign.completed).sort().join() === ref.done && r.bak === fx.v12, JSON.stringify({ firstRaw: raw === fx.v12, bakAfterFirst: bak === fx.v12, v: st.schemaVersion, coins: st.coins }));
    noErr(g, 'SAVE-09f');
    await g.browser.close();
  }
  {
    // Storage unreadable: boots, never writes.
    const denied = () => { Storage.prototype.getItem = () => { throw new Error('denied'); }; window.__writes = 0; const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'vectorHoleSave_v1') window.__writes++; return set.call(this, k, v); }; };
    const g = await boot(url, null, { initScript: denied });
    await autoOps(g);
    const r = await g.page.evaluate(() => ({ writes: window.__writes, state: typeof SAVE_GUARD === 'object' ? SAVE_GUARD.state : 'none', game: window.game.state }));
    push('SAVE-04 storage that refuses reads: boots, and never writes a blank save over what it could not read', r.writes === 0 && !!r.game, JSON.stringify(r));
    noErr(g, 'storage denied');
    await g.browser.close();
  }

  // --- SAVE-06: cloud copy (mocked CrazyGames data module) ----------------------
  const mockCrazy = (remote) => `
    window.__cgStore = ${JSON.stringify(remote || {})};
    window.CrazyGames = { SDK: { init: async () => {},
      game: { gameplayStart() {}, gameplayStop() {}, loadingStop() {}, happytime() {} },
      ad: { requestAd: (t, cb) => { cb && cb.adFinished && cb.adFinished(); } },
      data: { getItem: k => (k in __cgStore ? __cgStore[k] : null), setItem: (k, v) => { __cgStore[k] = v; }, removeItem: k => { delete __cgStore[k]; } } } };`;
  for (const [label, remote, local] of [['SAVE-06 account copy from a newer game version', fx.future, fx.current], ['SAVE-06 unreadable account copy', fx.truncated, fx.current]]) {
    const g = await boot(url, local, { query: '?portal=crazygames', initScript: mockCrazy({ [KEY]: remote }) });
    await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.monetization.provider === 'crazygames', null, { timeout: 10000 }).catch(() => {});
    await g.page.waitForTimeout(500);
    await autoOps(g);
    const r = await g.page.evaluate((k) => ({ remote: __cgStore[k], local: JSON.parse(localStorage.getItem(k)).coins }), KEY);
    push(`${label}: never overwritten by this device (local saves still work)`, r.remote === remote && r.local >= 4321, JSON.stringify({ remoteSame: r.remote === remote, localCoins: r.local }));
    noErr(g, label);
    await g.browser.close();
  }
  {
    const g = await boot(url, fx.truncated, { query: '?portal=crazygames', initScript: mockCrazy({ [KEY]: fx.current }) });
    await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.monetization.provider === 'crazygames', null, { timeout: 10000 }).catch(() => {});
    await g.page.waitForTimeout(600);
    const r = await g.page.evaluate((k) => ({ coins: window.game.save.coins, level: window.game.save.player.level, rescue: localStorage.getItem(k + '.rescue'), state: typeof SAVE_GUARD === 'object' ? SAVE_GUARD.state : 'none' }), KEY);
    push('SAVE-06 broken local save + good account copy: restored from the account, broken bytes kept under the rescue key', r.coins === 4321 && r.level === 12 && r.rescue === fx.truncated && r.state === 'ok', JSON.stringify({ ...r, rescue: r.rescue === fx.truncated }));
    noErr(g, 'SAVE-06 restore');
    await g.browser.close();
  }

  // --- Backup code over a held-back save (explicit choice) / cloud never lifts it ---
  {
    const g = await boot(url, fx.badOwned);
    const r = await g.page.evaluate((k) => {
      const gm = window.game;
      gm.closeInfoSheet();
      const code = encodeSaveCode(sanitizeSave(JSON.parse(JSON.stringify({ ...defaultSave(), coins: 2468 }))));
      // A cloud copy arriving later is not the player's choice.
      gm.adoptSave(decodeSaveCode(code), 'cloud');
      const afterCloud = { state: (typeof SAVE_GUARD === "object" ? SAVE_GUARD.state : "none"), raw: localStorage.getItem(k) };
      gm.openBackupLoad();
      document.getElementById('backupInput').value = code;
      gm.importBackup();
      // The code has less progress than the device: confirm "WCZYTAJ MIMO TO".
      const confirm = document.getElementById('btnInfoSheetAction');
      const asked = document.getElementById('infoSheetTitle').textContent;
      if (!confirm.classList.contains('hidden')) confirm.click();
      return { asked, afterCloud, state: (typeof SAVE_GUARD === "object" ? SAVE_GUARD.state : "none"), coins: JSON.parse(localStorage.getItem(k)).coins, rescue: localStorage.getItem(k + '.rescue') };
    }, KEY);
    push('a cloud adoption never lifts the guard (bytes unchanged)', r.afterCloud.state === 'invalid' && r.afterCloud.raw === fx.badOwned, JSON.stringify({ state: r.afterCloud.state, same: r.afterCloud.raw === fx.badOwned }));
    push('backup code over a held-back save (explicit): original kept under the rescue key, code\'s save stored', r.state === 'ok' && r.coins === 2468 && r.rescue === fx.badOwned, JSON.stringify({ ...r, afterCloud: undefined, rescue: r.rescue === fx.badOwned }));
    noErr(g, 'backup code');
    await g.browser.close();
  }
  // --- English: every notice is translated --------------------------------------
  for (const k of ['future', 'truncated', 'badCoins']) {
    const g = await boot(url, fx[k], { locale: 'en-US', query: '?i18n=log' });
    const r = await g.page.evaluate(() => ({ title: document.getElementById('infoSheetTitle').textContent, body: document.getElementById('infoSheetBody').textContent, btn: document.getElementById('btnInfoSheetAction').textContent, close: document.getElementById('btnInfoSheetClose').textContent }));
    const polish = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]|zapis|Gra |ODŚWIEŻ|NAPRAW|GRAJ/.test(r.title + r.body + r.btn + r.close);
    push(`EN: the "${k}" notice is fully in English`, !polish && !!r.title, JSON.stringify(r).slice(0, 220));
    await g.browser.close();
  }
  {
    // Stale tab: a deferred cloud restore must not write over the other tab's save.
    const g = await boot(url, fx.current);
    const r = await g.page.evaluate((k) => {
      const other = JSON.parse(localStorage.getItem(k)); other.coins = 11; localStorage.setItem(k, JSON.stringify(other));
      saveGame(window.game.save);
      const before = localStorage.getItem(k);
      window.game.adoptSave(sanitizeSave(defaultSave()), 'cloud');
      return { state: (typeof SAVE_GUARD === "object" ? SAVE_GUARD.state : "none"), same: localStorage.getItem(k) === before };
    }, KEY);
    push('stale tab: a (deferred) cloud adoption does not write over the other tab\'s save', r.state === 'stale' && r.same, JSON.stringify(r));
    await g.browser.close();
  }

  // --- Profil reset (explicit, confirmed) of a locked save keeps a rescue copy ---
  {
    const g = await boot(url, fx.future);
    await Promise.all([g.page.waitForNavigation(), g.page.evaluate(() => { window.game.closeInfoSheet(); window.game.resetProfile(); })]);
    await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
    const r = await g.page.evaluate((k) => ({ main: localStorage.getItem(k), rescue: localStorage.getItem(k + '.rescue') }), KEY);
    push('locked save + explicit Profil reset: the original is kept under the rescue key', r.rescue === fx.future && r.main !== fx.future, JSON.stringify({ rescue: r.rescue === fx.future, mainReplaced: r.main !== fx.future }));
    await g.browser.close();
  }

  // --- Review round 2 (PX01) ----------------------------------------------------
  // R1: Profil reset when the rescue copy can't be written -> nothing deleted,
  // no cloud wipe, no reload, a notice instead.
  const rescueRefused = () => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (/\.rescue$/.test(k)) throw new DOMException('full', 'QuotaExceededError'); return set.call(this, k, v); }; };
  {
    const g = await boot(url, fx.future, { initScript: rescueRefused });
    const r = await g.page.evaluate((k) => {
      window.__noReload = 1;
      window.game.closeInfoSheet();
      try { window.game.resetProfile(); } catch (e) { return { threw: e.message }; }
      return { main: localStorage.getItem(k), rescue: localStorage.getItem(k + '.rescue'), title: document.getElementById('infoSheet').classList.contains('hidden') ? null : document.getElementById('infoSheetTitle').textContent };
    }, KEY);
    await g.page.waitForTimeout(400);
    const still = await g.page.evaluate(() => window.__noReload === 1).catch(() => false);
    push('R1 reset of a held-back save with the rescue copy refused: the save stays, no reload, a notice', r.main === fx.future && r.rescue === null && still && !!r.title, JSON.stringify({ same: r.main === fx.future, rescue: r.rescue, noReload: still, title: r.title, threw: r.threw }));
    await g.browser.close();
  }
  {
    // ... with the cloud mirror attached (a stale tab): the account copy stays too.
    const g = await boot(url, fx.current, { query: '?portal=crazygames', initScript: mockCrazy({}) + `;(${rescueRefused.toString()})();` });
    await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.monetization.provider === 'crazygames', null, { timeout: 10000 }).catch(() => {});
    await g.page.waitForTimeout(600);
    const r = await g.page.evaluate((k) => {
      const cloudBefore = __cgStore[k];
      const other = JSON.parse(localStorage.getItem(k)); other.coins = 77; localStorage.setItem(k, JSON.stringify(other));
      saveGame(window.game.save); // -> stale
      const localBefore = localStorage.getItem(k);
      window.__noReload = 1;
      window.game.closeInfoSheet();
      window.game.resetProfile();
      return { state: typeof SAVE_GUARD === 'object' ? SAVE_GUARD.state : 'none', cloudSet: !!cloudBefore, cloudSame: __cgStore[k] === cloudBefore, localSame: localStorage.getItem(k) === localBefore };
    }, KEY);
    await g.page.waitForTimeout(400);
    const still = await g.page.evaluate(() => window.__noReload === 1).catch(() => false);
    push('R1 reset with the rescue copy refused and the cloud attached: local save and account copy untouched, no reload', r.cloudSet && r.cloudSame && r.localSame && still, JSON.stringify({ ...r, noReload: still }));
    noErr(g, 'R1 cloud');
    await g.browser.close();
  }
  // R2: a failed local write never reaches the cloud mirror; a good one does.
  {
    const mainFlag = () => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'vectorHoleSave_v1' && window.__failMain) throw new DOMException('full', 'QuotaExceededError'); return set.call(this, k, v); }; };
    const g = await boot(url, fx.current, { query: '?portal=crazygames', initScript: mockCrazy({}) + `;(${mainFlag.toString()})();` });
    await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.monetization.provider === 'crazygames', null, { timeout: 10000 }).catch(() => {});
    await g.page.waitForTimeout(600);
    const r = await g.page.evaluate((k) => {
      const gm = window.game, before = __cgStore[k];
      window.__failMain = true;
      gm.save.coins += 111; const ok1 = saveGame(gm.save);
      const afterFail = __cgStore[k];
      window.__failMain = false;
      gm.save.coins += 1; const ok2 = saveGame(gm.save);
      return { mirrored: !!before, ok1, failedSent: afterFail !== before, ok2, synced: __cgStore[k] === localStorage.getItem(k) };
    }, KEY);
    push('R2 local setItem fails with the cloud mirror on: the unsaved state is not uploaded', r.mirrored && r.ok1 === false && !r.failedSent, JSON.stringify(r));
    push('R2 the next successful local save is mirrored as before (sync works)', r.ok2 === true && r.synced, JSON.stringify(r));
    noErr(g, 'R2');
    await g.browser.close();
  }
  // R3: an existing key holding an empty string is not "no save".
  {
    const emptyKey = () => { if (!sessionStorage.getItem('__qaEmpty')) { localStorage.setItem('vectorHoleSave_v1', ''); sessionStorage.setItem('__qaEmpty', '1'); } };
    const g = await boot(url, null, { initScript: emptyKey });
    const st = await guard(g);
    const title = await sheet(g);
    await autoOps(g);
    const raw = await rawOf(g);
    push('R3 existing empty save key: read-only "corrupt" state with a notice', st === 'corrupt' && !!title, JSON.stringify({ st, title }));
    push('R3 existing empty save key: not overwritten by any automatic save', raw === '', JSON.stringify({ raw: raw === null ? null : raw.length }));
    const r = await g.page.evaluate((k) => {
      // The session played a mission meanwhile: bring back the save notice itself.
      window.game.saveGuardShown = null;
      if (window.game.showSaveGuardNotice) window.game.showSaveGuardNotice();
      const btn = document.getElementById('btnInfoSheetAction');
      const label = btn.classList.contains('hidden') ? null : btn.textContent;
      const title = document.getElementById('infoSheetTitle').textContent;
      if (label) btn.click();
      return { title, label, rescue: localStorage.getItem(k + '.rescue'), stored: localStorage.getItem(k), state: typeof SAVE_GUARD === 'object' ? SAVE_GUARD.state : 'none' };
    }, KEY);
    push('R3 start over keeps the empty original under the rescue key, then saves', r.rescue === '' && !!r.stored && r.state === 'ok', JSON.stringify({ ...r, stored: r.stored && r.stored.length }));
    noErr(g, 'R3');
    await g.browser.close();
  }
  {
    // ... and an empty account copy is not overwritten by the mirror.
    const g = await boot(url, fx.current, { query: '?portal=crazygames', initScript: mockCrazy({ [KEY]: '' }) });
    await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.monetization.provider === 'crazygames', null, { timeout: 10000 }).catch(() => {});
    await g.page.waitForTimeout(600);
    await autoOps(g);
    const r = await g.page.evaluate((k) => ({ remote: __cgStore[k], local: JSON.parse(localStorage.getItem(k)).coins }), KEY);
    push('R3 empty account copy: never overwritten by this device (local saves still work)', r.remote === '' && r.local >= 4321, JSON.stringify({ remote: r.remote === '' ? '""' : (r.remote || '').length, local: r.local }));
    noErr(g, 'R3 cloud');
    await g.browser.close();
  }
  // R4: unreadable storage -> writes blocked AND the player is told.
  {
    const denied = () => { Storage.prototype.getItem = () => { throw new Error('denied'); }; window.__writes = 0; const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'vectorHoleSave_v1') window.__writes++; return set.call(this, k, v); }; };
    const g = await boot(url, null, { initScript: denied });
    const title = await sheet(g);
    const r = await g.page.evaluate(() => ({ writes: window.__writes, state: typeof SAVE_GUARD === 'object' ? SAVE_GUARD.state : 'none', body: document.getElementById('infoSheetBody').textContent }));
    push('R4 unreadable storage: writes blocked and a notice says saving does not work', r.state === 'unavailable' && r.writes === 0 && !!title, JSON.stringify({ ...r, title, body: r.body.slice(0, 120) }));
    noErr(g, 'R4');
    await g.browser.close();
    const e = await boot(url, null, { initScript: denied, locale: 'en-US', query: '?i18n=log' });
    const en = await e.page.evaluate(() => document.getElementById('infoSheet').classList.contains('hidden') ? '' : document.getElementById('infoSheet').textContent);
    push('R4 EN: the "unavailable" notice is fully in English', !!en && !/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]|zapis|ODŚWIEŻ|GRAJ/.test(en), en.slice(0, 160));
    await e.browser.close();
  }

  return results;
}

if (isMain(import.meta.url)) {
  const { server, url } = await serve();
  const results = await runSaveSafetyChecks(url);
  server.close();
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} save-safety checks passed`);
  process.exit(failed.length ? 1 : 0);
}

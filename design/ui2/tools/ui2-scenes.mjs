// GG-UI-02 stage 1 (design only -- not a test, not part of the game): the
// controlled profiles and the scenes of the PRZED / A / B gallery. Every
// scene is staged by the game's own functions on an isolated browser
// profile (a fresh Chromium context per shot, its own localStorage); the
// variant is applied afterwards, in the page's memory only.
export const FROZEN_ISO = '2026-11-13T10:00:00Z';

export const VP = {
  iphone: { id: 'iphone', label: 'iPhone 390×844', width: 390, height: 844, mobile: true, dsf: 2 },
  p320: { id: 'p320', label: 'Telefon 320×568', width: 320, height: 568, mobile: true, dsf: 2 },
  p360: { id: 'p360', label: 'Telefon 360×800', width: 360, height: 800, mobile: true, dsf: 2 },
  cg: { id: 'cg', label: 'CrazyGames 800×450', width: 800, height: 450, mobile: false, dsf: 1.5 },
  land: { id: 'land', label: 'Telefon poziomo 844×390', width: 844, height: 390, mobile: true, dsf: 1.5 },
  desk: { id: 'desk', label: 'Desktop 1366×768', width: 1366, height: 768, mobile: false, dsf: 1 },
  qhd: { id: 'qhd', label: 'Desktop 2560×1440', width: 2560, height: 1440, mobile: false, dsf: 0.5 }
};

/** Builds a save in the page from defaultSave() (so sanitizeSave() keeps it as is).
 *  Values follow the game's rules: Core City rewards owned up to the level,
 *  districts unlocked only behind a cleared boss, xp below the level's need. */
export function buildProfile(kind) {
  const s = defaultSave();
  const today = new Date().toISOString().slice(0, 10);
  s.privacy = { decided: true, analytics: false, ads: false, ts: Date.now() };
  if (kind === 'fresh') return s; // the very first launch
  const order = DISTRICTS.map(d => d.missions);
  const complete = (n, starsOf) => {
    order.flat().slice(0, n).forEach((id, i) => { s.campaign.completed[id] = true; s.campaign.stars[id] = starsOf(i); s.campaign.attempts[id] = 1; });
    DISTRICTS.forEach((d, i) => { if (i > 0) { const prev = DISTRICTS[i - 1].missions; if (s.campaign.completed[prev[prev.length - 1]] && !s.campaign.unlockedDistricts.includes(d.id)) s.campaign.unlockedDistricts.push(d.id); } });
  };
  const coreRewards = (lvl) => {
    if (lvl >= 2) s.auras.owned.push('impuls');
    if (lvl >= 3) s.owned.push('krysztal');
    if (lvl >= 4) s.effects.owned.push('pixel_burst');
    if (lvl >= 5) s.overdriveSkins.owned.push('fala');
    if (lvl >= 6) { s.owned.push('pryzmat'); s.auras.owned.push('pryzmat'); s.effects.owned.push('pryzmat'); s.overdriveSkins.owned.push('pryzmat'); s.badges.push('pryzmat'); }
  };
  s.coach = { moved: true, ate: true, rival: true, danger: true };
  s.login.lastClaimDate = today;
  s.retention.installDate = today;
  if (kind === 'mid') {
    // Core City partly rebuilt: LVL 3 at 46%; Plac + Park done, Port one mission before its boss.
    s.displayName = 'Vega';
    s.coins = 1240; s.prisms = 18;
    s.hub = { coreLevel: 3, coreCharge: 46 };
    coreRewards(3);
    s.owned.push('cyan', 'pink'); s.selected = 'krysztal';
    s.auras.owned.push('spark'); s.auras.selected = 'impuls';
    s.player = { level: 7, xp: 310 };
    s.stats = { runsPlayed: 23, bestArenaScore: 4180, recentArenaScores: [2950, 3310, 4180, 2675, 3620] };
    s.login.day = 3; s.login.totalClaims = 3;
    s.freeChest = { nextAt: 0, opened: 4 };
    complete(29, (i) => [7, 3, 7, 1, 3, 7, 3, 1, 7, 3][i % 10]);
    s.boosters = { time: 2, start: 1, magnet: 1, shield: 1, sprint: 0, gift: true, sprintGift: false };
    s.daily = { lastSeedDate: null, lastSeedScore: 0, streak: 2, lastPlayedDate: null };
  }
  if (kind === 'max') {
    // Core City LVL 6 (the top authored level), half the campaign cleared.
    s.displayName = 'Vega';
    s.coins = 5320; s.prisms = 64;
    s.hub = { coreLevel: 6, coreCharge: 72 };
    coreRewards(6);
    s.owned.push('cyan', 'pink', 'green', 'purple'); s.selected = 'pryzmat';
    s.auras.owned.push('spark', 'ember'); s.auras.selected = 'pryzmat';
    s.effects.owned.push('neon_rose'); s.effects.selected = 'pryzmat';
    s.overdriveSkins.selected = 'pryzmat';
    s.player = { level: 19, xp: 640 };
    s.stats = { runsPlayed: 96, bestArenaScore: 6890, recentArenaScores: [5210, 6890, 4775, 6020, 5540] };
    s.login.day = 5; s.login.totalClaims = 19;
    s.freeChest = { nextAt: Date.now() + 2.5 * 3600e3, opened: 31 };
    complete(124, (i) => [7, 7, 3, 7, 1, 7, 3, 7][i % 8]);
    s.boosters = { time: 3, start: 2, magnet: 2, shield: 1, sprint: 2, gift: true, sprintGift: true };
    s.daily = { lastSeedDate: null, lastSeedScore: 0, streak: 6, lastPlayedDate: null };
  }
  s.unlocks.announced = Array.from(new Set([...unlockedFeatureIds(s), 'warsztat', 'wyzwania', 'kampania', 'boosters']));
  return s;
}

const wait = (page, ms) => page.waitForTimeout(ms);
const closeUnlock = (page) => page.evaluate(() => { const g = window.game; g.unlockQueue = []; clearTimeout(g.unlockShowTimer); document.getElementById('unlockOverlay').classList.add('hidden'); });
const clearConfetti = (page) => page.evaluate(() => { for (const id of ['missionConfetti', 'resultConfetti']) { const el = document.getElementById(id); if (el) el.innerHTML = ''; } });
/** A whole Arena round by the QA bot on a seeded stream; stops on the result screen. */
async function arenaRound(page, { seed, style = 'casual', before = null }) {
  await page.evaluate(({ seed, style, before }) => {
    window.__qaSeedRandom(seed);
    if (before) { const g = window.game; Object.assign(g.save.hub, before.hub || {}); }
    window.__qaPlayArena({ round: { seed }, style, clock0: 500000 });
  }, { seed, style, before });
  await wait(page, 2600);
}

/** The scenes. `stage(page)` leaves the game on the frame to shoot. */
export const SCENES = [
  // ---------------- MIASTO ----------------
  { id: 'm0-welcome', group: 'miasto', title: 'Pierwsze uruchomienie', note: 'Nowy profil przed pierwszą rundą (ekran powitalny)', profile: 'fresh', extra: true,
    stage: async (page) => { await wait(page, 900); } },
  { id: 'm1-early', group: 'miasto', title: 'Miasto · wczesny etap', note: 'Nowy profil po pierwszej ukończonej rundzie Areny (LVL 1)', profile: 'fresh',
    stage: async (page) => { await arenaRound(page, { seed: 4242 }); await closeUnlock(page); await page.evaluate(() => document.getElementById('btnMenu').click()); await wait(page, 900); await closeUnlock(page); await page.evaluate(() => document.querySelectorAll('.screen.overlay-screen:not(.hidden) .btn-link, #btnLoginClose').forEach(() => {})); await wait(page, 300); } },
  { id: 'm2-mid', group: 'miasto', title: 'Miasto · Core City LVL 3', note: 'Core City częściowo odbudowane: LVL 3, 46%', profile: 'mid', responsive: true,
    stage: async (page) => { await wait(page, 900); } },
  { id: 'm3-max', group: 'miasto', title: 'Miasto · Core City LVL 6', note: 'Najwyższy poziom miasta, skrzynia na liczniku', profile: 'max',
    stage: async (page) => { await wait(page, 900); } },
  { id: 'm4-roadmap', group: 'miasto', title: 'Core City · droga nagród', note: 'Arkusz poziomów i nagród (dotknięcie karty miasta)', profile: 'mid', extra: true,
    stage: async (page) => { await page.evaluate(() => window.game.openCoreCityRoadmap()); await wait(page, 500); } },
  // ---------------- DZIELNICE ----------------
  { id: 'd1-list', group: 'dzielnice', title: 'Dzielnice · 12 dzielnic', note: 'Lista wszystkich dzielnic; bieżąca: Port Syntez', profile: 'mid', responsive: true,
    stage: async (page) => { await page.evaluate(() => window.game.openCampaignScreen()); await wait(page, 700); } },
  { id: 'd2-current', group: 'dzielnice', title: 'Dzielnice · aktualna misja', note: 'Karta następnej misji i lista misji dzielnicy', profile: 'mid',
    stage: async (page) => { await page.evaluate(() => { window.game.openCampaignScreen(); const sc = document.querySelector('#campaignScreen .screen-inner'); const t = document.getElementById('missionNextCard'); sc.scrollTop = Math.max(0, t.offsetTop - 70); }); await wait(page, 700); } },
  { id: 'd3-states', group: 'dzielnice', title: 'Dzielnice · ukończona / zablokowana', note: 'Ukończony Plac Neonów; dalej zablokowane dzielnice', profile: 'mid',
    stage: async (page) => { await page.evaluate(() => { window.game.openCampaignScreen(); window.game.selectCampaignDistrict('plac'); }); await wait(page, 700); } },
  { id: 'd4-briefing-boss', group: 'dzielnice', title: 'Odprawa · misja z bossem', note: 'Boss Portu Syntez — cele i ich ikony', profile: 'mid', responsive: true,
    stage: async (page) => { await page.evaluate(() => { const g = window.game; g.openCampaignScreen(); g.openMissionBriefing(g.nextCampaignMissionId()); }); await wait(page, 700); } },
  { id: 'd5-locked', group: 'dzielnice', title: 'Dzielnica zablokowana', note: 'Arkusz informacji o zablokowanej dzielnicy', profile: 'mid', extra: true,
    stage: async (page) => { await page.evaluate(() => { const g = window.game; g.openCampaignScreen(); g.openLockedDistrictInfo(DISTRICTS.find(d => d.id === 'galeria')); }); await wait(page, 500); } },
  // ---------------- WARSZTAT ----------------
  { id: 'w1-skins', group: 'warsztat', title: 'Warsztat · skórki wirów', note: 'Lista skórek; wyposażony „Kryształ”', profile: 'mid', responsive: true,
    stage: async (page) => { await page.evaluate(() => window.game.openWarsztatScreen()); await wait(page, 900); } },
  { id: 'w2-equipped', group: 'warsztat', title: 'Warsztat · wybrana i wyposażona', note: 'Siatka skórek: POSIADANE / WYPOSAŻONE / do kupienia', profile: 'mid',
    stage: async (page) => { await page.evaluate(() => { window.game.openWarsztatScreen(); const sc = document.querySelector('#shopScreen .screen-inner'); const t = document.querySelector('#shopScreen .skin-grid-header'); sc.scrollTop = Math.max(0, t.offsetTop - 64); }); await wait(page, 900); } },
  { id: 'w3-buy', group: 'warsztat', title: 'Warsztat · skórka do kupienia', note: 'Podgląd „Toksycznej Zieleni” (700 monet) z ofertą zakupu', profile: 'mid',
    stage: async (page) => { await page.evaluate(() => { window.game.openWarsztatScreen(); const c = [...document.querySelectorAll('#skinGrid .skin-card')][3]; c.click(); }); await wait(page, 900); } },
  { id: 'w4-locked', group: 'warsztat', title: 'Warsztat · skórka zablokowana', note: 'Podgląd skórki z nagrody („Pryzmat” — Core City LVL 6)', profile: 'mid', extra: true,
    stage: async (page) => { await page.evaluate(() => { window.game.openWarsztatScreen(); const c = [...document.querySelectorAll('#skinGrid .skin-card')][9]; c.click(); }); await wait(page, 900); } },
  { id: 'w5-auras', group: 'warsztat', title: 'Warsztat · smugi', note: 'Inna kategoria: SMUGA (monety i pryzmaty)', profile: 'mid',
    stage: async (page) => { await page.evaluate(() => { window.game.openWarsztatScreen(); document.getElementById('tabAuras').click(); const sc = document.querySelector('#shopScreen .screen-inner'); const t = document.querySelector('#shopScreen .shop-tabs'); sc.scrollTop = Math.max(0, t.offsetTop - 64); }); await wait(page, 900); } },
  // ---------------- NAGRODY ----------------
  { id: 'r1-first-arena', group: 'nagrody', title: 'Wynik · pierwsza Arena', note: 'Pierwsza ukończona runda nowego profilu (zasady FTUE)', profile: 'fresh',
    stage: async (page) => { await arenaRound(page, { seed: 4242 }); await closeUnlock(page); await clearConfetti(page); } },
  { id: 'r2-later-arena', group: 'nagrody', title: 'Wynik · późniejsza Arena', note: 'Runda nr 24 profilu LVL 3', profile: 'mid', responsive: true,
    stage: async (page) => { await arenaRound(page, { seed: 777, style: 'greedy' }); await closeUnlock(page); await clearConfetti(page); } },
  { id: 'r3-mission', group: 'nagrody', title: 'Wynik · misja ukończona', note: 'Misja Portu Syntez zaliczona, gwiazdki i następna misja', profile: 'mid',
    stage: async (page) => { await page.evaluate(() => { window.__qaSeedRandom(5); const g = window.game; const id = g.nextCampaignMissionId(); const prev = DISTRICTS.find(d => d.id === 'port').missions[7]; g.startCampaignMission(prev); if (g.introPending) g.beginMissionPlay(); cancelAnimationFrame(g.rafId); g.running = false; g.mission.elapsed = 24; g.endCampaignMission(true); }); await wait(page, 2200); await closeUnlock(page); await clearConfetti(page); } },
  { id: 'r4-core-level', group: 'nagrody', title: 'Wynik · awans Core City', note: 'Runda, która dobija Core City do LVL 4', profile: 'mid',
    stage: async (page) => { await arenaRound(page, { seed: 777, style: 'greedy', before: { hub: { coreCharge: 94 } } }); await closeUnlock(page); await clearConfetti(page); await page.evaluate(() => { const sc = document.querySelector('#gameOverScreen .screen-inner'); const t = document.querySelector('#gameOverScreen .result-rewards'); if (sc && t) sc.scrollTop = Math.max(0, t.offsetTop - 80); }); await wait(page, 300); } },
  { id: 'r5-core-reward', group: 'nagrody', title: 'Nagroda Core City', note: 'Karta nagrody za LVL 4: efekt „Pikselowy Wybuch”', profile: 'mid',
    stage: async (page) => { await arenaRound(page, { seed: 777, style: 'greedy', before: { hub: { coreCharge: 94 } } }); await wait(page, 2600); await clearConfetti(page); } },
  { id: 'r6-chest', group: 'nagrody', title: 'Darmowa skrzynia', note: 'Otwarcie darmowej skrzyni z Miasta', profile: 'mid',
    stage: async (page) => { await page.evaluate(() => { window.__qaSeedRandom(21); window.game.openFreeChest(); }); await wait(page, 2600); } },
  { id: 'r7-login', group: 'nagrody', title: 'Nagroda dzienna', note: 'Kalendarz 7 dni — dzień 4', profile: 'mid',
    stage: async (page) => { await page.evaluate(() => { const g = window.game; g.save.login.lastClaimDate = '2026-11-12'; g.maybeShowLoginReward(); }); await wait(page, 900); } },
  { id: 'r8-district-unlock', group: 'nagrody', title: 'Odblokowanie dzielnicy', note: 'Boss Portu pokonany: otwiera się Galeria Glitch', profile: 'mid', extra: true,
    stage: async (page) => { await page.evaluate(() => { window.__qaSeedRandom(5); const g = window.game; const id = g.nextCampaignMissionId(); g.startCampaignMission(id); if (g.introPending) g.beginMissionPlay(); cancelAnimationFrame(g.rafId); g.running = false; g.mission.elapsed = 30; g.endCampaignMission(true); }); await wait(page, 3200); await clearConfetti(page); } },
  // ---------------- POWIĄZANE (audyt) ----------------
  { id: 'x1-wyzwania', group: 'inne', title: 'Wyzwania', note: 'Audyt: ekran Wyzwań', profile: 'mid', extra: true,
    stage: async (page) => { await page.evaluate(() => window.game.openChallengesScreen()); await wait(page, 700); } },
  { id: 'x2-profil', group: 'inne', title: 'Profil i ustawienia', note: 'Audyt: Profil', profile: 'mid', extra: true,
    stage: async (page) => { await page.evaluate(() => window.game.openProfileScreen()); await wait(page, 600); } }
];

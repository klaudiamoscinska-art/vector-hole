// FTUE-2 „Platformy”: the game fits every frame Poki / CrazyGames / phones /
// tablets / fullscreen give it.
//  - Matrix: the owner's 14 sizes + CrazyGames' required iframe sizes; every
//    main screen in every size, the whole screen catalogue in representative
//    sizes. Per screen: no page scroll, no button cut off or outside the
//    viewport (a scrolling panel may hold them -- then they must be reachable
//    by scrolling it), the screen's main action in view without scrolling and
//    hit where it is drawn (nothing covers it: consent bar, nav, HUD), no two
//    controls overlapping, tap targets, smallest text, HUD coverage in a round.
//  - Orientation changes and live resizes (a round, a menu, a sheet), a
//    portal-like iframe host (arrow keys / space / wheel never scroll the host
//    page, focus loss stops steering, fullscreen = the frame growing).
//  - Input: mouse steering stops when the cursor leaves the frame or the
//    window loses focus, held keys are released on blur, P / Escape / Space
//    pause, keys typed in a text field never steer or pause, a cancelled
//    touch stops steering, no steering while a modal is open.
// Screenshots -> qa/out/responsive/<WxH>/<scene>.png (+ report.json).
// Usage: node qa/responsive.mjs [--shots] [--only=844x390,640x360] [--scenes=hub,arena]
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, veteranSave, report, expectAll, is, holds, isMain, OUT, QA_TICK, chromium, installQaBridge } from './lib.mjs';

// [width, height, kind] -- kind: 'phone' (touch, DPR 3/2), 'tablet' (touch,
// DPR 2), 'desk' (mouse, DPR 1: a portal iframe on a desktop page).
export const MATRIX = [
  [320, 568, 'phone', 'mały telefon pionowo'],
  [375, 667, 'phone', 'telefon pionowo'],
  [390, 844, 'phone', 'iPhone pionowo'],
  [667, 375, 'phone', 'mały telefon poziomo'],
  [844, 390, 'phone', 'iPhone poziomo'],
  [640, 360, 'desk', 'Poki (mała ramka)'],
  [800, 450, 'phone', 'kompaktowa 16:9 / CrazyGames mobile'],
  [836, 470, 'desk', 'Poki'],
  [1031, 580, 'desk', 'Poki'],
  [768, 1024, 'tablet', 'tablet pionowo'],
  [1024, 768, 'tablet', 'tablet poziomo'],
  [1280, 720, 'desk', 'komputer / CrazyGames fullscreen'],
  [1920, 1080, 'desk', 'Full HD / CrazyGames fullscreen'],
  [2560, 1440, 'desk', 'duży ekran / fullscreen'],
  // CrazyGames requirements (docs.crazygames.com/requirements/gameplay, checked 2026-10-24)
  [821, 462, 'desk', 'CrazyGames desktop'],
  [907, 510, 'desk', 'CrazyGames desktop'],
  [1077, 606, 'desk', 'CrazyGames desktop'],
  [1216, 684, 'desk', 'CrazyGames desktop'],
  [1366, 768, 'desk', 'CrazyGames fullscreen'],
  [1536, 864, 'desk', 'CrazyGames fullscreen'],
  [1080, 607, 'tablet', 'CrazyGames tablet'],
];
// The whole screen catalogue runs in these (the main screens run everywhere).
const FULL_CATALOGUE = ['320x568', '390x844', '844x390', '640x360', '800x450', '1280x720', '768x1024'];
const MAIN_SCENES = ['welcome', 'hub', 'hubConsent', 'campaign', 'briefing', 'shop', 'challenges', 'arena', 'arenaLate', 'pause', 'evolution', 'results', 'mission', 'missionResult', 'login'];
const EXTRA_SCENES = ['profile', 'leaveConfirm', 'resetConfirm', 'infoSheet', 'unlock', 'missionStart', 'revive', 'ad', 'quickEquip', 'resultsFailed', 'challengeHub'];

const args = process.argv.slice(2);
const argOf = (k) => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1].split(',') : null; };

/* ---------- in-page audit ------------------------------------------------
   Runs in the page: what the player can see and reach on the open screen.
   root = the layer the scene is about (a .screen, an overlay, the HUD);
   primary = its main action (must be in view without scrolling and hit by a
   tap at its centre); mustSee = elements that must be fully in view. */
const AUDIT = function ({ root, primary, mustSee = [], mustPeek = [], overlapAllow = [], minTap = 24 }) {
  const W = innerWidth, H = innerHeight;
  const vis = (el) => {
    if (!el) return false;
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
      if (a.classList && a.classList.contains('hidden')) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0.5 && r.height > 0.5;
  };
  const box = (r) => ({ l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) });
  const name = (el) => el.id ? '#' + el.id : (el.className && typeof el.className === 'string' ? el.tagName.toLowerCase() + '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : el.tagName.toLowerCase()) + (el.textContent ? ` "${el.textContent.trim().replace(/\s+/g, ' ').slice(0, 24)}"` : '');
  // Where an element can be seen: its box cut by every clipping ancestor;
  // a scrolling ancestor makes it reachable (it may sit outside the
  // ancestor's current view) as long as it fits in it.
  const reach = (el) => {
    let r = el.getBoundingClientRect();
    let x0 = r.left, x1 = r.right, y0 = r.top, y1 = r.bottom;
    let scrolled = false, inScroller = false;
    let fixed = getComputedStyle(el).position === 'fixed';
    for (let a = el.parentElement; a && a !== document.body && !fixed; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.position === 'fixed') fixed = true;
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const ar = a.getBoundingClientRect();
      const canY = /auto|scroll/.test(cs.overflowY) && a.scrollHeight > a.clientHeight + 1;
      const canX = /auto|scroll/.test(cs.overflowX) && a.scrollWidth > a.clientWidth + 1;
      if (canY || canX) inScroller = true;
      if (canY) {
        if (y1 - y0 > ar.height + 1) return { ok: false, why: 'taller than its scroll box ' + name(a) };
        if (y0 < ar.top || y1 > ar.bottom) { scrolled = true; const h = y1 - y0; y0 = Math.max(ar.top, Math.min(y0, ar.bottom - h)); y1 = y0 + h; }
      } else if (y0 < ar.top - 1 || y1 > ar.bottom + 1) return { ok: false, why: 'cut by ' + name(a) + ' (y)' };
      if (canX) {
        if (x0 < ar.left || x1 > ar.right) { scrolled = true; const w = x1 - x0; x0 = Math.max(ar.left, Math.min(x0, ar.right - w)); x1 = x0 + w; }
      } else if (x0 < ar.left - 1 || x1 > ar.right + 1) return { ok: false, why: 'cut by ' + name(a) + ' (x)' };
    }
    if (x0 < -1 || x1 > W + 1 || y0 < -1 || y1 > H + 1) return { ok: false, why: `outside the viewport ${box({ left: x0, top: y0, right: x1, bottom: y1, width: x1 - x0, height: y1 - y0 }).l},${Math.round(y0)}..${Math.round(x1)},${Math.round(y1)}` };
    return { ok: true, scrolled, inScroller };
  };
  const inView = (el) => { const r = el.getBoundingClientRect(); return r.left >= -1 && r.top >= -1 && r.right <= W + 1 && r.bottom <= H + 1; };
  const hitOk = (el) => {
    const r = el.getBoundingClientRect();
    const pts = [[0.5, 0.5], [0.2, 0.5], [0.8, 0.5]];
    return pts.every(([fx, fy]) => { const h = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy); return h && (h === el || el.contains(h)); });
  };
  const coveredBy = (el) => { const r = el.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return h && !(h === el || el.contains(h)) ? name(h.closest('[id]') || h) : null; };

  const rootEl = typeof root === 'string' ? document.querySelector(root) : root;
  const out = { W, H, wide: document.body.classList.contains('wide'), compact: document.body.classList.contains('compact'), ui: +(window.game && window.game.uiScale || 1).toFixed(3), errors: [] };
  // 1. The page itself never scrolls (a portal iframe would scroll inside).
  const se = document.scrollingElement || document.documentElement;
  const sx = se.scrollWidth > W + 1, sy = se.scrollHeight > H + 1;
  window.scrollTo(0, 99999); const moved = window.scrollY > 0 || window.scrollX > 0; window.scrollTo(0, 0);
  out.pageScroll = sx || sy || moved;
  if (!rootEl || !vis(rootEl)) { out.rootMissing = true; return out; }
  // 2. Every control in the layer can be seen / reached.
  const ctrls = [...rootEl.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [tabindex="0"]')].filter(vis);
  out.controls = ctrls.length;
  out.unreachable = []; out.scrollOnly = []; out.smallTaps = []; out.covered = [];
  for (const el of ctrls) {
    const r = reach(el);
    if (!r.ok) { out.unreachable.push(name(el) + ': ' + r.why); continue; }
    if (r.scrolled) out.scrollOnly.push(name(el));
    const b = el.getBoundingClientRect();
    if (Math.min(b.width, b.height) < minTap - 0.5 && !el.closest('.hub-challenge-x')) out.smallTaps.push(`${name(el)} ${Math.round(b.width)}×${Math.round(b.height)}`);
    // (a control in a scrolling panel can be scrolled clear of a bar over it)
    if (!r.scrolled && !r.inScroller && inView(el)) { const c = coveredBy(el); if (c) out.covered.push(`${name(el)} under ${c}`); }
  }
  // 3. Controls never overlap each other (nested ones aside).
  out.overlaps = [];
  const stickyIn = (el) => { for (let a = el; a && a !== rootEl.parentElement; a = a.parentElement) if (getComputedStyle(a).position === 'sticky') return true; return false; };
  const rs = ctrls.map(el => ({ el, r: el.getBoundingClientRect() })).filter(o => reach(o.el).ok && !reach(o.el).scrolled);
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const a = rs[i], c = rs[j];
    if (a.el.contains(c.el) || c.el.contains(a.el)) continue;
    const ix = Math.min(a.r.right, c.r.right) - Math.max(a.r.left, c.r.left), iy = Math.min(a.r.bottom, c.r.bottom) - Math.max(a.r.top, c.r.top);
    // a sticky bar over the scrolled content is by design (it leaves the
    // content when scrolled to its own place)
    if (ix > 3 && iy > 3 && !stickyIn(a.el) && !stickyIn(c.el)) {
      const pair = name(a.el) + ' × ' + name(c.el);
      if (!overlapAllow.some(s => pair.includes(s))) out.overlaps.push(pair);
    }
  }
  // 4. The main action: in view, no scrolling, nothing over it, a real tap target.
  if (primary) {
    const p = document.querySelector(primary);
    if (!p || !vis(p)) out.primary = { missing: primary };
    else { const b = p.getBoundingClientRect(); out.primary = { sel: primary, inView: inView(p), hit: hitOk(p), by: coveredBy(p), box: box(b), tap: Math.round(Math.min(b.width, b.height)) }; }
  }
  // mustPeek: a long list whose start must show on screen (the rest scrolls)
  out.mustPeek = mustPeek.map(sel => { const el = document.querySelector(sel); if (!el || !vis(el)) return { sel, missing: true }; const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + 12, Math.min(r.top + 12, H - 1)); return { sel, peeks: r.top + 12 < H && !!top && (el.contains(top) || top === el), top: Math.round(r.top) }; });
  out.mustSee = mustSee.map(sel => { const el = document.querySelector(sel); if (!el || !vis(el)) return { sel, missing: true }; return { sel, inView: inView(el), box: box(el.getBoundingClientRect()) }; });
  // 5. Smallest visible text (CSS px on screen = font-size × every zoom above it).
  let minFont = 99, minFontAt = '';
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement; if (!vis(el)) continue;
    const rr = el.getBoundingClientRect(); if (rr.bottom < 0 || rr.top > H || rr.right < 0 || rr.left > W) continue;
    let z = 1; for (let a = el; a; a = a.parentElement) z *= parseFloat(getComputedStyle(a).zoom) || 1;
    const f = parseFloat(getComputedStyle(el).fontSize) * z;
    if (f < minFont) { minFont = f; minFontAt = name(el); }
  }
  out.minFont = +minFont.toFixed(1); out.minFontAt = minFontAt;
  return out;
};

/* ---------- scenes ---------------------------------------------------------
   Each: stage(page) puts the game in that state; then the audit options. */
const BOOT_WAIT = () => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state;
async function loadSave(page, save) {
  await page.evaluate((s) => { localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)); sessionStorage.setItem('__qaSeeded', '1'); }, save);
  await page.reload();
  await page.waitForFunction(BOOT_WAIT);
}
async function veteran(page, o = {}) {
  const s = await veteranSave(page, { missions: 30, coins: 900, runsPlayed: 6, ...o });
  if (o.undecided) s.privacy = { decided: false, analytics: false, ads: false, ts: 0 };
  s.login.lastClaimDate = o.loginDue ? '2000-01-01' : s.login.lastClaimDate;
  await loadSave(page, s);
  await page.waitForTimeout(400);
}
const frozenRound = () => { const gm = window.game; gm.checkEvolutionTriggers = () => {}; gm.startRound({ seed: 777 }); cancelAnimationFrame(gm.rafId); gm.running = false; gm.render(performance.now() / 1000); };
const HUD_MUST = ['#btnPause', '#hud-tier-strip'];

export const SCENES = {
  welcome: { stage: async (p) => { await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(BOOT_WAIT); await p.waitForTimeout(900); },
    audit: { root: '#mainMenu', primary: '#btnWelcomePlay', mustSee: ['.welcome-logo', '.welcome-stage'] } },
  hub: { stage: async (p) => { await veteran(p); },
    audit: { root: '#mainMenu', primary: '#btnStart', mustSee: ['#hubCampaignTile', '#btnDaily', '#hubHeroStage', '#bottomNav'] } },
  hubConsent: { stage: async (p) => { await veteran(p, { undecided: true }); },
    audit: { root: '#mainMenu', primary: '#btnStart', mustSee: ['#hubCampaignTile', '#btnDaily', '#consentBar', '#btnConsentYes', '#btnConsentNo'] } },
  challengeHub: { stage: async (p) => { await veteran(p); await p.evaluate(() => { const gm = window.game; gm.save.challenge = { seed: 12345, score: 4321, from: 'Ania', receivedAt: Date.now() }; gm.showScreen('mainMenu'); }); await p.waitForTimeout(300); },
    audit: { root: '#mainMenu', primary: '#btnStart', mustSee: ['#btnAcceptChallenge', '#hubCampaignTile'] } },
  login: { stage: async (p) => { await veteran(p, { loginDue: true }); await p.evaluate(() => { const gm = window.game; gm.bootFirstRun = false; gm.maybeShowLoginReward(); }); await p.waitForTimeout(500); },
    audit: { root: '#loginRewardScreen', primary: '#btnLoginClaim' } },
  campaign: { stage: async (p) => { await veteran(p); await p.evaluate(() => window.game.openCampaignScreen()); await p.waitForTimeout(500); },
    audit: { root: '#campaignScreen', primary: '#missionNextCard [data-mc-play], #missionNextCard button', mustSee: ['#districtMap', '#bottomNav'] } },
  briefing: { stage: async (p) => { await veteran(p); await p.evaluate(() => { const gm = window.game; gm.openCampaignScreen(); gm.openMissionBriefing('M31'); }); await p.waitForTimeout(600); },
    audit: { root: '#missionBriefing', primary: '#briefingCard .mc-play', mustSee: ['#btnBriefingClose'] } },
  shop: { stage: async (p) => { await veteran(p); await p.evaluate(() => window.game.openWarsztatScreen()); await p.waitForTimeout(500); },
    audit: { root: '#shopScreen', primary: null, mustSee: ['#tabSkins', '#bottomNav'], mustPeek: ['#skinGrid'] } },
  challenges: { stage: async (p) => { await veteran(p); await p.evaluate(() => window.game.openChallengesScreen()); await p.waitForTimeout(500); },
    audit: { root: '#challengesScreen', primary: '#btnPlayDaily', mustSee: ['#bottomNav'] } },
  profile: { stage: async (p) => { await veteran(p); await p.evaluate(() => window.game.openProfileScreen()); await p.waitForTimeout(400); },
    audit: { root: '#profileScreen', primary: '#btnProfileBack' } },
  resetConfirm: { stage: async (p) => { await veteran(p); await p.evaluate(() => { window.game.openProfileScreen(); document.getElementById('btnResetProfile').click(); }); await p.waitForTimeout(400); },
    audit: { root: '#resetProfileConfirm', primary: '#btnResetProfileNo', mustSee: ['#btnResetProfileYes'] } },
  infoSheet: { stage: async (p) => { await veteran(p); await p.evaluate(() => window.game.openCoreCityRoadmap()); await p.waitForTimeout(500); },
    audit: { root: '#infoSheet', primary: '#btnInfoSheetClose' } },
  unlock: { stage: async (p) => { await veteran(p); await p.evaluate(() => { const gm = window.game; const f = { id: 'wyzwania', kind: 'feature', color: '#EFCB63', icon: '', eyebrow: 'NOWA ZAKŁADKA', title: 'WYZWANIA', desc: 'Wyzwanie dnia: ta sama mapa dla wszystkich.', cta: 'ZOBACZ' }; gm.unlockQueue = [f, { ...f }]; gm.unlockQueueTotal = 2; gm.showNextUnlock(); }); await p.waitForTimeout(1600); },
    audit: { root: '#unlockOverlay', primary: '#btnUnlockLater', mustSee: ['#unlockTitle'] } },
  arena: { stage: async (p) => { await veteran(p); await p.addScriptTag({ content: QA_TICK }); await p.evaluate(frozenRound); await p.evaluate(() => window.__qaTick(240)); await p.waitForTimeout(200); },
    audit: { root: '#hud', primary: '#btnPause', mustSee: HUD_MUST, hud: true } },
  arenaLate: { stage: async (p) => { await veteran(p); await p.addScriptTag({ content: QA_TICK }); await p.evaluate(frozenRound); await p.evaluate(() => window.__qaTick(2400)); await p.waitForTimeout(200); },
    audit: { root: '#hud', primary: '#btnPause', mustSee: HUD_MUST, hud: true } },
  pause: { stage: async (p) => { await veteran(p); await p.evaluate(() => { frozenRoundIn(); const gm = window.game; gm.running = true; gm.pauseGame(); }); await p.waitForTimeout(400); },
    audit: { root: '#pauseSheet', primary: '#btnResume', mustSee: ['#btnLeaveRun', '#btnRestart'] } },
  leaveConfirm: { stage: async (p) => { await veteran(p); await p.evaluate(() => { frozenRoundIn(); const gm = window.game; gm.running = true; gm.pauseGame(); document.getElementById('btnLeaveRun').click(); }); await p.waitForTimeout(400); },
    audit: { root: '#leaveConfirm', primary: '#btnLeaveConfirmNo', mustSee: ['#btnLeaveConfirmYes'] } },
  quickEquip: { stage: async (p) => { await veteran(p); await p.evaluate(() => { frozenRoundIn(); const gm = window.game; gm.running = true; gm.pauseGame(); document.getElementById('btnQuickEquip').click(); }); await p.waitForTimeout(400); },
    audit: { root: '#quickEquipScreen', primary: '#btnQuickEquipApply', mustSee: ['#btnQuickEquipClose'] } },
  evolution: { stage: async (p) => { await veteran(p); await p.evaluate(() => { frozenRoundIn(); const gm = window.game; delete gm.checkEvolutionTriggers; gm.evolutionOffersTriggered = new Set(); gm.offerEvolution(); gm.render(performance.now() / 1000); }); await p.waitForTimeout(700); },
    audit: { root: '#evolutionOverlay', primary: '#evolutionCards > *', mustSee: ['#btnEvolutionSkip'] } },
  results: { stage: async (p) => { await veteran(p); await p.evaluate(() => { const gm = window.game; gm.startRound({ seed: 777 }); cancelAnimationFrame(gm.rafId); gm.player.score = 4200; gm.endRound(); }); await p.waitForTimeout(3200); await p.evaluate(() => { window.game.unlockQueue = []; document.getElementById('unlockOverlay').classList.add('hidden'); }); },
    audit: { root: '#gameOverScreen', primary: '#btnPlayAgain', mustSee: ['#finalScore'] } },
  resultsFailed: { stage: async (p) => { await veteran(p, { runsPlayed: 1 }); await p.evaluate(() => { const gm = window.game; gm.startRound({ seed: 778 }); cancelAnimationFrame(gm.rafId); gm.player.score = 50; gm.endRound(); }); await p.waitForTimeout(3200); await p.evaluate(() => { window.game.unlockQueue = []; document.getElementById('unlockOverlay').classList.add('hidden'); }); },
    audit: { root: '#gameOverScreen', primary: '#btnPlayAgain', mustSee: ['#finalScore'] } },
  missionStart: { stage: async (p) => { await veteran(p); await p.evaluate(() => { const gm = window.game; gm.startCampaignMission('M31'); }); await p.waitForTimeout(600); },
    audit: { root: '#missionStartOverlay', primary: '#missionStartCard .btn-primary' } },
  mission: { stage: async (p) => { await veteran(p); await p.evaluate(() => { const gm = window.game; gm.startCampaignMission('M31'); if (gm.introPending) gm.beginMissionPlay(); cancelAnimationFrame(gm.rafId); gm.running = false; gm.hideNelaToast(); for (let i = 0; i < 30; i++) gm.updateCampaign(1 / 30); gm.renderCampaign(1); }); await p.waitForTimeout(300); },
    audit: { root: '#hud', primary: '#btnPause', mustSee: [...HUD_MUST, '#hud-goal'], hud: true } },
  revive: { stage: async (p) => { await veteran(p); await p.evaluate(() => { const gm = window.game; gm.startCampaignMission('M02'); if (gm.introPending) gm.beginMissionPlay(); const m = gm.mission; const st = m.def.goal.steps || []; if (st[0] && st[0].eat) m.eatenByType[st[0].eat] = Math.ceil(gm.campaignGoalItems()[0].target * 0.7); m.elapsed = m.def.timeLimit; gm.updateCampaign(0.016); cancelAnimationFrame(gm.rafId); }); await p.waitForTimeout(600); },
    audit: { root: '#reviveOverlay', primary: '#btnReviveAd', mustSee: ['#btnReviveNo'] } },
  missionResult: { stage: async (p) => { await veteran(p); await p.evaluate(() => { const gm = window.game; gm.startCampaignMission('M31'); if (gm.introPending) gm.beginMissionPlay(); cancelAnimationFrame(gm.rafId); gm.running = false; gm.endCampaignMission(true); }); await p.waitForTimeout(1800); await p.evaluate(() => { window.game.unlockQueue = []; document.getElementById('unlockOverlay').classList.add('hidden'); }); },
    audit: { root: '#missionResultScreen', primary: '#btnMissionNext', mustSee: ['#missionResultTitle'] } },
  ad: { stage: async (p) => { await veteran(p); await p.evaluate(() => { window.game.monetization.demoAd(true); }); await p.waitForTimeout(400); },
    audit: { root: '#adOverlay', primary: null, mustSee: ['#adKind', '#adCountdown'] } },
};
// shared in-page helper for the scenes above
const PAGE_HELPERS = `window.frozenRoundIn = ${frozenRound.toString()};`;

function vpKind(kind) {
  if (kind === 'desk') return { mobile: false, deviceScaleFactor: 1 };
  if (kind === 'tablet') return { mobile: true, deviceScaleFactor: 2 };
  return { mobile: true, deviceScaleFactor: 3 };
}

/** Judges one audit result; returns [ok, problems[]] */
export function judge(scene, a, vp) {
  const probs = [];
  if (a.rootMissing) return [false, ['layer not visible']];
  if (a.pageScroll) probs.push('page scrolls');
  if (a.unreachable.length) probs.push('unreachable: ' + a.unreachable.slice(0, 4).join(' | '));
  if (a.covered.length) probs.push('covered: ' + a.covered.slice(0, 3).join(' | '));
  if (a.overlaps.length) probs.push('overlap: ' + a.overlaps.slice(0, 3).join(' | '));
  if (a.primary) {
    if (a.primary.missing) probs.push('main action missing ' + a.primary.missing);
    else {
      if (!a.primary.inView) probs.push(`main action out of view ${JSON.stringify(a.primary.box)}`);
      if (!a.primary.hit) probs.push(`main action not hit (under ${a.primary.by})`);
      if (a.primary.tap < 36) probs.push(`main action ${a.primary.tap}px`);
    }
  }
  for (const m of a.mustSee) { if (m.missing) probs.push(`${m.sel} missing`); else if (!m.inView) probs.push(`${m.sel} out of view ${JSON.stringify(m.box)}`); }
  for (const m of a.mustPeek || []) { if (m.missing) probs.push(`${m.sel} missing`); else if (!m.peeks) probs.push(`${m.sel} not on screen (top ${m.top})`); }
  if (a.smallTaps.length) probs.push('small taps: ' + a.smallTaps.slice(0, 3).join(' | '));
  if (a.minFont < 9) probs.push(`text ${a.minFont}px (${a.minFontAt})`);
  if (a.hud && a.hud.cover > 0.34) probs.push(`HUD covers ${(a.hud.cover * 100).toFixed(0)}% of the screen`);
  if (a.hud && a.hud.overlaps.length) probs.push('HUD overlap: ' + a.hud.overlaps.join(' | '));
  if (a.hud && !a.hud.centerFree) probs.push('HUD over the vortex');
  return [probs.length === 0, probs];
}

/** In a round: how much of the play field the HUD panels cover, whether
 *  they overlap each other / the minimap, and whether the vortex is free. */
const HUD_AUDIT = function () {
  const gm = window.game, W = innerWidth, H = innerHeight;
  const ids = ['btnPause', 'hud-topright', 'hud-tier-strip', 'hud-goal', 'nelaToast', 'nowPlaying', 'mobile-hint', 'overdriveBanner'];
  const boxes = ids.map(id => { const el = document.getElementById(id); if (!el || el.classList.contains('hidden') || getComputedStyle(el).display === 'none') return null; const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 ? { id, l: r.left, t: r.top, r: r.right, b: r.bottom } : null; }).filter(Boolean);
  if (gm.showMinimap) { const m = gm.minimapSize(), mg = gm.minimapMargin(); boxes.push({ id: 'minimap', ...(gm.minimapRect ? gm.minimapRect() : { l: W - m - mg, t: H - m - mg, r: W - mg, b: H - mg }) }); }
  // coverage on a 4 px grid (union of boxes)
  let covered = 0, total = 0;
  for (let y = 2; y < H; y += 4) for (let x = 2; x < W; x += 4) { total++; if (boxes.some(b => x >= b.l && x <= b.r && y >= b.t && y <= b.b)) covered++; }
  const overlaps = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], c = boxes[j];
    if (Math.min(a.r, c.r) - Math.max(a.l, c.l) > 2 && Math.min(a.b, c.b) - Math.max(a.t, c.t) > 2) overlaps.push(a.id + '×' + c.id);
  }
  const cx = W / 2, cy = H / 2, rad = Math.max(30, (gm.player ? gm.player.radius * gm.zoom : 30));
  const centerFree = !boxes.some(b => b.l < cx + rad && b.r > cx - rad && b.t < cy + rad && b.b > cy - rad);
  return { cover: +(covered / total).toFixed(3), overlaps, centerFree, boxes: boxes.map(b => ({ id: b.id, l: Math.round(b.l), t: Math.round(b.t), r: Math.round(b.r), b: Math.round(b.b) })), rank: (() => { const el = document.getElementById('hud-topright'); return el ? Math.round(el.getBoundingClientRect().height) : 0; })() };
};

export async function auditScene(page, sceneName) {
  const sc = SCENES[sceneName];
  await sc.stage(page);
  const a = await page.evaluate(AUDIT, sc.audit);
  if (sc.audit.hud) a.hud = await page.evaluate(HUD_AUDIT);
  return a;
}

async function openVp(url, [w, h, kind]) {
  const g = await openGame(url, { viewport: { width: w, height: h }, ...vpKind(kind) });
  await g.context.addInitScript(PAGE_HELPERS);
  await g.page.addScriptTag({ content: PAGE_HELPERS });
  return g;
}

export async function runResponsiveChecks(url, { shots = true, only = null, scenes = null, outDir = path.join(OUT, 'responsive') } = {}) {
  const results = [];
  const table = [];
  fs.mkdirSync(outDir, { recursive: true });
  for (const vp of MATRIX) {
    const tag = `${vp[0]}x${vp[1]}`;
    if (only && !only.includes(tag)) continue;
    const list = (FULL_CATALOGUE.includes(tag) ? [...MAIN_SCENES, ...EXTRA_SCENES] : MAIN_SCENES).filter(s => !scenes || scenes.includes(s));
    const g = await openVp(url, vp);
    fs.mkdirSync(path.join(outDir, tag), { recursive: true });
    for (const s of list) {
      let a, ok, probs;
      try {
        a = await auditScene(g.page, s);
        await g.page.addScriptTag({ content: PAGE_HELPERS });
        [ok, probs] = judge(s, a, vp);
      } catch (e) { ok = false; probs = ['crash: ' + String(e.message || e).split('\n')[0]]; a = {}; }
      if (shots) await g.page.screenshot({ path: path.join(outDir, tag, s + '.png') }).catch(() => {});
      table.push({ vp: tag, kind: vp[2], label: vp[3], scene: s, ok, probs, layout: a.compact ? 'compact' : (a.wide ? 'wide' : 'phone'), ui: a.ui, minFont: a.minFont, primary: a.primary, hud: a.hud });
      results.push(report(`${tag} ${s}: fits (no page scroll, nothing cut off or covered, main action in view)`, ok, probs.join(' ; ') || `${a.compact ? 'compact' : (a.wide ? 'wide' : 'phone')} ui ${a.ui} · min text ${a.minFont}px`));
    }
    results.push(report(`${tag}: no runtime errors`, g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(table, null, 2));
  return results;
}

/* ---------- the game in a portal-like iframe, live resizes, input ----------
   A host page (taller than the window, like a portal's game page) embeds
   the game in an iframe from another origin. */
const READY = () => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state;
async function hostWithGame(url, { frame = [640, 360], viewport = [1280, 900] } = {}) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: viewport[0], height: viewport[1] }, deviceScaleFactor: 1, locale: 'pl-PL' });
  await installQaBridge(context);
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  const errors = [];
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message)));
  page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_FAILED|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  // the host page comes from a second local server: another origin than
  // the game, like a portal (a fulfilled route would be a public address
  // and Chromium's local-network checks would block the game in it)
  const hostDir = path.join(OUT, 'responsive-host');
  fs.mkdirSync(hostDir, { recursive: true });
  fs.writeFileSync(path.join(hostDir, 'index.html'),
    `<!doctype html><html><body style="margin:0;height:3000px;background:#222"><div style="height:200px;color:#fff">PORTAL</div>` +
    `<iframe id="g" src="${url}" style="display:block;width:${frame[0]}px;height:${frame[1]}px;border:0" allow="fullscreen; autoplay"></iframe>` +
    `<button id="fs" style="margin:20px" onclick="document.getElementById('g').requestFullscreen().then(()=>window.__fs='ok',e=>window.__fs='err: '+e.message)">fullscreen</button></body></html>`);
  const host = await serve({ root: hostDir });
  const hostUrl = host.url;
  await page.goto(hostUrl);
  const gameFrame = async () => { const f = page.frames().find(fr => fr !== page.mainFrame()); await f.waitForFunction(READY, null, { timeout: 15000 }); return f; };
  let f = await gameFrame();
  const save = await f.evaluate(() => { const s = defaultSave(); s.stats.runsPlayed = 6; s.unlocks.announced = ['warsztat', 'wyzwania', 'kampania']; s.coach = { moved: true, ate: true, rival: true, danger: true }; s.login.lastClaimDate = new Date().toISOString().slice(0, 10); s.privacy = { decided: true, analytics: false, ads: false, ts: Date.now() }; return s; });
  await f.evaluate((s) => { localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)); location.reload(); }, save).catch(() => {});
  await page.waitForTimeout(300);
  f = await gameFrame();
  await f.waitForTimeout(400);
  return { browser, context, page, frame: f, errors, close: async () => { await browser.close(); host.server.close(); } };
}

export async function runPlatformInputChecks(url) {
  const results = [];
  // --- 1. Iframe 640x360 on a long portal page: the host never scrolls ---
  {
    const h = await hostWithGame(url);
    const { page } = h; let f = h.frame;
    const hostY = () => page.evaluate(() => Math.round(scrollY));
    // a click on Miasto's header (no button) gives the game focus
    await page.mouse.click(300, 206);
    for (const k of ['ArrowDown', 'ArrowDown', 'PageDown', 'Space', 'End', 'ArrowRight']) await page.keyboard.press(k);
    await page.waitForTimeout(300);
    const yKeys = await hostY();
    await page.mouse.move(320, 380);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(400);
    const yWheel = await hostY();
    await page.keyboard.down('Control'); await page.mouse.wheel(0, -300); await page.keyboard.up('Control');
    await page.waitForTimeout(200);
    results.push(expectAll('iframe 640×360 in a portal page: menu keys (arrows, PageDown, Space, End) and the mouse wheel over the game never scroll the host page', {
      keys: is(yKeys, 0), wheel: is(yWheel, 0), afterZoomWheel: is(await hostY(), 0) }, JSON.stringify({ yKeys, yWheel })));
    // a scrolling panel of the game still scrolls with the wheel
    await f.evaluate(() => window.game.openProfileScreen());
    await page.waitForTimeout(300);
    await page.mouse.move(320, 380); await page.mouse.wheel(0, 300); await page.waitForTimeout(400);
    const inner = await f.evaluate(() => document.querySelector('#profileScreen .screen-inner').scrollTop);
    results.push(report('iframe: the game\'s own scrolling panel (Profil) still scrolls with the wheel; the host stays put', inner > 50 && await hostY() === 0, `profile scrollTop ${inner}, host ${await hostY()}`));
    // typing in a text field never steers or pauses
    await f.click('#displayNameInput');
    await page.keyboard.down('KeyD'); await page.keyboard.press('KeyP'); await page.keyboard.press('Space');
    const typed = await f.evaluate(() => ({ kx: window.game.keyDir.x, val: document.getElementById('displayNameInput').value }));
    await page.keyboard.up('KeyD');
    results.push(report('text field (profile name): typing D / P / Space types, it never steers', typed.kx === 0 && /dp/i.test(typed.val), JSON.stringify(typed)));
    await f.evaluate(() => { document.getElementById('displayNameInput').value = ''; document.activeElement.blur(); window.game.showScreen('mainMenu'); });
    // --- a round: arrows steer without scrolling the host; P / Space / Escape pause
    await f.evaluate(() => window.game.startArenaRound());
    await page.waitForTimeout(500);
    await page.mouse.click(40, 500); // into the play field (bottom-left, away from HUD buttons)
    await f.evaluate(() => { window.game.pointerScreen = null; });
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(400);
    const steer = await f.evaluate(() => ({ ky: window.game.keyDir.y, running: window.game.running, paused: window.game.paused }));
    await page.keyboard.up('ArrowDown');
    results.push(report('round in the iframe: ArrowDown steers the vortex and does not scroll the host page', steer.ky > 0 && steer.running && !steer.paused && await hostY() === 0, JSON.stringify(steer) + ' host ' + await hostY()));
    const pauses = {};
    for (const k of ['KeyP', 'Space', 'Escape']) {
      await page.keyboard.press(k); await page.waitForTimeout(80);
      const a = await f.evaluate(() => window.game.paused);
      await page.keyboard.press(k); await page.waitForTimeout(80);
      const b = await f.evaluate(() => window.game.paused);
      pauses[k] = [a, b];
    }
    results.push(expectAll('pause keys: P, Space and Escape each pause and resume the round (Poki: ESC or spacebar; P when a portal uses Escape for fullscreen)', {
      P: holds(pauses.KeyP[0] === true && pauses.KeyP[1] === false, pauses.KeyP), Space: holds(pauses.Space[0] === true && pauses.Space[1] === false, pauses.Space), Escape: holds(pauses.Escape[0] === true && pauses.Escape[1] === false, pauses.Escape) }, JSON.stringify(pauses) + ' host ' + await hostY()));
    // mouse steering stops when the cursor leaves the frame
    await page.mouse.move(600, 380); await page.waitForTimeout(120);
    const inside = await f.evaluate(() => !!window.game.pointerScreen);
    await page.mouse.move(1000, 380); await page.waitForTimeout(150);
    const out1 = await f.evaluate(() => ({ ptr: window.game.pointerScreen, x: window.game.player.x, y: window.game.player.y }));
    await page.waitForTimeout(600);
    const out2 = await f.evaluate(() => ({ x: window.game.player.x, y: window.game.player.y }));
    const drift = Math.hypot(out2.x - out1.x, out2.y - out1.y);
    results.push(report('mouse: the cursor leaving the iframe stops the vortex (no steering toward the last point)', inside && out1.ptr === null && drift < 3, `inside ${inside}, after ${JSON.stringify(out1.ptr)}, drift ${drift.toFixed(1)} px`));
    // focus lost with a key held: released, the round pauses
    await page.mouse.click(40, 500);
    await f.evaluate(() => { if (window.game.paused) window.game.resumeGame(); });
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(150);
    const held = await f.evaluate(() => window.game.keyDir.x);
    await page.mouse.click(1000, 100); // the portal page takes focus
    await page.waitForTimeout(250);
    const blurred = await f.evaluate(() => ({ kx: window.game.keyDir.x, paused: window.game.paused, ptr: window.game.pointerScreen }));
    await page.keyboard.up('ArrowRight');
    results.push(report('focus lost (a click on the portal page) with an arrow held: the key is released, steering stops and the round pauses', held > 0 && blurred.kx === 0 && blurred.paused === true && blurred.ptr === null, `held ${held} → ${JSON.stringify(blurred)}`));
    // no steering while a modal is open: the pause sheet / evolution cards
    const before = await f.evaluate(() => ({ x: window.game.player.x, y: window.game.player.y }));
    await page.mouse.move(600, 260); await page.mouse.move(80, 500); await page.waitForTimeout(400);
    const after = await f.evaluate(() => ({ x: window.game.player.x, y: window.game.player.y }));
    await f.evaluate(() => { window.game.resumeGame(); window.game.evolutionOffersTriggered = new Set(); window.game.offerEvolution(); });
    await page.mouse.move(600, 260); await page.waitForTimeout(400);
    const evo1 = await f.evaluate(() => ({ x: window.game.player.x, y: window.game.player.y, pending: window.game.evolutionPending }));
    await page.mouse.move(100, 500); await page.waitForTimeout(400);
    const evo2 = await f.evaluate(() => ({ x: window.game.player.x, y: window.game.player.y }));
    results.push(report('no steering under a modal: the vortex stays put while the pause sheet / evolution cards are open and the mouse moves', Math.hypot(after.x - before.x, after.y - before.y) < 1 && evo1.pending && Math.hypot(evo2.x - evo1.x, evo2.y - evo1.y) < 1, JSON.stringify({ before, after, evo1, evo2 })));
    await f.evaluate(() => { if (window.game.evolutionPending) window.game.skipEvolutionOffer(); });
    // --- the portal's fullscreen: the frame grows to the screen and back
    await page.setViewportSize({ width: 1920, height: 1080 });
    const sizes = [];
    for (const [w, hgt, how] of [[1920, 1080, 'css'], [836, 470, 'css'], [1031, 580, 'css']]) {
      await page.evaluate(([w, hgt]) => { const g = document.getElementById('g'); g.style.width = w + 'px'; g.style.height = hgt + 'px'; }, [w, hgt]);
      await page.waitForTimeout(350);
      const s = await f.evaluate(() => ({ w: window.game.width, h: window.game.height, cw: window.game.canvas.width, dpr: window.game.dpr, layout: window.game.layout, ui: +window.game.uiScale.toFixed(2) }));
      const a = await f.evaluate(AUDIT, { root: '#hud', primary: '#btnPause', mustSee: ['#btnPause', '#hud-tier-strip'] });
      a.hud = await f.evaluate(HUD_AUDIT);
      const [ok, probs] = judge('arena', a);
      sizes.push({ w, h: hgt, how, ...s, ok, probs });
    }
    // the real Fullscreen API on the iframe (a click on the host's button = a user gesture)
    await page.evaluate(() => { const g = document.getElementById('g'); g.style.width = '836px'; g.style.height = '470px'; });
    await page.click('#fs');
    await page.waitForTimeout(800);
    const fs1 = await page.evaluate(() => ({ fs: window.__fs || null, el: document.fullscreenElement ? document.fullscreenElement.id : null }));
    const inFs = fs1.el === 'g' ? await f.evaluate(() => ({ w: window.game.width, h: window.game.height, layout: window.game.layout })) : null;
    if (fs1.el) { await page.evaluate(() => document.exitFullscreen()); await page.waitForTimeout(500); }
    const outFs = await f.evaluate(() => ({ w: window.game.width, h: window.game.height, layout: window.game.layout }));
    results.push(report('fullscreen as a portal does it (the iframe grows 836×470 → 1920×1080 → back) mid-round: canvas, layout and HUD follow, nothing cut off',
      sizes.every(s => s.ok && s.w === s.w && s.cw === Math.round(s.w * s.dpr)) && sizes[0].layout === 'wide' && sizes[1].layout === 'compact', JSON.stringify(sizes.map(s => ({ w: s.w, h: s.h, layout: s.layout, ui: s.ui, cw: s.cw, probs: s.probs })))));
    if (fs1.el === 'g') results.push(report('Fullscreen API on the iframe (host button): the game takes the whole screen and comes back', inFs && inFs.w >= 1000 && outFs.w === 836 && outFs.layout === 'compact', JSON.stringify({ fs1, inFs, outFs })));
    else results.push({ name: 'Fullscreen API on the iframe (headless Chromium did not enter fullscreen)', ok: true, notRun: true, details: 'NOT RUN: ' + JSON.stringify(fs1) });
    if (!fs1.el) console.log('NOT RUN  Fullscreen API on the iframe — ' + JSON.stringify(fs1));
    results.push(report('iframe: no runtime errors', h.errors.length === 0, h.errors.slice(0, 2).join(' | ')));
    await h.close();
  }

  // --- 2. A phone turned mid-round and on menus; touch -----------------
  {
    const g = await openGame(url, { viewport: { width: 390, height: 844 }, mobile: true, deviceScaleFactor: 3 });
    const s = await veteranSave(g.page, { missions: 30, coins: 900, runsPlayed: 6 });
    await loadSave(g.page, s);
    const turns = [];
    const audit = async (scene, opts) => { const a = await g.page.evaluate(AUDIT, opts); if (opts.hud) a.hud = await g.page.evaluate(HUD_AUDIT); const [ok, probs] = judge(scene, a); return { ok, probs, layout: a.compact ? 'compact' : a.wide ? 'wide' : 'phone' }; };
    await g.page.evaluate(() => window.game.startArenaRound());
    await g.page.waitForTimeout(400);
    for (const [w, h] of [[844, 390], [390, 844], [844, 390]]) {
      await g.page.setViewportSize({ width: w, height: h });
      await g.page.waitForTimeout(400);
      const st = await g.page.evaluate(() => ({ w: window.game.width, h: window.game.height, cw: window.game.canvas.width, ch: window.game.canvas.height, dpr: window.game.dpr, running: window.game.running }));
      const a = await audit('arena', { root: '#hud', primary: '#btnPause', mustSee: ['#btnPause', '#hud-tier-strip'], hud: true });
      turns.push({ at: `${w}x${h}`, ...st, ...a, canvasOk: st.cw === Math.round(w * st.dpr) && st.ch === Math.round(h * st.dpr) });
    }
    // pause sheet, then back to Miasto, turned both ways
    await g.page.evaluate(() => window.game.pauseGame());
    for (const [w, h] of [[390, 844], [844, 390]]) { await g.page.setViewportSize({ width: w, height: h }); await g.page.waitForTimeout(300); turns.push({ at: `pause ${w}x${h}`, ...(await audit('pause', { root: '#pauseSheet', primary: '#btnResume', mustSee: ['#btnLeaveRun'] })) }); }
    await g.page.evaluate(() => { const gm = window.game; gm.resumeGame(); gm.leaveRun(); gm.showScreen('mainMenu'); });
    await g.page.waitForTimeout(300);
    for (const [w, h] of [[390, 844], [844, 390], [390, 844]]) { await g.page.setViewportSize({ width: w, height: h }); await g.page.waitForTimeout(350); turns.push({ at: `hub ${w}x${h}`, ...(await audit('hub', { root: '#mainMenu', primary: '#btnStart', mustSee: ['#hubCampaignTile', '#btnDaily', '#bottomNav'] })) }); }
    results.push(report('phone turned 390×844 ↔ 844×390 mid-round, on the pause sheet and on Miasto: canvas follows (DPR), layout switches phone ↔ compact, everything fits',
      turns.every(t => t.ok && (t.canvasOk === undefined || t.canvasOk)), JSON.stringify(turns.map(t => ({ at: t.at, layout: t.layout, probs: t.probs, canvasOk: t.canvasOk })))));
    // touch: drag steers, the page never scrolls, a cancelled touch stops steering
    const touch = await g.page.evaluate(async () => {
      const gm = window.game; gm.startArenaRound();
      await new Promise(r => setTimeout(r, 300));
      const c = document.getElementById('gameCanvas');
      const mk = (type, x, y, list = true) => { const t = new Touch({ identifier: 7, target: c, clientX: x, clientY: y }); const e = new TouchEvent(type, { bubbles: true, cancelable: true, touches: list ? [t] : [], changedTouches: [t] }); c.dispatchEvent(e); return e.defaultPrevented; };
      const startPrevented = mk('touchstart', 300, 200);
      const movePrevented = mk('touchmove', 330, 210);
      const steering = !!gm.pointerScreen;
      mk('touchcancel', 330, 210, false);
      const afterCancel = gm.pointerScreen;
      return { startPrevented, movePrevented, steering, afterCancel, docScroll: document.scrollingElement.scrollTop + window.scrollY };
    });
    results.push(report('touch: a drag on the play field steers and never scrolls/zooms the page (default prevented); a cancelled touch stops steering',
      touch.startPrevented && touch.movePrevented && touch.steering && touch.afterCancel === null && touch.docScroll === 0, JSON.stringify(touch)));
    results.push(report('phone turns + touch: no runtime errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // --- 3. A desktop window resized live on every main screen ------------
  {
    const g = await openGame(url, { viewport: { width: 1280, height: 720 }, mobile: false, deviceScaleFactor: 1 });
    const s = await veteranSave(g.page, { missions: 30, coins: 900, runsPlayed: 6 });
    await loadSave(g.page, s);
    const rows = [];
    for (const [scene, open, opts] of [
      ['hub', () => window.game.showScreen('mainMenu'), { root: '#mainMenu', primary: '#btnStart', mustSee: ['#hubCampaignTile', '#btnDaily'] }],
      ['campaign', () => window.game.openCampaignScreen(), { root: '#campaignScreen', primary: '#missionNextCard .mc-play' }],
      ['shop', () => window.game.openWarsztatScreen(), { root: '#shopScreen', mustSee: ['#tabSkins'] }],
      ['challenges', () => window.game.openChallengesScreen(), { root: '#challengesScreen', primary: '#btnPlayDaily' }],
    ]) {
      await g.page.evaluate(open);
      for (const [w, h] of [[1280, 720], [640, 360], [836, 470], [1920, 1080], [800, 1000], [1031, 580]]) {
        await g.page.setViewportSize({ width: w, height: h });
        await g.page.waitForTimeout(250);
        const a = await g.page.evaluate(AUDIT, opts);
        const [ok, probs] = judge(scene, a);
        rows.push({ scene, at: `${w}x${h}`, ok, probs });
      }
    }
    const bad = rows.filter(r => !r.ok);
    results.push(report('desktop window resized live (1280×720 → 640×360 → 836×470 → 1920×1080 → 800×1000 → 1031×580) on Miasto / Dzielnice / Warsztat / Wyzwania: every step fits', bad.length === 0, bad.length ? JSON.stringify(bad.slice(0, 4)) : `${rows.length} steps`));
    results.push(report('live resize: no runtime errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }
  return results;
}

if (isMain(import.meta.url)) {
  const { server, url } = await serve();
  const res = [];
  if (!args.includes('--input-only')) res.push(...await runResponsiveChecks(url, { shots: true, only: argOf('only'), scenes: argOf('scenes') }));
  if (!args.includes('--layout-only')) res.push(...await runPlatformInputChecks(url));
  server.close();
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} responsive checks passed`);
  process.exit(failed.length ? 1 : 0);
}

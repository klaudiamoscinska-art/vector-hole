// v14 flow checks ("Czytelność"): one clear action per screen and every
// mission briefed before it starts -- the start screen is just logo + GRAJ,
// Miasto has no floating GRAJ plate and fits a phone without scrolling,
// Dzielnice starts the next mission without scrolling, a tap on any mission
// opens its briefing, the result screen previews the next mission above the
// button that starts it, NELA is a visible character, and Warsztat never
// spends coins on a single tap. Usage: node qa/flow.mjs
import { serve, openGame, veteranSave, report } from './lib.mjs';

async function seeded(url, saveOpts = {}, opts = {}) {
  const g = await openGame(url, opts);
  const save = await veteranSave(g.page, saveOpts);
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.game.state);
  await g.page.waitForTimeout(500);
  return g;
}

/** Bottom edge (px) of the screen area above the bottom nav. */
const NAV_TOP = `(() => { const n = document.getElementById('bottomNav'); return n && !n.classList.contains('hidden') ? n.getBoundingClientRect().top : window.innerHeight; })()`;

export async function runFlowChecks(url) {
  const results = [];
  // Every browser session reports its own runtime errors.
  const done = async (g, label) => {
    results.push(report(`flow: no runtime errors (${label})`, g.errors.length === 0, g.errors.slice(0, 3).join(' | ')));
    await g.browser.close();
  };

  // --- First launch: logo + one button, nothing else to read -------------
  {
    const g = await openGame(url, { viewport: { width: 375, height: 667 } });
    await g.page.waitForTimeout(400);
    const r = await g.page.evaluate(() => {
      const welcome = document.getElementById('hubWelcome');
      const buttons = [...welcome.querySelectorAll('button')].filter(b => b.offsetParent !== null);
      const cta = document.getElementById('btnWelcomePlay').getBoundingClientRect();
      const words = welcome.innerText.split(/\s+/).filter(Boolean).length;
      return { buttons: buttons.length, ctaBottom: cta.bottom, H: window.innerHeight, words };
    });
    results.push(report('flow: start screen has exactly one button, on screen (375x667)', r.buttons === 1 && r.ctaBottom <= r.H, JSON.stringify(r)));
    results.push(report('flow: start screen copy is short (<= 12 words)', r.words <= 12, `${r.words} words`));
    await done(g, `start screen`);
  }

  // --- Miasto: GRAJ in the page flow, everything fits a phone -------------
  for (const vp of [{ width: 402, height: 874 }, { width: 375, height: 667 }]) {
    const g = await seeded(url, { missions: 5, runsPlayed: 4 }, { viewport: vp });
    const r = await g.page.evaluate((navTopExpr) => {
      const navTop = eval(navTopExpr);
      const inner = document.querySelector('#mainMenu > .screen-inner');
      const sticky = [...document.querySelectorAll('#mainMenu *')].filter(el => ['sticky', 'fixed'].includes(getComputedStyle(el).position)).map(el => el.id || el.className);
      const play = document.getElementById('btnStart').getBoundingClientRect();
      const chest = document.getElementById('hubFreeChest').getBoundingClientRect();
      const visibleButtons = [...document.querySelectorAll('#mainMenu button, #mainMenu [role="button"]')].filter(b => b.offsetParent !== null).length;
      return { sticky, playBottom: Math.round(play.bottom), chestBottom: Math.round(chest.bottom), navTop: Math.round(navTop), overflow: inner.scrollHeight - inner.clientHeight, visibleButtons,
        campaign: document.getElementById('hubCampaignTitle').textContent };
    }, NAV_TOP);
    results.push(report(`flow ${vp.width}x${vp.height}: Miasto has no sticky/floating element`, r.sticky.length === 0, r.sticky.join(', ')));
    results.push(report(`flow ${vp.width}x${vp.height}: GRAJ and the whole hub fit above the nav (no scrolling)`, r.playBottom <= r.navTop && r.chestBottom <= r.navTop + 1 && r.overflow <= 1, JSON.stringify(r)));
    results.push(report(`flow ${vp.width}x${vp.height}: Miasto keeps to a handful of tappable things (<= 10)`, r.visibleButtons <= 10, `${r.visibleButtons}`));
    results.push(report(`flow ${vp.width}x${vp.height}: hub campaign tile names the next mission`, /^M\d\d · /.test(r.campaign), r.campaign));
    await done(g, `Miasto ${vp.width}x${vp.height}`);
  }

  // --- Hub campaign tile -> briefing -> GRAJ starts that mission ----------
  {
    const g = await seeded(url, { missions: 3 });
    const r = await g.page.evaluate(async () => {
      const gm = window.game;
      const next = gm.nextCampaignMissionId();
      document.getElementById('hubCampaignTile').click();
      await new Promise(res => setTimeout(res, 100));
      const sheet = document.getElementById('missionBriefing');
      const open = !sheet.classList.contains('hidden');
      const def = campaignMissionById(next);
      const goals = sheet.querySelectorAll('.mc-goal').length;
      const nela = (sheet.querySelector('.nela-line') || {}).textContent;
      const avatar = !!sheet.querySelector('.nela-avatar svg');
      const meta = sheet.querySelector('.mc-meta').textContent;
      const stars = sheet.querySelectorAll('.mc-stars .mc-star').length;
      sheet.querySelector('[data-mc-launch]').click();
      await new Promise(res => setTimeout(res, 100));
      const started = gm.mode === 'campaign' && gm.mission && gm.mission.def.id === next && gm.running;
      const closed = sheet.classList.contains('hidden');
      // v15: the mission opens on the tap-to-start card with NELA's line.
      const start = document.getElementById('missionStartOverlay');
      const toastOk = !start.classList.contains('hidden') && start.textContent.includes(def.nela.start) && !!start.querySelector('.nela-avatar svg');
      gm.leaveRun && gm.leaveRun();
      return { next, open, goals, steps: def.goal.steps.length, nelaOk: nela === def.nela.start, avatar, metaOk: meta.includes(formatClock(def.timeLimit)) && stars === 3, started, closed, toastOk };
    });
    results.push(report('flow: hub campaign tile opens the next mission\'s briefing', r.open, JSON.stringify(r)));
    results.push(report('flow: briefing lists every goal as its own row + NELA (with avatar) + time and the 3 star conditions', r.goals === r.steps && r.nelaOk && r.avatar && r.metaOk, JSON.stringify(r)));
    results.push(report('flow: briefing GRAJ starts exactly that mission and closes the sheet', r.started && r.closed));
    results.push(report('flow: mission opens on the start card with NELA\'s bubble (avatar + the mission\'s line)', r.toastOk));
    await done(g, `briefing`);
  }

  // --- Dzielnice: the next mission starts without scrolling ---------------
  for (const vp of [{ width: 402, height: 874 }, { width: 375, height: 667 }]) {
    const g = await seeded(url, { missions: 5 }, { viewport: vp });
    const r = await g.page.evaluate(async (navTopExpr) => {
      const gm = window.game;
      gm.openCampaignScreen();
      await new Promise(res => setTimeout(res, 350));
      const navTop = eval(navTopExpr);
      const btn = document.querySelector('#missionNextCard [data-mc-play]');
      const b = btn.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      const story = document.getElementById('districtStoryText').textContent;
      // every row opens a briefing (locked ones too, with a reason)
      const rows = [...document.querySelectorAll('#missionList .mission-row')];
      rows[rows.length - 1].click();
      await new Promise(res => setTimeout(res, 50));
      const lockBtn = document.querySelector('#briefingCard .mc-play');
      const lockedSheet = !!lockBtn && /Najpierw ukończ/.test(document.getElementById('briefingCard').textContent) && (lockBtn.disabled || !!lockBtn.dataset.mcPlay);
      gm.closeMissionBriefing();
      return { id: btn.dataset.mcPlay, next: gm.nextCampaignMissionId(), btnBottom: Math.round(b.bottom), navTop: Math.round(navTop), tappable: !!(hit && hit.closest('[data-mc-play]')), story: story.length, lockedSheet, rows: rows.length };
    }, NAV_TOP);
    results.push(report(`flow ${vp.width}x${vp.height}: Dzielnice — next mission's GRAJ on screen without scrolling`, r.btnBottom <= r.navTop && r.tappable && r.id === r.next, JSON.stringify(r)));
    results.push(report(`flow ${vp.width}x${vp.height}: Dzielnice — district story by NELA, locked rows explain themselves`, r.story > 40 && r.lockedSheet, JSON.stringify(r)));
    await done(g, `Dzielnice ${vp.width}x${vp.height}`);
  }

  // --- Result: the next mission is previewed above the button -------------
  {
    const g = await seeded(url, { missions: 3 });
    const r = await g.page.evaluate(async () => {
      const gm = window.game;
      const id = gm.nextCampaignMissionId();
      gm.startCampaignMission(id);
      cancelAnimationFrame(gm.rafId); gm.running = false;
      gm.mission.elapsed = 30;
      gm.endCampaignMission(true);
      await new Promise(res => setTimeout(res, 100));
      gm.unlockQueue = []; clearTimeout(gm.unlockShowTimer); document.getElementById('unlockOverlay').classList.add('hidden');
      const card = document.getElementById('missionResultNextCard');
      const btn = document.getElementById('btnMissionNext');
      const next = gm.nextCampaignMissionId();
      const res = { played: id, next, cardShown: !card.classList.contains('hidden'), cardCode: (card.querySelector('.mc-code') || {}).textContent,
        goals: card.querySelectorAll('.mc-goal').length, btn: btn.textContent.trim(), cardAbove: card.getBoundingClientRect().bottom <= btn.getBoundingClientRect().top,
        nela: document.getElementById('missionResultNela').textContent === campaignMissionById(id).nela.success };
      btn.click();
      // v15: the button opens the next mission's briefing (boosters).
      res.briefed = !document.getElementById('missionBriefing').classList.contains('hidden') && !!document.querySelector(`#briefingCard [data-mc-launch="${next}"]`);
      document.querySelector('#briefingCard [data-mc-launch]').click();
      res.startedNext = gm.mission && gm.mission.def.id === next && res.briefed;
      cancelAnimationFrame(gm.rafId); gm.running = false;
      // a failed attempt: retry is the main button, the missing goals are listed
      gm.mission.elapsed = 9999; gm.endCampaignMission(false);
      await new Promise(res2 => setTimeout(res2, 50));
      res.failBtn = btn.textContent.trim();
      res.failMissing = /Zostało:/.test(document.getElementById('missionResultMedal').textContent);
      res.failNoNext = card.classList.contains('hidden');
      return res;
    });
    const code = await g.page.evaluate((id) => missionCode(campaignMissionById(id)), r.next);
    results.push(report('flow: result screen previews the next mission (code, goals) above its button', r.cardShown && r.cardCode === code && r.goals > 0 && r.cardAbove && r.btn.includes(code), JSON.stringify(r)));
    results.push(report('flow: result button briefs and starts that next mission; NELA reacts in her bubble', r.startedNext && r.nela));
    results.push(report('flow: a failed mission offers SPRÓBUJ PONOWNIE and lists what is missing', /SPRÓBUJ PONOWNIE/.test(r.failBtn) && r.failMissing && r.failNoNext, JSON.stringify(r)));
    await done(g, `result`);
  }

  // --- Review regressions: legacy saves, replays, step banners --------------
  {
    const g = await seeded(url, { missions: 4 });
    const r = await g.page.evaluate(async () => {
      const gm = window.game;
      const c = gm.save.campaign;
      // replaying a mission whose stars were won earlier (v15: 2 of 3)
      c.stars.M02 = 3;
      gm.startCampaignMission('M02'); cancelAnimationFrame(gm.rafId); gm.running = false;
      gm.mission.elapsed = 999; gm.endCampaignMission(true);
      await new Promise(res => setTimeout(res, 50));
      gm.unlockQueue = []; clearTimeout(gm.unlockShowTimer); document.getElementById('unlockOverlay').classList.add('hidden');
      const star = document.querySelectorAll('#missionResultStars .mr-star.old').length + document.querySelectorAll('#missionResultStars .mr-star.on').length >= 2 ? '★' : '☆';
      const eyebrow = (document.querySelector('#missionResultNextCard .mc-eyebrow') || {}).textContent;
      // a finished step is announced once, even if it drops and comes back
      gm.startCampaignMission('M01'); cancelAnimationFrame(gm.rafId); gm.running = false;
      let banners = 0;
      const orig = gm.showBanner.bind(gm);
      gm.showBanner = (t, ...a) => { if (t === 'CEL ZALICZONY') banners++; return orig(t, ...a); };
      const m = gm.mission;
      m.eatenByType.capsule = 3; gm.updateCampaignHUD();
      m.eatenByType.capsule = 0; gm.updateCampaignHUD();
      m.eatenByType.capsule = 3; gm.updateCampaignHUD();
      gm.showBanner = orig;
      return { star, eyebrow, banners };
    });
    results.push(report('flow: a replay keeps showing stars won earlier; no false "NOWA DZIELNICA"', r.star === '★' && !/NOWA DZIELNICA/.test(r.eyebrow || ''), JSON.stringify(r)));
    results.push(report('flow: "CEL ZALICZONY" fires once per step', r.banners === 1, JSON.stringify(r)));
    await done(g, 'regressions');
  }

  // --- Warsztat: tap = wear; buying needs a confirming tap -----------------
  {
    const g = await seeded(url, { missions: 6, coins: 5000 });
    const r = await g.page.evaluate(async () => {
      const gm = window.game;
      gm.openWarsztatScreen();
      await new Promise(res => setTimeout(res, 200));
      const coins0 = gm.save.coins;
      const card = (id) => [...document.querySelectorAll('#skinGrid .skin-card')].find(c => c.querySelector(`canvas[data-skin="${id}"]`));
      const target = SKINS.find(s => !gm.save.owned.includes(s.id) && !s.unlockSource && s.price > 0);
      card(target.id).click();
      await new Promise(res => setTimeout(res, 50));
      const afterTap = { coins: gm.save.coins, owned: gm.save.owned.includes(target.id), sheet: !document.getElementById('infoSheet').classList.contains('hidden'), preview: gm.pendingLoadout.skin === target.id };
      // close without buying -> preview reverts, nothing spent
      gm.closeInfoSheet();
      const reverted = gm.pendingLoadout.skin === gm.save.selected && gm.save.coins === coins0;
      card(target.id).click();
      await new Promise(res => setTimeout(res, 50));
      document.getElementById('btnInfoSheetAction').click();
      await new Promise(res => setTimeout(res, 50));
      const bought = { coins: gm.save.coins, owned: gm.save.owned.includes(target.id), equipped: gm.save.selected === target.id };
      // an owned one is worn with a single tap
      card(SKINS[0].id).click();
      await new Promise(res => setTimeout(res, 50));
      const worn = gm.save.selected === SKINS[0].id && document.getElementById('infoSheet').classList.contains('hidden');
      const equipBtn = !!document.getElementById('btnEquip');
      return { price: target.price, coins0, afterTap, reverted, bought, worn, equipBtn };
    });
    results.push(report('flow: Warsztat — a tap on an item for sale previews it and asks, spends nothing', r.afterTap.coins === r.coins0 && !r.afterTap.owned && r.afterTap.sheet && r.afterTap.preview && r.reverted, JSON.stringify(r)));
    results.push(report('flow: Warsztat — KUP I ZAŁÓŻ buys and wears it', r.bought.owned && r.bought.equipped && r.bought.coins === r.coins0 - r.price, JSON.stringify(r.bought)));
    results.push(report('flow: Warsztat — an owned item is worn with one tap (no ZAŁÓŻ button at the bottom)', r.worn && !r.equipBtn));
    await done(g, `Warsztat`);
  }

  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { server, url } = await serve();
  const res = await runFlowChecks(url);
  server.close();
  console.log(`\n${res.filter(r => r.ok).length}/${res.length} flow checks passed`);
  process.exit(res.every(r => r.ok) ? 0 : 1);
}

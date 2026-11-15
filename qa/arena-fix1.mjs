// ARENA-FIX-1: three Arena fixes (owner prompt 2026-11-15).
//  - C: Sterowanie: Mysz / Klawiatura (save.settings.deskControls). A new
//    save is Mouse; a missing / unknown value falls back to Mouse; the choice
//    survives a reload. Keyboard: WASD and arrows steer, a released key
//    stops the vortex, the cursor (still or moving) never steers, the mouse
//    still clicks buttons; a switch, a pause, a lost focus and a resume
//    never leave the vortex drifting or a key held, and never change the
//    mode. Mouse keeps the cursor steering and the WASD help. Phones and
//    tablets get no such switch and touch keeps steering whatever is saved.
//  - E: Enter on Arena's start screen (Miasto's GRAJ, the welcome card's GRAJ)
//    starts exactly one round -- not on a repeat, a focused GRAJ (native
//    activation), another focused control, a text field, another screen,
//    a sheet over Miasto, or during a round; the "Enter" key cap shows on a
//    computer only.
//  - M: MISSION-ENTER-1 -- Enter on an open mission card (Dzielnice / the Miasto
//    shortcut) = its GRAJ exactly like a click: the right mission once, the
//    picked boosters charged once (same result as the click), not on a repeat,
//    a focused GRAJ's own activation, another control inside the card, a text
//    field, a dialog over the card, a locked mission or in a round; Arena's Enter
//    unchanged; the key cap on a computer only.
//  - L: the CrazyGames package (real Pointer Lock in Chromium, a local stand-in
//    for the portal, NOT the CrazyGames Preview): Mouse locks on a board click
//    after an Enter start, buttons answer under the lock, a switch to Keyboard
//    lets go of the lock without a pause, Keyboard never asks for a click.
//  - R: an eaten Arena rival never respawns within the player's reach
//    (r_player * sqrt(2) + r_rival + CONFIG.arena.respawn.margin): small and
//    big player, centre, edge and corner, five rivals at once; with no safe
//    spot it waits off the board (no collisions, no reward, no double
//    respawn, still in the standings) and comes back once, safe against the
//    player's position at that moment, with the usual protection.
// Usage: node qa/arena-fix1.mjs [--only=C,E,M,L,R]
import path from 'node:path';
import { serve, openGame, veteranSave, report, isMain, OUT } from './lib.mjs';
import { exportPackage } from '../tools/export-crazygames-basic.mjs';
import { portalHost, clickIn } from './crazygames-basic1.mjs';

const DESK = { viewport: { width: 1280, height: 720 }, mobile: false, deviceScaleFactor: 1 };

/** A desktop page on a veteran save (no hints, no calendar), `settings` merged in. */
async function deskGame(url, settings = {}, opts = DESK) {
  const g = await openGame(url, opts);
  const save = await veteranSave(g.page, { runsPlayed: 6 });
  Object.assign(save.settings, settings);
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state === GameState.MENU);
  await g.page.evaluate(() => {
    window.__starts = 0;
    const gm = window.game, orig = gm.startRound;
    gm.startRound = function (...a) { window.__starts++; return orig.apply(this, a); };
  });
  return g;
}

/** In a live round: the vortex can't be eaten and no evolution card stops the round. */
const calmRound = (page) => page.evaluate(() => {
  const gm = window.game;
  gm.player.invulnerableUntil = Infinity;
  gm.checkEvolutionTriggers = () => {};
  gm.checkOverdriveTrigger = () => {};
});
const st = (page) => page.evaluate(() => {
  const gm = window.game;
  const pl = gm.player || { x: 0, y: 0 };
  return { x: +pl.x.toFixed(2), y: +pl.y.toFixed(2), kx: gm.keyDir.x, ky: gm.keyDir.y, ptr: gm.pointerScreen, running: gm.running, paused: gm.paused, mode: gm.save.settings.deskControls, starts: window.__starts };
});
const moved = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

/* ---------------- C: Mouse / Keyboard ---------------- */
async function controlChecks(url) {
  const out = [];
  // C1 -- a new save, fallbacks, an old save without the field.
  {
    const g = await openGame(url, DESK);
    const r = await g.page.evaluate(() => {
      const fix = (v) => { const s = defaultSave(); if (v === undefined) delete s.settings.deskControls; else s.settings.deskControls = v; return sanitizeSave(s).settings.deskControls; };
      return {
        fresh: defaultSave().settings.deskControls, live: window.game.save.settings.deskControls,
        missing: fix(undefined), bad: [fix('KEYBOARD'), fix('touch'), fix(null), fix(1), fix({})], kept: fix('keyboard'), mouse: fix('mouse'),
        schema: defaultSave().schemaVersion, otherKept: sanitizeSave({ ...defaultSave(), settings: { ...defaultSave().settings, inputMode: 'thumbpad', deskControls: 'keyboard' } }).settings.inputMode
      };
    });
    out.push(report('C1 new save: Sterowanie = Mysz (defaultSave and the live game)', r.fresh === 'mouse' && r.live === 'mouse', JSON.stringify(r)));
    out.push(report('C1 missing / unknown deskControls falls back to Mysz, Klawiatura is kept, the touch mode untouched, SAVE v13', r.missing === 'mouse' && r.bad.every(v => v === 'mouse') && r.kept === 'keyboard' && r.mouse === 'mouse' && r.schema === 13 && r.otherKept === 'thumbpad', JSON.stringify(r)));
    await g.browser.close();
  }

  // C2 -- Profil: the switch is there on a computer, a click saves it, a reload keeps it.
  {
    const g = await deskGame(url);
    const p = g.page;
    await p.evaluate(() => window.game.openProfileScreen());
    const shown = await p.evaluate(() => { const r = document.getElementById('profileDeskControlsRow'); return !r.classList.contains('hidden') && r.getClientRects().length > 0; });
    await p.click('#profileDeskControlsRow [data-desk-controls="keyboard"]');
    const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('vectorHoleSave_v1')).settings.deskControls);
    await p.reload();
    await p.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state === GameState.MENU);
    await p.evaluate(() => window.game.openProfileScreen());
    const after = await p.evaluate(() => ({ mode: window.game.save.settings.deskControls, active: document.querySelector('#profileDeskControlsRow [data-desk-controls="keyboard"]').classList.contains('active') }));
    out.push(report('C2 Profil shows Sterowanie na Arenie on a computer; Klawiatura is saved and still chosen after a reload', shown && stored === 'keyboard' && after.mode === 'keyboard' && after.active, JSON.stringify({ shown, stored, after })));
    out.push(report('C2 no page errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // C3 -- Keyboard: Enter, keys steer, release stops, the cursor never steers, buttons click.
  {
    const g = await deskGame(url, { deskControls: 'keyboard' });
    const p = g.page;
    await p.mouse.move(640, 360);
    await p.keyboard.press('Enter');
    await p.waitForFunction(() => window.game.running, null, { timeout: 5000 });
    await calmRound(p);
    await p.waitForTimeout(200);
    // The cursor on the board, still and then moving: nothing.
    const c0 = await st(p);
    await p.waitForTimeout(500);
    for (const [x, y] of [[1150, 120], [100, 650], [1200, 650], [60, 60]]) { await p.mouse.move(x, y, { steps: 6 }); await p.waitForTimeout(120); }
    const c1 = await st(p);
    out.push(report('C3 Keyboard: Enter started the round and the cursor -- still or moving over the board -- never moves the vortex', c0.running && c0.starts === 1 && moved(c0, c1) < 0.5 && c1.ptr === null, JSON.stringify({ c0, c1 })));
    // Every key steers its way; a release stops dead while the cursor keeps moving.
    const want = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
    const dirs = {}, stops = {};
    for (const [key, [wx, wy]] of Object.entries(want)) {
      const a = await st(p);
      await p.keyboard.down(key);
      await p.waitForTimeout(300);
      await p.keyboard.up(key);
      const b = await st(p);
      await p.mouse.move(wx > 0 ? 1200 : 80, wy > 0 ? 680 : 40, { steps: 5 });
      await p.waitForTimeout(350);
      const c = await st(p);
      dirs[key] = Math.sign(Math.round(b.x - a.x)) === wx && Math.sign(Math.round(b.y - a.y)) === wy && moved(a, b) > 15;
      stops[key] = moved(b, c) < 0.5 && c.kx === 0 && c.ky === 0 && c.ptr === null;
    }
    out.push(report('C3 Keyboard: WASD and the arrows each move the vortex their way', Object.values(dirs).every(Boolean), JSON.stringify(dirs)));
    out.push(report('C3 Keyboard: a released key stops the vortex -- no drift toward the cursor (the bug)', Object.values(stops).every(Boolean), JSON.stringify(stops)));
    // The mouse still clicks the HUD's pause button.
    const box = await p.locator('#btnPause').boundingBox();
    await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await p.waitForTimeout(150);
    const pz = await st(p);
    out.push(report('C3 Keyboard: the mouse still clicks buttons (pause)', pz.paused && pz.mode === 'keyboard', JSON.stringify(pz)));

    // C4 -- switches in the pause sheet: Arena shows the row; a switch drops every old input.
    await p.click('#btnControls');
    const row = await p.evaluate(() => { const r = document.getElementById('deskControlsRow'); return !r.classList.contains('hidden') && r.getClientRects().length > 0; });
    await p.click('#deskControlsRow [data-desk-controls="mouse"]');
    const sw1 = await st(p);
    await p.click('#btnResume');
    await p.waitForTimeout(400);
    const r0 = await st(p);
    await p.waitForTimeout(400);
    const r1 = await st(p);
    out.push(report('C4 pause sheet in Arena offers Sterowanie; Mysz is saved, nothing steers after the resume until the mouse moves', row && sw1.mode === 'mouse' && sw1.ptr === null && !r1.paused && moved(r0, r1) < 0.5, JSON.stringify({ row, sw1, r0, r1 })));
    const m0 = await st(p);
    await p.mouse.move(1180, 360, { steps: 4 });
    await p.waitForTimeout(450);
    const m1 = await st(p);
    await p.keyboard.down('KeyS');
    await p.waitForTimeout(250);
    const m2 = await st(p);
    await p.keyboard.up('KeyS');
    out.push(report('C4 Mysz: the cursor steers again and WASD still helps while held (mouse mode unchanged)', m1.x - m0.x > 15 && m2.y - m1.y > 5, JSON.stringify({ m0, m1, m2 })));
    // Back to Keyboard with the cursor's point live on the board.
    await p.keyboard.press('KeyP');
    await p.waitForTimeout(100);
    if (!(await p.evaluate(() => !document.getElementById('controlsPanel').classList.contains('hidden')))) await p.click('#btnControls');
    await p.evaluate(() => { window.game.pointerScreen = { x: 1180, y: 360 }; window.game.pointerFromMouse = true; });
    await p.click('#deskControlsRow [data-desk-controls="keyboard"]');
    const sw2 = await st(p);
    await p.keyboard.press('KeyP');
    await p.waitForTimeout(200);
    const k0 = await st(p);
    await p.mouse.move(1200, 380, { steps: 3 });
    await p.waitForTimeout(500);
    const k1 = await st(p);
    out.push(report('C4 a switch to Klawiatura clears the cursor\'s point and the keys; after the resume the vortex stays put with the cursor on the board', sw2.mode === 'keyboard' && sw2.ptr === null && sw2.kx === 0 && !k0.paused && moved(k0, k1) < 0.5, JSON.stringify({ sw2, k0, k1 })));

    // C5 -- pause / lost focus with a key held: nothing stays held, the mode stays.
    await p.keyboard.down('KeyD');
    await p.waitForTimeout(150);
    await p.keyboard.press('KeyP');
    const h1 = await st(p);
    await p.keyboard.up('KeyD');
    await p.keyboard.press('KeyP');
    await p.waitForTimeout(150);
    const h2 = await st(p);
    await p.waitForTimeout(400);
    const h3 = await st(p);
    await p.keyboard.down('ArrowLeft');
    await p.waitForTimeout(150);
    await p.evaluate(() => window.dispatchEvent(new Event('blur')));
    const b1 = await st(p);
    await p.keyboard.up('ArrowLeft');
    await p.click('#btnResume');
    await p.waitForTimeout(150);
    const b2 = await st(p);
    await p.waitForTimeout(400);
    const b3 = await st(p);
    out.push(report('C5 P with D held: the pause releases it, the resume drives nothing, Klawiatura stays', h1.paused && h1.kx === 0 && !h2.paused && moved(h2, h3) < 0.5 && h3.mode === 'keyboard', JSON.stringify({ h1, h2, h3 })));
    out.push(report('C5 a lost focus with a key held: paused, the key released, no drift after the resume, Klawiatura stays', b1.paused && b1.kx === 0 && !b2.paused && moved(b2, b3) < 0.5 && b3.mode === 'keyboard', JSON.stringify({ b1, b2, b3 })));
    out.push(report('C3-C5 no page errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // C6 -- a phone: no Mysz / Klawiatura switch, no key cap, and a saved Klawiatura never stops touch.
  {
    const g = await deskGame(url, { deskControls: 'keyboard' }, { viewport: { width: 390, height: 844 } });
    const p = g.page;
    const ui = await p.evaluate(() => {
      const gm = window.game; gm.openProfileScreen();
      const vis = (el) => !!el && !el.classList.contains('hidden') && el.getClientRects().length > 0;
      return { profileRow: vis(document.getElementById('profileDeskControlsRow')), key: [...document.querySelectorAll('.play-key')].some(vis), desk: document.body.classList.contains('desk-pointer') };
    });
    await p.evaluate(() => { window.game.showScreen('mainMenu'); document.getElementById('btnStart').click(); });
    await p.waitForFunction(() => window.game.running, null, { timeout: 5000 });
    await calmRound(p);
    const pauseRow = await p.evaluate(() => { window.game.pauseGame(); document.getElementById('btnControls').click(); const r = document.getElementById('deskControlsRow'); const v = !r.classList.contains('hidden') && r.getClientRects().length > 0; window.game.resumeGame(); return v; });
    const cdp = await g.context.newCDPSession(p);
    const t0 = await st(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y: 420 }] });
    for (let i = 0; i < 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 340 + i * 4, y: 420 }] }); await p.waitForTimeout(70); }
    const t1 = await st(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    out.push(report('C6 phone: no Mysz / Klawiatura switch (Profil, pause), no Enter key cap', !ui.profileRow && !pauseRow && !ui.key && !ui.desk, JSON.stringify({ ...ui, pauseRow })));
    out.push(report('C6 phone with Klawiatura saved (a backup from a computer): a finger still steers', t1.x - t0.x > 10, JSON.stringify({ t0, t1 })));
    await g.browser.close();
  }
  return out;
}

/* ---------------- E: Enter ---------------- */
async function enterChecks(url) {
  const out = [];
  const g = await deskGame(url);
  const p = g.page;
  const repeatKey = () => p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', key: 'Enter', repeat: true, bubbles: true, cancelable: true })));
  // Key cap.
  const cap = await p.evaluate(() => { const k = document.querySelector('#btnStart .play-key'); return { vis: !!k && k.getClientRects().length > 0, text: k && k.textContent, hidden: k && k.getAttribute('aria-hidden') }; });
  out.push(report('E0 a quiet "Enter" key cap on GRAJ on a computer (aria-hidden)', cap.vis && cap.text === 'Enter' && cap.hidden === 'true', JSON.stringify(cap)));
  // Repeats, other screens, sheets, text fields, other focused controls: no start.
  await repeatKey();
  const e1 = await st(p);
  await p.evaluate(() => window.game.showScreen('shopScreen'));
  await p.keyboard.press('Enter');
  const e2 = await st(p);
  await p.evaluate(() => window.game.showScreen('mainMenu'));
  await p.evaluate(() => document.getElementById('loginRewardScreen').classList.remove('hidden'));
  await p.keyboard.press('Enter');
  const e3 = await st(p);
  await p.evaluate(() => { document.getElementById('loginRewardScreen').classList.add('hidden'); clearTimeout(window.game.loginPopupTimer); });
  await p.click('#hubHeroStage');
  await p.waitForTimeout(150);
  const sheet = await p.evaluate(() => !document.getElementById('infoSheet').classList.contains('hidden'));
  await p.keyboard.press('Enter');
  const e4 = await st(p);
  await p.evaluate(() => window.game.closeInfoSheet());
  await p.evaluate(() => { const i = document.createElement('input'); i.id = 'qaTextField'; document.getElementById('mainMenu').appendChild(i); i.focus(); });
  await p.keyboard.press('Enter');
  const e5 = await st(p);
  await p.evaluate(() => { document.getElementById('qaTextField').remove(); document.getElementById('btnNavDzielnice').focus(); });
  await p.keyboard.press('Enter');
  await p.waitForTimeout(100);
  const e6 = await st(p);
  const onCampaign = await p.evaluate(() => !document.getElementById('campaignScreen').classList.contains('hidden'));
  out.push(report('E1 no start from a repeated Enter, another screen (Warsztat), a sheet over Miasto (calendar, Core City roadmap), a text field', [e1, e2, e3, e4, e5].every(s => s.starts === 0 && !s.running) && sheet, JSON.stringify([e1, e2, e3, e4, e5].map(s => s.starts))));
  out.push(report('E1 Enter on another focused control (the Dzielnice tab) is that control\'s, not a start', e6.starts === 0 && onCampaign, JSON.stringify({ starts: e6.starts, onCampaign })));
  // One press = one round; holding (repeats) and Enter in the round add nothing.
  await p.evaluate(() => { window.game.showScreen('mainMenu'); document.activeElement && document.activeElement.blur(); });
  await p.keyboard.down('Enter');
  for (let i = 0; i < 5; i++) await repeatKey();
  await p.keyboard.up('Enter');
  await p.waitForTimeout(150);
  const e7 = await st(p);
  await p.keyboard.press('Enter');
  await p.evaluate(() => window.game.pauseGame());
  await p.keyboard.press('Enter');
  const e8 = await st(p);
  out.push(report('E2 Enter on Miasto starts exactly one Arena round; held (repeats), in the round and over the pause sheet it adds none', e7.starts === 1 && e7.running && e8.starts === 1 && e8.paused, JSON.stringify({ e7: e7.starts, e8: e8.starts })));
  // A focused GRAJ: the key's own button click and the shortcut never both fire.
  await p.evaluate(() => { document.getElementById('btnPause').click(); document.getElementById('btnLeaveRun').click(); document.getElementById('btnLeaveConfirmYes').click(); });
  await p.waitForFunction(() => window.game.state === GameState.MENU && !document.getElementById('mainMenu').classList.contains('hidden'));
  await p.evaluate(() => { clearTimeout(window.game.loginPopupTimer); window.__starts = 0; document.getElementById('btnStart').focus(); });
  await p.keyboard.press('Enter');
  await p.waitForTimeout(150);
  const e9 = await st(p);
  out.push(report('E3 Enter with GRAJ focused starts exactly one round (no double start from the native activation)', e9.starts === 1 && e9.running, JSON.stringify({ starts: e9.starts })));
  // A control hidden by a screen switch can keep the focus until the next frame: Enter right
  // after leaving Profil (its toggle still focused, now off screen) still starts the round.
  await p.evaluate(() => { document.getElementById('btnPause').click(); document.getElementById('btnLeaveRun').click(); document.getElementById('btnLeaveConfirmYes').click(); });
  await p.waitForFunction(() => window.game.state === GameState.MENU && !document.getElementById('mainMenu').classList.contains('hidden'));
  const stale = await p.evaluate(() => {
    clearTimeout(window.game.loginPopupTimer); window.__starts = 0;
    window.game.openProfileScreen();
    const t = document.querySelector('#profileDeskControlsRow [data-desk-controls="mouse"]');
    t.focus();
    window.game.showScreen('mainMenu');
    const focused = document.activeElement === t, onScreen = t.getClientRects().length;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', key: 'Enter', bubbles: true, cancelable: true }));
    return { focused, onScreen };
  });
  await p.waitForTimeout(150);
  const e10 = await st(p);
  out.push(report('E3 Enter right after a screen switch (the hidden Profil toggle still focused) starts exactly one round', stale.focused && stale.onScreen === 0 && e10.starts === 1 && e10.running, JSON.stringify({ ...stale, starts: e10.starts })));
  out.push(report('E1-E3 no page errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
  await g.browser.close();

  // First launch: the welcome card's GRAJ.
  const f = await openGame(url, DESK);
  await f.page.evaluate(() => { window.__starts = 0; const gm = window.game, o = gm.startRound; gm.startRound = function (...a) { window.__starts++; return o.apply(this, a); }; });
  const w0 = await f.page.evaluate(() => ({ firstRun: document.getElementById('mainMenu').classList.contains('first-run'), cap: document.querySelector('#btnWelcomePlay .play-key').getClientRects().length > 0 }));
  await f.page.keyboard.press('Enter');
  await f.page.waitForTimeout(150);
  const w1 = await st(f.page);
  out.push(report('E4 first launch: Enter = the welcome card\'s GRAJ, one round, key cap shown', w0.firstRun && w0.cap && w1.starts === 1 && w1.running, JSON.stringify({ ...w0, starts: w1.starts })));
  out.push(report('E4 no page errors', f.errors.length === 0, f.errors.slice(0, 2).join(' | ')));
  await f.browser.close();

  // English: the cap reads Enter, the new copy is translated.
  const en = await openGame(url, { ...DESK, locale: 'en-US' });
  const t = await en.page.evaluate(() => { window.game.openProfileScreen(); const row = document.getElementById('profileDeskControlsRow'); return { label: row.querySelector('.control-label').textContent, buttons: [...row.querySelectorAll('button')].map(b => b.textContent), cap: document.querySelector('#btnWelcomePlay .play-key').textContent }; });
  out.push(report('E5 English: Arena controls -- Mouse / Keyboard, the cap says Enter', t.label === 'Arena controls' && t.buttons.join() === 'Mouse,Keyboard' && t.cap === 'Enter', JSON.stringify(t)));
  await en.browser.close();
  return out;
}

/* ---------------- L: Pointer Lock in the CrazyGames package ---------------- */
async function lockChecks() {
  const out = [];
  const pkg = exportPackage({ out: path.join(OUT, 'arena-fix1', 'cg') });
  const state = (f) => f.evaluate(() => {
    const gm = window.game, hint = document.getElementById('lockHint');
    return { locked: !!document.pointerLockElement && !!gm.pointerLocked, running: gm.running, paused: gm.paused, x: +gm.player.x.toFixed(2), y: +gm.player.y.toFixed(2), ptr: gm.pointerScreen, hint: !!hint && !hint.classList.contains('hidden'), mode: gm.save.settings.deskControls };
  });
  // Mouse (default): Enter starts, a board click locks, a button answers under the lock.
  {
    const g = await portalHost(pkg.gameDir, { width: 1216, height: 684 });
    const { page, frame: f } = g;
    await focusFrame(f); // keys reach a frame once it has focus (a click into it / the portal)
    await page.mouse.move(600, 300);
    await page.keyboard.press('Enter');
    await waitRunning(f, 8000);
    await f.evaluate(() => { window.game.player.invulnerableUntil = Infinity; window.game.checkEvolutionTriggers = () => {}; });
    await page.mouse.move(700, 340);
    await page.waitForTimeout(300);
    const a = await state(f);
    await page.mouse.down(); await page.mouse.up();
    await f.waitForFunction(() => !!document.pointerLockElement && window.game.pointerLocked, null, { timeout: 4000 }).catch(() => {});
    const b = await state(f);
    out.push(report('L1 Mysz: Enter starts the round with no error and no lock yet (as GRAJ), the lock offer is shown, a board click locks', a.running && !a.locked && a.hint && b.locked && !b.hint, JSON.stringify({ a, b })));
    // Switching to Klawiatura (Profil-style call, mid-round) lets go of the lock without pausing.
    await f.evaluate(() => window.game.setDeskControls('keyboard'));
    await page.waitForTimeout(300);
    const c = await state(f);
    await page.mouse.down(); await page.mouse.up();
    await page.waitForTimeout(400);
    const d = await state(f);
    out.push(report('L2 a switch to Klawiatura lets go of the lock (no pause), a board click never locks again, no offer', !c.locked && !c.paused && c.ptr === null && !d.locked && !d.hint && !d.paused, JSON.stringify({ c, d })));
    // Back to Mysz: the existing mechanism (the opt-in of this session) locks again.
    await f.evaluate(() => window.game.setDeskControls('mouse'));
    await page.waitForTimeout(400);
    let e = await state(f);
    if (!e.locked) { await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(400); e = await state(f); }
    const pb = await f.locator('#btnPause').boundingBox();
    // Under the lock, clicks go to the button under the virtual pointer: P is enough here.
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(250);
    const pz = await state(f);
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(500);
    const back = await state(f);
    out.push(report('L3 back to Mysz: locked again, P pauses with a free cursor, P resumes and locks (unchanged)', e.locked && pz.paused && !pz.locked && !back.paused && back.locked && !!pb, JSON.stringify({ e: e.locked, pz: [pz.paused, pz.locked], back: [back.paused, back.locked] })));
    // Esc stand-in: a lock lost from outside pauses (unchanged).
    await f.evaluate(() => document.exitPointerLock());
    await page.waitForTimeout(150);
    const esc = await state(f);
    await page.waitForTimeout(400);
    const esc2 = await state(f);
    await clickIn(page, f, '#btnResume');
    await page.waitForTimeout(150);
    const res = await state(f);
    out.push(report('L4 Mysz: a lock ended from outside (Esc) pauses and frees the cursor; paused the vortex stays put; WRÓĆ DO GRY resumes with no steering point (unchanged)', esc.paused && !esc.locked && moved(esc, esc2) < 0.5 && !res.paused && res.running && res.ptr === null, JSON.stringify({ esc, esc2, res })));
    out.push(report('L1-L4 no errors in the iframe, nothing external', g.errors.length === 0 && g.external.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }
  // Keyboard chosen in Profil inside the iframe: Enter, keys, no lock, no click needed; resume without a click.
  {
    const g = await portalHost(pkg.gameDir, { width: 1216, height: 684 });
    const { page, frame: f } = g;
    await f.evaluate(() => { window.game.openProfileScreen(); });
    await f.locator('#profileDeskControlsRow [data-desk-controls="keyboard"]').click(); // a real click, scrolled into view
    await f.evaluate(() => window.game.showScreen('mainMenu'));
    await focusFrame(f); // keys reach a frame once it has focus (a click into it / the portal)
    await page.mouse.move(600, 300);
    await page.keyboard.press('Enter');
    await waitRunning(f, 8000);
    await f.evaluate(() => { window.game.player.invulnerableUntil = Infinity; window.game.checkEvolutionTriggers = () => {}; });
    await page.waitForTimeout(200);
    const a = await state(f);
    await page.keyboard.down('KeyD'); await page.waitForTimeout(300); await page.keyboard.up('KeyD');
    const b = await state(f);
    await page.mouse.move(820, 220, { steps: 5 }); await page.waitForTimeout(400);
    const c = await state(f);
    await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(400);
    const d = await state(f);
    await page.keyboard.press('KeyP'); await page.waitForTimeout(150);
    await page.keyboard.press('KeyP'); await page.waitForTimeout(400);
    const e = await state(f);
    await page.keyboard.down('KeyS'); await page.waitForTimeout(250); await page.keyboard.up('KeyS');
    const h = await state(f);
    out.push(report('L5 Klawiatura in the iframe: Enter starts, D drives, the cursor never steers, a board click never locks, no offer', a.running && b.x - a.x > 15 && moved(b, c) < 0.5 && !d.locked && !d.hint && !d.paused && c.mode === 'keyboard', JSON.stringify({ a, b, c, d })));
    out.push(report('L5 Klawiatura: P pauses, P resumes and the keys steer at once -- no click to get the lock', !e.paused && !e.locked && h.y - e.y > 10, JSON.stringify({ e, h })));
    out.push(report('L5 no errors in the iframe, nothing external', g.errors.length === 0 && g.external.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }
  return out;
}

/* ---------------- R: safe respawn ---------------- */
const RESPAWN = `
window.__af = {
  vt() {
    const realNow = window.__afRealNow || (window.__afRealNow = performance.now.bind(performance));
    window.__afNow = Math.max(window.__afNow || 0, realNow());
    performance.now = () => window.__afNow;
  },
  step(n = 1) { const g = window.game; for (let i = 0; i < n; i++) { window.__afNow += 1000 / 30; g.update(1 / 30); } },
  start(seed) {
    const g = window.game;
    this.vt();
    g.startRound({ seed });
    if (g.rafId) cancelAnimationFrame(g.rafId);
    g.running = false;
    g.checkEvolutionTriggers = () => {}; g.checkOverdriveTrigger = () => {}; g.offerEvolution = () => {};
    g.player.invulnerableUntil = 0;
  },
  /** Feeds bot i to the player at (px, py) with radius pr; returns the respawn. */
  feed(i, px, py, pr) {
    const g = window.game, p = g.player, b = g.bots[i];
    p.x = px; p.y = py; p.radius = pr; p.invulnerableUntil = Infinity;
    b.radius = Math.min(12, pr / 1.3); b.invulnerableUntil = 0; b.x = p.x + 2; b.y = p.y + 1;
    const eaten = g.rivalsEatenThisRun;
    g.handleHoleCollisions();
    p.radius = pr; // the eat grew it; measure against the size it had
    const need = pr * Math.SQRT2 + b.radius + CONFIG.arena.respawn.margin;
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    return { eaten: g.rivalsEatenThisRun - eaten, d, need, safe: b.waiting ? null : d >= need, inside: b.x >= b.radius && b.x <= WORLD_W - b.radius && b.y >= b.radius && b.y <= WORLD_H - b.radius, waiting: !!b.waiting, inv: b.invulnerable };
  }
};`;

async function respawnChecks(url) {
  const out = [];
  const g = await openGame(url, DESK);
  const p = g.page;
  await p.addScriptTag({ content: RESPAWN });
  const sweep = await p.evaluate(() => {
    const A = window.__af, g = window.game, res = {};
    const cases = {
      smallCentre: [1500, 1500, 18], bigCentre: [1500, 1500, CONFIG.hole.maxRadius], midCentre: [1500, 1500, 120],
      smallCorner: [20, 20, 18], bigCorner: [CONFIG.hole.maxRadius, CONFIG.hole.maxRadius, CONFIG.hole.maxRadius],
      bigEdge: [WORLD_W - CONFIG.hole.maxRadius, 1500, CONFIG.hole.maxRadius], midEdge: [1500, WORLD_H - 120, 120]
    };
    A.start(4242);
    for (const [name, [x, y, r]] of Object.entries(cases)) {
      let ok = 0, n = 0, minGap = Infinity, eaten = 0, outside = 0, inv = 0;
      for (let k = 0; k < 150; k++) {
        const i = k % g.bots.length;
        const s = A.feed(i, x, y, r);
        n++; eaten += s.eaten; if (s.safe) ok++; if (!s.inside) outside++; if (s.inv) inv++;
        minGap = Math.min(minGap, s.d - s.need);
      }
      res[name] = { n, ok, eaten, outside, inv, minGap: Math.round(minGap), waiting: g.waitingBots.length };
    }
    performance.now = window.__afRealNow;
    return res;
  });
  const all = Object.values(sweep);
  out.push(report('R1 every eaten rival respawns outside r_player*sqrt(2) + r_rival + margin, inside the city, with its protection -- small / mid / max player at the centre, an edge and a corner (150 eats each)', all.every(c => c.ok === c.n && c.eaten === c.n && c.outside === 0 && c.inv === c.n && c.waiting === 0), JSON.stringify(sweep)));

  // R2 -- five rivals swallowed in one frame, then frames played: no instant second swallow.
  const burst = await p.evaluate(() => {
    const A = window.__af, g = window.game;
    A.start(777);
    const pl = g.player;
    pl.x = 1500; pl.y = 1500; pl.radius = 200; pl.invulnerableUntil = Infinity;
    g.bots.forEach((b, i) => { b.radius = 20; b.invulnerableUntil = 0; b.x = 1500 + i * 8; b.y = 1500 - i * 5; });
    const before = g.rivalsEatenThisRun;
    g.handleHoleCollisions();
    const once = g.rivalsEatenThisRun - before;
    const gaps = g.bots.map(b => Math.round(Math.hypot(b.x - pl.x, b.y - pl.y) - (pl.radius * Math.SQRT2 + b.radius + CONFIG.arena.respawn.margin)));
    const scores = g.bots.map(b => b.score);
    A.step(15); // half a second with the player parked
    const again = g.rivalsEatenThisRun - before - once;
    performance.now = window.__afRealNow;
    return { once, gaps, again, unique: new Set(g.bots).size, bots: g.bots.length };
  });
  out.push(report('R2 five rivals swallowed in one frame: each counted once, all five back out of reach, none swallowed again in the next 0.5 s', burst.once === 5 && burst.gaps.every(x => x >= 0) && burst.again === 0 && burst.unique === 5 && burst.bots === 5, JSON.stringify(burst)));

  // R3 -- no safe spot: the rival waits off the board, then comes back once, safe against the player of that moment.
  const wait = await p.evaluate(() => {
    const A = window.__af, g = window.game, R = CONFIG.arena.respawn;
    A.start(31337);
    const pl = g.player;
    const keep = R.margin;
    R.margin = 1e6; // nowhere in the city is far enough
    const b = g.bots[2];
    const s = A.feed(2, 1500, 1500, 60);
    const scoreAfterEat = pl.score, eatenAfter = g.rivalsEatenThisRun, botScore = b.score;
    const waiting1 = { waiting: b.waiting, inBots: g.bots.includes(b), inWaiting: g.waitingBots.includes(b), field: g.arenaField().length, ranked: rankHoles(g.arenaField()).includes(b) };
    // The player sweeps across where the rival vanished, other rivals play on: nothing touches it.
    pl.invulnerableUntil = Infinity;
    let drawErr = null;
    for (let f = 0; f < 90; f++) {
      pl.x = 1300 + f * 5; pl.y = 1500; pl.radius = 60;
      b.x = pl.x; b.y = pl.y; // stale coordinates right under the player
      A.step(1);
      if (f % 30 === 0) { try { g.render(window.__afNow / 1000); } catch (e) { drawErr = String(e); } }
    }
    const during = { eaten: g.rivalsEatenThisRun - eatenAfter, score: pl.score - scoreAfterEat, botScore: b.score === botScore, still: b.waiting && g.waitingBots.length === 1 && !g.bots.includes(b) && g.bots.length === 4 };
    // Space again: it comes back on the next retry, once, against the player's position NOW.
    R.margin = keep;
    pl.x = 400; pl.y = 2600; pl.radius = 150;
    let backAfter = null;
    for (let f = 0; f < 30 && backAfter === null; f++) { A.step(1); if (!b.waiting) backAfter = f + 1; }
    const d = Math.hypot(b.x - pl.x, b.y - pl.y), need = pl.radius * Math.SQRT2 + b.radius + R.margin;
    const res = {
      s, waiting1, during, drawErr, backAfter, safe: d >= need, gap: Math.round(d - need), inv: b.invulnerable, bots: g.bots.length, unique: new Set(g.bots).size, waitingLeft: g.waitingBots.length,
      slot: g.bots.indexOf(b), retry: R.retry
    };
    A.step(60);
    res.later = { bots: g.bots.length, waiting: g.waitingBots.length, unique: new Set(g.bots).size };
    performance.now = window.__afRealNow;
    return res;
  });
  out.push(report('R3 no safe spot: the rival is not placed on the player but waits off the board (out of this.bots, still in the standings)', wait.s.eaten === 1 && wait.s.waiting && wait.waiting1.waiting && !wait.waiting1.inBots && wait.waiting1.inWaiting && wait.waiting1.field === 6 && wait.waiting1.ranked, JSON.stringify({ s: wait.s, w: wait.waiting1 })));
  out.push(report('R3 while waiting: no collision, no second reward or score, drawing works', wait.during.eaten === 0 && wait.during.score === 0 && wait.during.botScore && wait.during.still && !wait.drawErr, JSON.stringify({ during: wait.during, drawErr: wait.drawErr })));
  out.push(report('R3 room again: back within one retry (0.5 s), once, in its old slot, safe against the player\'s position and size at that moment, with fresh protection', wait.backAfter !== null && wait.backAfter <= Math.ceil(wait.retry * 30) + 1 && wait.safe && wait.inv && wait.bots === 5 && wait.unique === 5 && wait.waitingLeft === 0 && wait.slot === 2 && wait.later.bots === 5 && wait.later.waiting === 0, JSON.stringify(wait)));

  // R4 -- the round's own layout and the player's respawn are what they were.
  const layout = await p.evaluate(() => {
    const g = window.game, A = window.__af;
    A.start(2024);
    const a = g.bots.map(b => [Math.round(b.x), Math.round(b.y), Math.round(b.radius)]).join(';') + '|' + Math.round(g.player.x) + ',' + Math.round(g.player.y);
    A.start(2024);
    const b = g.bots.map(b => [Math.round(b.x), Math.round(b.y), Math.round(b.radius)]).join(';') + '|' + Math.round(g.player.x) + ',' + Math.round(g.player.y);
    performance.now = window.__afRealNow;
    return { same: a === b, waiting: g.waitingBots.length, cfg: CONFIG.arena.respawn };
  });
  out.push(report('R4 a seeded round lays out the same rivals and player twice, and starts with no waiting rival', layout.same && layout.waiting === 0, JSON.stringify(layout)));
  out.push(report('R no page errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
  await g.browser.close();
  return out;
}


/* ---------------- M: Enter on a mission card (MISSION-ENTER-1) ---------------- */
/** A veteran desktop page (6 missions done: boosters unlocked) with the mission launch counted. */
async function missionGame(url, { coins = 0, stock = null, opts = DESK } = {}) {
  const g = await deskGame(url, {}, opts);
  await g.page.evaluate(({ coins, stock }) => {
    const gm = window.game;
    gm.save.coins = coins;
    gm.save.campaign.completed[CONFIG.boosters.unlockMission] = true;   // boosters on the card
    if (stock) Object.assign(gm.save.boosters, stock);
    window.__ml = 0; window.__sc = 0; window.__bp = 0; window.__scIds = [];
    const lm = gm.launchMission, sc = gm.startCampaignMission, bp = gm.beginMissionPlay;
    gm.beginMissionPlay = function (...a) { if (!document.getElementById('missionStartOverlay').classList.contains('hidden')) window.__bp++; return bp.apply(this, a); };
    gm.launchMission = function (...a) { window.__ml++; return lm.apply(this, a); };
    gm.startCampaignMission = function (id, ...a) { window.__sc++; window.__scIds.push(id); return sc.call(this, id, ...a); };
  }, { coins, stock });
  return g;
}
const ms = (page) => page.evaluate(() => {
  const g = window.game, vis = (id) => { const e = document.getElementById(id); return !!e && !e.classList.contains('hidden') && e.getClientRects().length > 0; };
  return { launches: window.__ml, camp: window.__sc, ids: window.__scIds.join(), arena: window.__starts, briefing: vis('missionBriefing'), startCard: vis('missionStartOverlay'), intro: !!g.introPending,
    coins: g.save.coins, stock: JSON.stringify(g.save.boosters), boosters: g.mission && g.mission.boosters ? g.mission.boosters.join() : null, mission: g.mission && g.mission.def ? g.mission.def.id : null };
});
const press = (page, mods = {}) => page.evaluate((m) => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', key: 'Enter', bubbles: true, cancelable: true, ...m })), mods);

async function missionChecks(url) {
  const out = [];
  // M1 -- the real path: Dzielnice, a mouse click on the mission's GRAJ opens the card (focus stays on that
  // button, now under the modal), Enter starts that mission once; held Enter and a second press add nothing.
  {
    const g = await missionGame(url);
    const p = g.page;
    const next = await p.evaluate(() => { window.game.openCampaignScreen(); return window.game.nextCampaignMissionId(); });
    await p.locator('.mc-play[data-mc-play]').filter({ visible: true }).first().click({ force: true });
    const m0 = await p.evaluate(() => { const a = document.activeElement; return { open: !document.getElementById('missionBriefing').classList.contains('hidden'), focusUnder: !!a && !document.getElementById('missionBriefing').contains(a) && a.hasAttribute('data-mc-play'), sel: window.game.selectedMissionId, cap: (() => { const k = document.querySelector('#briefingCard .mc-play .play-key'); return !!k && k.getClientRects().length > 0 && k.textContent === 'Enter' && k.getAttribute('aria-hidden') === 'true'; })() }; });
    out.push(report('M0 the open mission card\'s GRAJ shows the quiet "Enter" key cap on a computer (aria-hidden)', m0.open && m0.cap, JSON.stringify(m0)));
    await p.keyboard.down('Enter');
    for (let i = 0; i < 5; i++) await repeatKey(p);
    await p.keyboard.up('Enter');
    await p.waitForTimeout(150);
    const a = await ms(p);
    const bp0 = await p.evaluate(() => window.__bp);
    // A new press (the launching key was released) = the START card's START: the clock runs.
    await p.keyboard.press('Enter');
    await p.waitForTimeout(250);
    const b = await ms(p);
    const play = await p.evaluate(() => ({ bp: window.__bp, intro: !!window.game.introPending, running: window.game.running, ended: !!window.game.mission.ended, elapsed: window.game.mission.elapsed, left: window.game.mission.timeRemaining, limit: window.game.mission.def.timeLimit }));
    await p.keyboard.press('Enter');
    await p.keyboard.press('Enter');
    await p.waitForTimeout(150);
    const c = await ms(p);
    const play2 = await p.evaluate(() => ({ bp: window.__bp, elapsed: window.game.mission.elapsed, left: window.game.mission.timeRemaining }));
    out.push(report('M1 Enter on the open card (focus still on the Dzielnice GRAJ under it) starts the selected mission exactly once; the card closes, the start card opens', m0.focusUnder && m0.sel === next && a.launches === 1 && a.camp === 1 && a.ids === next && a.mission === next && !a.briefing && a.startCard && a.arena === 0, JSON.stringify({ next, m0, a })));
    out.push(report('M2 the launching press, held (repeats) and released, leaves the START card waiting (no clock); a new Enter = START: one beginMissionPlay, one launch, boosters / coins untouched, the clock runs; more presses add nothing', a.startCard && a.intro && bp0 === 0 && b.launches === 1 && b.camp === 1 && b.arena === 0 && !b.startCard && !b.intro && play.bp === 1 && play.running && !play.ended && play.elapsed > 0 && play.left < play.limit && c.launches === 1 && c.camp === 1 && c.arena === 0 && play2.bp === 1 && play2.elapsed > play.elapsed && b.coins === a.coins && b.stock === a.stock && c.stock === a.stock && c.boosters === a.boosters, JSON.stringify({ a, b, c, play, play2 })));
    out.push(report('M1-M2 no page errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }
  // M3 -- GRAJ itself focused: the key's native click and the shortcut never both fire.
  {
    const g = await missionGame(url);
    const p = g.page;
    await p.evaluate(() => { const id = window.game.nextCampaignMissionId(); window.game.openMissionBriefing(id); document.querySelector('#briefingCard .mc-play[data-mc-launch]').focus(); });
    await p.keyboard.press('Enter');
    await p.waitForTimeout(150);
    const a = await ms(p);
    out.push(report('M3 Enter with the card\'s GRAJ focused starts exactly once (no double from the native activation)', a.launches === 1 && a.camp === 1 && a.startCard, JSON.stringify(a)));
    await g.browser.close();
  }
  // M4 -- boosters: the picked one is charged once, and Enter and a click leave the same save.
  const paid = {};
  for (const via of ['enter', 'click']) {
    const g = await missionGame(url, { coins: 500, stock: { time: 0, start: 2 } });
    const p = g.page;
    await p.evaluate(() => { const id = window.game.nextCampaignMissionId(); window.game.openMissionBriefing(id); });
    await p.locator('#briefingCard [data-booster="time"]').click();   // coins: stock 0
    await p.locator('#briefingCard [data-booster="start"]').click();  // stock 2
    const pre = await p.evaluate(() => ({ coins: window.game.save.coins, cost: window.game.briefingBoosterCost(), sel: [...window.game.briefingBoosters].join() }));
    if (via === 'enter') {
      // Focus is on the last booster tile: Enter there is the tile's own (toggles it), not a start.
      await p.keyboard.press('Enter');
      const tile = await p.evaluate(() => ({ off: !window.game.briefingBoosters.has('start'), launches: window.__ml }));
      await p.keyboard.press('Enter');   // toggles it back on
      const back = await p.evaluate(() => window.game.briefingBoosters.has('start'));
      out.push(report('M4 Enter on a focused booster tile toggles that booster (its own action), no start', tile.off && back && tile.launches === 0, JSON.stringify(tile)));
      await p.evaluate(() => document.activeElement && document.activeElement.blur());
      await p.keyboard.press('Enter');
    } else {
      await p.locator('#briefingCard .mc-play[data-mc-launch]').click({ force: true });
    }
    await p.waitForTimeout(150);
    paid[via] = { ...(await ms(p)), pre };
    await g.browser.close();
  }
  const pe = paid.enter, pc = paid.click;
  const same = (k) => pe[k] === pc[k];
  out.push(report('M5 Enter with boosters picked (one from stock, one for coins): charged exactly once, the same save and mission boosters as a click', pe.launches === 1 && pe.camp === 1 && pe.boosters === pc.boosters && same('coins') && same('stock') && same('mission') && pe.boosters === 'time,start' && pe.pre.cost > 0 && pe.coins === pe.pre.coins - pe.pre.cost && JSON.parse(pe.stock).start === 1 && JSON.parse(pe.stock).time === 0, JSON.stringify({ enter: pe, click: pc })));
  out.push(report('M6 the click path still starts the mission exactly once', pc.launches === 1 && pc.camp === 1 && pc.startCard && pc.arena === 0, JSON.stringify(pc)));

  // M7 -- what Enter must leave alone.
  {
    const g = await missionGame(url, { coins: 0 });
    const p = g.page;
    const open = () => p.evaluate(() => { document.activeElement && document.activeElement.blur(); window.game.openMissionBriefing(window.game.nextCampaignMissionId()); });
    const none = async (label) => { const s = await ms(p); return { label, launches: s.launches, camp: s.camp, arena: s.arena, briefing: s.briefing, coins: s.coins }; };
    const res = [];
    await open();
    // a dialog over the card
    await p.evaluate(() => document.getElementById('loginRewardScreen').classList.remove('hidden'));
    await p.keyboard.press('Enter'); res.push(await none('dialog over the card'));
    await p.evaluate(() => { document.getElementById('loginRewardScreen').classList.add('hidden'); clearTimeout(window.game.loginPopupTimer); });
    // a text field inside the card
    await p.evaluate(() => { const i = document.createElement('input'); i.id = 'qaTextField'; document.getElementById('briefingCard').appendChild(i); i.focus(); });
    await p.keyboard.press('Enter'); res.push(await none('text field'));
    await p.evaluate(() => document.getElementById('qaTextField').remove());
    // a modifier, a repeat
    await p.evaluate(() => document.activeElement && document.activeElement.blur());
    await press(p, { shiftKey: true }); res.push(await none('shift+Enter'));
    await repeatKey(p); res.push(await none('repeat'));
    // another control in the card (the close button): its own action, no start
    await p.evaluate(() => document.getElementById('btnBriefingClose').focus());
    await p.keyboard.press('Enter');
    const closed = await none('close button');
    res.push(closed);
    // no card: Enter on Dzielnice does nothing
    await p.evaluate(() => { window.game.openCampaignScreen(); document.activeElement && document.activeElement.blur(); });
    await p.keyboard.press('Enter'); res.push(await none('Dzielnice, no card'));
    // a locked mission: GRAJ is not playable
    const lockedId = await p.evaluate(() => { const id = DISTRICTS[DISTRICTS.length - 1].missions.slice(-1)[0]; window.game.openMissionBriefing(id); return id; });
    await p.evaluate(() => document.activeElement && document.activeElement.blur());
    await p.keyboard.press('Enter'); res.push(await none('locked mission ' + lockedId));
    // short of coins for the picked booster: the same refusal as a click, no start
    await p.evaluate(() => { window.game.save.boosters.time = 0; window.game.openMissionBriefing(window.game.nextCampaignMissionId()); });
    await p.locator('#briefingCard [data-booster="time"]').click();
    await p.evaluate(() => document.activeElement && document.activeElement.blur());
    await p.keyboard.press('Enter'); res.push(await none('short of coins'));
    // No start anywhere (no mission, no Arena round). Short of coins Enter reaches launchMission() exactly like a click
    // and gets the same refusal: the card stays open, nothing charged, no mission started.
    const short = res[res.length - 1];
    const bad = res.filter(r => r.camp !== 0 || r.arena !== 0 || (r.label !== 'short of coins' && r.launches !== 0));
    const shortOk = short.launches === 1 && short.briefing && short.coins === 0;
    out.push(report('M7 Enter does not start a mission under a dialog over the card, in a text field, with a modifier or a repeat, from the close button (its own action: closes the card), with no card, on a locked mission, or short of coins for the picked booster', bad.length === 0 && shortOk && !closed.briefing, JSON.stringify(res)));
    out.push(report('M7 no page errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // M8 -- in a round (the started mission) Enter adds nothing; Arena's Enter and the Miasto shortcut.
  {
    const g = await missionGame(url);
    const p = g.page;
    await p.evaluate(() => { window.game.openMissionBriefing(window.game.nextCampaignMissionId()); document.activeElement && document.activeElement.blur(); });
    await p.keyboard.press('Enter');
    await p.keyboard.press('Enter');
    await p.waitForTimeout(100);
    await p.keyboard.press('Enter');
    await p.keyboard.press('Enter');
    const r = await p.evaluate(() => ({ running: window.game.running, ml: window.__ml, sc: window.__sc, bp: window.__bp, arena: window.__starts }));
    out.push(report('M8 launch, START and then Enter in the running mission: one launch, one START, no Arena round', r.running && r.ml === 1 && r.sc === 1 && r.bp === 1 && r.arena === 0, JSON.stringify(r)));
    await g.browser.close();
  }
  {
    const g = await missionGame(url);
    const p = g.page;
    // The card opened from Miasto (the campaign shortcut): Enter is the card's GRAJ, never Arena's.
    await p.evaluate(() => { clearTimeout(window.game.loginPopupTimer); window.game.showScreen('mainMenu'); window.game.openMissionBriefing(window.game.nextCampaignMissionId()); document.activeElement && document.activeElement.blur(); });
    await p.keyboard.press('Enter');
    await p.waitForTimeout(150);
    const a = await ms(p);
    out.push(report('M9 the card opened over Miasto: Enter starts the mission, not an Arena round', a.launches === 1 && a.camp === 1 && a.arena === 0, JSON.stringify(a)));
    await g.browser.close();
  }
  {
    const g = await missionGame(url);
    const p = g.page;
    // Close the card: Miasto's Enter is Arena's again (one round).
    await p.evaluate(() => { clearTimeout(window.game.loginPopupTimer); window.game.openMissionBriefing(window.game.nextCampaignMissionId()); window.game.closeMissionBriefing(); document.activeElement && document.activeElement.blur(); });
    await p.keyboard.press('Enter');
    await p.waitForTimeout(150);
    const a = await ms(p);
    out.push(report('M10 with the card closed Enter on Miasto still starts exactly one Arena round (no mission)', a.arena === 1 && a.launches === 0 && a.camp === 0, JSON.stringify(a)));
    await g.browser.close();
  }
  // M12 -- the START card: what Enter must leave alone, and the click path.
  {
    const g = await missionGame(url);
    const p = g.page;
    const snap = () => p.evaluate(() => ({ bp: window.__bp, card: !document.getElementById('missionStartOverlay').classList.contains('hidden'), intro: !!window.game.introPending, ml: window.__ml, sc: window.__sc, arena: window.__starts }));
    const res = [];
    // the same key event that launched can not also go through the START card: two non-repeat keydowns with no keyup between
    await p.evaluate(() => { window.game.openMissionBriefing(window.game.nextCampaignMissionId()); document.activeElement && document.activeElement.blur(); });
    await press(p);                    // launches (card -> START card)
    res.push({ label: 'launch press', ...(await snap()) });
    await press(p);                    // no keyup in between: still the same press
    res.push({ label: 'no keyup between', ...(await snap()) });
    await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Enter', key: 'Enter', bubbles: true })));
    // dialog over the START card, an ad playing, a text field, a modifier, a repeat
    await p.evaluate(() => document.getElementById('loginRewardScreen').classList.remove('hidden'));
    await press(p); res.push({ label: 'dialog over START card', ...(await snap()) });
    await p.evaluate(() => { document.getElementById('loginRewardScreen').classList.add('hidden'); clearTimeout(window.game.loginPopupTimer); window.game.monetization.busy = true; });
    await press(p); res.push({ label: 'ad playing', ...(await snap()) });
    await p.evaluate(() => { window.game.monetization.busy = false; const i = document.createElement('input'); i.id = 'qaTextField'; document.getElementById('missionStartCard').appendChild(i); i.focus(); });
    await press(p); res.push({ label: 'text field', ...(await snap()) });
    await p.evaluate(() => document.getElementById('qaTextField').remove());
    await press(p, { shiftKey: true }); res.push({ label: 'shift+Enter', ...(await snap()) });
    await repeatKey(p); res.push({ label: 'repeat', ...(await snap()) });
    const waiting = res.every(r => r.bp === 0 && r.card && r.intro && r.ml === 1 && r.sc === 1 && r.arena === 0);
    out.push(report('M12 START card: the press that launched (no keyup between), a dialog over it, an ad, a text field, a modifier and a repeat do not start the clock', waiting, JSON.stringify(res)));
    // another control on the card keeps its own Enter: "Zmień wzmocnienia" backs out (cancelMissionStart), no START
    await p.evaluate(() => document.getElementById('btnMissionBack').focus());
    await p.keyboard.press('Enter');
    await p.waitForTimeout(100);
    const back = await p.evaluate(() => ({ bp: window.__bp, card: !document.getElementById('missionStartOverlay').classList.contains('hidden'), briefing: !document.getElementById('missionBriefing').classList.contains('hidden'), ml: window.__ml }));
    out.push(report('M12 Enter on the START card\'s own back button is its action (back to the card), not START', back.bp === 0 && !back.card && back.briefing && back.ml === 1, JSON.stringify(back)));
    out.push(report('M12 no page errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }
  {
    // the click path of START still works, once
    const g = await missionGame(url);
    const p = g.page;
    await p.evaluate(() => { window.game.openMissionBriefing(window.game.nextCampaignMissionId()); });
    await p.locator('#briefingCard .mc-play[data-mc-launch]').click({ force: true });
    await p.locator('#btnMissionGo').click({ force: true });
    await p.waitForTimeout(150);
    const r = await p.evaluate(() => ({ bp: window.__bp, ml: window.__ml, running: window.game.running, intro: !!window.game.introPending, arena: window.__starts, cap: (() => { const k = document.querySelector('#btnMissionGo .play-key'); return !!k; })() }));
    out.push(report('M13 clicking GRAJ and then START still works: one launch, one START', r.bp === 1 && r.ml === 1 && r.running && !r.intro && r.arena === 0, JSON.stringify(r)));
    await g.browser.close();
  }
  {
    // the START button carries the Enter key cap on a computer, not on a phone
    const g = await missionGame(url);
    const cap = await g.page.evaluate(() => { window.game.openMissionBriefing(window.game.nextCampaignMissionId()); window.game.launchMission(window.game.selectedMissionId); const k = document.querySelector('#btnMissionGo .play-key'); return { vis: !!k && k.getClientRects().length > 0, text: k && k.textContent, hidden: k && k.getAttribute('aria-hidden') }; });
    out.push(report('M14 the START button shows the quiet "Enter" key cap on a computer (aria-hidden)', cap.vis && cap.text === 'Enter' && cap.hidden === 'true', JSON.stringify(cap)));
    await g.browser.close();
    const ph = await missionGame(url, { opts: { viewport: { width: 390, height: 844 } } });
    const pc = await ph.page.evaluate(() => { window.game.openMissionBriefing(window.game.nextCampaignMissionId()); window.game.launchMission(window.game.selectedMissionId); const k = document.querySelector('#btnMissionGo .play-key'); return { there: !!k, shown: !!k && k.getClientRects().length > 0 }; });
    out.push(report('M14 a phone: no visible Enter key cap on START', pc.there && !pc.shown, JSON.stringify(pc)));
    await ph.browser.close();
  }
  // M11 -- a phone: no key cap; English: the cap reads Enter.
  {
    const g = await missionGame(url, { opts: { viewport: { width: 390, height: 844 } } });
    const cap = await g.page.evaluate(() => { window.game.openMissionBriefing(window.game.nextCampaignMissionId()); const k = document.querySelector('#briefingCard .play-key'); return { there: !!k, shown: !!k && k.getClientRects().length > 0 }; });
    out.push(report('M11 a phone: the card has no visible Enter key cap', cap.there && !cap.shown, JSON.stringify(cap)));
    await g.browser.close();
  }
  {
    const g = await openGame(url, { ...DESK, locale: 'en-US' });
    const cap = await g.page.evaluate(() => { window.game.openMissionBriefing(window.game.nextCampaignMissionId()); const k = document.querySelector('#briefingCard .play-key'); return k && k.textContent; });
    out.push(report('M11 English: the card\'s key cap reads Enter', cap === 'Enter', String(cap)));
    await g.browser.close();
  }
  return out;
}
const repeatKey = (p) => p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', key: 'Enter', repeat: true, bubbles: true, cancelable: true })));


/** Gives the game's frame the keyboard focus (what a click into it does on the portal) and
 *  waits until it really has it -- focus reaches an iframe asynchronously. Counts Enter
 *  keydowns that reach the frame, for waitRunning()'s diagnosis. */
async function focusFrame(f) {
  await f.evaluate(() => {
    if (!window.__afEnter) { window.__afEnter = { n: 0 }; window.addEventListener('keydown', (e) => { if (e.code === 'Enter') { window.__afEnter.n++; const a = document.activeElement; window.__afEnter.at = a && (a.id || a.className || a.tagName); } }, true); }
    window.focus();
  });
  await f.waitForFunction(() => document.hasFocus(), null, { timeout: 3000 });
}

/** Waits for a round to start; on a timeout says why (focus, open sheets, the start button). */
async function waitRunning(t, timeout) {
  try { await t.waitForFunction(() => window.game.running, null, { timeout }); }
  catch (e) {
    const why = await t.evaluate(() => {
      const g = window.game, a = document.activeElement, menu = document.getElementById('mainMenu');
      const open = [...document.querySelectorAll('.overlay-screen, [aria-modal="true"], #adOverlay')].filter(x => !x.classList.contains('hidden') && x.getClientRects().length).map(x => x.id || x.className);
      return { hasFocus: document.hasFocus(), active: a && (a.id || a.tagName), menu: !menu.classList.contains('hidden'), firstRun: menu.classList.contains('first-run'), open, start: !!g.arenaStartButton(), enterKeydowns: window.__afEnter ? window.__afEnter.n : null, focusAtEnter: window.__afEnter ? window.__afEnter.at : null, busy: !!(g.monetization && g.monetization.busy) };
    }).catch((err) => String(err));
    throw new Error('the round did not start: ' + JSON.stringify(why));
  }
}
export async function runArenaFix1Checks(url, only = null) {
  const want = (k) => !only || only.includes(k);
  const out = [];
  if (want('C')) out.push(...await controlChecks(url));
  if (want('E')) out.push(...await enterChecks(url));
  if (want('M')) out.push(...await missionChecks(url));
  if (want('L')) out.push(...await lockChecks());
  if (want('R')) out.push(...await respawnChecks(url));
  return out;
}

if (isMain(import.meta.url)) {
  const a = process.argv.find(x => x.startsWith('--only='));
  const { server, url } = await serve();
  let res = [];
  try { res = await runArenaFix1Checks(url, a ? a.slice(7).split(',') : null); } finally { server.close(); }
  const failed = res.filter(r => !r.ok).length;
  console.log(`\n${res.length - failed}/${res.length} ARENA-FIX-1 checks passed`);
  process.exit(failed || !res.length ? 1 : 0);
}

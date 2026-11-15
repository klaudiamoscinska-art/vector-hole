// GG-UX-03 -- the four owner-approved corrections (2026-11-14):
//  C  controls: exactly two touch modes -- Przeciąganie (legacy drag, the
//     default, unchanged) and Joystick (inputMode 'thumbpad', now a dynamic
//     joystick anchored wherever a finger lands on the board; the bottom-35 %
//     zone is gone). Anywhere, no jump, deflection = direction, instant stop,
//     multitouch, HUD, pause / resume, touchcancel, focus loss, a turn of the
//     phone, menus still scroll, desktop unchanged, saves.
//  M  minimap: bottom LEFT by default, RIGHT from Profil → Ustawienia
//     (save.settings.minimapSide), every mode, safe area, district plate,
//     no HUD collision on eight frames, edge arrows, PL/EN.
//  O  Overdrive: no dark layer in Arena's last seconds, no "ZACIEMNIENIE"
//     -- the same seeded variant pick, scores, bonus objects and end frame as
//     the base on paired seeded rounds (both variants); Campaign darkness
//     untouched.
//  V  vortices: every hole sprite layer is the base's mirror image (left <->
//     right), turned by the same look.spin -- same direction and speed of
//     turning (static: look data / drawBody / stampHoleLayer identical to
//     the base; measured: the angular shift between frames); handedness of
//     the arms measured before / after; Warsztat uses the same path.
// Base = BASE_REV (main before GG-UX-03), read with `git show` (or
// VH_QA_REVS). The vortex checks serve copies of both revisions whose one
// export list also names holeSprite + HOLE_LOOKS (QA instrumentation only,
// identical for both; the shipped game.js is unchanged by it).
// Usage: node qa/ux3.mjs [--only=C,M,O,V]
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, veteranSave, report, revisionFile, ARENA_BOT, QA_RANDOM, frozenDateScript, ROOT, OUT, isMain } from './lib.mjs';

export const UX3_BASE_REV = '339ec77d0c9a91a868ed3c7215e172c24f22bff1';
const DIR = path.join(OUT, 'ux3');
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);

const FRAMES = [[320, 568], [360, 800], [390, 844], [402, 874], [640, 360], [800, 450], [844, 390], [1366, 768]];

/** Writes a revision's runtime files into DIR/<name>/ (optionally exporting
 *  the vortex internals) and returns the folder. */
function snapshot(name, files, exportExtra) {
  const dir = path.join(DIR, name);
  fs.mkdirSync(dir, { recursive: true });
  for (const [f, buf] of Object.entries(files)) {
    let s = buf;
    if (f === 'game.js' && exportExtra) {
      s = String(buf).replace(/^export\s*\{/m, 'export {\n  holeSprite, HOLE_LOOKS,');
      if (s === String(buf)) throw new Error('no export list in ' + name);
    }
    fs.writeFileSync(path.join(dir, f), s);
  }
  return dir;
}
const RUNTIME = ['index.html', 'style.css', 'game.js'];
const baseFiles = () => Object.fromEntries(RUNTIME.map(f => [f, revisionFile(UX3_BASE_REV, f)]));
const candFiles = () => Object.fromEntries(RUNTIME.map(f => [f, fs.readFileSync(path.join(ROOT, f))]));

async function veteranPage(url, opts = {}, settings = {}) {
  const g = await openGame(url, opts);
  const s = await veteranSave(g.page, { missions: 30, runsPlayed: 6 });
  Object.assign(s.settings, settings);
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), s);
  await g.page.reload();
  await g.page.waitForFunction(() => window.__qaBridge && window.__qaBridge.ready && window.game && window.game.state);
  return g;
}

/** Switches the game to English (Profil's language buttons reload the page). */
async function toEnglish(g) {
  await Promise.all([g.page.waitForNavigation(), g.page.evaluate(() => { window.game.running = false; window.game.setLanguage('en'); })]);
  await g.page.waitForFunction(() => window.__qaBridge && window.__qaBridge.ready && window.game && window.game.state && I18N.lang === 'en');
}

/* ---------- in-page helpers (strings, injected with addScriptTag) ---------- */
const TOUCH_KIT = `
window.__ux3 = {
  /** A live Arena round with the loop detached (frames are stepped by hand). */
  round(seed) {
    const g = window.game; g.checkEvolutionTriggers = () => {};
    g.startRound({ seed: seed || 4242 }); cancelAnimationFrame(g.rafId);
    g.coachState = null; g.player.invulnerableUntil = 0;
    return g.running;
  },
  /** Touch events as a phone sends them: fingers = [{id, x, y}] still down
   *  after the event, changed = the finger(s) this event is about. */
  touch(type, fingers, changed, target) {
    const c = target || document.getElementById('gameCanvas');
    const mk = (f) => new Touch({ identifier: f.id, target: c, clientX: f.x, clientY: f.y });
    const e = new TouchEvent(type, { bubbles: true, cancelable: true, touches: fingers.map(mk), targetTouches: fingers.map(mk), changedTouches: changed.map(mk) });
    c.dispatchEvent(e);
    return e.defaultPrevented;
  },
  step(n) { const g = window.game; for (let i = 0; i < (n || 1); i++) g.update(1 / 30); return { x: g.player.x, y: g.player.y }; },
  pad() {
    const g = window.game, b = document.getElementById('thumbpadBase'), r = b.getBoundingClientRect();
    return { id: g.thumbpadTouchId, mv: { ...g.moveVector }, shown: !b.classList.contains('hidden'), cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }
};`;

/* ===================================================================== C */
async function controlsChecks(url) {
  const out = [];
  // C1 -- new profile: Przeciąganie, two modes only, in that order (PL / EN)
  {
    const g = await openGame(url, { viewport: { width: 390, height: 844 } });
    const r = await g.page.evaluate(async () => {
      const d = defaultSave(), g = window.game;
      const read = () => [...document.querySelectorAll('#inputModeRow .toggle-btn')].map(b => ({ id: b.id, text: b.textContent.trim(), active: b.classList.contains('active') }));
      g.syncControlsPanel();
      const pl = read();
      const all = document.body.innerText + ' ' + [...document.querySelectorAll('#controlsPanel *')].map(e => e.textContent).join(' ');
      return { fresh: d.settings.inputMode, live: g.save.settings.inputMode, useThumbpad: g.useThumbpad, pl, zone: 'zoneHeightFraction' in CONFIG.input, oldWords: /Kciuk \\(pad\\)|dolna strefa|dolny obszar|Bottom-zone/i.test(all) };
    });
    await toEnglish(g);
    const en = await g.page.evaluate(() => [...document.querySelectorAll('#inputModeRow .toggle-btn')].map(b => b.textContent.trim()));
    const ok = r.fresh === 'legacy' && r.live === 'legacy' && !r.useThumbpad && r.pl.length === 2 && r.pl[0].id === 'btnInputLegacy' && r.pl[0].text === 'Przeciąganie' && r.pl[0].active
      && r.pl[1].id === 'btnInputThumbpad' && r.pl[1].text === 'Joystick' && !r.pl[1].active && !r.zone && !r.oldWords && en.join('|') === 'Drag to move|Joystick';
    out.push(report('C1 new profile: Przeciąganie is selected; the Sterowanie panel offers exactly PRZECIĄGANIE | JOYSTICK (EN "Drag to move" | "Joystick"); no third / bottom-zone mode, CONFIG.input.zoneHeightFraction gone', ok, JSON.stringify({ ...r, en })));
    out.push(report('C1 no runtime errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // C2 -- the joystick anywhere on the board (top / middle / bottom), no
  // jump on touch, deflection = direction (not the finger vs the screen
  // centre), stop at once on release, fades out
  {
    const g = await veteranPage(url, { viewport: { width: 390, height: 844 } }, { inputMode: 'thumbpad' });
    await g.page.addScriptTag({ content: TOUCH_KIT });
    const r = await g.page.evaluate(async () => {
      const u = window.__ux3, g = window.game; u.round(4242);
      const res = [];
      const H = g.height, W = g.width;
      for (const [name, x, y] of [['top', 0.62 * W, 0.2 * H], ['middle', 0.5 * W, 0.5 * H], ['bottom', 0.62 * W, 0.86 * H], ['top-left', 0.18 * W, 0.24 * H]]) {
        const p0 = { x: g.player.x, y: g.player.y };
        u.touch('touchstart', [{ id: 7, x, y }], [{ id: 7, x, y }]);
        const at = u.pad();
        const p1 = u.step(6);
        const jump = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        // push right 40 px: the hole goes right (wherever the anchor is)
        u.touch('touchmove', [{ id: 7, x: x + 40, y }], [{ id: 7, x: x + 40, y }]);
        const mv = u.pad().mv;
        const p2 = u.step(10);
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        // push up-left: the hole turns that way
        u.touch('touchmove', [{ id: 7, x: x - 30, y: y - 30 }], [{ id: 7, x: x - 30, y: y - 30 }]);
        const p3 = u.step(10);
        const ux = p3.x - p2.x, uy = p3.y - p2.y;
        u.touch('touchend', [], [{ id: 7, x: x - 30, y: y - 30 }]);
        const after = u.pad();
        const p4 = u.step(10);
        const drift = Math.hypot(p4.x - p3.x, p4.y - p3.y);
        res.push({ name, x: Math.round(x), y: Math.round(y), anchored: at.id === 7, under: Math.round(Math.hypot(at.cx - x, at.cy - y)), jump: +jump.toFixed(3),
          rightCos: +(dx / (Math.hypot(dx, dy) || 1)).toFixed(3), mv: +mv.magnitude.toFixed(2), upLeftCos: +((-ux - uy) / Math.SQRT2 / (Math.hypot(ux, uy) || 1)).toFixed(3),
          releasedId: after.id, releasedMv: after.mv.magnitude, drift: +drift.toFixed(3) });
        // move the hole back to the middle for the next spot
        g.player.x = 1500; g.player.y = 1500; u.step(1);
      }
      await new Promise(res => setTimeout(res, CONFIG.input.fadeDelayMs + 120));
      const hidden = document.getElementById('thumbpadBase').classList.contains('hidden');
      const pe = ['thumbpadBase', 'thumbpadKnob'].map(id => getComputedStyle(document.getElementById(id)).pointerEvents);
      return { res, hidden, pe, canvasTA: getComputedStyle(g.canvas).touchAction };
    });
    const bad = r.res.filter(s => !s.anchored || s.under > 3 || s.jump !== 0 || s.rightCos < 0.99 || s.mv < 0.5 || s.upLeftCos < 0.99 || s.releasedId !== null || s.releasedMv !== 0 || s.drift !== 0);
    out.push(report('C2 Joystick (390x844): appears under the finger at the top, middle, bottom and top-left of the board; the touch itself moves nothing (0 px over 6 frames); a push right drives right and up-left drives up-left wherever the anchor is (deflection, not the finger vs the screen centre); release = signal 0 and 0 px drift', bad.length === 0, JSON.stringify(bad.length ? bad : r.res.map(s => `${s.name}@${s.x},${s.y} cos ${s.rightCos}/${s.upLeftCos}`))));
    out.push(report('C2 the joystick fades out after release; base and knob take no touches (pointer-events none); touch-action none only on the board', r.hidden && r.pe.every(v => v === 'none') && r.canvasTA === 'none', JSON.stringify({ hidden: r.hidden, pe: r.pe, ta: r.canvasTA })));

    // C3 multitouch, HUD, pause / resume, touchcancel, blur, menus
    const m = await g.page.evaluate(async () => {
      const u = window.__ux3, g = window.game; u.round(4242);
      const W = g.width, H = g.height, A = { id: 1, x: 0.6 * W, y: 0.55 * H }, B = { id: 2, x: 0.3 * W, y: 0.3 * H };
      const o = {};
      u.touch('touchstart', [A], [A]);
      u.touch('touchmove', [{ ...A, x: A.x + 40 }], [{ ...A, x: A.x + 40 }]);
      const before = u.pad();
      // a second finger lands and moves: the first finger's anchor and push stay
      u.touch('touchstart', [{ ...A, x: A.x + 40 }, B], [B]);
      u.touch('touchmove', [{ ...A, x: A.x + 40 }, { ...B, x: B.x - 50, y: B.y + 60 }], [{ ...B, x: B.x - 50, y: B.y + 60 }]);
      const mid = u.pad();
      o.second = { keptId: mid.id === 1, keptAnchor: Math.round(Math.hypot(mid.cx - before.cx, mid.cy - before.cy)), keptMv: Math.abs(mid.mv.x - before.mv.x) < 1e-9 && Math.abs(mid.mv.y - before.mv.y) < 1e-9 };
      // the joystick's own finger lifts while the second stays: stop at once
      u.touch('touchend', [{ ...B, x: B.x - 50, y: B.y + 60 }], [{ ...A, x: A.x + 40 }]);
      const p0 = u.step(1); u.touch('touchmove', [{ ...B, x: B.x + 80, y: B.y }], [{ ...B, x: B.x + 80, y: B.y }]); const p1 = u.step(10);
      o.firstUp = { id: u.pad().id, mv: u.pad().mv.magnitude, drift: +Math.hypot(p1.x - p0.x, p1.y - p0.y).toFixed(3) };
      u.touch('touchend', [], [{ ...B, x: B.x + 80, y: B.y }]);
      // touchcancel
      u.touch('touchstart', [A], [A]); u.touch('touchmove', [{ ...A, y: A.y - 40 }], [{ ...A, y: A.y - 40 }]);
      u.touch('touchcancel', [], [{ ...A, y: A.y - 40 }]);
      o.cancel = { id: u.pad().id, mv: u.pad().mv.magnitude };
      // a finger on a HUD panel / the minimap: no joystick there
      g.hudBoxes = null; g.fadeHudUnderHole();
      const hud = [];
      for (const b of (g.hudBoxes || []).filter(b => b.el.id !== 'btnPause').concat(g.showMinimap ? [{ el: { id: 'minimap' }, ...g.minimapRect() }] : [])) {
        const x = (b.l + b.r) / 2, y = (b.t + b.b) / 2, el = document.elementFromPoint(x, y);
        u.touch('touchstart', [{ id: 9, x, y }], [{ id: 9, x, y }], el);
        hud.push({ id: b.el.id, target: el && (el.id || el.tagName), started: u.pad().id !== null });
        u.touch('touchend', [], [{ id: 9, x, y }], el);
        g.releaseThumbpad();
      }
      o.hud = hud;
      // the pause button works; a held joystick stops on pause and does not come back on resume
      u.touch('touchstart', [A], [A]); u.touch('touchmove', [{ ...A, x: A.x + 45 }], [{ ...A, x: A.x + 45 }]);
      document.getElementById('btnPause').click();
      o.pause = { paused: g.paused, id: u.pad().id, mv: u.pad().mv.magnitude };
      // a touch on the board under the pause sheet starts nothing
      u.touch('touchstart', [A, { id: 3, x: 50, y: 400 }], [{ id: 3, x: 50, y: 400 }]);
      o.pausedTouch = u.pad().id;
      g.resumeGame(); cancelAnimationFrame(g.rafId);
      const r0 = u.step(1);
      u.touch('touchmove', [{ ...A, x: A.x + 60 }], [{ ...A, x: A.x + 60 }]); // the old finger is still down
      const r1 = u.step(15);
      o.resume = { id: u.pad().id, mv: u.pad().mv.magnitude, drift: +Math.hypot(r1.x - r0.x, r1.y - r0.y).toFixed(3) };
      u.touch('touchend', [], [A]);
      // focus lost
      u.touch('touchstart', [A], [A]); u.touch('touchmove', [{ ...A, x: A.x - 45 }], [{ ...A, x: A.x - 45 }]);
      window.dispatchEvent(new Event('blur'));
      o.blur = { paused: g.paused, id: u.pad().id, mv: u.pad().mv.magnitude };
      g.resumeGame(); cancelAnimationFrame(g.rafId);
      return o;
    });
    out.push(report('C3 multitouch: a second finger landing and moving never moves the first finger\'s anchor or push; lifting the joystick finger stops the hole at once though the second stays down (0 px over 10 frames, the second finger steers nothing)',
      m.second.keptId && m.second.keptAnchor <= 1 && m.second.keptMv && m.firstUp.id === null && m.firstUp.mv === 0 && m.firstUp.drift === 0, JSON.stringify({ second: m.second, firstUp: m.firstUp })));
    out.push(report('C3 touchcancel and window blur (focus lost) zero the joystick; blur pauses the live round as before', m.cancel.id === null && m.cancel.mv === 0 && m.blur.id === null && m.blur.mv === 0 && m.blur.paused, JSON.stringify({ cancel: m.cancel, blur: m.blur })));
    out.push(report('C3 a finger on a HUD panel (clock strip, standings) or the minimap starts no joystick', m.hud.length >= 3 && m.hud.every(h => !h.started), JSON.stringify(m.hud)));
    out.push(report('C3 pause: the pause button works, a held joystick is zeroed, a touch under the pause sheet starts nothing; resume brings no movement back (0 px over 15 frames, even with the old finger still moving)',
      m.pause.paused && m.pause.id === null && m.pause.mv === 0 && m.pausedTouch === null && m.resume.id === null && m.resume.mv === 0 && m.resume.drift === 0, JSON.stringify({ pause: m.pause, pausedTouch: m.pausedTouch, resume: m.resume })));

    // C4 a turn of the phone leaves no anchor
    await g.page.evaluate(() => { const u = window.__ux3, g = window.game; u.round(4242); const A = { id: 4, x: 200, y: 500 }; u.touch('touchstart', [A], [A]); u.touch('touchmove', [{ ...A, x: 250 }], [{ ...A, x: 250 }]); window.__ux3held = u.pad().id; });
    await g.page.setViewportSize({ width: 844, height: 390 });
    await g.page.waitForTimeout(500);
    const turn = await g.page.evaluate(() => { const u = window.__ux3, g = window.game; cancelAnimationFrame(g.rafId); const p0 = u.step(1), p1 = u.step(10); return { held: window.__ux3held, id: u.pad().id, mv: u.pad().mv.magnitude, w: g.width, drift: +Math.hypot(p1.x - p0.x, p1.y - p0.y).toFixed(3) }; });
    out.push(report('C4 turning the phone (390x844 -> 844x390) mid-push leaves no joystick anchor and no movement', turn.held === 4 && turn.w === 844 && turn.id === null && turn.mv === 0 && turn.drift === 0, JSON.stringify(turn)));

    // C5 menus keep scrolling: no touch outside the board is cancelled
    const menu = await g.page.evaluate(() => {
      const u = window.__ux3, g = window.game; g.endRound && g.running && (g.running = false);
      g.showScreen('profileScreen');
      const el = document.querySelector('#profileScreen .screen-inner');
      const prevented = u.touch('touchstart', [{ id: 5, x: 100, y: 300 }], [{ id: 5, x: 100, y: 300 }], el);
      return { prevented, ta: getComputedStyle(el).touchAction, pad: u.pad().id };
    });
    out.push(report('C5 menus: a touch on a menu screen (Profil) is not cancelled and starts no joystick (touch-action stays auto there)', !menu.prevented && menu.ta !== 'none' && menu.pad === null, JSON.stringify(menu)));
    out.push(report('C2-C5 no runtime errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // C6 -- Przeciąganie (default) still steers toward the finger, as before
  {
    const g = await veteranPage(url, { viewport: { width: 390, height: 844 } }, { inputMode: 'legacy' });
    await g.page.addScriptTag({ content: TOUCH_KIT });
    const r = await g.page.evaluate(() => {
      const u = window.__ux3, g = window.game; u.round(4242); u.step(2);
      const W = g.width, H = g.height, F = { id: 1, x: 0.18 * W, y: 0.24 * H };
      const c = g.playerScreenCircle(), p0 = { x: g.player.x, y: g.player.y };
      u.touch('touchstart', [F], [F]);
      const p1 = u.step(10);
      const dx = p1.x - p0.x, dy = p1.y - p0.y, wx = F.x - c.x, wy = F.y - c.y;
      const cos = (dx * wx + dy * wy) / (Math.hypot(dx, dy) * Math.hypot(wx, wy) || 1);
      u.touch('touchend', [], [F]);
      const p2 = u.step(1), p3 = u.step(10);
      return { cos: +cos.toFixed(3), moved: +Math.hypot(dx, dy).toFixed(1), pad: u.pad().id, shown: u.pad().shown, stop: +Math.hypot(p3.x - p2.x, p3.y - p2.y).toFixed(3) };
    });
    out.push(report('C6 Przeciąganie (unchanged): the hole drives toward the finger on the screen, no joystick appears, finger up = stop', r.cos > 0.98 && r.moved > 5 && r.pad === null && !r.shown && r.stop === 0, JSON.stringify(r)));
    await g.browser.close();
  }

  // C7 -- desktop: mouse and keys unchanged whatever the saved touch mode
  {
    const g = await veteranPage(url, { viewport: { width: 1366, height: 768 }, mobile: false, deviceScaleFactor: 1 }, { inputMode: 'thumbpad' });
    await g.page.addScriptTag({ content: TOUCH_KIT });
    await g.page.evaluate(() => { window.__ux3.round(4242); window.__ux3.step(2); });
    const c = await g.page.evaluate(() => window.game.playerScreenCircle());
    await g.page.mouse.move(c.x + 200, c.y + 2);
    const r = await g.page.evaluate(() => {
      const u = window.__ux3, g = window.game; const p0 = { x: g.player.x, y: g.player.y }; const p1 = u.step(10);
      const mouse = p1.x - p0.x;
      // UX-FIX-A: Mysz takes no movement key; in Klawiatura S drives down.
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', key: 's', bubbles: true }));
      const mouseKey = g.keyDir.y;
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS', key: 's', bubbles: true }));
      g.save.settings.deskControls = 'keyboard'; g.pointerScreen = null;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', key: 's', bubbles: true }));
      const k0 = u.step(1), k1 = u.step(10);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS', key: 's', bubbles: true }));
      g.save.settings.deskControls = 'mouse';
      return { touch: g.isTouchDevice, mouse: +mouse.toFixed(1), mouseKey, keysDown: +(k1.y - k0.y).toFixed(1), keysSide: +(k1.x - k0.x).toFixed(1), modeRowHidden: document.getElementById('inputModeRow').classList.contains('hidden') };
    });
    out.push(report('C7 desktop (1366x768, no touch, Joystick saved): the mouse still steers (toward the cursor), S takes no direction in Mysz (UX-FIX-A) and drives down in Klawiatura, the touch-mode row stays hidden', !r.touch && r.mouse > 5 && r.mouseKey === 0 && r.keysDown > 5 && Math.abs(r.keysSide) < 0.5 && r.modeRowHidden, JSON.stringify(r)));
    await g.browser.close();
  }

  // C8 -- the choice is saved; older saves keep their choice
  {
    const g = await veteranPage(url, { viewport: { width: 390, height: 844 } }, { inputMode: 'legacy' });
    await g.page.evaluate(() => { document.getElementById('btnInputThumbpad').click(); });
    await g.page.reload();
    await g.page.waitForFunction(() => window.__qaBridge && window.__qaBridge.ready && window.game && window.game.state);
    const kept = await g.page.evaluate(() => ({ mode: window.game.save.settings.inputMode, use: window.game.useThumbpad }));
    const mig = await g.page.evaluate(() => {
      const mk = (settings) => { const s = defaultSave(); s.settings = { ...s.settings, ...settings }; return s; };
      const run = (s) => { const issues = []; const o = sanitizeSave(migrateSave(JSON.parse(JSON.stringify(s))), issues); return { mode: o.settings.inputMode, side: o.settings.minimapSide, issues: issues.length }; };
      const noField = defaultSave(); delete noField.settings.inputMode; delete noField.settings.minimapSide;
      return {
        legacy: run(mk({ inputMode: 'legacy' })), thumbpad: run(mk({ inputMode: 'thumbpad' })), missing: run(noField), junk: run(mk({ inputMode: 'bottomzone' })),
        right: run(mk({ minimapSide: 'right' })), badSide: run(mk({ minimapSide: 'top' })), schema: defaultSave().schemaVersion
      };
    });
    out.push(report('C8 the picked mode survives a reload (Joystick -> still Joystick)', kept.mode === 'thumbpad' && kept.use, JSON.stringify(kept)));
    out.push(report('C8 saves (schema 13, no migration): legacy -> Przeciąganie, thumbpad -> Joystick, a missing or unknown mode -> Przeciąganie; minimapSide missing / unknown -> left, right kept; nothing reported as damaged',
      mig.schema === 13 && mig.legacy.mode === 'legacy' && mig.thumbpad.mode === 'thumbpad' && mig.missing.mode === 'legacy' && mig.junk.mode === 'legacy'
      && mig.missing.side === 'left' && mig.legacy.side === 'left' && mig.right.side === 'right' && mig.badSide.side === 'left' && Object.values(mig).filter(v => v && v.issues).length === 0, JSON.stringify(mig)));
    await g.browser.close();
  }
  return out;
}

/* ===================================================================== M */
async function minimapChecks(url) {
  const out = [];
  // M1 -- default left, right after the setting, back to left; saved; PL/EN
  {
    const g = await veteranPage(url, { viewport: { width: 390, height: 844 } });
    await g.page.addScriptTag({ content: TOUCH_KIT });
    const r = await g.page.evaluate(() => {
      const g = window.game; g.showScreen('profileScreen'); g.syncControlsPanel();
      const row = document.getElementById('minimapSideRow');
      const btns = [...row.querySelectorAll('[data-minimap-side]')].map(b => ({ side: b.dataset.minimapSide, text: b.textContent.trim(), active: b.classList.contains('active') }));
      const label = row.querySelector('.control-label').textContent.trim();
      window.__ux3.round(4242);
      const m = g.minimapRect(), mg = g.minimapMargin();
      return { btns, label, def: g.save.settings.minimapSide, l: m.l, r: m.r, W: g.width, mg, body: document.body.className };
    });
    out.push(report('M1 default: the minimap sits in the bottom-LEFT corner (left edge = margin), Profil → Ustawienia shows POŁOŻENIE MINIMAPY: LEWA (on) | PRAWA',
      r.def === 'left' && Math.abs(r.l - r.mg) < 0.5 && r.label === 'Położenie minimapy' && r.btns.map(b => b.text).join('|') === 'Lewa|Prawa' && r.btns[0].active && !r.btns[1].active && /minimap-left/.test(r.body), JSON.stringify(r)));
    await g.page.evaluate(() => { const g = window.game; g.running = false; g.showScreen('profileScreen'); document.querySelector('[data-minimap-side="right"]').click(); });
    await g.page.reload();
    await g.page.waitForFunction(() => window.__qaBridge && window.__qaBridge.ready && window.game && window.game.state);
    await g.page.addScriptTag({ content: TOUCH_KIT });
    const r2 = await g.page.evaluate(() => {
      const g = window.game; window.__ux3.round(4242);
      const m = g.minimapRect();
      const right = { side: g.save.settings.minimapSide, r: m.r, W: g.width, mg: g.minimapMargin(), stored: JSON.parse(localStorage.getItem('vectorHoleSave_v1')).settings.minimapSide, body: document.body.className };
      g.running = false; g.showScreen('profileScreen'); document.querySelector('[data-minimap-side="left"]').click();
      window.__ux3.round(4242);
      return { right, back: { side: g.save.settings.minimapSide, l: g.minimapRect().l, body: document.body.className }, visible: g.save.settings.minimap };
    });
    out.push(report('M1 PRAWA moves it to the bottom-right corner and survives a reload; LEWA brings it back; the visibility setting (settings.minimap) is untouched',
      r2.right.side === 'right' && r2.right.stored === 'right' && Math.abs(r2.right.W - r2.right.mg - r2.right.r) < 0.5 && /minimap-right/.test(r2.right.body)
      && r2.back.side === 'left' && Math.abs(r2.back.l - r2.right.mg) < 0.5 && /minimap-left/.test(r2.back.body) && r2.visible === 'auto', JSON.stringify(r2)));
    await toEnglish(g);
    await g.page.evaluate(() => window.game.showScreen('profileScreen'));
    const en = await g.page.evaluate(() => { const row = document.getElementById('minimapSideRow'); return { label: row.querySelector('.control-label').textContent.trim(), btns: [...row.querySelectorAll('button')].map(b => b.textContent.trim()).join('|') }; });
    out.push(report('M1 EN: MINIMAP POSITION: LEFT | RIGHT', en.label === 'Minimap position' && en.btns === 'Left|Right', JSON.stringify(en)));
    // export / import
    const code = await g.page.evaluate(() => { const s = window.game.save; s.settings.minimapSide = 'right'; const c = encodeSaveCode(sealSave ? s : s); const d = decodeSaveCode(c); const o = d && (d.save || d); return { side: o && o.settings && o.settings.minimapSide, input: o && o.settings && o.settings.inputMode }; });
    out.push(report('M1 the backup code carries the side (export -> import keeps minimapSide right)', code.side === 'right', JSON.stringify(code)));
    out.push(report('M1 no runtime errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // M2 -- every mode draws the map (and its plate) where minimapRect() says, on both sides
  {
    const g = await veteranPage(url, { viewport: { width: 390, height: 844 } });
    const r = await g.page.evaluate(async () => {
      const g = window.game, res = [];
      const spy = () => { const got = []; const f = g.drawMinimapLabel.bind(g); g.drawMinimapLabel = (ctx, px, py, size, id) => { got.push({ px, py, size }); f(ctx, px, py, size, id); }; return () => { delete g.drawMinimapLabel; return got; }; };
      const modes = {
        arena: () => g.startRound({ seed: 4242 }),
        daily: () => g.startRound({ seed: 20261114, daily: true }),
        challenge: () => g.startRound({ seed: 777, challenge: { score: 500, from: 'Znajomy' } }),
        campaign: () => { g.startCampaignMission('M05'); g.beginMissionPlay && g.beginMissionPlay(); }
      };
      for (const side of ['left', 'right']) {
        g.save.settings.minimapSide = side;
        for (const [name, start] of Object.entries(modes)) {
          g.checkEvolutionTriggers = () => {};
          start(); cancelAnimationFrame(g.rafId);
          const stop = spy();
          if (g.mode === 'campaign') g.renderCampaign(performance.now() / 1000); else g.render(performance.now() / 1000);
          const got = stop(), m = g.minimapRect();
          res.push({ side, name, mode: g.mode, daily: !!g.isDailyRun, at: got[0] ? Math.round(got[0].px) : null, l: Math.round(m.l), ok: !!got[0] && Math.abs(got[0].px - m.l) < 0.5 && (side === 'left' ? m.l < g.width / 2 : m.r > g.width / 2) });
          g.running = false;
        }
      }
      g.save.settings.minimapSide = 'left';
      return res;
    });
    const bad = r.filter(x => !x.ok);
    out.push(report('M2 Arena, Wyzwanie dnia, a friend challenge and a Campaign mission all draw the minimap in the chosen corner (left and right)', bad.length === 0 && r.length === 8, JSON.stringify(bad.length ? bad : r.map(x => `${x.side}/${x.name}@${x.at}`))));
    out.push(report('M2 no runtime errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // M3 -- eight frames, both sides, Arena and Campaign: map + plate inside
  // the safe area, clear of every HUD box; edge arrows clear of it
  {
    const bad = [], info = [];
    for (const [w, h] of FRAMES) {
      const desk = w >= 1000;
      const g = await veteranPage(url, { viewport: { width: w, height: h }, mobile: !desk, deviceScaleFactor: desk ? 1 : 2 });
      const r = await g.page.evaluate(async () => {
        const g = window.game, res = [];
        const settle = () => new Promise(r => setTimeout(r, 120));
        for (const side of ['left', 'right']) for (const mode of ['arena', 'campaign']) {
          g.save.settings.minimapSide = side; g.applyMinimapSide();
          g.checkEvolutionTriggers = () => {};
          if (mode === 'arena') g.startRound({ seed: 4242 }); else { g.startCampaignMission('M05'); g.beginMissionPlay && g.beginMissionPlay(); }
          cancelAnimationFrame(g.rafId);
          // the hole in the middle of the city: nothing fades
          g.player.x = mode === 'arena' ? 1500 : (CONFIG.campaign.bounds.minX + CONFIG.campaign.bounds.maxX) / 2; g.player.y = mode === 'arena' ? 1500 : (CONFIG.campaign.bounds.minY + CONFIG.campaign.bounds.maxY) / 2;
          await settle();
          if (g.mode === 'campaign') g.renderCampaign(performance.now() / 1000); else g.render(performance.now() / 1000);
          g.hudBoxes = null; g.fadeHudUnderHole();
          const k = g.uiScale || 1, m = g.minimapRect(), sf = g.safe;
          const c = g.ctx; c.save(); c.font = "10px 'Russo One', 'Exo 2', 'Segoe UI', sans-serif";
          const lw = (Math.max(...DISTRICTS.map(x => c.measureText(x.name.toUpperCase()).width)) + 21) * k; c.restore();
          const label = side === 'right' ? { l: m.r - lw, r: m.r, t: m.t - 20 * k, b: m.t - 4 * k } : { l: m.l, r: m.l + lw, t: m.t - 20 * k, b: m.t - 4 * k };
          const boxes = [];
          const shown = (el) => el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 1;
          for (const id of ['btnPause', 'hud-tier-strip', 'hud-topright', 'hud-goal', 'nelaToast', 'nowPlaying', 'mobile-hint']) {
            const el = document.getElementById(id);
            if (!shown(el)) continue;
            if ((id === 'nelaToast' || id === 'nowPlaying') && !el.classList.contains('visible')) continue;
            const b = el.getBoundingClientRect(); boxes.push({ id, l: b.left, t: b.top, r: b.right, b: b.bottom });
          }
          (g.hudStack || []).forEach((b, i) => boxes.push({ id: 'stack' + i, ...b }));
          // the coach hint and "now playing" are shown on purpose (they share the bottom edge)
          const probe = [];
          for (const id of ['mobile-hint', 'nowPlaying']) {
            const el = document.getElementById(id); if (!el) continue;
            const was = el.className; el.classList.remove('hidden'); el.classList.add('visible');
            if (id === 'mobile-hint') el.textContent = 'Dotknij planszy i przesuń kciuk — wir jedzie w tę stronę';
            const b = el.getBoundingClientRect(); if (b.width > 1 && getComputedStyle(el).display !== 'none') probe.push({ id: id + '*', l: b.left, t: b.top, r: b.right, b: b.bottom });
            el.className = was;
          }
          const meet = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 1 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 1;
          const hits = boxes.concat(probe).filter(b => meet(b, m) || meet(b, label)).map(b => b.id);
          const outOf = [m, label].some(b => b.l < sf.l - 0.5 || b.r > g.width - sf.r + 0.5 || b.t < sf.t - 0.5 || b.b > g.height - sf.b + 0.5);
          const arrows = [];
          for (let a = 0; a < Math.PI * 2; a += Math.PI / 24) { const p = g.edgeMarkerPos(a, 30); if (p.x > m.l - 4 && p.x < m.r + 4 && p.y > m.t - 4 && p.y < m.b + 4) arrows.push(+a.toFixed(2)); }
          res.push({ side, mode, hits, outOf, arrows, map: [Math.round(m.l), Math.round(m.t), Math.round(m.r - m.l)], k: +k.toFixed(2) });
          g.running = false;
        }
        return res;
      });
      const b = r.filter(x => x.hits.length || x.outOf || x.arrows.length);
      if (b.length) bad.push({ frame: `${w}x${h}`, b });
      info.push(`${w}x${h}: ${r[0].map.join(',')}`);
      if (g.errors.length) bad.push({ frame: `${w}x${h}`, errors: g.errors.slice(0, 2) });
      await g.browser.close();
    }
    out.push(report('M3 eight frames (320x568 ... 1366x768), left and right, Arena and Campaign: the minimap and its district plate stay inside the safe area and meet no HUD box (pause, clock strip, standings, goal, NELA, the canvas stack, the coach hint, "now playing"); edge arrows never land on the map', bad.length === 0, JSON.stringify(bad.length ? bad.slice(0, 4) : info)));
  }

  // M4 -- safe area: the map keeps clear of a side notch (left) / home bar
  {
    const g = await veteranPage(url, { viewport: { width: 844, height: 390 } });
    const r = await g.page.evaluate(() => {
      const g = window.game; g.startRound({ seed: 4242 }); cancelAnimationFrame(g.rafId);
      g.safe = { t: 0, r: 47, b: 21, l: 47 };
      const L = g.minimapRect(); g.save.settings.minimapSide = 'right'; const R = g.minimapRect(); g.save.settings.minimapSide = 'left';
      return { mg: g.minimapMargin(), L, R, W: g.width, H: g.height };
    });
    out.push(report('M4 safe area (iPhone on its side: 47 px notch each side, 21 px home bar): the left map starts at notch + margin, the right one ends at W - notch - margin, both above the home bar',
      Math.abs(r.L.l - (47 + r.mg)) < 0.5 && Math.abs(r.R.r - (r.W - 47 - r.mg)) < 0.5 && Math.abs(r.L.b - (r.H - 21 - r.mg)) < 0.5, JSON.stringify(r)));
    await g.browser.close();
  }

  // M5 -- Campaign's hidden data: a dark mission's map shows no entity on the left either
  {
    const g = await veteranPage(url, { viewport: { width: 390, height: 844 } });
    const r = await g.page.evaluate(() => {
      const g = window.game; g.checkEvolutionTriggers = () => {};
      g.startCampaignMission('M15'); g.beginMissionPlay && g.beginMissionPlay(); cancelAnimationFrame(g.rafId);
      const m = g.minimapRect(), ctx = g.ctx, fr = ctx.fillRect.bind(ctx); let dots = 0, diamonds = 0;
      const dd = g.drawMinimapDiamond.bind(g);
      ctx.fillRect = (x, y, w, h) => { if (w < 5 && h < 5 && x >= m.l - 3 && x <= m.r + 3 && y >= m.t - 3 && y <= m.b + 3) dots++; fr(x, y, w, h); };
      g.drawMinimapDiamond = (...a) => { diamonds++; dd(...a); };
      g.drawCampaignMinimap(ctx);
      ctx.fillRect = fr; delete g.drawMinimapDiamond;
      return { dark: !!g.mission.def.setup.dark, live: g.campaignEntities.filter(e => e.live && !e.consumed).length, dots, diamonds, left: m.l < g.width / 2 };
    });
    out.push(report('M5 Campaign: a dark mission (M15) still hides every entity on the minimap (now on the left)', r.dark && r.left && r.live > 0 && r.dots === 0 && r.diamonds === 0, JSON.stringify(r)));
    await g.browser.close();
  }
  return out;
}

/* ===================================================================== O */
async function overdriveChecks(baseUrl, candUrl) {
  const out = [];
  // Paired seeded Arena rounds (the same Math.random stream and virtual
  // clock on both revisions), checkpoints at 20 / 12 / 5 / 1 s left.
  // (as qa/trace.mjs: audio off -- the music sequencer draws Math.random in
  // real time -- and a frozen wall clock, so a round repeats exactly)
  const play = async (url, seed) => {
    const g = await veteranPage(url, { viewport: { width: 390, height: 844 }, initScript: frozenDateScript('2026-11-14T10:00:00.000Z') }, { music: false, sfx: false });
    await g.page.addScriptTag({ content: QA_RANDOM + ARENA_BOT });
    const r = await g.page.evaluate((seed) => {
      const g = window.game; const marks = [20, 12.5, 11.5, 5, 1]; const cps = [];
      const lum = () => { const d = g.ctx.getImageData(0, 0, g.canvas.width, g.canvas.height).data; let s = 0, n = 0; for (let i = 0; i < d.length; i += 64) { s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++; } return s / n; };
      window.__qaSeedRandom(seed);
      // UX-FIX-B changed three evolution cards on purpose (Skaner, Impuls ssący, Łowca): the
      // round is compared with the cards skipped, so only the finish is what differs.
      const res = window.__qaPlayArena({ round: { seed }, style: 'casual', clock0: 1e6, pickCards: false, onFrame(f, g) {
        if (marks.length && g.timeRemaining <= marks[0]) {
          const at = marks.shift();
          g.render(f / 30); const L = lum();
          cps.push({ at, frame: f, score: g.player.score, bots: g.bots.map(b => b.score).join(','), objects: g.objects.length, portals: g.objects.filter(o => o.tier === 'portal').length,
            od: g.overdriveActive, variant: g.overdriveVariant, tag: g.overdriveTag, banner: g.banner ? [g.banner.text, g.banner.sub || ''].join('/') : null, rnd: window.__qaRandomCalls, lum: +L.toFixed(1) });
        }
      } });
      const tag = document.getElementById('resultTag');
      return { res: { score: res.score, place: res.place, frames: res.frames, radius: res.radius, coinsEarned: res.coinsEarned, state: res.state }, cps, resultTag: tag.classList.contains('hidden') ? null : tag.textContent, rnd: window.__qaRandomCalls };
    }, seed);
    const errors = g.errors.slice();
    await g.browser.close();
    return { ...r, errors };
  };
  // find one seed of each variant on the candidate (deterministic list)
  const runs = {};
  for (const seed of [101, 202, 303, 404, 505, 606, 707, 808]) {
    const c = await play(candUrl, seed);
    const v = (c.cps.find(x => x.variant) || {}).variant;
    if (v && !runs[v]) runs[v] = { seed, c };
    if (runs.blackout && runs.portal_rain) break;
  }
  for (const v of ['blackout', 'portal_rain']) {
    const k = runs[v];
    if (!k) { out.push(report(`O1 ${v}: a seed with this variant`, false, 'none of 8 seeds picked it')); continue; }
    const b = await play(baseUrl, k.seed), c = k.c;
    const strip = (x) => x.map(p => ({ at: p.at, frame: p.frame, score: p.score, bots: p.bots, objects: p.objects, portals: p.portals, od: p.od, variant: p.variant, rnd: p.rnd }));
    const same = JSON.stringify(strip(b.cps)) === JSON.stringify(strip(c.cps)) && JSON.stringify(b.res) === JSON.stringify(c.res) && b.rnd === c.rnd;
    out.push(report(`O1 ${v} (seed ${k.seed}): base and candidate play the same round -- the same variant pick, scores (you + rivals), object and bonus-portal counts, Math.random draws at 20 / 12.5 / 11.5 / 5 / 1 s left, the same end frame, score, place and coins`, same,
      same ? `end frame ${c.res.frames}, score ${c.res.score}, place ${c.res.place}, portals at 11.5 s ${c.cps[2].portals}` : JSON.stringify({ base: strip(b.cps), cand: strip(c.cps), bres: b.res, cres: c.res })));
    // darkness: candidate brightness during Overdrive vs before it, and vs the base
    const pre = c.cps.find(p => p.at === 12.5), during = c.cps.filter(p => p.od);
    const ratio = during.map(p => +(p.lum / pre.lum).toFixed(2));
    const vsBase = during.map(p => +(p.lum / (b.cps.find(q => q.at === p.at).lum || 1)).toFixed(2));
    const okDark = during.length >= 3 && ratio.every(x => x > 0.8);
    out.push(report(`O2 ${v}: no dark layer -- board brightness during Overdrive (11.5 / 5 / 1 s left) vs 12.5 s left stays ${ratio.join(' / ')} (base: ${during.map(p => +(b.cps.find(q => q.at === p.at).lum / b.cps.find(q => q.at === 12.5).lum).toFixed(2)).join(' / ')}); candidate / base ${vsBase.join(' / ')}`, okDark, JSON.stringify({ cand: c.cps.map(p => p.lum), base: b.cps.map(p => p.lum) })));
    const t = during[0] || {};
    const okTag = v === 'blackout' ? t.tag === null && t.banner === 'WIELKI FINISZ!/' && c.resultTag === null && b.cps.find(p => p.od).tag === 'ZACIEMNIENIE'
      : t.tag === 'BURZA PORTALI' && t.banner === 'WIELKI FINISZ!/BURZA PORTALI' && c.resultTag === 'BURZA PORTALI' && t.portals >= 1;
    out.push(report(`O3 ${v}: the finish is announced as ${v === 'blackout' ? '"WIELKI FINISZ!" only (no ZACIEMNIENIE banner or result tag; the base said ZACIEMNIENIE)' : '"WIELKI FINISZ!" + BURZA PORTALI, as before'}`, okTag, JSON.stringify({ tag: t.tag, banner: t.banner, resultTag: c.resultTag, baseTag: (b.cps.find(p => p.od) || {}).tag })));
    out.push(report(`O ${v}: no runtime errors (base and candidate)`, !b.errors.length && !c.errors.length, b.errors.concat(c.errors).slice(0, 2).join(' | ')));
  }
  // O4 bonus objects: portal_rain spawns exactly 10 x value 15, as CONFIG says
  {
    const g = await veteranPage(candUrl, { viewport: { width: 390, height: 844 } });
    const r = await g.page.evaluate(() => {
      const g = window.game; g.startRound({ seed: 4242 }); cancelAnimationFrame(g.rafId);
      const before = g.objects.length; g.spawnPortalRain(); const added = g.objects.slice(before);
      return { cfg: CONFIG.overdrive, n: added.length, values: [...new Set(added.map(o => o.value))], tiers: [...new Set(added.map(o => o.tier))] };
    });
    out.push(report('O4 CONFIG.overdrive unchanged (12 s, [blackout, portal_rain], 10 objects x 15) and Burza portali spawns exactly that', r.cfg.triggerSecondsRemaining === 12 && r.cfg.variants.join() === 'blackout,portal_rain' && r.cfg.bonusObjectCount === 10 && r.cfg.bonusObjectValue === 15 && r.n === 10 && r.values.join() === '15' && r.tiers.join() === 'portal', JSON.stringify(r)));
    // O5 Campaign darkness stays: a dark mission still darkens outside the light
    const d = await g.page.evaluate(() => {
      const g = window.game; g.checkEvolutionTriggers = () => {};
      g.startCampaignMission('M15'); g.beginMissionPlay && g.beginMissionPlay(); cancelAnimationFrame(g.rafId);
      let calls = 0; const f = g.drawDarkness.bind(g); g.drawDarkness = (...a) => { calls++; return f(...a); };
      g.renderCampaign(performance.now() / 1000); delete g.drawDarkness;
      const c = g.ctx.getImageData(Math.round(g.canvas.width * 0.05), Math.round(g.canvas.height * 0.4), 4, 4).data;
      return { dark: !!g.mission.def.setup.dark, calls, corner: Math.round((c[0] + c[1] + c[2]) / 3), src: g.drawDarkness.toString().length };
    });
    out.push(report('O5 Campaign: a dark mission (setup.dark, M15) still draws its darkness (drawDarkness() runs, the far board is near black)', d.dark && d.calls === 1 && d.corner < 40, JSON.stringify(d)));
    await g.browser.close();
  }
  // O6 static: drawDarkness() is the base's, byte for byte
  {
    const fn = (src) => { const i = src.indexOf('  drawDarkness('); if (i < 0) return null; const j = src.indexOf('\n  }\n', i); return src.slice(i, j); };
    const b = fn(String(revisionFile(UX3_BASE_REV, 'game.js'))), c = fn(fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8'));
    out.push(report('O6 drawDarkness() (Campaign) is identical to the base', !!b && b === c, `${(c || '').length} chars`));
  }
  return out;
}

/* ===================================================================== V */
async function vortexChecks(baseUrl, candUrl) {
  const out = [];
  const baseSrc = String(revisionFile(UX3_BASE_REV, 'game.js')), candSrc = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
  // V1 static: look data, drawBody, stampHoleLayer and paintHoleLayer are the base's
  {
    const between = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i + a.length); return i < 0 || j < 0 ? null : s.slice(i, j); };
    const parts = {
      HOLE_LOOKS: ['const HOLE_LOOKS = {', '\nfunction paintHoleLayer('],
      paintHoleLayer: ['function paintHoleLayer(', '\nfunction holeSprite('],
      stampHoleLayer: ['function stampHoleLayer(', '\n/** Cheap stable'],
      // UX-FIX-A: the vortex part of drawBody() (its look layers); the name tag after it
      // gained the threat mark, the Smuga before it is not a look layer.
      drawBody: ["    // GG-HOLE-01: the look's layers (HOLE_LOOKS)", '    if (!this.name) return;'],
      accretion: ['function drawAccretionDisk(', '\n}\n']
    };
    const diff = Object.entries(parts).filter(([, [a, b]]) => { const x = between(baseSrc, a, b), y = between(candSrc, a, b); return !x || x !== y; }).map(([k]) => k);
    const spins = (s) => (between(s, 'const HOLE_LOOKS = {', '\nfunction paintHoleLayer(') || '').match(/spin: \[[^\]]*\]/g) || [];
    const sb = spins(baseSrc), sc = spins(candSrc);
    // the only change in holeSprite(): the mirror before painting
    const hs = (s) => between(s, 'function holeSprite(', '\n/** Stamps a layer');
    const hsDiff = hs(candSrc).split('\n').filter(l => !hs(baseSrc).split('\n').includes(l)).filter(l => !/^\s*\/\//.test(l)).map(l => l.trim());
    const calls = { paint: (candSrc.match(/paintHoleLayer\(/g) || []).length, sprite: (candSrc.match(/holeSprite\(/g) || []).length };
    out.push(report('V1 static: HOLE_LOOKS (every spin, color, radius, flow), paintHoleLayer(), stampHoleLayer(), Hole.drawBody() and the accretion disk are byte-identical to the base; the 10 looks keep their spin arrays', diff.length === 0 && sb.length === 10 && JSON.stringify(sb) === JSON.stringify(sc), JSON.stringify({ differs: diff, spins: sc })));
    out.push(report('V1 static: holeSprite() differs from the base only by `c.scale(-1, 1)` (the mirror, before painting, inside the cached sprite); paintHoleLayer is called only there and holeSprite only by stampHoleLayer -- no unmirrored path (Warsztat, rivals, swallowed rivals use the same stamps)',
      JSON.stringify(hsDiff) === JSON.stringify(['c.scale(-1, 1);']) && calls.paint === 2 && calls.sprite === 2, JSON.stringify({ hsDiff, calls })));
  }
  // V2 pixels: every layer of every look = the base's mirror image; handedness
  const bDir = snapshot('base-x', baseFiles(), true), cDir = snapshot('cand-x', candFiles(), true);
  const bs = await serve({ root: bDir }), cs = await serve({ root: cDir });
  const LAYERS = ['under', 'inner', 'flow', 'rim', 'crown', 'ring'];
  const grab = async (u) => {
    const g = await openGame(u, { viewport: { width: 390, height: 844 } });
    const r = await g.page.evaluate(async (LAYERS) => {
      const ns = await import(document.querySelector('script[type="module"][src]').src);
      const looks = Object.keys(ns.HOLE_LOOKS), out = {};
      for (const style of looks) for (const layer of LAYERS) {
        if ((layer === 'crown' || layer === 'ring') && !ns.HOLE_LOOKS[style].crown) continue;
        const col = style === 'horizon' ? '#50F0FA' : style === 'prism' ? '' : '#9875FF';
        const s = ns.holeSprite(style, layer, col, 90);
        out[style + '|' + layer] = { url: s.canvas.toDataURL(), w: s.canvas.width, half: s.half, r: s.r };
      }
      return { looks, spins: Object.fromEntries(looks.map(k => [k, ns.HOLE_LOOKS[k].spin])), out };
    }, LAYERS);
    const errors = g.errors.slice();
    return { g, r, errors };
  };
  const B = await grab(bs.url), C = await grab(cs.url);
  await B.g.browser.close();
  const cmp = await C.g.page.evaluate(async ({ base, cand }) => {
    const load = (u) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = u; });
    const px = (img, flip) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); if (flip) { x.translate(c.width, 0); x.scale(-1, 1); } x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
    const diff = (a, b) => { let s = 0, n = 0; for (let i = 0; i < a.length; i += 4) { const w = Math.max(a[i + 3], b[i + 3]); if (w < 8) continue; s += (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) + Math.abs(a[i + 3] - b[i + 3])) / 4; n++; } return n ? s / n : 0; };
    // handedness: angular offset of the brightness pattern between two radii
    // (> 0: the pattern's angle grows outward). Polar sampling, best circular
    // cross-correlation shift in (-pi/2, pi/2).
    const pitch = (d, w, R, r1, r2) => {
      const N = 360, prof = (rr) => { const p = new Float64Array(N); for (let k = 0; k < N; k++) { const a = k / N * Math.PI * 2, x = Math.round(w / 2 + Math.cos(a) * rr), y = Math.round(w / 2 + Math.sin(a) * rr), i = (y * w + x) * 4; p[k] = (d[i] + d[i + 1] + d[i + 2]) * d[i + 3] / 255; } let m = 0; p.forEach(v => m += v); m /= N; return p.map(v => v - m); };
      const a = prof(R * r1), b = prof(R * r2); let best = 0, bv = -Infinity, e = 0, f = 0; a.forEach(v => e += v * v); b.forEach(v => f += v * v);
      for (let s = -45; s <= 45; s++) { let v = 0; for (let k = 0; k < N; k++) v += a[k] * b[(k + s + N) % N]; if (v > bv) { bv = v; best = s; } }
      return { shift: best, strength: e > 1 && f > 1 ? +(bv / Math.sqrt(e * f)).toFixed(2) : 0 };
    };
    const res = {};
    for (const key of Object.keys(cand)) {
      const bi = await load(base[key].url), ci = await load(cand[key].url);
      const b = px(bi, false), bf = px(bi, true), c = px(ci, false);
      const w = ci.width, R = cand[key].r * w / 2 / cand[key].half;
      // arms between 0.62 and 0.74 R (the disk, `under`) / 0.36 and 0.46 R (the heart, `inner`)
      const [r1, r2] = /\|inner$/.test(key) ? [0.36, 0.46] : [0.62, 0.74];
      res[key] = { size: [bi.width, ci.width], mirror: +diff(bf, c).toFixed(2), same: +diff(b, c).toFixed(2), pb: pitch(b, w, R, r1, r2), pc: pitch(c, w, R, r1, r2) };
    }
    return res;
  }, { base: B.r.out, cand: C.r.out });
  const keys = Object.keys(cmp);
  // (anti-aliasing and baked glows round a little differently once flipped:
  // <= 2.5 of 255 on average, and always far closer than the unflipped base
  // for a layer that is not mirror-symmetric)
  const notMirror = keys.filter(k => cmp[k].size[0] !== cmp[k].size[1] || cmp[k].mirror > 2.5 || (cmp[k].same > 4 && cmp[k].mirror > cmp[k].same / 2));
  const changed = keys.filter(k => cmp[k].same > cmp[k].mirror + 2);
  out.push(report(`V2 pixels: all ${keys.length} cached layers of the ${C.r.looks.length} looks (under / inner / flow / rim / crown / ring) are the base's exact mirror image (mean |diff| <= 2.5 of 255 vs the flipped base, vs up to ${Math.max(...keys.map(k => cmp[k].same)).toFixed(0)} unflipped), the same canvas size (no extra memory); ${changed.length} of them differ visibly from the unflipped base (the rest are mirror-symmetric rings)`,
    notMirror.length === 0 && keys.length >= 50 && changed.length >= 20 && JSON.stringify(B.r.spins) === JSON.stringify(C.r.spins), JSON.stringify(notMirror.length ? notMirror.map(k => [k, cmp[k]]).slice(0, 6) : { spins: C.r.spins })));
  // handedness of the arm layers (under / inner): the sign flips
  const arms = keys.filter(k => /\|(under|inner)$/.test(k));
  const hand = arms.map(k => { const [style, layer] = k.split('|'); const sp = C.r.spins[style][layer === 'under' ? 0 : 1]; return { k, spin: sp, base: cmp[k].pb.shift, cand: cmp[k].pc.shift, str: cmp[k].pc.strength }; });
  // (a layer whose pattern hardly winds -- a ring, a curtain -- gives a
  // shift near 0 or an aliased one: listed, not counted; V2 already proves
  // every layer is the exact mirror)
  const strong = hand.filter(h => Math.abs(h.base) >= 5 && h.str >= 0.3);
  const flipped = strong.filter(h => Math.abs(h.base + h.cand) <= 2);
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, 'handedness.json'), JSON.stringify({ note: 'shift = angle (deg) of the arm pattern at 0.74 R minus at 0.62 R (under) / 0.46 R minus 0.36 R (inner) inside the cached sprite (screen y down: + = clockwise outward); spin = rad/s of that layer (+ = clockwise); "leading" arms: outer end ahead in the turn (shift*spin > 0); "trailing": outer end behind (a drain / galaxy)', hand }, null, 2));
  out.push(report(`V3 arm handedness (under + inner layers): for each layer with a measurable spiral (${strong.length} of ${hand.length}) the winding flips (shift after = -shift before, +-2 deg) in ${flipped.length} -- before: ${strong.filter(h => h.base * h.spin > 0).length} leading / ${strong.filter(h => h.base * h.spin < 0).length} trailing, after: ${strong.filter(h => h.cand * h.spin > 0).length} leading / ${strong.filter(h => h.cand * h.spin < 0).length} trailing (qa/out/ux3/handedness.json)`,
    strong.length >= 15 && flipped.length >= Math.ceil(strong.length * 0.85), 'not flipped by the measure (aliasing): ' + JSON.stringify(strong.filter(h => !flipped.includes(h)).slice(0, 6))));
  out.push(report('V2/V3 no runtime errors', !B.errors.length && !C.errors.length, B.errors.concat(C.errors).slice(0, 2).join(' | ')));
  await C.g.browser.close();
  bs.server.close(); cs.server.close();

  // V4 the turning itself: every rotate() Hole.drawBody() makes (the stamps'
  // look.spin angles, the live strokes, the accretion disk) for 10 skins as
  // you and as a rival at t and t + 1/30 s -- recorded on the base and the
  // candidate. Identical lists = the same direction and speed of every
  // turning layer; the picture each one turns is the mirrored sprite (V2).
  const turn = async (u) => {
    const g = await veteranPage(u, { viewport: { width: 390, height: 844 } });
    const r = await g.page.evaluate(() => {
      const g = window.game; g.startRound({ seed: 4242 }); cancelAnimationFrame(g.rafId);
      const Hole = g.player.constructor, cv = document.createElement('canvas'); cv.width = cv.height = 400;
      const ctx = cv.getContext('2d'), rot = ctx.rotate.bind(ctx), di = ctx.drawImage.bind(ctx);
      let log = [];
      ctx.rotate = (a) => { log.push(+a.toFixed(9)); rot(a); };
      ctx.drawImage = (img, ...rest) => { log.push('img' + img.width); di(img, ...rest); };
      const res = [];
      for (const sk of SKINS) for (const isPlayer of [true, false]) {
        const h = new Hole('', 0, 0, isPlayer); h.radius = 120; h.skin = sk.id;
        const frames = [10, 10 + 1 / 30].map(t => { log = []; ctx.setTransform(1, 0, 0, 1, 200, 200); h.drawBody(ctx, t); return log; });
        // the first stamp is the `under` layer: its turn per frame, in degrees
        const r0 = frames[0].find(x => typeof x === 'number'), r1 = frames[1].find(x => typeof x === 'number');
        res.push({ skin: sk.id, isPlayer, look: h.lookOf().style, calls: frames.map(f => f.length), underDegPerFrame: +((r1 - r0) * 180 / Math.PI).toFixed(3), log: JSON.stringify(frames) });
      }
      return res;
    });
    await g.browser.close();
    return r;
  };
  const tb = await turn(baseUrl), tc = await turn(candUrl);
  const mism = tc.filter((x, i) => x.log !== tb[i].log || x.look !== tb[i].look);
  const looks = [...new Set(tc.map(x => x.look))];
  out.push(report(`V4 turning: every rotate() of Hole.drawBody() (stamps, live strokes, accretion disk) for ${tc.length} holes (10 skins as you and as a rival, ${looks.length} looks, two frames 1/30 s apart) is identical to the base -- the same directions and speeds (the 'under' layer turns ${tc.filter(x => x.isPlayer).map(x => x.look + ' ' + (x.underDegPerFrame > 0 ? '+' : '') + x.underDegPerFrame).join(', ')} deg/frame, + = clockwise)`,
    mism.length === 0 && tc.length === 20 && looks.length === 10 && tc.every(x => x.calls[0] > 3), JSON.stringify(mism.slice(0, 2).map(x => ({ skin: x.skin, isPlayer: x.isPlayer, cand: x.log.slice(0, 200), base: tb[tc.indexOf(x)].log.slice(0, 200) })))));
  return out;
}

export async function runUx3Checks(url) {
  const results = [];
  fs.mkdirSync(DIR, { recursive: true });
  let base = null;
  if (want('O') || want('V')) {
    try { base = await serve({ root: snapshot('base', baseFiles(), false) }); } catch (e) { results.push(report('UX3 base revision readable (git show / VH_QA_REVS)', false, String(e.message || e).slice(0, 160))); }
  }
  if (want('C')) results.push(...await controlsChecks(url));
  if (want('M')) results.push(...await minimapChecks(url));
  if (base && want('O')) results.push(...await overdriveChecks(base.url, url));
  if (base && want('V')) results.push(...await vortexChecks(base.url, url));
  if (base) base.server.close();
  return results;
}

if (isMain(import.meta.url)) {
  const { server, url } = await serve();
  const res = await runUx3Checks(url);
  server.close();
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} GG-UX-03 checks passed`);
  fs.writeFileSync(path.join(DIR, 'summary.json'), JSON.stringify(res, null, 2));
  process.exit(failed.length ? 1 : 0);
}

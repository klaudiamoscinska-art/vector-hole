// GG-UX-03 evidence gallery: real frames from the game's own renderer (the
// base = main before GG-UX-03, and the candidate = this checkout), written to
// design/ux3/. Nothing here is drawn by hand or generated: every picture is
// a Playwright screenshot or a canvas the game itself painted.
// Usage: node design/ux3/tools/ux3-shots.mjs   (then gallery.html / gallery-artifact.html)
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, veteranSave, revisionFile, ARENA_BOT, QA_RANDOM, QA_TICK, frozenDateScript, ROOT } from '../../../qa/lib.mjs';
import { UX3_BASE_REV } from '../../../qa/ux3.mjs';

const OUTD = path.join(ROOT, 'design', 'ux3');
const SHOTS = path.join(OUTD, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const tmp = path.join(ROOT, 'qa', 'out', 'ux3', 'shots-base');
fs.mkdirSync(tmp, { recursive: true });
for (const f of ['index.html', 'style.css', 'game.js']) fs.writeFileSync(path.join(tmp, f), revisionFile(UX3_BASE_REV, f));
const cand = await serve();
const base = await serve({ root: tmp });
const manifest = [];
const add = (file, title, group, note = '') => manifest.push({ file, title, group, note });

async function page(url, vp, settings = {}, opts = {}) {
  const desk = vp.width >= 1000;
  const g = await openGame(url, { viewport: vp, mobile: !desk && !opts.noTouch, deviceScaleFactor: opts.dsf || 2, initScript: opts.initScript, locale: opts.locale || 'pl-PL' });
  const s = await veteranSave(g.page, { missions: 60, runsPlayed: 12, coins: 9000 });
  s.settings = { ...s.settings, music: false, sfx: false, ...settings };
  if (opts.save) opts.save(s);
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), s);
  await g.page.reload();
  await g.page.waitForFunction(() => window.__qaBridge && window.__qaBridge.ready && window.game && window.game.state);
  await g.page.addScriptTag({ content: QA_TICK + QA_RANDOM + ARENA_BOT });
  return g;
}
const shot = async (g, name, clip) => { await g.page.screenshot({ path: path.join(SHOTS, name), type: 'jpeg', quality: 82, clip }); return name; };
const arenaAt = (g, frames = 240) => g.page.evaluate((frames) => {
  const gm = window.game; gm.checkEvolutionTriggers = () => {};
  gm.startRound({ seed: 777 }); cancelAnimationFrame(gm.rafId); gm.running = false;
  window.__qaTick(frames, 5); gm.running = true; gm.banner = null; gm.bannerQueue = []; gm.render(window.__vnow / 1000);
}, frames);

/* 1-3: the joystick at the middle, top and bottom of the board */
{
  const g = await page(cand.url, { width: 390, height: 844 }, { inputMode: 'thumbpad' });
  await arenaAt(g);
  for (const [name, fx, fy, dx, dy] of [['middle', 0.5, 0.5, 34, -22], ['top', 0.66, 0.2, -30, 26], ['bottom', 0.7, 0.84, 36, 8]]) {
    await g.page.evaluate(([fx, fy, dx, dy]) => {
      const gm = window.game, c = gm.canvas, x = fx * gm.width, y = fy * gm.height;
      const T = (type, px, py, list = true) => c.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: list ? [new Touch({ identifier: 1, target: c, clientX: px, clientY: py })] : [], changedTouches: [new Touch({ identifier: 1, target: c, clientX: px, clientY: py })] }));
      gm.releaseThumbpad(); T('touchstart', x, y); T('touchmove', x + dx, y + dy);
      for (let i = 0; i < 12; i++) gm.update(1 / 30);
      gm.render(performance.now() / 1000);
      window.__ux3dot = { x, y };
    }, [fx, fy, dx, dy]);
    await g.page.waitForTimeout(150);
    // the finger itself, drawn on top of the screenshot only (a white ring)
    await g.page.evaluate(() => { let d = document.getElementById('__finger'); if (!d) { d = document.createElement('div'); d.id = '__finger'; document.body.appendChild(d); } const p = window.__ux3dot, k = window.game.moveVector; d.style.cssText = `position:fixed;z-index:9999;pointer-events:none;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid rgba(255,255,255,0.85);box-shadow:0 0 8px #000;left:${p.x + k.x * 40}px;top:${p.y + k.y * 40}px`; });
    add(await shot(g, `joystick-${name}.jpg`), `Joystick — ${name === 'middle' ? 'środek' : name === 'top' ? 'góra' : 'dół'} planszy`, 'Sterowanie', 'Podstawa pojawia się pod palcem; biały okrąg = miejsce palca (dorysowany tylko na zrzucie).');
    await g.page.evaluate(() => { document.getElementById('__finger').remove(); window.game.releaseThumbpad(); });
  }
  // 4: the Sterowanie panel PL
  await g.page.evaluate(() => { const gm = window.game; gm.pauseGame(); document.getElementById('controlsPanel').classList.remove('hidden'); gm.save.settings.inputMode = 'legacy'; gm.syncControlsPanel(); });
  await g.page.waitForTimeout(250);
  add(await shot(g, 'controls-pl.jpg'), 'Pauza → Sterowanie: PRZECIĄGANIE | JOYSTICK (nowy profil)', 'Sterowanie');
  await g.browser.close();
  const gb = await page(base.url, { width: 390, height: 844 }, { inputMode: 'legacy' });
  await arenaAt(gb);
  await gb.page.evaluate(() => { const gm = window.game; gm.pauseGame(); document.getElementById('controlsPanel').classList.remove('hidden'); gm.syncControlsPanel(); });
  await gb.page.waitForTimeout(250);
  add(await shot(gb, 'controls-before.jpg'), 'PRZED: Kciuk (pad) | Przeciąganie', 'Sterowanie');
  await gb.browser.close();
  const ge = await page(cand.url, { width: 390, height: 844 }, { lang: 'en' }, { locale: 'en-US' });
  await arenaAt(ge);
  await ge.page.evaluate(() => { const gm = window.game; gm.pauseGame(); document.getElementById('controlsPanel').classList.remove('hidden'); gm.syncControlsPanel(); });
  await ge.page.waitForTimeout(250);
  add(await shot(ge, 'controls-en.jpg'), 'Controls (EN): DRAG TO MOVE | JOYSTICK', 'Sterowanie');
  await ge.browser.close();
}

/* 5-7: minimap left / right, settings PL / EN */
for (const [side, vp, tag] of [['left', { width: 390, height: 844 }, 'iphone'], ['right', { width: 390, height: 844 }, 'iphone'], ['left', { width: 320, height: 568 }, '320'], ['left', { width: 844, height: 390 }, 'landscape']]) {
  const g = await page(cand.url, vp, { minimapSide: side });
  await arenaAt(g);
  add(await shot(g, `minimap-${side}-${tag}.jpg`), `Minimapa ${side === 'left' ? 'LEWA (domyślna)' : 'PRAWA (z Ustawień)'} — ${vp.width}×${vp.height}`, 'Minimapa');
  await g.browser.close();
}
{
  const gb = await page(base.url, { width: 390, height: 844 });
  await arenaAt(gb);
  add(await shot(gb, 'minimap-before.jpg'), 'PRZED: minimapa po prawej (390×844)', 'Minimapa');
  await gb.browser.close();
}
for (const lang of ['pl', 'en']) {
  const g = await page(cand.url, { width: 390, height: 844 }, { lang }, { locale: lang === 'en' ? 'en-US' : 'pl-PL' });
  await g.page.evaluate(() => { window.game.showScreen('profileScreen'); window.game.syncControlsPanel(); document.getElementById('minimapSideRow').scrollIntoView({ block: 'center' }); });
  await g.page.waitForTimeout(400);
  add(await shot(g, `settings-${lang}.jpg`), lang === 'pl' ? 'Profil → Ustawienia: POŁOŻENIE MINIMAPY (PL)' : 'Profile → Settings: MINIMAP POSITION (EN)', 'Minimapa');
  await g.browser.close();
}

/* 8: the last 12 s of a "blackout" round, base vs candidate (same seeded round) */
for (const [url, who] of [[base.url, 'before'], [cand.url, 'after']]) {
  const g = await page(url, { width: 390, height: 844 }, {}, { initScript: frozenDateScript('2026-11-14T10:00:00.000Z') });
  const at = [11, 6];
  await g.page.evaluate((at) => {
    window.__qaSeedRandom(303);
    window.__shots = [];
    window.__qaPlayArena({ round: { seed: 303 }, style: 'casual', clock0: 1e6, onFrame(f, gm) {
      if (at.length && gm.timeRemaining <= at[0]) { at.shift(); throw { stopAt: true }; }
    } });
  }, at.slice()).catch(() => {});
  for (const sec of at) {
    await g.page.evaluate((sec) => {
      const gm = window.game;
      const realNow = window.__realNow || performance.now.bind(performance);
      let vnow = 2e6; performance.now = () => vnow;
      while (gm.timeRemaining > sec && gm.state === GameState.PLAYING) { if (gm.evolutionPending) { gm.skipEvolutionOffer(); continue; } vnow += 1000 / 30; gm.update(1 / 30); }
      gm.render(vnow / 1000);
      performance.now = realNow;
    }, sec);
    const info = await g.page.evaluate(() => ({ v: window.game.overdriveVariant, t: Math.ceil(window.game.timeRemaining) }));
    add(await shot(g, `finish-${sec}s-${who}.jpg`), `${who === 'before' ? 'PRZED' : 'PO'}: ${info.t} s do końca — wariant „${info.v}”`, 'Koniec rundy', who === 'before' ? 'Czarna warstwa rgba(0,0,0,0.55) nad planszą.' : 'Ta sama runda (seed 303), bez ciemnej warstwy.');
  }
  await g.browser.close();
}

/* 9-10: every vortex before / after, plus rotation flipbooks */
const vortex = async (url) => {
  const g = await page(url, { width: 390, height: 844 });
  const r = await g.page.evaluate(() => {
    const gm = window.game; gm.startRound({ seed: 4242 }); cancelAnimationFrame(gm.rafId); gm.running = false;
    const Hole = gm.player.constructor, S = 220, FR = 12;
    const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
    const out = {};
    for (const sk of SKINS) for (const isPlayer of [true, false]) {
      const h = new Hole('', 0, 0, isPlayer); h.radius = 72; h.skin = sk.id;
      // a still at t = 10 s, and a strip of FR frames 1/15 s apart (0.8 s)
      cv.width = S * FR; cv.height = S;
      ctx.fillStyle = '#0b1a2a'; ctx.fillRect(0, 0, cv.width, cv.height);
      for (let f = 0; f < FR; f++) { ctx.save(); ctx.beginPath(); ctx.rect(f * S, 0, S, S); ctx.clip(); ctx.translate(f * S + S / 2, S / 2); h.drawBody(ctx, 10 + f / 15); ctx.restore(); }
      out[sk.id + (isPlayer ? '' : '-rival')] = { name: sk.name, strip: cv.toDataURL('image/webp', 0.86) };
    }
    return out;
  });
  await g.browser.close();
  return r;
};
const vb = await vortex(base.url), vc = await vortex(cand.url);
const vortices = [];
for (const k of Object.keys(vc)) {
  for (const [who, src] of [['before', vb[k]], ['after', vc[k]]]) fs.writeFileSync(path.join(SHOTS, `vortex-${k}-${who}.webp`), Buffer.from(src.strip.split(',')[1], 'base64'));
  vortices.push({ key: k, name: vc[k].name + (k.endsWith('-rival') ? ' (rywal)' : ''), before: `vortex-${k}-before.webp`, after: `vortex-${k}-after.webp` });
}

/* 11-14: Arena and Campaign on a phone, CrazyGames 800x450, Warsztat */
{
  const g = await page(cand.url, { width: 390, height: 844 });
  await arenaAt(g, 900);
  add(await shot(g, 'arena-phone.jpg'), 'Arena — telefon 390×844 (wiry odbite, minimapa po lewej)', 'Rozgrywka');
  await g.page.evaluate(() => { const gm = window.game; gm.running = false; gm.checkEvolutionTriggers = () => {}; gm.startCampaignMission('M05'); gm.beginMissionPlay && gm.beginMissionPlay(); cancelAnimationFrame(gm.rafId); for (let i = 0; i < 90; i++) gm.update(1 / 30); gm.renderCampaign(performance.now() / 1000); });
  await g.page.waitForTimeout(200);
  add(await shot(g, 'campaign-phone.jpg'), 'Kampania (M05) — telefon 390×844', 'Rozgrywka');
  await g.page.evaluate(() => { const gm = window.game; gm.running = false; gm.openWarsztatScreen(); });
  await g.page.waitForTimeout(600);
  add(await shot(g, 'warsztat-phone.jpg'), 'Warsztat — podgląd wiru = ten sam rysunek co w grze', 'Rozgrywka');
  await g.browser.close();
}
{
  const g = await page(cand.url, { width: 800, height: 450 }, {}, { dsf: 1, noTouch: true });
  await arenaAt(g, 600);
  add(await shot(g, 'crazygames-800x450.jpg'), 'CrazyGames 800×450 — Arena', 'Rozgrywka');
  await g.browser.close();
}
const gb2 = await page(base.url, { width: 390, height: 844 });
await gb2.page.evaluate(() => { const gm = window.game; gm.openWarsztatScreen(); });
await gb2.page.waitForTimeout(600);
add(await shot(gb2, 'warsztat-before.jpg'), 'PRZED: Warsztat (wir nieodbity)', 'Rozgrywka');
await gb2.browser.close();

fs.writeFileSync(path.join(OUTD, 'manifest.json'), JSON.stringify({ base: UX3_BASE_REV, shots: manifest, vortices }, null, 2));
cand.server.close(); base.server.close();
console.log(`${manifest.length} screens + ${vortices.length} vortex pairs -> design/ux3/shots`);

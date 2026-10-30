// GAME-READY-1: the pre-release fixes stay fixed.
//  - The Daily's date is written in the game's language on every day of the
//    year (English showed Polish month names: „27 PAŹDZIERNIKA”).
//  - English on the FTUE-2 screens: the same fit audit as qa/responsive.mjs
//    (nothing cut off, covered or out of reach, the main action in view) on
//    a phone, a small phone (360×640), a phone on its side and a Poki frame, plus
//    no text clipped in English that isn't clipped in Polish too.
//  - The public page head (title, description, Open Graph, JSON-LD, the
//    viewport) states only what the game has: 240 missions in 12 districts,
//    a web game (no native apps), Polish and English.
// Screenshots -> qa/out/gameready1/<lang>/<WxH>/<scene>.png
// Usage: node qa/gameready1.mjs [--only=date,screens,head]
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, veteranSave, report, isMain, ROOT, OUT } from './lib.mjs';
import { SCENES, judge, auditScene } from './responsive.mjs';

const READY = () => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state;

async function veteran(page) {
  const s = await veteranSave(page, { missions: 30, coins: 900, runsPlayed: 6 });
  await page.evaluate((v) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(v)), s);
  await page.reload();
  await page.waitForFunction(READY);
}

/* ---------- 1. the Daily's date, PL and EN, any day ---------- */
// [UTC instant, Polish label, English label]; the label follows the UTC day
// like the Daily's seed (dailySeedForDate), so 23:59:59Z is still that day.
const DATES = [
  ['2026-01-01T00:00:00Z', '1 STYCZNIA', 'JANUARY 1'],
  ['2026-02-28T12:00:00Z', '28 LUTEGO', 'FEBRUARY 28'],
  ['2028-02-29T08:00:00Z', '29 LUTEGO', 'FEBRUARY 29'],
  ['2026-03-31T23:59:59Z', '31 MARCA', 'MARCH 31'],
  ['2026-04-09T10:00:00Z', '9 KWIETNIA', 'APRIL 9'],
  ['2026-05-15T10:00:00Z', '15 MAJA', 'MAY 15'],
  ['2026-06-30T10:00:00Z', '30 CZERWCA', 'JUNE 30'],
  ['2026-07-04T10:00:00Z', '4 LIPCA', 'JULY 4'],
  ['2026-08-21T10:00:00Z', '21 SIERPNIA', 'AUGUST 21'],
  ['2026-09-11T10:00:00Z', '11 WRZEŚNIA', 'SEPTEMBER 11'],
  ['2026-10-27T10:00:00Z', '27 PAŹDZIERNIKA', 'OCTOBER 27'],
  ['2026-11-30T10:00:00Z', '30 LISTOPADA', 'NOVEMBER 30'],
  ['2026-12-31T23:59:59Z', '31 GRUDNIA', 'DECEMBER 31']
];

async function dateChecks(url) {
  const out = [];
  for (const [locale, lang, col] of [['pl-PL', 'pl', 1], ['en-US', 'en', 2]]) {
    const g = await openGame(url, { locale });
    await veteran(g.page);
    const r = await g.page.evaluate(async (dates) => {
      const Real = Date, rows = [];
      try {
        for (const [iso] of dates) {
          const fix = Real.parse(iso);
          window.Date = class extends Real { constructor(...a) { if (a.length) super(...a); else super(fix); } static now() { return fix; } };
          window.game.openChallengesScreen();
          await new Promise(res => setTimeout(res, 30)); // the translation observer runs as a microtask
          rows.push(document.getElementById('dailyDateLabel').textContent);
        }
      } finally { window.Date = Real; }
      return { rows, lang: document.documentElement.lang };
    }, DATES);
    const want = DATES.map(d => d[col]);
    const bad = r.rows.map((t, i) => t === want[i] ? null : `${DATES[i][0]}: "${t}" != "${want[i]}"`).filter(Boolean);
    out.push(report(`date ${lang}: the Daily's date is in ${lang === 'en' ? 'English' : 'Polish'} for 13 days across the year (1st, 9th, 28-31st, leap day, 23:59:59 UTC)`, r.lang === lang && bad.length === 0, bad.join(' | ') || r.rows.join(' · ')));
    if (lang === 'en') out.push(report('date en: no Polish letters or month names in the English label', r.rows.every(t => !/[ĄĆĘŁŃÓŚŹŻ]|STYCZ|LUTEG|MARCA|KWIET|MAJA|CZERW|LIPCA|SIERP|WRZE|PAŹDZ|LISTOP|GRUDN/.test(t)), r.rows.join(' · ')));
    out.push(report(`date ${lang}: no runtime errors`, g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }
  return out;
}

/* ---------- 2. English on the FTUE-2 screens ---------- */
// (320×568 is left out on purpose: there the Dzielnice card's GRAJ slides
// under the bottom nav in 8 of 12 districts in Polish and in English alike --
// a size limit of the smallest phone, not a translation one; see
// docs/GAME_READY1_REPORT.md. qa/responsive.mjs keeps covering 320×568.)
const FRAMES = [[375, 667, 'phone'], [360, 640, 'phone'], [844, 390, 'phone'], [836, 470, 'desk']];
const EN_SCENES = ['welcome', 'hub', 'campaign', 'briefing', 'shop', 'challenges', 'profile', 'arena', 'pause', 'evolution', 'results', 'mission', 'missionResult', 'missionStart', 'unlock', 'login'];
const vpKind = (kind) => kind === 'desk' ? { mobile: false, deviceScaleFactor: 1 } : { mobile: true, deviceScaleFactor: 2 };
const PAGE_HELPERS = `window.frozenRoundIn = () => { const gm = window.game; gm.checkEvolutionTriggers = () => {}; gm.startRound({ seed: 777 }); cancelAnimationFrame(gm.rafId); gm.running = false; gm.render(performance.now() / 1000); };`;

/** Visible text boxes the layout cuts: an ellipsis, or a box that hides
 *  what overflows it while its text is wider / taller than it is. */
const CLIPPED = () => {
  const out = [];
  const name = (el) => el.id ? '#' + el.id : el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : '');
  const shown = (el) => { for (let a = el; a && a !== document.documentElement; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0 || (a.classList && a.classList.contains('hidden'))) return false; } const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; };
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest('svg, canvas')) continue;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.data.trim().length > 1);
    if (!own || !shown(el)) continue;
    const cs = getComputedStyle(el);
    const hidesX = /hidden|clip/.test(cs.overflowX), hidesY = /hidden|clip/.test(cs.overflowY);
    const wide = el.scrollWidth > el.clientWidth + 1, tall = el.scrollHeight > el.clientHeight + 2;
    if ((cs.textOverflow === 'ellipsis' && wide) || (hidesX && wide) || (hidesY && tall)) out.push(`${name(el)} "${el.textContent.trim().slice(0, 40)}"`);
  }
  return out;
};

async function screenChecks(url) {
  const out = [];
  const clipped = {};
  for (const [locale, lang] of [['pl-PL', 'pl'], ['en-US', 'en']]) {
    for (const [w, h, kind] of FRAMES) {
      const tag = `${w}x${h}`;
      const g = await openGame(url, { viewport: { width: w, height: h }, locale, ...vpKind(kind) });
      await g.context.addInitScript(PAGE_HELPERS);
      await g.page.addScriptTag({ content: PAGE_HELPERS });
      const dir = path.join(OUT, 'gameready1', lang, tag);
      fs.mkdirSync(dir, { recursive: true });
      const probsAll = [];
      for (const s of EN_SCENES) {
        let ok = false, probs = [];
        try {
          const a = await auditScene(g.page, s);
          await g.page.addScriptTag({ content: PAGE_HELPERS });
          [ok, probs] = judge(s, a, [w, h, kind]);
          clipped[`${lang} ${tag} ${s}`] = await g.page.evaluate(CLIPPED);
        } catch (e) { probs = ['crash: ' + String(e.message || e).split('\n')[0]]; }
        await g.page.screenshot({ path: path.join(dir, s + '.png') }).catch(() => {});
        if (lang === 'en' && !ok) probsAll.push(`${s}: ${probs.join(' ; ')}`);
      }
      if (lang === 'en') {
        out.push(report(`English ${tag}: ${EN_SCENES.length} screens fit like the Polish ones (nothing cut off, covered or out of reach, main action in view)`, probsAll.length === 0, probsAll.join(' || ')));
        const extra = EN_SCENES.map(s => { const pl = new Set((clipped[`pl ${tag} ${s}`] || []).map(x => x.split(' ')[0])); return (clipped[`en ${tag} ${s}`] || []).filter(x => !pl.has(x.split(' ')[0])).map(x => `${s}: ${x}`); }).flat();
        out.push(report(`English ${tag}: no text clipped in English that the Polish layout shows in full`, extra.length === 0, extra.slice(0, 8).join(' | ')));
        out.push(report(`English ${tag}: no runtime errors`, g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
      }
      await g.browser.close();
    }
  }
  fs.writeFileSync(path.join(OUT, 'gameready1', 'clipped.json'), JSON.stringify(clipped, null, 2));
  return out;
}

/* ---------- 3. the public page head ---------- */
function headChecks() {
  const out = [];
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const head = html.slice(0, html.indexOf('</head>'));
  const meta = (attr, key) => { const m = new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`).exec(head); return m ? m[1] : null; };
  const desc = meta('name', 'description') || '';
  let ld = null;
  try { ld = JSON.parse(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/.exec(head)[1]); } catch (e) { ld = null; }
  const texts = [desc, meta('property', 'og:description'), meta('name', 'twitter:description'), ld && ld.description, /<title>([^<]*)<\/title>/.exec(head)[1]].map(String);
  out.push(report('head: the description and the JSON-LD say 240 missions in 12 districts (not the old 60)', /240 misji/.test(desc) && /12 dzielnic/.test(desc) && ld && /240 misji/.test(ld.description) && /12 dzielnic/.test(ld.description) && !texts.some(t => /\b60 misji|\b6 dzielnic/.test(t)), JSON.stringify({ desc, ld: ld && ld.description })));
  out.push(report('head: the JSON-LD names a web game only (no native Android / iOS app exists) in Polish and English, free', !!ld && JSON.stringify(ld.gamePlatform) === '["Web browser"]' && JSON.stringify(ld.inLanguage) === '["pl","en"]' && ld.isAccessibleForFree === true && ld['@type'] === 'VideoGame', JSON.stringify(ld && { gamePlatform: ld.gamePlatform, inLanguage: ld.inLanguage, free: ld.isAccessibleForFree })));
  out.push(report('head: no claim the game does not back (app stores, a native app, multiplayer, ads or a portal SDK)', !texts.some(t => /App Store|Google Play|aplikacj|Android|iOS|multiplayer|wieloosobow|reklam|SDK|Poki|CrazyGames/i.test(t)), texts.join(' | ').slice(0, 300)));
  const vp = meta('name', 'viewport') || '';
  // Kept on purpose (GAME-READY-1, docs/GAME_READY1_REPORT.md §6): the game
  // owns every gesture (canvas touch-action:none, pinch blocked on iOS too),
  // and maximum-scale=1 stops iOS zooming in on the 15 px name field.
  out.push(report('head: the viewport is unchanged (device width, cover for the safe areas, no page zoom)', vp === 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover', vp));
  return out;
}

const PARTS = { date: dateChecks, screens: screenChecks, head: async () => headChecks() };
export async function runGameReady1Checks(url, only = null) {
  const out = [];
  for (const [k, fn] of Object.entries(PARTS)) if (!only || only.includes(k)) out.push(...await fn(url));
  return out;
}

if (isMain(import.meta.url)) {
  const o = process.argv.find(x => x.startsWith('--only='));
  const { server, url } = await serve();
  const res = await runGameReady1Checks(url, o ? o.slice(7).split(',') : null);
  server.close();
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} GAME-READY-1 checks passed`);
  process.exit(failed.length ? 1 : 0);
}

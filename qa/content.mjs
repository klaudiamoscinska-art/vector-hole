// CONTENT-1: an audit of every Campaign mission (all of DISTRICTS, 240 today)
// -- what the player is told (name, goal rows, NELA, EN copy), what the goal
// icon shows, what really lies on the board, whether progress counts the
// right object only, whether the mission can be finished, and how big the
// vortex gets on a phone.
//
//   node qa/content.mjs              static + board + progress checks and an
//                                    expert-bot playthrough of every mission
//   node qa/content.mjs --static     no playthroughs (fast)
//   node qa/content.mjs --root DIR   audit another checkout (a BEFORE run)
//
// Writes qa/out/content/audit.json and audit.md (one row per mission:
// PASS / ISSUE / NOT VERIFIED). Checks of the board and of progress run on
// the real mission build (startCampaignMission), not on the spec text, and
// a mission is PASS only if those pass AND the expert bot finished it
// (with --static every mission is NOT VERIFIED at best).
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, allDistrictsSave, report, OUT, CAMPAIGN_BOT, isMain } from './lib.mjs';

const argv = process.argv.slice(2);
const flag = (k) => argv.includes(k);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };

// Frames the scale check measures (CSS px): a phone in portrait and on its
// side, the smallest Poki frame and a CrazyGames frame.
export const SCALE_FRAMES = [
  { id: 'phone', width: 390, height: 844 },
  { id: 'phone-land', width: 775, height: 328 },
  { id: 'poki-s', width: 640, height: 360 },
  { id: 'cg', width: 800, height: 450 }
];
// The vortex may span at most this share of the short side of the frame
// (radius / short side; Arena's CONFIG.juice.zoom.holeScreenFrac is 0.24).
export const MAX_HOLE_FRAC = 0.3;

/* In-page audit of one mission: the real board, the real HUD and the
   real briefing card. */
const AUDIT = `
window.__qaContentAudit = function (id) {
  const g = window.game;
  const def = campaignMissionById(id);
  const B = CONFIG.campaign.bounds;
  const out = { id, code: missionCode(def), district: def.district, name: def.name, diff: def.diff, needTier: def.needTier,
    timeLimit: def.timeLimit, twists: def.twists.slice(), nela: [def.nela.start, def.nela.success], steps: [], issues: [], review: [] };
  const issue = (pri, cls, msg) => out.issues.push({ pri, cls, msg });
  g.missionBoosters = [];
  g.startCampaignMission(id);
  if (g.introPending) g.beginMissionPlay();
  if (g.rafId) cancelAnimationFrame(g.rafId);
  g.running = false;
  const m = g.mission;
  const ents = g.campaignEntities.filter(e => e.type !== 'gate');
  const steps = def.goal.steps;
  // What each step is about on the board: the entities it counts.
  const matches = (st, e) => {
    if (st.eat) return e.type === st.eat && (!st.glyph || e.glyph === st.glyph);
    if (st.activate) return e.type === st.activate;
    if (st.landmark) return e.type === 'landmark';
    return false;
  };
  steps.forEach((st, i) => {
    const icon = g.objectiveIconDef(st, def.setup);
    const kind = st.eat ? 'eat' : st.activate ? 'activate' : st.landmark ? 'landmark' : st.tier ? 'tier' : st.combo ? 'combo' : st.rival ? 'rival' : st.score ? 'score' : '?';
    const on = ents.filter(e => matches(st, e));
    const arts = [...new Set(on.map(e => e.artKind()))].sort();
    const n = st.n || (st.landmark ? 1 : 0);
    const row = { i, kind, type: st.eat || st.activate || null, glyph: st.glyph || null, n, label: st.label, icon: icon.icon, color: icon.color,
      onBoard: on.length, arts, objectKey: null };
    // A step that names no object and whose type is laid in random looks
    // (props, T4-T6) is about the whole class; otherwise about one look.
    const randomClass = !st.glyph && st.eat && ['prop', 'structure', 'heavy', 'tower'].includes(st.eat) && !def.setup[st.eat + 'Glyph'];
    row.objectKey = st.eat === 'runner' ? 'runner' : (kind === 'eat' || kind === 'activate') ? (randomClass ? 'class:' + st.eat : arts.join('|')) : kind;
    out.steps.push(row);
    if (!st.label) issue('P1', 'tekst', 'krok ' + (i + 1) + ': brak opisu celu');
    if (/[a-z]+_[a-z]+/.test(st.label)) issue('P1', 'tekst', 'krok ' + (i + 1) + ': surowy identyfikator w opisie: ' + st.label);
    if (!icon.icon || !/<(path|rect|circle)/.test(icon.icon)) issue('P1', 'ikona', 'krok ' + (i + 1) + ': brak ikony');
    if (kind === 'eat' || kind === 'activate' || kind === 'landmark') {
      if (on.length < n) issue('P1', 'obiekty', 'krok ' + (i + 1) + ' (' + st.label + '): na planszy ' + on.length + ' z ' + n + ' wymaganych');
      if (st.glyph && arts.length !== 1) issue('P1', 'obiekty', 'krok ' + (i + 1) + ': obiekt „' + st.glyph + '” rysowany jako ' + arts.join('/'));
    }
  });
  // Objects off the playable box / goal objects hidden under a bigger one.
  for (const e of ents) {
    if (e.x < B.minX || e.x > B.maxX || e.y < B.minY || e.y > B.maxY) issue('P1', 'obiekty', e.type + '/' + (e.glyph || '-') + ' poza obszarem gry (' + Math.round(e.x) + ',' + Math.round(e.y) + ')');
  }
  const goalEnts = ents.filter(e => steps.some(st => matches(st, e)));
  let hidden = 0;
  const under = [];
  for (const e of goalEnts) {
    const o = ents.find(o => o !== e && o.radius > e.radius && Math.hypot(o.x - e.x, o.y - e.y) < o.radius * 0.8);
    if (o) { hidden++; under.push(e.type + '/' + (e.glyph || '-') + ' pod ' + o.type + '/' + (o.glyph || o.landmarkId || '-')); }
  }
  if (hidden) issue('P2', 'obiekty', hidden + ' obiekt(y) celu pod większym obiektem: ' + under.join(', '));
  // Growth: the board must hold enough food for the highest tier needed.
  const units = ents.filter(e => e.type !== 'landmark').reduce((s, e) => s + ((e.stats && e.stats.growth) || 0), 0);
  const needUnits = CONFIG.growth.unitAnchors[(def.needTier || 1) - 1];
  out.board = { entities: ents.length, units, needUnits, hidden,
    byKind: ents.reduce((acc, e) => { const k = e.type + ':' + e.artKind(); acc[k] = (acc[k] || 0) + 1; return acc; }, {}) };
  if (units < needUnits) issue('P1', 'wykonalność', 'na planszy ' + units + ' jedn. wzrostu, a cel wymaga T' + def.needTier + ' (' + needUnits + ')');
  // The same rows in the briefing card and the in-round HUD.
  const card = g.missionCardHtml ? g.missionCardHtml(def) : '';
  g.updateCampaignHUD();
  const hud = document.getElementById('missionGoalItems').innerHTML;
  const norm = s => s.replace(/\\s+/g, ' ');
  out.steps.forEach((r, i) => {
    if (card && !norm(card).includes(norm(r.icon))) issue('P1', 'spójność', 'krok ' + (i + 1) + ': ikona w odprawie inna niż w HUD');
    if (card && !card.includes(r.label)) issue('P1', 'spójność', 'krok ' + (i + 1) + ': opis w odprawie inny niż w HUD');
    if (!norm(hud).includes(norm(r.icon).replace(/"/g, '"')) && !hud.includes(r.label)) issue('P1', 'spójność', 'krok ' + (i + 1) + ': brak w HUD');
  });
  // Progress: eating a counted object adds exactly 1; an object the step
  // does not name (same type, another look -- or another type) adds 0.
  const probes = [];
  const resolve = (e) => { e.eating = true; e.consumed = true; e.eater = g.player; e._resolved = true; g.resolveCampaignEntity(e); };
  steps.forEach((st, i) => {
    if (!st.eat || st.eat === 'runner') return;
    const before = g.objectiveProgress(st)[0];
    const right = g.campaignEntities.find(e => !e.consumed && matches(st, e));
    if (right) {
      resolve(right);
      const after = g.objectiveProgress(st)[0];
      probes.push({ step: i + 1, right: after - before });
      if (after - before !== 1) issue('P1', 'postęp', 'krok ' + (i + 1) + ': właściwy obiekt dodał ' + (after - before));
    }
    // A wrong object: same type with another glyph (when the step names
    // one), else a different type of the same size class.
    const otherGlyph = st.glyph ? (TIERS[st.eat] && TIERS[st.eat].subtypes || []).concat(['znacznik', 'krysztal', 'witryna', 'emiter', 'paleta', 'zasilacz']).find(gl => gl !== st.glyph) : null;
    const wrong = st.glyph
      ? new CampaignEntity(st.eat, g.player.x, g.player.y, { glyph: otherGlyph })
      : new CampaignEntity(st.eat === 'fragment' ? 'capsule' : 'fragment', g.player.x, g.player.y);
    g.campaignEntities.push(wrong);
    const b2 = g.objectiveProgress(st)[0];
    resolve(wrong);
    const a2 = g.objectiveProgress(st)[0];
    probes.push({ step: i + 1, wrong: a2 - b2, wrongKind: wrong.type + ':' + (wrong.glyph || '-') });
    if (a2 !== b2) issue('P1', 'postęp', 'krok ' + (i + 1) + ': niewłaściwy obiekt (' + wrong.type + '/' + (wrong.glyph || '-') + ') liczy się do celu');
  });
  out.probes = probes;
  g.endCampaignMission(false);
  return out;
};
`;

/** Number words in NELA's lines -> the count they promise. */
const NUM_WORDS = { 'dwa': 2, 'dwie': 2, 'dwóch': 2, 'dwoma': 2, 'trzy': 3, 'trzech': 3, 'cztery': 4, 'czterech': 4, 'pięć': 5, 'pięciu': 5, 'sześć': 6, 'siedem': 7, 'osiem': 8, 'dziewięć': 9, 'dziesięć': 10, 'dziesięciu': 10, 'jedenaście': 11, 'dwanaście': 12, 'trzynaście': 13, 'czternaście': 14, 'piętnaście': 15 };
// Object words in names / NELA lines -> the board art they describe.
const OBJECT_WORDS = [
  [/witryn/i, ['witryna']], [/maszt|anten/i, ['maszt']], [/wieżow/i, ['wiezowiec']], [/kopuł/i, ['kopula']],
  [/pawilon|altan/i, ['pawilon']], [/billboard|reklam|ekran/i, ['billboard']], [/magazyn|hurtowni/i, ['magazyn']],
  [/autobus/i, ['autobus']], [/tramwaj|skład|wagon|pociąg/i, ['tramwaj']], [/ciężarów|flot|wózk/i, ['ciezarowka']],
  [/(^|[^i])skrzy/i, ['skrzynia']], [/palet/i, ['paleta']], [/kryszta/i, ['krysztal']], [/klucz/i, ['klucz_sektora']], [/emiter/i, ['emiter']],
  [/zasilacz/i, ['zasilacz']], [/most/i, ['mostek']], [/lustr/i, ['lustro']], [/pylon/i, ['pylon']], [/węz[eł]/i, ['wezel']],
  [/kapsuł/i, ['kapsula']], [/bajt/i, ['bajt']], [/kiosk|kram/i, ['kiosk']], [/ławk/i, ['lawka']], [/komin|chłodni/i, ['__komin']]
];

function textReview(r) {
  const out = [];
  const arts = new Set(Object.keys(r.board.byKind).map(k => k.split(':')[1]));
  const counts = new Set();
  r.steps.forEach(s => { if (s.n) counts.add(s.n); const m = /(\d+)/.exec(s.label); if (m) counts.add(+m[1]); });
  for (const [where, text] of [['nazwa', r.name], ['NELA', r.nela[0]]]) {
    for (const [re, want] of OBJECT_WORDS) {
      if (re.test(text) && !want.some(a => arts.has(a))) out.push(`${where} wspomina „${re.source}”, a na planszy brak ${want.join('/')}`);
    }
  }
  for (const w of r.nela[0].toLowerCase().split(/[^a-ząćęłńóśźż0-9]+/)) {
    const n = NUM_WORDS[w] || (/^\d+$/.test(w) ? +w : 0);
    if (n && n !== 1 && !counts.has(n) && !/^T\d/.test(w)) out.push(`NELA mówi „${w}”, a cele: ${[...counts].join(', ')}`);
  }
  return out;
}

export async function runContentAudit(url, { play = true, only = null, label = 'after' } = {}) {
  const results = [];
  const { browser, page, errors } = await openGame(url, { viewport: { width: 390, height: 844 } });
  const save = await allDistrictsSave(page);
  await page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await page.reload();
  await page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
  await page.addScriptTag({ content: AUDIT });
  await page.addScriptTag({ content: CAMPAIGN_BOT });
  const ids = (await page.evaluate(() => DISTRICTS.flatMap(d => d.missions))).filter(id => !only || only.includes(id));
  const rows = [];
  for (const id of ids) {
    const r = await page.evaluate((mid) => window.__qaContentAudit(mid), id);
    r.review = textReview(r);
    if (play) {
      // Expert bot under the real limit; a failure is retried without a
      // limit so "hard" and "impossible" stay apart. Every frame records
      // the vortex radius (world px) and the camera zoom.
      const p = await page.evaluate((mid) => {
        let maxR = 0, maxScreen = 0;
        const onFrame = (f, g) => { if (g.player.radius > maxR) maxR = g.player.radius; const s = g.player.radius * g.zoom; if (s > maxScreen) maxScreen = s; };
        const a = window.__qaPlayMission(mid, { onFrame });
        const res = { success: a.success, elapsed: a.elapsed, limit: a.limit, fail: a.fail, maxR: Math.round(maxR), maxScreen: Math.round(maxScreen), w: window.game.width, h: window.game.height };
        // (a fragile vortex or a hunter can end any single run: up to three
        // runs without a limit before a mission counts as impossible)
        for (let k = 0; !a.success && !res.openSuccess && k < 3; k++) { const b = window.__qaPlayMission(mid, { openLimit: true, onFrame }); res.openSuccess = b.success; res.openElapsed = b.elapsed; res.openTries = k + 1; res.openFail = b.fail; }
        return res;
      }, id);
      r.play = p;
      p.frac = +(p.maxScreen / Math.min(p.w, p.h)).toFixed(3);
      if (!p.success && !p.openSuccess) r.issues.push({ pri: 'P1', cls: 'wykonalność', msg: `bot-ekspert nie kończy misji nawet w 3 próbach bez limitu (${p.openFail || p.fail})` });
      if (p.frac > MAX_HOLE_FRAC) r.issues.push({ pri: 'P1', cls: 'skala', msg: `wir do ${Math.round(p.frac * 100)}% krótszego boku telefonu (promień ${p.maxR} px)` });
    }
    r.status = r.issues.length ? 'ISSUE' : (play && r.play && (r.play.success || r.play.openSuccess)) ? 'PASS' : 'NOT VERIFIED';
    rows.push(r);
    if (r.issues.length) console.log(`  ${r.code} (${r.id}) ${r.name}: ${r.issues.map(i => i.msg).join(' | ')}`);
  }

  // Across missions: one board object = one icon, one icon = one object
  // (the HUD and the briefing draw what really lies on the board).
  const byKey = new Map(), byIcon = new Map();
  for (const r of rows) for (const s of r.steps) {
    if (!s.objectKey) continue;
    if (!byKey.has(s.objectKey)) byKey.set(s.objectKey, new Set());
    byKey.get(s.objectKey).add(s.icon);
    if (!byIcon.has(s.icon)) byIcon.set(s.icon, new Set());
    byIcon.get(s.icon).add(s.objectKey);
  }
  const shared = [...byIcon.values()].filter(set => set.size > 1).map(set => [...set].sort().join(' = '));
  const split = [...byKey.entries()].filter(([, set]) => set.size > 1).map(([k]) => k);
  for (const r of rows) for (const s of r.steps) {
    const set = byIcon.get(s.icon);
    if (set && set.size > 1) r.issues.push({ pri: 'P1', cls: 'ikona', msg: `krok ${s.i + 1} (${s.label}): ta sama ikona co dla ${[...set].filter(k => k !== s.objectKey).join(', ')}` });
    if (s.kind === 'eat' && s.glyph && s.icon === (rows.flatMap(x => x.steps).find(o => o.objectKey === 'class:' + s.type) || {}).icon && s.arts.length === 1) {
      r.issues.push({ pri: 'P1', cls: 'ikona', msg: `krok ${s.i + 1} (${s.label}): ogólna ikona klasy zamiast ikony obiektu „${s.glyph}”` });
    }
  }
  for (const r of rows) {
    // (dedupe -- one message per step/class)
    const seen = new Set();
    r.issues = r.issues.filter(i => { const k = i.cls + i.msg; if (seen.has(k)) return false; seen.add(k); return true; });
    if (r.issues.length) r.status = 'ISSUE';
  }

  // EN: every name, goal and NELA line reaches the screen in English.
  const texts = [...new Set(rows.flatMap(r => [r.name, r.nela[0], r.nela[1], ...r.steps.map(s => s.label), r.steps.map(s => s.label).join(' · ')]))];
  await browser.close();
  const en = await openGame(url, { viewport: { width: 390, height: 844 }, locale: 'en-US' });
  const untranslated = await en.page.evaluate(async (list) => {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.getElementById('app').appendChild(box);
    const out = [];
    for (let i = 0; i < list.length; i += 50) {
      const chunk = list.slice(i, i + 50);
      box.innerHTML = chunk.map(t => `<p>${t}</p>`).join('');
      await new Promise(r => setTimeout(r, 30));
      [...box.children].forEach((p, k) => { const t = p.textContent; if (t === chunk[k] || /[ąćęłńóśźż]/i.test(t)) out.push(chunk[k]); });
    }
    box.remove();
    return out;
  }, texts);
  await en.browser.close();
  for (const r of rows) {
    for (const t of [r.name, r.nela[0], r.nela[1], ...r.steps.map(s => s.label)]) {
      if (untranslated.includes(t)) r.issues.push({ pri: 'P2', cls: 'EN', msg: `brak tłumaczenia: „${t}”` });
    }
    if (r.issues.length) r.status = 'ISSUE';
  }

  const count = (st) => rows.filter(r => r.status === st).length;
  fs.mkdirSync(path.join(OUT, 'content', label), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'content', label, 'audit.json'), JSON.stringify({ shared, split, untranslated, rows }, null, 2));
  fs.writeFileSync(path.join(OUT, 'content', label, 'audit.md'), auditMarkdown(rows, { shared, split, play }));

  const expected = await (async () => ids.length)();
  results.push(report('content: every mission in DISTRICTS is audited', rows.length === expected && (only || expected === 240), `${rows.length}/${expected} (DISTRICTS lists ${expected})`));
  results.push(report('content: goal rows name real objects (labels, nouns, no raw ids)', rows.every(r => !r.issues.some(i => i.cls === 'tekst')), list(rows, 'tekst')));
  results.push(report('content: one icon per board object, the object\'s own icon (no shared/class icon for a named object)', shared.length === 0 && split.length === 0 && rows.every(r => !r.issues.some(i => i.cls === 'ikona')), shared.slice(0, 6).join(' ; ') || list(rows, 'ikona')));
  results.push(report('content: briefing card and HUD show the same goal rows and icons', rows.every(r => !r.issues.some(i => i.cls === 'spójność')), list(rows, 'spójność')));
  results.push(report('content: the board holds every goal object, inside the playable box, none hidden under a bigger one', rows.every(r => !r.issues.some(i => i.cls === 'obiekty')), list(rows, 'obiekty')));
  results.push(report('content: enough growth on the board for the tier each mission needs', rows.every(r => !r.issues.some(i => i.cls === 'wykonalność' && /jedn/.test(i.msg))), list(rows.filter(r => r.issues.some(i => /jedn/.test(i.msg))), 'wykonalność')));
  results.push(report('content: progress counts the named object (+1) and never another one (+0)', rows.every(r => !r.issues.some(i => i.cls === 'postęp')), list(rows, 'postęp')));
  results.push(report('content: every name, goal and NELA line has English copy', untranslated.length === 0, untranslated.slice(0, 5).join(' | ')));
  if (play) {
    const played = rows.filter(r => r.play);
    results.push(report('content: the expert bot finishes every mission (open limit when the real one is missed)', played.every(r => r.play.success || r.play.openSuccess), `${played.filter(r => r.play.success).length} under the limit, ${played.filter(r => !r.play.success && r.play.openSuccess).length} only without it, ${played.filter(r => !r.play.success && !r.play.openSuccess).length} never`));
    const worst = played.slice().sort((a, b) => b.play.frac - a.play.frac).slice(0, 3);
    results.push(report(`content: the vortex never spans more than ${MAX_HOLE_FRAC * 100}% of a phone's short side`, played.every(r => r.play.frac <= MAX_HOLE_FRAC), worst.map(r => `${r.code} ${Math.round(r.play.frac * 100)}% r${r.play.maxR}`).join(', ')));
  }
  results.push(report('content: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | ')));
  console.log(`  missions: PASS ${count('PASS')}, ISSUE ${count('ISSUE')}, NOT VERIFIED ${count('NOT VERIFIED')} -> qa/out/content/${label}/audit.md`);
  return results;
}

function list(rows, cls) {
  const hit = rows.filter(r => r.issues.some(i => i.cls === cls));
  return hit.length ? `${hit.length} missions: ` + hit.slice(0, 5).map(r => `${r.code} ${r.issues.find(i => i.cls === cls).msg}`).join(' ; ') : '';
}

function auditMarkdown(rows, { shared, split, play }) {
  const esc = (s) => String(s).replace(/\|/g, '\\|');
  const lines = [
    '# CONTENT-1 — audyt misji Kampanii',
    '',
    `Misji: ${rows.length}. PASS ${rows.filter(r => r.status === 'PASS').length} · ISSUE ${rows.filter(r => r.status === 'ISSUE').length} · NOT VERIFIED ${rows.filter(r => r.status === 'NOT VERIFIED').length}.`,
    play ? 'Rozgrywka: bot-ekspert w czasie wirtualnym (limit misji, a przy porażce drugi przebieg bez limitu); skala wiru mierzona w ramce 390×844.' : 'Bez rozgrywki (--static): żadna misja nie może być PASS.',
    '',
    shared.length ? 'Wspólne ikony różnych obiektów: ' + shared.join(' ; ') : 'Każdy obiekt ma własną ikonę.',
    split.length ? 'Obiekty z różnymi ikonami w różnych misjach: ' + split.join(', ') : '',
    '',
    '| Kod | Id | Dzielnica | Nazwa | Cele | Obiekty na planszy (cel) | Bot | Wir max | Wynik | Priorytet | Problemy / do przeglądu |',
    '|---|---|---|---|---|---|---|---|---|---|---|'
  ];
  for (const r of rows) {
    const goals = r.steps.map(s => s.label).join(' · ');
    const objs = r.steps.filter(s => s.kind === 'eat' || s.kind === 'activate' || s.kind === 'landmark').map(s => `${s.onBoard}/${s.n} ${s.objectKey}`).join(', ') || '—';
    const bot = r.play ? (r.play.success ? `✓ ${r.play.elapsed}/${r.play.limit}s` : r.play.openSuccess ? `limit ✗, bez limitu ✓ ${r.play.openElapsed}s` : `✗ ${r.play.fail}`) : 'NOT RUN';
    const hole = r.play ? `${Math.round(r.play.frac * 100)}% (r ${r.play.maxR})` : '—';
    const pri = r.issues.length ? r.issues.map(i => i.pri).sort()[0] : '';
    const notes = [...r.issues.map(i => `${i.pri} ${i.cls}: ${i.msg}`), ...r.review.map(t => `przegląd: ${t}`)].join('<br>');
    lines.push(`| ${r.code} | ${r.id} | ${r.district} | ${esc(r.name)} | ${esc(goals)} | ${esc(objs)} | ${bot} | ${hole} | ${r.status} | ${pri} | ${esc(notes)} |`);
  }
  return lines.join('\n') + '\n';
}

if (isMain(import.meta.url)) {
  const root = arg('--root', null);
  const { server, url } = await serve(root ? { root: path.resolve(root) } : {});
  const onlyArg = arg('--only', null);
  const res = await runContentAudit(url, { play: !flag('--static'), only: onlyArg ? onlyArg.split(',') : null, label: arg('--label', root ? 'before' : 'after') });
  server.close();
  process.exit(res.every(r => r.ok) ? 0 : 1);
}

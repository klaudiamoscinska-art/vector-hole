// WORKSHOP-BUY: buying in Warsztat happens in the showroom card's fixed action
// slot, with no sheet over the grid (the owner's playtest: the sheet kept
// covering the cards however it was placed).
//  - Layout, every platform frame + the owner's laptop, each state (nothing
//    looked at / can buy / short / reward): the action and the preview in view,
//    nothing over the cards (landscape: every Finisz card in view), a tap on
//    a card moves nothing, no label cut off.
//  - Phone: a card at the very end of the list is bought with the preview and
//    the action in view (they used to scroll away); pinning doesn't move the list.
//  - Behaviour: looking spends nothing, a tap buys exactly once, another card
//    or tab replaces the look, every way out reverts, a preview left behind
//    can never be worn, a rewarded ad updates the offer, reward items can't be bought.
//  - English: the slot's text is translated and fits.
// Screenshots -> qa/out/workshop-buy/<WxH>-<state>.png
// Usage: node qa/workshop-buy.mjs [--only=layout,phone,behaviour,english]
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, veteranSave, report, expectAll, holds, isMain, OUT } from './lib.mjs';
import { MATRIX, settled } from './responsive.mjs';

const OUT_DIR = path.join(OUT, 'workshop-buy');
const allOf = (name, checks, context) => expectAll(name, Object.fromEntries(Object.entries(checks).map(([k, v]) => [k, holds(!!v)])), context);
const READY = () => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state;

async function veteran(page, prisms = 59) {
  const s = await veteranSave(page, { missions: 30, coins: 5000, runsPlayed: 6 });
  s.prisms = prisms;
  await page.evaluate((v) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(v)), s);
  await page.reload();
  await page.waitForFunction(READY);
}

const openOn = async (url, w, h, kind, { dpr = null, locale = 'pl-PL', prisms = 59 } = {}) => {
  const g = await openGame(url, { viewport: { width: w, height: h }, mobile: kind !== 'desk', deviceScaleFactor: dpr || (kind === 'desk' ? 1 : 2), locale });
  await veteran(g.page, prisms);
  await g.page.evaluate(() => { document.getElementById('btnNavWarsztat').click(); document.getElementById('tabOverdrive').click(); });
  await g.page.waitForTimeout(250);
  return g;
};

// Finisz has one of each: Fala (reward), Zielona Burza 40 ◆ (buy with 59, short with 5).
const LOOK = async (p, state) => {
  await p.evaluate((st) => {
    const gm = window.game;
    gm.clearWarsztatFocus();
    if (st === 'idle') return;
    gm.save.prisms = st === 'short' ? 5 : 59;
    gm.updateCoinDisplays();
    gm.onCosmeticPick('overdriveSkin', OVERDRIVE_SKINS.find(o => st === 'reward' ? o.unlockSource : o.id === 'zielona_burza'));
  }, state);
  await p.waitForTimeout(120);
};

const MEASURE = () => {
  const R = (e) => e.getBoundingClientRect(), H = innerHeight, W = innerWidth;
  const on = (e) => { const b = R(e), t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!t && (t === e || e.contains(t)); };
  const shown = (e) => !!e && !e.classList.contains('hidden') && R(e).width > 1;
  const inView = (e) => { const b = R(e); return b.top >= -1 && b.bottom <= H + 1 && b.left >= -1 && b.right <= W + 1; };
  const nav = document.getElementById('bottomNav');
  const navTop = document.body.classList.contains('wide') || document.body.classList.contains('compact') ? H : R(nav).top;
  const btns = ['btnWarsztatBuy', 'btnWarsztatCancel'].map(id => document.getElementById(id)).filter(shown);
  const cards = [...document.querySelectorAll('#shopScreen .skin-grid:not(.hidden) > .skin-card')];
  const c = R(document.getElementById('warsztatPreviewCanvas')), slot = R(document.querySelector('.warsztat-action'));
  const line = document.querySelector('.warsztat-preview-loadout');
  return {
    layout: document.body.classList.contains('wide') ? 'wide' : document.body.classList.contains('compact') ? 'compact' : 'phone',
    sheet: !document.getElementById('infoSheet').classList.contains('hidden'),
    btns: btns.map(b => b.textContent),
    btnsOk: btns.every(b => inView(b) && R(b).bottom <= navTop + 1 && on(b)),
    tap: btns.length ? Math.round(Math.min(...btns.map(b => Math.min(R(b).width, R(b).height)))) : 44,
    clipped: btns.filter(b => b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1).map(b => b.textContent),
    slotOk: slot.top >= -1 && slot.bottom <= navTop + 1,
    canvasPct: Math.round(100 * Math.max(0, Math.min(c.bottom, navTop) - Math.max(c.top, 0)) / c.height),
    lineOk: inView(line) && line.scrollWidth <= line.clientWidth + 1,
    line: [...line.children].filter(e => !e.classList.contains('hidden')).map(e => e.textContent).join(' '),
    tabsOk: ['tabSkins', 'tabOverdrive'].every(id => { const t = document.getElementById(id); return inView(t) && on(t); }),
    cards: cards.length,
    cardsSeen: cards.filter(k => { const b = R(k); return b.top >= -1 && b.bottom <= navTop + 1 && on(k); }).length,
    cardTops: cards.map(k => Math.round(R(k).top)),
    tabsTop: Math.round(R(document.getElementById('tabSkins')).top),
    pageScroll: document.documentElement.scrollWidth > W + 1
  };
};

async function layoutChecks(url) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = [];
  const frames = [[1279, 598, 'desk', 'laptop właścicielki 150%', null, 1.5], ...MATRIX.filter(f => f[0] && f[1]).map(f => [f[0], f[1], f[2], f[3], f[4], null])];
  for (const [w, h, kind, name, , dpr] of frames) {
    const g = await openOn(url, w, h, kind, { dpr });
    const p = g.page, tag = `${w}x${h}`, m = {};
    // GG-UI-02: measure once the screen's entrance has finished (on a slow 2560x1440 frame the
    // rising column was still moving at the first measurement and read as a layout shift).
    await settled(p, '#shopScreen');
    for (const st of ['idle', 'buy', 'short', 'reward']) {
      await LOOK(p, st);
      m[st] = await p.evaluate(MEASURE);
      await p.screenshot({ path: path.join(OUT_DIR, `${tag}-${st}.png`) });
    }
    const looks = [m.buy, m.short, m.reward];
    const all = [m.idle, ...looks];
    const moved = Math.max(...looks.map(x => Math.max(Math.abs(x.tabsTop - m.idle.tabsTop), ...x.cardTops.map((t, i) => Math.abs(t - m.idle.cardTops[i])))));
    out.push(allOf(`Warsztat ${tag} (${name}): no sheet; the action and preview in view, a tap moves nothing, no label cut off`, {
      'no sheet in any state': all.every(x => !x.sheet),
      'buy state: KUP I ZAŁÓŻ + NIE TERAZ': /^KUP I ZAŁÓŻ · 40 ◆$/.test(m.buy.btns[0]) && m.buy.btns[1] === 'NIE TERAZ',
      'short state: ZAGRAJ RUNDĘ + NIE TERAZ': m.short.btns[0] === 'ZAGRAJ RUNDĘ' && m.short.btns[1] === 'NIE TERAZ',
      'reward state: only NIE TERAZ': m.reward.btns.length === 1 && m.reward.btns[0] === 'NIE TERAZ',
      'buttons in view and on top': all.every(x => x.btnsOk),
      'tap target >= 44 px': all.every(x => x.tap >= 44),
      'no label cut off': all.every(x => !x.clipped.length),
      'status line fits': all.every(x => x.lineOk),
      'preview fully in view': all.every(x => x.slotOk && x.canvasPct >= 99),
      'tabs in view': all.every(x => x.tabsOk),
      'a tap on a card moves nothing (<= 1 px)': moved <= 1,
      'no sideways page scroll': all.every(x => !x.pageScroll),
      'landscape: every card in view and on top': m.buy.layout === 'phone' || all.every(x => x.cardsSeen === x.cards)
    }, JSON.stringify({ moved, buy: m.buy.btns, seen: all.map(x => x.cardsSeen), cards: m.buy.cards, canvas: all.map(x => x.canvasPct), tap: all.map(x => x.tap), clipped: all.flatMap(x => x.clipped), layout: m.buy.layout })));
    out.push(report(`Warsztat ${tag}: no runtime errors`, g.errors.length === 0, g.errors.slice(0, 3).join(' | ')));
    await g.browser.close();
  }
  return out;
}

async function phoneChecks(url) {
  const out = [];
  for (const [w, h] of [[430, 932], [390, 844], [375, 667], [360, 640], [320, 568]]) {
    const g = await openOn(url, w, h, 'phone');
    const p = g.page;
    const r = await p.evaluate(async () => {
      const gm = window.game, R = (e) => e.getBoundingClientRect();
      document.getElementById('tabSkins').click();
      const scroller = document.querySelector('#shopScreen .nav-screen'), hero = document.querySelector('#shopScreen .warsztat-preview');
      const wait = (ms) => new Promise(res => setTimeout(res, ms));
      const height0 = scroller.scrollHeight;
      scroller.scrollTop = scroller.scrollHeight; await wait(250);
      const stuck = hero.classList.contains('stuck'), height1 = scroller.scrollHeight, headVisible = R(scroller.querySelector('.app-header')).bottom > R(scroller).top;
      const buyable = [...document.querySelectorAll('#skinGrid .skin-card')].filter(c => { const s = SKINS.find(x => x.id === c.dataset.item); return s && !gm.save.owned.includes(s.id) && !s.unlockSource; }).pop();
      const reachable = (el) => { const b = R(el), t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!t && el.contains(t); };
      if (!reachable(buyable)) { buyable.scrollIntoView({ block: 'center' }); await wait(200); }
      const top0 = R(buyable).top;
      const tappable = reachable(buyable);
      buyable.click(); await wait(120);
      const c = R(document.getElementById('warsztatPreviewCanvas')), navTop = R(document.getElementById('bottomNav')).top, buy = document.getElementById('btnWarsztatBuy'), b = R(buy);
      const res = { stuck, headVisible, tappable, height0, height1, cardMoved: Math.abs(R(buyable).top - top0), canvasPct: Math.round(100 * Math.max(0, Math.min(c.bottom, navTop) - Math.max(c.top, 0)) / c.height), buyInView: b.top >= -1 && b.bottom <= navTop + 1 && !buy.classList.contains('hidden'), heroH: Math.round(R(hero).height), roomForList: Math.round(navTop - R(hero).bottom), scrolled: scroller.scrollTop > 0 };
      return res;
    });
    await p.screenshot({ path: path.join(OUT_DIR, `${w}x${h}-list-end.png`) });
    // Back to the top: the card returns to full size where it started.
    r.backFull = await p.evaluate(async (height0) => {
      const scroller = document.querySelector('#shopScreen .nav-screen'), hero = scroller.querySelector('.warsztat-preview');
      window.game.clearWarsztatFocus(); scroller.scrollTop = 0; await new Promise(res => setTimeout(res, 250));
      return !hero.classList.contains('stuck') && hero.style.marginBottom === '' && Math.abs(scroller.scrollHeight - height0) <= 1;
    }, r.height0);
    out.push(allOf(`Warsztat phone ${w}x${h}: a card low in the list is looked at with the preview and the action in view`, {
      'the card can be tapped': r.tappable,
      'preview in view': r.canvasPct >= 99,
      'action in view': r.buyInView,
      'room left for the list >= 180 px': r.roomForList >= 180,
      'pinned and slimmer once the header has scrolled away': r.headVisible || r.stuck,
      'pinning never moves the list': r.height0 === r.height1 && r.cardMoved <= 1,
      'back at the top: full size again': r.backFull
    }, JSON.stringify(r)));
    await g.browser.close();
  }
  return out;
}

async function behaviourChecks(url) {
  const out = [];
  const g = await openOn(url, 1280, 720, 'desk');
  const p = g.page;
  const r = await p.evaluate(async () => {
    const gm = window.game, o = {}, wait = (ms) => new Promise(res => setTimeout(res, ms));
    const buy = document.getElementById('btnWarsztatBuy'), cancel = document.getElementById('btnWarsztatCancel');
    const item = (list, id) => list.find(x => x.id === id);
    const zb = item(OVERDRIVE_SKINS, 'zielona_burza'), zs = item(OVERDRIVE_SKINS, 'zloty_szczyt'), fala = OVERDRIVE_SKINS.find(x => x.unlockSource);
    const wallet = () => [gm.save.coins, gm.save.prisms].join('/');
    const w0 = wallet(), worn0 = gm.save.overdriveSkins.selected;

    // Looking spends nothing; tapping the same card twice neither.
    document.getElementById('tabOverdrive').click();
    const card = (id) => document.querySelector(`#overdriveSkinGrid .skin-card[data-item="${id}"]`);
    card('zielona_burza').click(); card('zielona_burza').click(); await wait(30);
    o.look = { wallet: wallet() === w0, owned: gm.save.overdriveSkins.owned.includes('zielona_burza'), pending: gm.pendingLoadout.overdriveSkin, name: document.getElementById('warsztatPreviewName').textContent, marked: card('zielona_burza').classList.contains('looking'), wornKept: gm.save.overdriveSkins.selected === worn0, wornMark: card(worn0).classList.contains('selected') };

    // Another card replaces the look (the old sheet's revert would undo it).
    card('zloty_szczyt').click(); await wait(30);
    o.swap = { pending: gm.pendingLoadout.overdriveSkin, name: document.getElementById('warsztatPreviewName').textContent, focus: gm.warsztatFocus.item.id, oldMark: card('zielona_burza').classList.contains('looking'), newMark: card('zloty_szczyt').classList.contains('looking'), label: buy.textContent };

    // NIE TERAZ.
    cancel.click(); await wait(30);
    o.cancel = { pending: gm.pendingLoadout.overdriveSkin === worn0, focus: gm.warsztatFocus, hint: !document.getElementById('warsztatHint').classList.contains('hidden'), buyHidden: buy.classList.contains('hidden'), cancelHidden: cancel.classList.contains('hidden'), wallet: wallet() === w0, line: document.getElementById('warsztatPreviewLoadout').textContent };

    // Escape, and a tab change.
    card('zielona_burza').click();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' })); await wait(30);
    o.esc = { pending: gm.pendingLoadout.overdriveSkin === worn0, focus: gm.warsztatFocus };
    card('zielona_burza').click();
    document.getElementById('tabAuras').click(); await wait(30);
    o.tab = { pending: gm.pendingLoadout.overdriveSkin === worn0, focus: gm.warsztatFocus };
    document.getElementById('tabOverdrive').click();

    // A look across categories: the previous category goes back too.
    card('zielona_burza').click();
    gm.onCosmeticPick('skin', item(SKINS, 'cyan')); await wait(30);
    o.cross = { finisz: gm.pendingLoadout.overdriveSkin === worn0, skin: gm.pendingLoadout.skin };
    gm.clearWarsztatFocus();

    // A preview left behind can't be worn: leave the screen mid-look, then the
    // pause's quick equip commits the loadout.
    const skinWorn = gm.save.selected;
    gm.onCosmeticPick('skin', item(SKINS, 'cyan'));
    gm.showScreen('mainMenu');
    o.leave = { pending: gm.pendingLoadout.skin === skinWorn, focus: gm.warsztatFocus };
    gm.onEquipClick();
    o.leave.worn = gm.save.selected === skinWorn;
    o.leave.owned = gm.save.owned.includes('cyan');
    gm.openWarsztatScreen();
    document.getElementById('tabOverdrive').click();

    // Buying: exactly once however fast the taps come; the same price; worn.
    const p0 = gm.save.prisms;
    card('zielona_burza').click(); await wait(30);
    o.buyLabel = buy.textContent;
    buy.click(); buy.click(); await wait(30);
    o.bought = { paid: p0 - gm.save.prisms, price: zb.pricePrisms, owned: gm.save.overdriveSkins.owned.filter(x => x === 'zielona_burza').length, worn: gm.save.overdriveSkins.selected === 'zielona_burza', focus: gm.warsztatFocus, stored: JSON.parse(localStorage.getItem('vectorHoleSave_v1')).overdriveSkins.selected, hint: !document.getElementById('warsztatHint').classList.contains('hidden'), fx: !!gm.warsztatFx };

    // Short of prisms: nothing to buy; the way to earn them opens on request,
    // the look survives it; a rewarded ad on this screen updates the offer.
    gm.save.prisms = zs.pricePrisms - 2; gm.updateCoinDisplays();
    card('zloty_szczyt').click(); await wait(30);
    const earn = document.getElementById('btnWarsztatEarn');
    o.short = { label: buy.textContent, line: document.getElementById('warsztatPreviewLoadout').textContent, earn: !earn.classList.contains('hidden'), earnTap: Math.round(earn.getBoundingClientRect().height) };
    earn.click(); await wait(30);
    o.short.sheet = !document.getElementById('infoSheet').classList.contains('hidden') && /Pryzmaty/.test(document.getElementById('infoSheetTitle').textContent);
    gm.closeInfoSheet(); await wait(30);
    o.short.kept = gm.warsztatFocus && gm.warsztatFocus.item.id === 'zloty_szczyt';
    const before = gm.save.prisms;
    await gm.watchFreePrismsAd(); await wait(50);
    o.ad = { gained: gm.save.prisms - before, label: buy.textContent, line: document.getElementById('warsztatPreviewLoadout').textContent, earnGone: earn.classList.contains('hidden') };
    gm.clearWarsztatFocus();

    // A reward is never for sale.
    card(fala.id).click(); await wait(30);
    o.reward = { buyHidden: buy.classList.contains('hidden'), earnHidden: earn.classList.contains('hidden'), line: document.getElementById('warsztatPreviewLoadout').textContent, pending: gm.pendingLoadout.overdriveSkin };
    const w1 = wallet();
    buy.click(); await wait(30);
    o.reward.nothing = wallet() === w1 && !gm.save.overdriveSkins.owned.includes(fala.id);
    gm.clearWarsztatFocus();

    // An owned item: one tap wears it, no offer.
    card(worn0).click(); await wait(30);
    o.owned = { worn: gm.save.overdriveSkins.selected === worn0, focus: gm.warsztatFocus };

    // ZAGRAJ RUNDĘ: the look ends, the round starts with what is worn.
    gm.save.prisms = 0; gm.updateCoinDisplays();
    card('zloty_szczyt').click(); await wait(30);
    buy.click(); await wait(200);
    o.play = { running: !!gm.running, pending: gm.pendingLoadout.overdriveSkin === worn0, focus: gm.warsztatFocus, worn: gm.save.overdriveSkins.selected === worn0 };
    return o;
  });
  out.push(allOf('Warsztat: looking at an item spends nothing, the worn item keeps its mark', {
    'nothing spent': r.look.wallet, 'not owned': !r.look.owned, 'preview shows it': r.look.pending === 'zielona_burza' && r.look.name === 'Zielona Burza',
    'its card is marked': r.look.marked, 'still wearing the old one': r.look.wornKept && r.look.wornMark
  }, JSON.stringify(r.look)));
  out.push(allOf('Warsztat: another card replaces the look (preview, card mark, price)', {
    'preview': r.swap.pending === 'zloty_szczyt' && r.swap.name === 'Złoty Szczyt' && r.swap.focus === 'zloty_szczyt',
    'card marks': !r.swap.oldMark && r.swap.newMark, 'price': /KUP I ZAŁÓŻ · 25 ◆/.test(r.swap.label)
  }, JSON.stringify(r.swap)));
  out.push(allOf('Warsztat: NIE TERAZ, Escape, a tab change and a card in another category all go back to what is worn', {
    'NIE TERAZ': r.cancel.pending && !r.cancel.focus && r.cancel.hint && r.cancel.buyHidden && r.cancel.cancelHidden && r.cancel.wallet && /^Smuga: /.test(r.cancel.line),
    'Escape': r.esc.pending && !r.esc.focus, 'tab change': r.tab.pending && !r.tab.focus, 'other category': r.cross.finisz && r.cross.skin === 'cyan'
  }, JSON.stringify({ c: r.cancel, e: r.esc, t: r.tab, x: r.cross })));
  out.push(allOf('Warsztat: leaving mid-look reverts — a preview left behind can never be worn', {
    'pending back': r.leave.pending && !r.leave.focus, 'the next equip wears only what is owned': r.leave.worn, 'not granted': !r.leave.owned
  }, JSON.stringify(r.leave)));
  out.push(allOf('Warsztat: KUP I ZAŁÓŻ pays the same price exactly once, wears and saves it, with the burst', {
    'label': /KUP I ZAŁÓŻ · 40 ◆/.test(r.buyLabel), 'paid once': r.bought.paid === r.bought.price && r.bought.price === 40, 'owned once': r.bought.owned === 1,
    'worn': r.bought.worn && r.bought.stored === 'zielona_burza', 'slot back to the hint': !r.bought.focus && r.bought.hint, 'burst': r.bought.fx
  }, JSON.stringify(r.bought)));
  out.push(allOf('Warsztat: short of prisms — ZAGRAJ RUNDĘ, how to earn them on request, and a rewarded ad updates the offer', {
    'label': r.short.label === 'ZAGRAJ RUNDĘ', 'line': /^Brakuje 2 ◆/.test(r.short.line), 'earn link': r.short.earn && r.short.earnTap >= 24, 'sheet on request': r.short.sheet, 'look survives it': r.short.kept,
    'ad updates the offer': r.ad.gained > 0 && /^KUP I ZAŁÓŻ · 25 ◆/.test(r.ad.label) && /^Cena: 25 ◆ · masz 2\d ◆/.test(r.ad.line) && r.ad.earnGone
  }, JSON.stringify({ s: r.short, a: r.ad })));
  out.push(allOf('Warsztat: a reward shows where it comes from and has nothing to buy', {
    'no buy, no earn': r.reward.buyHidden && r.reward.earnHidden, 'source': /CORE CITY LVL|NAGRODA ZA|Pakiecie/.test(r.reward.line), 'previewed': !!r.reward.pending, 'nothing happens': r.reward.nothing
  }, JSON.stringify(r.reward)));
  out.push(report('Warsztat: an owned item is worn with one tap, no offer', r.owned.worn && !r.owned.focus, JSON.stringify(r.owned)));
  out.push(allOf('Warsztat: ZAGRAJ RUNDĘ ends the look and starts a round with what is worn', { 'running': r.play.running, 'reverted': r.play.pending && !r.play.focus && r.play.worn }, JSON.stringify(r.play)));
  out.push(report('Warsztat behaviour: no runtime errors', g.errors.length === 0, g.errors.slice(0, 3).join(' | ')));
  await g.browser.close();
  return out;
}

async function englishChecks(url) {
  const out = [];
  for (const [w, h, kind, dpr] of [[1279, 598, 'desk', 1.5], [844, 390, 'phone', 2], [667, 375, 'phone', 2], [640, 360, 'desk', 1], [375, 667, 'phone', 2], [320, 568, 'phone', 2]]) {
    const g = await openOn(url, w, h, kind, { dpr, locale: 'en-US' });
    const p = g.page, m = {};
    for (const st of ['buy', 'short', 'reward']) {
      await LOOK(p, st);
      await p.waitForTimeout(250); // the translation layer (MutationObserver)
      m[st] = await p.evaluate(MEASURE);
    }
    await p.screenshot({ path: path.join(OUT_DIR, `${w}x${h}-en-reward.png`) });
    const pl = /Cena|masz|Brakuje|KUP|ZAGRAJ|NIE TERAZ|Skąd|Nagroda|Pakiecie/;
    const texts = [m.buy, m.short, m.reward].flatMap(x => [x.line, ...x.btns]);
    out.push(allOf(`Warsztat ${w}x${h} English: the slot is translated and fits`, {
      'buy': /^BUY & EQUIP · 40 ◆$/.test(m.buy.btns[0]) && /^Price: 40 ◆ · you have 59 ◆/.test(m.buy.line),
      'short': /^You're 35 ◆ short/.test(m.short.line) && /How to get them\?/.test(m.short.line) && m.short.btns[0] === 'PLAY A ROUND',
      'no Polish left': !texts.some(t => pl.test(t)),
      'no label cut off': ![m.buy, m.short, m.reward].some(x => x.clipped.length),
      'buttons in view': [m.buy, m.short, m.reward].every(x => x.btnsOk), 'status line fits': [m.buy, m.short, m.reward].every(x => x.lineOk)
    }, JSON.stringify(texts)));
    await g.browser.close();
  }
  return out;
}

const PARTS = { layout: layoutChecks, phone: phoneChecks, behaviour: behaviourChecks, english: englishChecks };
export async function runWorkshopBuyChecks(url, only = null) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = [];
  for (const [k, fn] of Object.entries(PARTS)) if (!only || only.includes(k)) out.push(...await fn(url));
  return out;
}

if (isMain(import.meta.url)) {
  const o = process.argv.find(x => x.startsWith('--only='));
  const { server, url } = await serve();
  const res = await runWorkshopBuyChecks(url, o ? o.slice(7).split(',') : null);
  server.close();
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} WORKSHOP-BUY checks passed`);
  process.exit(failed.length ? 1 : 0);
}

// GG-UI-02 stage 1 -- MOCKUP ONLY: variant B's DOM pass. Runs in the page's
// memory after a scene is staged; reads the game's own data, adds only
// presentational nodes ([data-u2]) and never writes the save.
(function () {
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>';
  const el = (tag, cls, html) => { const n = document.createElement(tag); n.className = cls; n.dataset.u2 = '1'; if (html != null) n.innerHTML = html; return n; };
  window.__ui2Undo = function () {
    document.querySelectorAll('[data-u2]').forEach(n => n.remove());
    document.querySelectorAll('.u2-boss').forEach(n => n.classList.remove('u2-boss'));
    const pm = document.querySelector('#btnStart .u2-play-text');
    if (pm) { const b = document.getElementById('btnStart'); [...pm.children].forEach(c => b.appendChild(c)); pm.remove(); }
  };
  window.__ui2Apply = function (variant) {
    if (variant !== 'b') return;
    const g = window.game, s = g.save;
    // Miasto: the six Core City levels as one rail (reached, current + its real charge, ahead).
    const foot = document.querySelector('#hubHeroStage .hub-city-foot');
    if (foot) {
      const L = s.hub.coreLevel || 1, c = Math.max(0, Math.min(100, s.hub.coreCharge || 0));
      let h = '';
      for (let n = 1; n <= 6; n++) {
        h += `<span class="u2-rail-node${n < L ? ' on' : n === L ? ' now' : ''}">${n}</span>`;
        if (n < 6) h += `<span class="u2-rail-bar"><i style="width:${n < L ? 100 : n === L ? c : 0}%"></i></span>`;
      }
      foot.appendChild(el('div', 'u2-rail', h));
    }
    const play = document.getElementById('btnStart');
    if (play && !play.querySelector('.u2-play-text')) {
      const wrap = document.createElement('span'); wrap.className = 'u2-play-text';
      [...play.children].forEach(c => wrap.appendChild(c));
      play.appendChild(el('span', 'u2-play-orb')); play.appendChild(wrap);
    }
    // Dzielnice: a state mark on every tile, the route counter, the district's colour on its header.
    const tiles = [...document.querySelectorAll('#districtMap .district-tile')];
    let done = 0;
    tiles.forEach((t, i) => {
      const d = DISTRICTS[i]; if (!d) return;
      const all = d.missions.every(id => s.campaign.completed[id]);
      if (all) done++;
      if (all) t.appendChild(el('span', 'u2-state done', CHECK));
      else if (t.classList.contains('locked')) t.appendChild(el('span', 'u2-state lock', LOCK));
      else t.appendChild(el('span', 'u2-state now', `${d.missions.filter(id => s.campaign.completed[id]).length}/${d.missions.length}`));
    });
    const map = document.getElementById('districtMap');
    if (map && tiles.length) {
      const total = Object.keys(s.campaign.completed).length;
      map.parentNode.insertBefore(el('div', 'u2-route', `<span>ODBUDOWANE DZIELNICE <b>${done}/12</b></span><span>MISJE <b>${total}/240</b></span>`), map);
      const act = tiles.findIndex(t => t.classList.contains('active'));
      const head = document.querySelector('#campaignScreen .district-head');
      if (head && act >= 0) head.style.setProperty('--u2-dc', DISTRICT_COLORS[DISTRICTS[act].id]);
    }
    // Mission cards: the district's boss goal gets its own plate (the game's rule: a goal step with a landmark).
    document.querySelectorAll('.mission-card').forEach(card => {
      const btn = card.querySelector('[data-mc-play], [data-mc-launch]');
      const id = btn && (btn.dataset.mcPlay || btn.dataset.mcLaunch);
      const def = id && campaignMissionById(id); if (!def) return;
      const steps = (def.goal && def.goal.steps) || [];
      const rows = [...card.querySelectorAll('.mc-goal')];
      steps.forEach((st, i) => { if (st.landmark && rows[i]) { rows[i].classList.add('u2-boss'); rows[i].appendChild(el('span', 'u2-boss-tag', 'BOSS')); } });
      if (!steps.length && def.goal && def.setup && def.setup.landmark && rows.length) { const r = rows[rows.length - 1]; r.classList.add('u2-boss'); r.appendChild(el('span', 'u2-boss-tag', 'BOSS')); }
    });
    // Warsztat: where each cosmetic comes from (real data: price, currency, unlockSource) + the status of the previewed one.
    const tables = { skinGrid: SKINS, auraGrid: AURAS, effectGrid: EAT_EFFECTS, overdriveSkinGrid: OVERDRIVE_SKINS };
    for (const gid of Object.keys(tables)) {
      document.querySelectorAll(`#${gid} .skin-card`).forEach(card => {
        const it = tables[gid].find(x => x.id === card.dataset.item); if (!it) return;
        const kind = it.unlockSource ? 'reward' : (it.pricePrisms || it.priceType === 'prisms') ? 'prism' : (it.price || it.priceCoins) ? 'coin' : 'start';
        card.appendChild(el('span', 'u2-src ' + kind, kind === 'reward' ? '★' : kind === 'prism' ? '◆' : kind === 'coin' ? '◇' : '●'));
      });
    }
    const labels = document.querySelector('#shopScreen .warsztat-preview-labels');
    const grid = document.querySelector('#shopScreen .skin-grid:not(.hidden)');
    if (labels && grid) {
      const card = grid.querySelector('.skin-card.looking') || grid.querySelector('.skin-card.selected');
      if (card) {
        const st = card.classList.contains('selected') ? ['worn', 'WYPOSAŻONE'] : card.classList.contains('is-buyable') ? ['buy', 'DO KUPIENIA'] : card.classList.contains('is-short') ? ['short', 'ZA MAŁO MONET'] : card.classList.contains('is-reward') ? ['reward', 'NAGRODA'] : ['owned', 'POSIADANE'];
        labels.appendChild(el('span', 'u2-status ' + st[0], st[1]));
      }
    }
  };
})();

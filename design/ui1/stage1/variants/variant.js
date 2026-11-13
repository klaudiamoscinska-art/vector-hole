// GG-UI-01 stage 1 -- the proposed HUD as an isolated layer over the real,
// frozen game frame (design/ui1/tools/ui1-shots.mjs injects this into the
// TEST page only; nothing here is loaded by the game).
// How it works:
//   * the game's own HUD keeps running untouched; this layer only READS it
//     (the DOM values Game.updateHUD()/updateCampaignHUD() wrote, plus the
//     state the canvas widgets draw from) and shows the same values in a new
//     #ui1-hud; the original panels are hidden with CSS;
//   * the screen-space canvas widgets the proposal redraws (minimap, combo,
//     friend-challenge target) are overridden on the game INSTANCE
//     (own properties; deleting them restores the prototype's methods);
//   * the world layer, banners, float texts, edge arrows, name tags and the
//     vortices are not touched.
// window.__ui1Apply(layer, css)  layer: 'before' | 'a' | 'b'
// window.__ui1Plate(on)          every UI layer off (the identity check)
(function () {
  const g = window.game;
  const CITY = window.__ui1City;   // { pitch, road, cells, map, keys } read from game.js by the harness
  const OVERRIDES = ['drawMinimap', 'drawCampaignMinimap', 'drawComboHud', 'drawChallengeTarget'];
  let layer = 'before';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255}, ${n >> 8 & 255}, ${n & 255}, ${a})`; };
  const ICON = {
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 7v5l3 3" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 2l2.6 6.9L22 9l-5.6 4.6L18.2 21 12 16.8 5.8 21l1.8-7.4L2 9l7.4-.1z" fill="currentColor"/></svg>',
    crown: '<svg viewBox="0 0 24 24"><path d="M3 19h18l-1.6-11-5.2 4.2L12 4.5l-2.2 7.7L4.6 8z" fill="currentColor"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4z"/><path d="M7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3"/></svg>',
    note: '<svg viewBox="0 0 24 24"><path d="M9 18V6l11-2v12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="2.6" fill="currentColor"/><circle cx="17.5" cy="16" r="2.6" fill="currentColor"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/></svg>'
  };

  /* ------------------------------------------------------------ the DOM HUD */
  /** What the game's own HUD shows right now (read, never written). */
  function read() {
    const campaign = g.mode === 'campaign';
    const badge = $('missionTierBadge');
    const tierN = parseInt((badge.textContent.match(/\d+/) || [1])[0], 10);
    const s = {
      campaign, daily: !!g.isDailyRun,
      time: $('missionTimerValue').textContent, urgent: !!document.querySelector('.hud-pill-time.hud-urgent'),
      score: $('missionScoreValue').textContent,
      tier: badge.textContent, tierN, tierColor: badge.style.color || '#50F0FA', pct: parseFloat($('missionTierBar').style.width) || 0,
      rank: $('rankValue').textContent,
      rows: [...document.querySelectorAll('#leaderboardList li')].map(li => li.classList.contains('lb-gap') ? { gap: true } : {
        me: li.classList.contains('is-player'), first: li.classList.contains('lb-first'),
        rank: li.querySelector('.lb-rank').textContent.trim(), name: li.querySelector('.lb-name').textContent, score: li.querySelector('.lb-size').textContent
      }),
      goalTitle: (document.querySelector('.hud-goal-section-title') || {}).textContent || '',
      goals: [...document.querySelectorAll('#missionGoalItems .mission-goal-item')].map(el => {
        const count = el.querySelector('.mission-goal-count').textContent.trim();
        const m = count.match(/^(\d+)\s*\/\s*(\d+)$/);
        return { done: el.classList.contains('done'), cls: [...el.classList].filter(c => c.startsWith('twist-')).join(' '),
          icon: el.querySelector('.mission-goal-icon').innerHTML, color: el.querySelector('.mission-goal-icon').style.color,
          label: el.querySelector('.mission-goal-text').textContent, count, p: m ? +m[1] : null, n: m ? +m[2] : null };
      }),
      mission: campaign && g.mission ? g.mission.def.id : null,
      nela: $('nelaToast').classList.contains('visible') && !$('nelaToast').classList.contains('hidden') ? $('nelaToastText').textContent : null,
      playing: $('nowPlaying').classList.contains('visible') ? $('nowPlayingName').textContent : null,
      combo: null, challenge: null
    };
    if (g.comboCount >= 2 && g.comboDisplayAlpha > 0) {
      const m = g.comboMultiplier;
      const win = g.comboWindowOverride || CONFIG.juice.combo.windowSeconds;
      s.combo = { n: g.comboCount, m: m.toFixed(1), frac: Math.max(0, Math.min(1, g.comboTimer / win)),
        color: m >= 2.5 ? '#FF54AD' : (m >= 1.9 ? '#9875FF' : (m >= 1.4 ? '#EFCB63' : '#50F0FA')) };
    }
    if (!campaign && g.challenge) {
      s.challenge = { from: String(g.challenge.from).toUpperCase().slice(0, 12), score: g.challenge.score, mine: g.player.score,
        beaten: !!g.challengeBeaten, frac: Math.max(0, Math.min(1, g.player.score / g.challenge.score)) };
    }
    return s;
  }

  function html(s) {
    const B = layer === 'b';
    // Tier progress. A: one clean bar, the next tier named at its end.
    // B: a six-step ladder (T1..T6) -- finished steps full, the current one filling.
    let ladder;
    if (B) {
      ladder = '<div class="u-ladder">' + [1, 2, 3, 4, 5, 6].map(i => {
        const w = i < s.tierN ? 100 : i === s.tierN ? s.pct : 0;
        return `<i class="${i < s.tierN ? 'full' : i === s.tierN ? 'now' : ''}"><b style="width:${w}%"></b></i>`;
      }).join('') + '</div>';
    } else {
      ladder = `<div class="u-bar"><b style="width:${s.pct}%"></b></div><span class="u-next">${s.tierN < 6 ? 'T' + (s.tierN + 1) : 'MAX'}</span>`;
    }
    const core = `<div class="u-core${s.urgent ? ' urgent' : ''}" data-fade style="--tier:${s.tierColor}">
      <span class="u-time">${ICON.clock}<em>${esc(s.time)}</em></span>
      <span class="u-tier"><span class="u-badge">${esc(s.tier)}</span>${ladder}</span>
      <span class="u-score">${ICON.star}<em>${esc(s.score)}</em></span>
    </div>`;
    let right;
    if (s.campaign) {
      right = `<div class="u-goal" data-fade><div class="u-goal-head"><span>${esc(s.goalTitle)}</span><span class="u-chip">${esc(s.mission || '')}</span></div>` + s.goals.map(it => {
        let prog = '';
        if (it.n != null && it.n > 1 && !it.cls) {
          prog = B && it.n <= 8
            ? '<span class="u-pips">' + Array.from({ length: it.n }, (_, i) => `<i class="${i < it.p ? 'on' : ''}"></i>`).join('') + '</span>'
            : `<span class="u-gbar"><b style="width:${Math.min(100, it.p / it.n * 100)}%"></b></span>`;
        }
        return `<div class="u-goal-row${it.done ? ' done' : ''} ${it.cls}" style="--gc:${it.color || '#50F0FA'}"><span class="u-gicon"><svg viewBox="0 0 24 24">${it.icon.replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg></span><span class="u-glabel">${esc(it.label)}</span><span class="u-gcount">${esc(it.count)}</span>${prog}</div>`;
      }).join('') + '</div>';
    } else {
      const top = Math.max(1, ...s.rows.filter(r => !r.gap).map(r => +r.score || 0));
      right = `<div class="u-rank" data-fade><div class="u-rank-head"><span class="u-rank-title">${B ? ICON.trophy : ''}${s.daily ? 'WYZWANIE DNIA' : 'RANKING'}</span><span class="u-place">${esc(s.rank)}</span></div><ol>` + s.rows.map(r => r.gap
        ? '<li class="gap" aria-hidden="true">···</li>'
        : `<li class="${r.me ? 'me' : ''}${r.first ? ' first' : ''}" style="--p:${Math.round((+r.score || 0) / top * 100)}%"><span class="u-pos">${r.first ? ICON.crown : esc(r.rank.replace('#', ''))}</span><span class="u-name">${esc(r.name)}</span><span class="u-pts">${esc(r.score)}</span></li>`).join('') + '</ol></div>';
    }
    const combo = s.combo ? `<div class="u-combo" style="--cc:${s.combo.color}"><span class="u-combo-n">×${s.combo.n}</span><span class="u-combo-t"><b>COMBO</b><em>PKT ×${s.combo.m}</em></span><span class="u-combo-bar"><b style="width:${(s.combo.frac * 100).toFixed(1)}%"></b></span></div>` : '';
    const ch = s.challenge ? `<div class="u-challenge${s.challenge.beaten ? ' beaten' : ''}"><span class="u-ch-icon">${ICON.target}</span><span class="u-ch-t"><b>WYZWANIE · ${esc(s.challenge.from)}</b><em>${s.challenge.beaten ? 'POBITE' : `${s.challenge.mine} / ${s.challenge.score}`}</em></span><span class="u-ch-bar"><b style="width:${(s.challenge.frac * 100).toFixed(1)}%"></b></span></div>` : '';
    const nela = s.nela ? `<div class="u-nela"><span class="u-nela-av"><svg viewBox="0 0 40 40"><path d="M20 3l14.7 8.5v17L20 37 5.3 28.5v-17z" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="20" cy="20" r="7.5" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="20" cy="20" r="2.6" fill="currentColor"/></svg></span><span class="u-nela-body"><b>NELA</b><em>${esc(s.nela)}</em></span></div>` : '';
    const np = s.playing ? `<div class="u-np">${ICON.note}<em>${esc(s.playing)}</em></div>` : '';
    return `<div class="u-top"><div class="u-pause" aria-hidden="true"><i></i><i></i></div>${core}</div>${right}<div class="u-left">${combo}${ch}</div>${nela}${np}`;
  }

  /** The same rule as Game.fadeHudUnderHole(): a panel the vortex is under fades. */
  function fade(root) {
    const c = g.playerScreenCircle && g.playerScreenCircle();
    const k = g.uiScale || 1;
    root.querySelectorAll('[data-fade]').forEach(el => {
      let x = 0, y = 0;
      for (let a = el; a && a !== root; a = a.offsetParent) { x += a.offsetLeft; y += a.offsetTop; }
      const b = { l: x * k, t: y * k, r: (x + el.offsetWidth) * k, b: (y + el.offsetHeight) * k };
      el.classList.toggle('u-under', !!c && c.x + c.r > b.l && c.x - c.r < b.r && c.y + c.r > b.t && c.y - c.r < b.b);
    });
  }

  function render() {
    let root = $('ui1-hud');
    if (!root) { root = document.createElement('div'); root.id = 'ui1-hud'; $('hud').after(root); }
    root.className = 'ui1-' + layer + (g.mode === 'campaign' ? ' is-campaign' : '');
    root.innerHTML = html(read());
    fade(root);
  }

  /* ------------------------------------------------------------ the minimap
     Same rect (Game.minimapRect()), same size (Game.minimapSize()), same
     data as Game.drawMinimap() / drawCampaignMinimap(): every object, every
     rival (red = bigger than you, light = prey), you, the camera frame, the
     district name; a blackout mission still hides the entities. New is only
     how it is drawn: the real street grid (CITY_PITCH / CITY_ROAD) and the
     district map (CITY_DISTRICT_MAP), a frame, a hierarchy of markers. */
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function diamond(ctx, x, y, r) { ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }

  function drawMini(ctx, campaign) {
    const B = layer === 'b';
    const size = g.minimapSize(), rect = g.minimapRect(), px = rect.l, py = rect.t;
    const b = campaign ? CONFIG.campaign.bounds : { minX: 0, minY: 0, maxX: WORLD_W, maxY: WORLD_H };
    const sx = size / (b.maxX - b.minX), sy = size / (b.maxY - b.minY);
    const to = (x, y) => ({ x: px + (x - b.minX) * sx, y: py + (y - b.minY) * sy });
    const theme = campaign ? g.campaignTheme() : null;
    const districtOf = (i, j) => theme || CITY.keys[CITY.map[Math.max(0, Math.min(CITY.cells - 1, j))][Math.max(0, Math.min(CITY.cells - 1, i))]] || 'plac';
    const here = theme || districtOf(Math.floor(g.player.x / CITY.pitch), Math.floor(g.player.y / CITY.pitch));
    const colorOf = (d) => DISTRICT_COLORS[d] || '#50F0FA';
    const rad = B ? 9 : 7;
    ctx.save();
    ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    ctx.globalAlpha = g.hudFade('minimap', rect);

    // The plate.
    if (B) { ctx.save(); ctx.shadowColor = rgba(colorOf(here), 0.45); ctx.shadowBlur = 12; rr(ctx, px, py, size, size, rad); ctx.fillStyle = '#04101D'; ctx.fill(); ctx.restore(); }
    rr(ctx, px, py, size, size, rad);
    if (B) { const gr = ctx.createLinearGradient(px, py, px, py + size); gr.addColorStop(0, 'rgba(10, 32, 50, 0.96)'); gr.addColorStop(1, 'rgba(4, 16, 29, 0.96)'); ctx.fillStyle = gr; }
    else ctx.fillStyle = 'rgba(4, 12, 22, 0.88)';
    ctx.fill();
    ctx.save();
    rr(ctx, px, py, size, size, rad);
    ctx.clip();

    // Streets (the gaps between the blocks) and the blocks, tinted by district.
    const P = CITY.pitch, R = CITY.road;
    if (B) { ctx.fillStyle = 'rgba(80, 240, 250, 0.10)'; ctx.fillRect(px, py, size, size); }
    for (let j = 0; j < CITY.cells; j++) {
      for (let i = 0; i < CITY.cells; i++) {
        const x0 = Math.max(b.minX, i * P + R / 2), y0 = Math.max(b.minY, j * P + R / 2), x1 = Math.min(b.maxX, (i + 1) * P - R / 2), y1 = Math.min(b.maxY, (j + 1) * P - R / 2);
        if (x1 <= x0 || y1 <= y0) continue;
        const d = districtOf(i, j), col = colorOf(d), cur = !campaign && d === here;
        const a = to(x0, y0), w = (x1 - x0) * sx, h = (y1 - y0) * sy;
        rr(ctx, a.x, a.y, w, h, Math.min(B ? 2.2 : 1.6, w / 2, h / 2));
        ctx.fillStyle = '#071725';
        ctx.fill();
        ctx.fillStyle = rgba(col, campaign ? (B ? 0.26 : 0.2) : cur ? (B ? 0.46 : 0.38) : (B ? 0.24 : 0.19));
        ctx.fill();
        if (B && h > 4) { ctx.fillStyle = rgba(col, cur || campaign ? 0.5 : 0.22); ctx.fillRect(a.x + 1.2, a.y + 0.4, w - 2.4, 0.8); }
      }
    }
    if (B) {
      // Lane lines along the streets: the grid reads as roads, not as gaps.
      ctx.strokeStyle = 'rgba(242, 248, 255, 0.16)'; ctx.lineWidth = 0.6; ctx.setLineDash([2, 2]);
      for (let L = 1; L < CITY.cells; L++) {
        const v = to(L * P, b.minY), hz = to(b.minX, L * P);
        if (L * P > b.minX && L * P < b.maxX) { ctx.beginPath(); ctx.moveTo(v.x, py); ctx.lineTo(v.x, py + size); ctx.stroke(); }
        if (L * P > b.minY && L * P < b.maxY) { ctx.beginPath(); ctx.moveTo(px, hz.y); ctx.lineTo(px + size, hz.y); ctx.stroke(); }
      }
      ctx.setLineDash([]);
    }

    // Objects: all of them, as before -- small things quiet, big things clear.
    const dark = campaign && g.mission && g.mission.def.setup.dark;
    if (campaign) {
      for (const z of (g.glitchZones || [])) {
        const c = to(z.x, z.y);
        ctx.fillStyle = 'rgba(255, 84, 173, 0.3)';
        ctx.beginPath(); ctx.arc(c.x, c.y, z.r * sx, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255, 84, 173, 0.8)'; ctx.lineWidth = 0.8; ctx.stroke();
      }
      for (const e of g.campaignEntities) {
        if (e.consumed || !e.live || dark) continue;
        const p = to(e.x, e.y), col = g.campaignEntityColor(e);
        if (e.type === 'landmark') {
          ctx.fillStyle = '#04101D'; diamond(ctx, p.x, p.y, 5.6); ctx.fill();
          if (B) { ctx.shadowColor = col; ctx.shadowBlur = 6; }
          ctx.fillStyle = col; diamond(ctx, p.x, p.y, 4.2); ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#04101D'; diamond(ctx, p.x, p.y, 1.6); ctx.fill();
        } else if (e.type === 'node' || e.type === 'pylon' || e.type === 'gate') {
          ctx.fillStyle = '#04101D'; diamond(ctx, p.x, p.y, 3.6); ctx.fill();
          ctx.fillStyle = col; diamond(ctx, p.x, p.y, 2.6); ctx.fill();
        } else {
          ctx.globalAlpha *= 0.8; ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(p.x, p.y, 1.05, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha /= 0.8;
        }
      }
    } else {
      const late = [];
      for (const o of g.objects) {
        const def = TIERS[o.tier];
        if (o.tier === 'golden' || o.tier === 'node' || o.tier === 'pylon' || o.tier === 'landmark') { late.push(o); continue; }
        const p = to(o.x, o.y), small = (def.minSizeTier || 0) <= 1;
        ctx.globalAlpha *= small ? 0.55 : 0.9;
        ctx.fillStyle = def.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, small ? 0.75 : 1.15, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha /= small ? 0.55 : 0.9;
      }
      for (const o of late) {
        const p = to(o.x, o.y), gold = o.tier === 'golden', col = TIERS[o.tier].color;
        ctx.fillStyle = '#04101D'; diamond(ctx, p.x, p.y, gold ? 5.4 : 3.6); ctx.fill();
        if (B && gold) { ctx.shadowColor = col; ctx.shadowBlur = 7; }
        ctx.fillStyle = col; diamond(ctx, p.x, p.y, gold ? 4 : 2.6); ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // The camera frame (Arena: what the screen shows; Campaign: the game's fixed 16 px hint).
    const cam = to(g.camera.x, g.camera.y);
    const vw = campaign ? 16 : g.viewHalfW * 2 * sx, vh = campaign ? 16 : g.viewHalfH * 2 * sy;
    const vx = cam.x - vw / 2, vy = cam.y - vh / 2;
    if (B) {
      ctx.fillStyle = 'rgba(242, 248, 255, 0.07)'; ctx.fillRect(vx, vy, vw, vh);
      ctx.strokeStyle = 'rgba(242, 248, 255, 0.95)'; ctx.lineWidth = 1.2;
      const k = Math.min(4, vw / 3, vh / 3);
      for (const [cx, cy, dx, dy] of [[vx, vy, 1, 1], [vx + vw, vy, -1, 1], [vx, vy + vh, 1, -1], [vx + vw, vy + vh, -1, -1]]) { ctx.beginPath(); ctx.moveTo(cx + dx * k, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy * k); ctx.stroke(); }
    } else {
      ctx.strokeStyle = 'rgba(242, 248, 255, 0.6)'; ctx.lineWidth = 1;
      rr(ctx, vx, vy, vw, vh, 1.5); ctx.stroke();
    }

    // Rivals: bigger than you = red and solid, prey = a light ring. Then you.
    for (const bot of g.bots) {
      const p = to(bot.x, bot.y);
      const danger = bot.radius > g.player.radius * CONFIG.eating.holeRatio;
      ctx.fillStyle = '#04101D';
      ctx.beginPath(); ctx.arc(p.x, p.y, danger ? 4.6 : 3.8, 0, Math.PI * 2); ctx.fill();
      if (danger) {
        if (B) { ctx.shadowColor = '#ff3860'; ctx.shadowBlur = 6; }
        ctx.fillStyle = '#ff3860';
        ctx.beginPath(); ctx.arc(p.x, p.y, 3.4, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#04101D';
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(242, 248, 255, 0.95)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.7, 0, Math.PI * 2); ctx.stroke();
      }
    }
    const pp = to(g.player.x, g.player.y);
    if (B) {
      ctx.strokeStyle = 'rgba(80, 240, 250, 0.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(pp.x, pp.y, 8.5, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowColor = '#50F0FA'; ctx.shadowBlur = 8;
    }
    ctx.fillStyle = '#04101D';
    ctx.beginPath(); ctx.arc(pp.x, pp.y, 6.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#50F0FA';
    ctx.beginPath(); ctx.arc(pp.x, pp.y, 5.2, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(pp.x, pp.y, 2.9, 0, Math.PI * 2); ctx.fill();
    ctx.restore(); // clip

    // The frame.
    if (B) {
      const gr = ctx.createLinearGradient(px, py, px + size, py + size);
      gr.addColorStop(0, 'rgba(80, 240, 250, 0.95)'); gr.addColorStop(0.55, 'rgba(152, 117, 255, 0.7)'); gr.addColorStop(1, 'rgba(255, 84, 173, 0.8)');
      ctx.strokeStyle = gr; ctx.lineWidth = 1.5;
      rr(ctx, px + 0.75, py + 0.75, size - 1.5, size - 1.5, rad); ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)'; ctx.lineWidth = 1;
      rr(ctx, px + 2.5, py + 2.5, size - 5, size - 5, rad - 2); ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(242, 248, 255, 0.22)'; ctx.lineWidth = 1;
      rr(ctx, px + 0.5, py + 0.5, size - 1, size - 1, rad); ctx.stroke();
    }

    // The district name: where the game draws it (over the top-right corner).
    const d = DISTRICTS.find(x => x.id === here);
    if (d) {
      const label = d.name.toUpperCase(), col = colorOf(here);
      ctx.font = B ? `10px 'Russo One', 'Exo 2', sans-serif` : `800 9.5px 'Exo 2', 'Segoe UI', sans-serif`;
      const tw = ctx.measureText(label).width, w = tw + 21, h = 16, x = px + size - w, y = py - 20;
      rr(ctx, x, y, w, h, B ? 5 : 8);
      ctx.fillStyle = B ? 'rgba(4, 16, 29, 0.92)' : 'rgba(4, 12, 22, 0.82)'; ctx.fill();
      if (B) { ctx.strokeStyle = rgba(col, 0.75); ctx.lineWidth = 1; rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 5); ctx.stroke(); }
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x + 8.5, y + h / 2, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = B ? col : 'rgba(242, 248, 255, 0.92)';
      ctx.fillText(label, x + 15, y + h / 2 + 0.5);
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------ switching */
  function clear() {
    for (const n of OVERRIDES) delete g[n];
    const st = $('ui1-style'); if (st) st.remove();
    const root = $('ui1-hud'); if (root) root.remove();
    delete document.body.dataset.ui1;
    $('hud').style.visibility = '';
    g.hudFades = null;
  }
  window.__ui1Apply = function (l, css) {
    clear();
    layer = l;
    if (l === 'before') return;
    const st = document.createElement('style'); st.id = 'ui1-style'; st.textContent = css; document.head.appendChild(st);
    document.body.dataset.ui1 = l;
    g.drawMinimap = (ctx) => drawMini(ctx, false);
    g.drawCampaignMinimap = (ctx) => drawMini(ctx, true);
    g.drawComboHud = () => {};
    g.drawChallengeTarget = () => {};
    render();
  };
  window.__ui1Plate = function (on) {
    if (on) {
      for (const n of OVERRIDES) g[n] = () => {};
      $('hud').style.visibility = 'hidden';
      if ($('ui1-hud')) $('ui1-hud').style.visibility = 'hidden';
    } else {
      const l = layer, css = ($('ui1-style') || {}).textContent || '';
      window.__ui1Apply(l, css);
    }
  };
  /** The boxes (CSS px) each layer's panels cover -- how much of the board the HUD takes. */
  window.__ui1Boxes = function () {
    const k = g.uiScale || 1, out = [];
    const add = (name, el, root) => {
      if (!el || !el.offsetWidth || getComputedStyle(el).visibility === 'hidden') return;
      let x = 0, y = 0;
      for (let a = el; a && a !== root; a = a.offsetParent) { x += a.offsetLeft; y += a.offsetTop; }
      out.push({ name, w: +(el.offsetWidth * k).toFixed(1), h: +(el.offsetHeight * k).toFixed(1), x: +(x * k).toFixed(1), y: +(y * k).toFixed(1) });
    };
    if (layer === 'before') {
      const root = $('hud');
      [['pause', 'btnPause'], ['core', 'hud-tier-strip'], ['rank', 'hud-topright'], ['goal', 'hud-goal']].forEach(([n, id]) => { const el = $(id); if (el && !el.classList.contains('hidden')) add(n, el, root); });
      if ($('nelaToast').classList.contains('visible')) add('nela', $('nelaToast'), root);
    } else {
      const root = $('ui1-hud');
      [['pause', '.u-pause'], ['core', '.u-core'], ['rank', '.u-rank'], ['goal', '.u-goal'], ['nela', '.u-nela'], ['combo', '.u-combo'], ['challenge', '.u-challenge']].forEach(([n, q]) => add(n, root.querySelector(q), root));
    }
    return out;
  };
})();

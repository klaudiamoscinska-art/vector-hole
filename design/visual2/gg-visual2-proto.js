/* ============================================================================
   GG-VISUAL-01 -- "GLITCH GULP VISUAL 2.0" floor PROTOTYPE (not runtime code).

   This file is NOT loaded by index.html and is not part of any release. The
   evidence script (qa/visual2-shots.mjs) splices it into game.js in memory,
   just before the export list, so it runs in game.js's module scope and can
   use the game's own helpers (SeededRNG, cityHash, cityDistrict, rgbaColor,
   roundRectPath, ...). window.__GG_VISUAL picks the direction:
     'A' = "Nocna makieta"   -- material surfaces, one light from the NW,
                                relief (raised blocks, sunken water), paint.
     'B' = "Neonowy schemat" -- emissive line work on dark glass, the light
                                comes from the lines themselves.
   Anything else leaves the game exactly as it is.

   What it replaces: only paintCityChunk() -- the picture painted ONCE into a
   CityFloor chunk canvas. The chunk cache, the blit per frame, the camera,
   the objects, the holes, every rule and every RNG stream of a round are
   untouched: the floor has always drawn from its own cityHash() seeds.

   One language, twelve districts: a district is a RECIPE (a ground material
   + three motifs + its accent color), every motif is written once against a
   handful of primitives (slab / pit / ink / line), and a direction is just
   an implementation of those primitives + a material palette.
   ============================================================================ */
const GV2 = (() => {
  const style = typeof window !== 'undefined' ? window.__GG_VISUAL : null;
  if (style !== 'A' && style !== 'B') return null;
  const A = style === 'A';
  const P = CITY_PITCH, R = CITY_ROAD, W = CITY_WALK, B = CITY_BLEED;
  const TAU = Math.PI * 2;
  const SH = 5;             // A: how far a raised piece's shadow falls (SE)
  const INK = '#E2ECF6';    // A: road / court paint
  const STEEL = '#8FA6B8';  // neutral metal (never a tier color)
  let detail = 2;           // gfx level of the view asking for chunks (0 = low-end)

  const mixCache = new Map();
  function mix(a, b, t) {
    const key = a + b + t;
    let v = mixCache.get(key);
    if (v) return v;
    const x = hexToRgb(a), y = hexToRgb(b);
    v = '#' + x.map((n, k) => Math.round(n + (y[k] - n) * t).toString(16).padStart(2, '0')).join('');
    mixCache.set(key, v);
    return v;
  }

  /* ---- materials: the same eight surfaces everywhere in the city ---- */
  const MATERIALS = {
    asphalt: { A: '#070d17', B: '#03080f' },
    walk: { A: '#132233', B: '#07121e' },
    paving: { A: '#0e1c28', B: '#050f19' },
    grass: { A: '#0a241d', B: '#04130f' },
    deck: { A: '#111a23', B: '#060d15' },
    gallery: { A: '#16122a', B: '#0a0715' },
    roof: { A: '#12182c', B: '#070a18' },
    board: { A: '#0c1823', B: '#040c14' },
    water: { A: '#12405c', B: '#031322' }
  };
  const mat = (kind, col, t) => mix(MATERIALS[kind][style], col, t == null ? (A ? 0.1 : 0.045) : t);

  /* ---- recipes: what a district is made of ---- */
  const RECIPES = {
    plac: { ground: 'paving', motifs: ['emblem', 'strips', 'fountain'] },
    park: { ground: 'grass', motifs: ['path', 'pond', 'pitch'] },
    port: { ground: 'deck', motifs: ['containers', 'basin', 'parking'] },
    galeria: { ground: 'gallery', motifs: ['checker', 'mural', 'rosette'] },
    dachy: { ground: 'roof', motifs: ['helipad', 'solar', 'vents'] },
    rdzen: { ground: 'board', motifs: ['circuit', 'circuit', 'circuit'] },
    // Rozdział II: the sibling's material, one motif of its own.
    metro: { ground: 'board', motifs: ['tracks', 'circuit', 'tracks'] },
    bazar: { ground: 'paving', motifs: ['stalls', 'strips', 'fountain'] },
    fabryka: { ground: 'deck', motifs: ['pipes', 'basin', 'containers'] },
    zatoka: { ground: 'gallery', motifs: ['holo', 'mural', 'rosette'] },
    ogrody: { ground: 'grass', motifs: ['terraces', 'pond', 'path'] },
    chmura: { ground: 'roof', motifs: ['racks', 'solar', 'helipad'] }
  };

  /* ---- primitives: the whole difference between the two directions ---- */
  const rr = (c, x, y, w, h, r) => roundRectPath(c, x, y, w, h, r);

  /** Strokes the current path: A = flat paint, B = an emissive line (a soft
   *  wide band under a crisp core -- pre-baked, never shadowBlur). */
  function line(c, col, a, w) {
    if (A) { c.strokeStyle = rgbaColor(col, a); c.lineWidth = w; c.stroke(); return; }
    c.strokeStyle = rgbaColor(col, a * 0.28); c.lineWidth = w + 4; c.stroke();
    c.strokeStyle = rgbaColor(col, Math.min(0.6, a * 1.5)); c.lineWidth = Math.max(1, w * 0.7); c.stroke();
  }
  /** Marking paint color: A = off-white paint, B = the district's light. */
  const ink = (col, a) => (A ? rgbaColor(INK, a) : rgbaColor(col, Math.min(0.5, a * 1.3)));

  /** A raised piece. A: shadow to the SE + lit NW edges. B: an outlined pane. */
  function slab(c, x, y, w, h, r, fill, col, lift = 0.6, a = 0.28) {
    if (A) {
      c.fillStyle = 'rgba(0, 0, 0, 0.36)'; rr(c, x + SH * lift, y + SH * lift, w, h, r); c.fill();
      c.fillStyle = fill; rr(c, x, y, w, h, r); c.fill();
      c.strokeStyle = 'rgba(200, 225, 245, 0.17)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(x + r, y + 0.6); c.lineTo(x + w - r, y + 0.6); c.moveTo(x + 0.6, y + r); c.lineTo(x + 0.6, y + h - r); c.stroke();
    } else {
      c.fillStyle = fill; rr(c, x, y, w, h, r); c.fill();
      c.strokeStyle = rgbaColor(col, a); c.lineWidth = 1.2; rr(c, x + 0.5, y + 0.5, w - 1, h - 1, r); c.stroke();
    }
  }
  /** A sunken shape (water). A: the NW wall shades the bottom. B: a broken
   *  outline. Never a dark disc inside a bright ring -- that is a hole. */
  function pit(c, path, fill, col) {
    c.fillStyle = fill; path(); c.fill();
    if (A) {
      c.save(); path(); c.clip();
      c.strokeStyle = 'rgba(0, 0, 0, 0.3)'; c.lineWidth = 9;
      c.translate(SH * 0.5, SH * 0.5); path(); c.stroke();
      c.restore();
    } else {
      c.setLineDash([10, 7]); path(); line(c, col, 0.26, 2); c.setLineDash([]);
    }
  }
  function ripples(c, cx, cy, rx, ry, rng, n) {
    c.strokeStyle = A ? 'rgba(170, 220, 245, 0.13)' : 'rgba(80, 240, 250, 0.13)'; c.lineWidth = 1.3;
    c.beginPath();
    for (let k = 0; k < n; k++) {
      const wx = cx + (rng.next() - 0.5) * rx * 1.5, wy = cy + (rng.next() - 0.5) * ry * 1.5;
      c.moveTo(wx - 7, wy); c.quadraticCurveTo(wx, wy - 4, wx + 7, wy);
    }
    c.stroke();
  }

  /* ---- ground textures (skipped on the low-end level) ---- */
  const GROUNDS = {
    paving(c, x, y, s, col, rng) {
      if (A) {
        const t = 41;
        for (let a = 0; a * t < s; a++) for (let b = 0; b * t < s; b++) {
          const q = cityHash(a, b, 9) % 5;
          if (q > 1) continue;
          c.fillStyle = q ? 'rgba(255, 255, 255, 0.022)' : 'rgba(0, 0, 0, 0.1)';
          c.fillRect(x + a * t, y + b * t, t, t);
        }
        c.strokeStyle = 'rgba(0, 0, 0, 0.2)'; c.lineWidth = 1;
        c.beginPath();
        for (let k = t; k < s; k += t) { c.moveTo(x + k, y); c.lineTo(x + k, y + s); c.moveTo(x, y + k); c.lineTo(x + s, y + k); }
        c.stroke();
      } else {
        c.fillStyle = rgbaColor(col, 0.13);
        for (let a = 12; a < s; a += 24) for (let b = 12; b < s; b += 24) c.fillRect(x + a - 0.8, y + b - 0.8, 1.6, 1.6);
      }
    },
    grass(c, x, y, s, col, rng) {
      if (A) {
        for (let k = 0; k < 16; k++) {
          c.fillStyle = k % 2 ? 'rgba(90, 220, 160, 0.03)' : 'rgba(0, 0, 0, 0.09)';
          c.beginPath(); c.ellipse(x + rng.next() * s, y + rng.next() * s, 26 + rng.next() * 44, 16 + rng.next() * 26, rng.next() * 3, 0, TAU); c.fill();
        }
        for (let k = 0; k < 110; k++) {
          c.fillStyle = rgbaColor(col, 0.05 + rng.next() * 0.07);
          c.fillRect(x + rng.next() * s, y + rng.next() * s, 1.6, 1.6);
        }
      } else {
        c.strokeStyle = rgbaColor(col, 0.15); c.lineWidth = 1;
        c.beginPath();
        for (let k = 0; k < 80; k++) { const gx = x + rng.next() * s, gy = y + rng.next() * s; c.moveTo(gx, gy); c.lineTo(gx + 2, gy - 5); c.moveTo(gx + 3, gy); c.lineTo(gx + 4, gy - 4); }
        c.stroke();
      }
    },
    deck(c, x, y, s, col, rng) {
      if (A) {
        c.strokeStyle = 'rgba(0, 0, 0, 0.22)'; c.lineWidth = 1.5;
        c.beginPath();
        for (let k = 72; k < s; k += 72) { c.moveTo(x + k, y); c.lineTo(x + k, y + s); c.moveTo(x, y + k); c.lineTo(x + s, y + k); }
        c.stroke();
        for (let k = 0; k < 7; k++) {
          c.fillStyle = 'rgba(0, 0, 0, 0.08)';
          c.beginPath(); c.ellipse(x + rng.next() * s, y + rng.next() * s, 14 + rng.next() * 26, 8 + rng.next() * 12, rng.next() * 3, 0, TAU); c.fill();
        }
      } else {
        c.strokeStyle = rgbaColor(col, 0.05); c.lineWidth = 1;
        c.beginPath();
        for (let k = -s; k < s; k += 22) { c.moveTo(x + k, y); c.lineTo(x + k + s, y + s); }
        c.stroke();
      }
    },
    gallery(c, x, y, s, col, rng) {
      c.strokeStyle = A ? 'rgba(0, 0, 0, 0.2)' : rgbaColor(col, 0.07); c.lineWidth = 1;
      c.beginPath();
      for (let k = -s; k < s; k += 48) { c.moveTo(x + k, y); c.lineTo(x + k + s, y + s); c.moveTo(x + k + s, y); c.lineTo(x + k, y + s); }
      c.stroke();
    },
    roof(c, x, y, s, col, rng) {
      if (A) {
        c.strokeStyle = 'rgba(0, 0, 0, 0.18)'; c.lineWidth = 1;
        c.beginPath();
        for (let k = 38; k < s; k += 38) { c.moveTo(x, y + k); c.lineTo(x + s, y + k); }
        c.stroke();
      } else {
        c.fillStyle = rgbaColor(col, 0.1);
        for (let a = 16; a < s; a += 32) for (let b = 16; b < s; b += 32) c.fillRect(x + a - 2.5, y + b - 0.5, 5, 1);
      }
    },
    board(c, x, y, s, col, rng) {
      c.fillStyle = A ? 'rgba(0, 0, 0, 0.22)' : rgbaColor(col, 0.12);
      for (let a = 12; a < s; a += 24) for (let b = 12; b < s; b += 24) c.fillRect(x + a - 1, y + b - 1, 2, 2);
    }
  };

  /* ---- motifs: written once, drawn by both directions ---- */
  const MOTIFS = {
    emblem(c, x, y, s, col, rng) {
      const cx = x + s / 2, cy = y + s / 2, r = s * 0.27;
      if (A) {
        c.fillStyle = 'rgba(255, 255, 255, 0.035)'; c.beginPath(); c.arc(cx, cy, r * 1.22, 0, TAU); c.fill();
        c.fillStyle = mat('paving', col, 0.2); c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
      }
      c.beginPath(); c.arc(cx, cy, r, 0, TAU); line(c, col, 0.26, 3);
      c.beginPath(); c.arc(cx, cy, r * 0.66, 0, TAU); line(c, col, 0.13, 1.5);
      // A four-point star: the plaza's compass, inlaid in the paving.
      c.fillStyle = rgbaColor(col, A ? 0.13 : 0.07);
      c.beginPath();
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 - Math.PI / 2, rad = k % 2 ? r * 0.2 : r * 0.62; c.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); }
      c.closePath(); c.fill();
      if (!A) line(c, col, 0.2, 1.2);
      c.beginPath();
      for (let k = 0; k < 12; k++) {
        const a = k * Math.PI / 6;
        c.moveTo(cx + Math.cos(a) * r * 0.76, cy + Math.sin(a) * r * 0.76);
        c.lineTo(cx + Math.cos(a) * r * (k % 3 ? 0.86 : 0.95), cy + Math.sin(a) * r * (k % 3 ? 0.86 : 0.95));
      }
      line(c, col, 0.14, 1.5);
    },
    strips(c, x, y, s, col, rng) {
      const horiz = rng.next() < 0.5;
      for (const f of [0.3, 0.7]) {
        const bx = horiz ? x + s * 0.1 : x + s * f - 9, by = horiz ? y + s * f - 9 : y + s * 0.1, bw = horiz ? s * 0.8 : 18, bh = horiz ? 18 : s * 0.8;
        if (A) { c.fillStyle = 'rgba(0, 0, 0, 0.2)'; c.fillRect(bx, by, bw, bh); }
        c.fillStyle = rgbaColor(col, A ? 0.2 : 0.12);
        if (horiz) c.fillRect(bx + 6, by + 7, bw - 12, 4); else c.fillRect(bx + 7, by + 6, 4, bh - 12);
        if (!A) { c.strokeStyle = rgbaColor(col, 0.22); c.lineWidth = 1; c.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1); }
      }
      // Planter beds between the strips (flat, the lot's own tone).
      for (const f of [0.18, 0.5, 0.82]) {
        const px = horiz ? x + s * f - 22 : x + s * 0.5 - 12, py = horiz ? y + s * 0.5 - 12 : y + s * f - 22;
        slab(c, px, py, horiz ? 44 : 24, horiz ? 24 : 44, 5, mat('grass', col, 0.08), col, 0.4, 0.2);
      }
    },
    fountain(c, x, y, s, col, rng) {
      const cx = x + s / 2, cy = y + s / 2, r = s * 0.19;
      c.beginPath();
      for (let q = r + 26; q < s * 0.7; q += 26) { c.moveTo(cx + q, cy); c.arc(cx, cy, q, 0, TAU); }
      line(c, A ? '#000000' : col, A ? 0.16 : 0.07, 1);
      if (A) { c.fillStyle = 'rgba(0, 0, 0, 0.18)'; c.beginPath(); c.arc(cx, cy, r + 9, 0, TAU); c.fill(); }
      pit(c, () => { c.beginPath(); c.arc(cx, cy, r, 0, TAU); }, mat('water', col, 0.12), col);
      ripples(c, cx, cy, r, r, rng, 6);
      c.fillStyle = rgbaColor(col, 0.22); c.beginPath(); c.arc(cx, cy, 4, 0, TAU); c.fill();
    },
    path(c, x, y, s, col, rng) {
      const sx = x + rng.next() * s * 0.3, ex = x + s * 0.7 + rng.next() * s * 0.3;
      const trace = () => { c.beginPath(); c.moveTo(sx, y - 10); c.bezierCurveTo(x + s * 1.05, y + s * 0.3, x - s * 0.05, y + s * 0.7, ex, y + s + 10); };
      c.lineCap = 'round';
      if (A) {
        c.strokeStyle = 'rgba(0, 0, 0, 0.28)'; c.lineWidth = 22; c.save(); c.translate(2, 2); trace(); c.stroke(); c.restore();
        c.strokeStyle = mix('#2a3a3c', col, 0.12); c.lineWidth = 19; trace(); c.stroke();
        c.strokeStyle = 'rgba(255, 255, 255, 0.05)'; c.lineWidth = 1.5; c.setLineDash([3, 9]); trace(); c.stroke(); c.setLineDash([]);
      } else {
        c.strokeStyle = rgbaColor(col, 0.2); c.lineWidth = 20; trace(); c.stroke();
        c.strokeStyle = mat('grass', col); c.lineWidth = 17; trace(); c.stroke();
        c.strokeStyle = rgbaColor(col, 0.16); c.lineWidth = 1; c.setLineDash([6, 8]); trace(); c.stroke(); c.setLineDash([]);
      }
      c.lineCap = 'butt';
      for (let k = 0; k < 3; k++) {
        const fx = x + 44 + rng.next() * (s - 88), fy = y + 44 + rng.next() * (s - 88), rot = rng.next() * 3;
        const bed = () => { c.beginPath(); c.ellipse(fx, fy, 24, 14, rot, 0, TAU); };
        if (A) { c.fillStyle = 'rgba(0, 0, 0, 0.26)'; c.save(); c.translate(3, 3); bed(); c.fill(); c.restore(); }
        c.fillStyle = A ? mix('#113229', col, 0.1) : mat('grass', col, 0.12); bed(); c.fill();
        c.strokeStyle = 'rgba(255, 84, 173, 0.2)'; c.lineWidth = 1.3; bed(); c.stroke();
        c.fillStyle = 'rgba(255, 84, 173, 0.24)';
        for (let n = 0; n < 7; n++) c.fillRect(fx + (rng.next() - 0.5) * 32, fy + (rng.next() - 0.5) * 15, 2.2, 2.2);
      }
    },
    pond(c, x, y, s, col, rng) {
      const cx = x + s / 2, cy = y + s / 2;
      const shore = () => { c.beginPath(); c.ellipse(cx, cy, s * 0.37, s * 0.3, 0, 0, TAU); };
      if (A) { c.fillStyle = mix('#2a3a3c', col, 0.12); shore(); c.fill(); } else { shore(); line(c, col, 0.12, 9); }
      pit(c, () => { c.beginPath(); c.ellipse(cx, cy, s * 0.3, s * 0.23, 0, 0, TAU); }, mat('water', col, 0.1), col);
      ripples(c, cx, cy, s * 0.28, s * 0.2, rng, 9);
      // Lily pads: flat leaves, the lawn's tone.
      for (let k = 0; k < 4; k++) {
        const a = rng.next() * TAU, d = 0.25 + rng.next() * 0.5;
        c.fillStyle = rgbaColor(col, A ? 0.2 : 0.14);
        c.beginPath(); c.arc(cx + Math.cos(a) * s * 0.26 * d, cy + Math.sin(a) * s * 0.19 * d, 5, 0.4, TAU); c.fill();
      }
    },
    pitch(c, x, y, s, col, rng) {
      const cx = x + s / 2, cy = y + s / 2, m = 24;
      if (A) {
        c.fillStyle = mix('#0f3328', col, 0.1); c.fillRect(x + m, y + m, s - 2 * m, s - 2 * m);
        c.fillStyle = 'rgba(0, 0, 0, 0.1)';
        for (let k = m; k < s - m; k += 40) c.fillRect(x + k, y + m, 20, s - 2 * m);
      } else {
        c.fillStyle = rgbaColor(col, 0.04);
        for (let k = m; k < s - m; k += 40) c.fillRect(x + k, y + m, 20, s - 2 * m);
      }
      c.beginPath();
      c.rect(x + m, y + m, s - 2 * m, s - 2 * m);
      c.moveTo(x + m, cy); c.lineTo(x + s - m, cy);
      c.moveTo(cx + 30, cy); c.arc(cx, cy, 30, 0, TAU);
      c.rect(cx - 42, y + m, 84, 36); c.rect(cx - 42, y + s - m - 36, 84, 36);
      c.strokeStyle = ink(col, 0.17); c.lineWidth = 2; c.stroke();
    },
    containers(c, x, y, s, col, rng) {
      const tones = ['#8FA6B8', '#6E8798', '#A4B6C4'];
      for (let row = 0; row < 6; row++) {
        for (let k = 0; k < 4; k++) {
          if (rng.next() < 0.2) continue;
          const tone = tones[Math.floor(rng.next() * tones.length)];
          const bx = x + 14 + k * 67, by = y + 16 + row * 45;
          slab(c, bx, by, 58, 30, 2, A ? mix(MATERIALS.deck.A, tone, 0.2) : rgbaColor(tone, 0.05), tone, 0.5, 0.18);
          c.strokeStyle = A ? 'rgba(0, 0, 0, 0.2)' : rgbaColor(tone, 0.08); c.lineWidth = 1;
          c.beginPath();
          for (let n = 1; n < 6; n++) { c.moveTo(bx + n * 9.6, by + 3); c.lineTo(bx + n * 9.6, by + 27); }
          c.stroke();
        }
      }
    },
    basin(c, x, y, s, col, rng) {
      pit(c, () => { c.beginPath(); c.rect(x - 4, y + 24, s + 8, s); }, mat('water', col, 0.06), col);
      ripples(c, x + s / 2, y + s / 2 + 12, s * 0.62, s * 0.56, rng, 30);
      // The quay: a concrete edge with mooring bollards and a painted line.
      c.fillStyle = A ? mix(MATERIALS.walk.A, col, 0.1) : mat('deck', col, 0.1); c.fillRect(x, y, s, 24);
      c.beginPath(); c.moveTo(x, y + 24); c.lineTo(x + s, y + 24); line(c, col, 0.3, 2);
      c.strokeStyle = ink(col, 0.1); c.lineWidth = 1;
      c.beginPath();
      for (let k = 12; k < s; k += 12) { c.moveTo(x + k, y + 2); c.lineTo(x + k, y + 9); }
      c.stroke();
      c.fillStyle = rgbaColor(col, 0.4);
      for (let k = 30; k < s; k += 60) { c.beginPath(); c.arc(x + k, y + 17, 3, 0, TAU); c.fill(); }
    },
    parking(c, x, y, s, col, rng) {
      c.beginPath();
      for (const row of [0.08, 0.58]) {
        const ry = y + s * row;
        c.moveTo(x + 14, ry + s * 0.34); c.lineTo(x + s - 14, ry + s * 0.34);
        for (let k = 14; k <= s - 14; k += 30) { c.moveTo(x + k, ry); c.lineTo(x + k, ry + s * 0.34); }
      }
      c.strokeStyle = ink(col, 0.15); c.lineWidth = 2; c.stroke();
      c.font = `120px ${FONT_DISPLAY}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = ink(col, 0.06); c.fillText('P', x + s / 2, y + s / 2 + 6);
    },
    checker(c, x, y, s, col, rng) {
      const t = 36;
      for (let a = 0; a * t < s; a++) for (let b = 0; b * t < s; b++) {
        if ((a + b) % 2) { c.fillStyle = rgbaColor(col, A ? 0.075 : 0.05); c.fillRect(x + a * t, y + b * t, t, t); }
        else if (A) { c.fillStyle = 'rgba(0, 0, 0, 0.12)'; c.fillRect(x + a * t, y + b * t, t, t); }
      }
      if (!A) {
        c.strokeStyle = rgbaColor(col, 0.1); c.lineWidth = 1; c.beginPath();
        for (let k = t; k < s; k += t) { c.moveTo(x + k, y); c.lineTo(x + k, y + s); c.moveTo(x, y + k); c.lineTo(x + s, y + k); }
        c.stroke();
      }
    },
    mural(c, x, y, s, col, rng) {
      const cols = [col, cityTone('#50F0FA'), cityTone('#9875FF')];
      for (let k = 0; k < 9; k++) {
        const px = x + rng.next() * s, py = y + rng.next() * s, r = 30 + rng.next() * 60, cc = cols[k % 3];
        c.beginPath(); c.moveTo(px, py - r); c.lineTo(px + r * 0.9, py + r * 0.6); c.lineTo(px - r * 0.9, py + r * 0.6); c.closePath();
        c.fillStyle = rgbaColor(cc, (A ? 0.09 : 0.04) + rng.next() * 0.06); c.fill();
        if (!A) { c.strokeStyle = rgbaColor(cc, 0.2); c.lineWidth = 1; c.stroke(); }
      }
      for (let k = 0; k < 7; k++) {
        c.fillStyle = rgbaColor(cols[k % 3], 0.12 + rng.next() * 0.1);
        c.fillRect(x + rng.next() * s * 0.5, y + rng.next() * s, s * (0.2 + rng.next() * 0.4), 2 + rng.next() * 7);
      }
    },
    rosette(c, x, y, s, col, rng) {
      const cx = x + s / 2, cy = y + s / 2, r = s * 0.38;
      c.fillStyle = A ? mix(MATERIALS.gallery.A, col, 0.2) : 'rgba(152, 117, 255, 0.05)';
      c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
      for (let k = 0; k < 16; k += 2) {
        const a = k * Math.PI / 8;
        c.fillStyle = rgbaColor(col, A ? 0.07 : 0.045);
        c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, r, a, a + Math.PI / 8); c.closePath(); c.fill();
      }
      c.beginPath(); c.arc(cx, cy, r, 0, TAU); line(c, col, 0.2, 2);
      c.beginPath();
      for (const f of [0.35, 0.7]) { c.moveTo(cx + r * f, cy); c.arc(cx, cy, r * f, 0, TAU); }
      line(c, col, 0.1, 1.2);
    },
    helipad(c, x, y, s, col, rng) {
      const cx = x + s / 2, cy = y + s / 2;
      if (A) { c.fillStyle = 'rgba(0, 0, 0, 0.16)'; c.beginPath(); c.arc(cx, cy, s * 0.33, 0, TAU); c.fill(); }
      c.beginPath(); c.arc(cx, cy, s * 0.27, 0, TAU);
      c.strokeStyle = ink(col, 0.26); c.lineWidth = 4; c.stroke();
      c.lineWidth = 7;
      c.beginPath();
      c.moveTo(cx - 22, cy - 28); c.lineTo(cx - 22, cy + 28); c.moveTo(cx + 22, cy - 28); c.lineTo(cx + 22, cy + 28); c.moveTo(cx - 22, cy); c.lineTo(cx + 22, cy);
      c.stroke();
      c.fillStyle = 'rgba(239, 203, 99, 0.42)';
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; c.beginPath(); c.arc(cx + Math.cos(a) * s * 0.33, cy + Math.sin(a) * s * 0.33, 2.2, 0, TAU); c.fill(); }
    },
    solar(c, x, y, s, col, rng) {
      for (let row = 0; row < 7; row++) {
        for (let k = 0; k < 5; k++) {
          const bx = x + 20 + k * 50, by = y + 20 + row * 36;
          slab(c, bx, by, 44, 28, 1, A ? '#101f47' : '#0a1230', '#9875FF', 0.35, 0.26);
          c.strokeStyle = A ? 'rgba(150, 175, 255, 0.14)' : 'rgba(152, 117, 255, 0.22)'; c.lineWidth = 1;
          c.beginPath(); c.moveTo(bx + 22, by + 2); c.lineTo(bx + 22, by + 26); c.moveTo(bx + 2, by + 14); c.lineTo(bx + 42, by + 14); c.stroke();
        }
      }
    },
    vents(c, x, y, s, col, rng) {
      c.beginPath();
      let px = x + 20, py = y + 20 + rng.next() * (s - 40);
      c.moveTo(px, py);
      for (let k = 0; k < 4; k++) { px += 40 + rng.next() * 40; c.lineTo(px, py); py = y + 20 + rng.next() * (s - 40); c.lineTo(px, py); }
      if (A) { c.strokeStyle = 'rgba(0, 0, 0, 0.3)'; c.lineWidth = 7; c.stroke(); c.strokeStyle = mix(MATERIALS.roof.A, STEEL, 0.22); c.lineWidth = 4; c.stroke(); } else line(c, col, 0.14, 3);
      for (let k = 0; k < 5; k++) {
        const w = 24 + rng.next() * 22, bx = x + 16 + rng.next() * (s - w - 32), by = y + 16 + rng.next() * (s - w - 32);
        slab(c, bx, by, w, w, 2, A ? mix(MATERIALS.roof.A, STEEL, 0.14) : '#0c1024', STEEL, 0.7, 0.2);
        c.strokeStyle = A ? 'rgba(0, 0, 0, 0.3)' : 'rgba(164, 182, 196, 0.1)'; c.lineWidth = 1.2;
        c.beginPath(); for (let g = 5; g < w - 3; g += 5) { c.moveTo(bx + 4, by + g); c.lineTo(bx + w - 4, by + g); } c.stroke();
      }
    },
    circuit(c, x, y, s, col, rng, v) {
      const snap = (n) => Math.round(n / 12) * 12;
      for (let k = 0; k < 14; k++) {
        const tc = k % 4 ? col : cityTone('#50F0FA');
        let px = x + snap(rng.next() * s), py = y + snap(rng.next() * s);
        c.beginPath(); c.moveTo(px, py);
        for (let n = 0; n < 3 + Math.floor(rng.next() * 3); n++) {
          const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1]];
          const [dx, dy] = dirs[Math.floor(rng.next() * dirs.length)];
          const len = 24 + snap(rng.next() * 48);
          px = clamp(px + dx * len, x + 8, x + s - 8); py = clamp(py + dy * len, y + 8, y + s - 8);
          c.lineTo(px, py);
        }
        if (A) { c.strokeStyle = 'rgba(0, 0, 0, 0.28)'; c.lineWidth = 4.5; c.stroke(); c.strokeStyle = rgbaColor(tc, 0.3); c.lineWidth = 2; c.stroke(); } else line(c, tc, 0.16, 1.5);
        c.fillStyle = rgbaColor(tc, 0.34); c.beginPath(); c.arc(px, py, 3, 0, TAU); c.fill();
      }
      for (let k = 0; k <= v; k++) {
        const w = 44 + rng.next() * 20, bx = x + 20 + rng.next() * (s - w - 40), by = y + 20 + rng.next() * (s - w - 40);
        c.strokeStyle = rgbaColor(col, 0.2); c.lineWidth = 1.2;
        c.beginPath();
        for (let p = 8; p < w - 4; p += 8) { c.moveTo(bx + p, by); c.lineTo(bx + p, by - 6); c.moveTo(bx + p, by + w); c.lineTo(bx + p, by + w + 6); }
        c.stroke();
        slab(c, bx, by, w, w, 3, A ? '#16283a' : '#0a141f', cityTone('#50F0FA'), 0.6, 0.28);
      }
    },
    /* -- Rozdział II sketches: one motif each, from the same primitives -- */
    tracks(c, x, y, s, col, rng) {
      for (const f of [0.3, 0.7]) {
        const ty = y + s * f;
        if (A) { c.fillStyle = 'rgba(0, 0, 0, 0.22)'; c.fillRect(x, ty - 20, s, 40); }
        c.strokeStyle = A ? mix(MATERIALS.board.A, STEEL, 0.16) : rgbaColor(col, 0.09); c.lineWidth = 4;
        c.beginPath(); for (let k = 8; k < s; k += 16) { c.moveTo(x + k, ty - 14); c.lineTo(x + k, ty + 14); } c.stroke();
        c.beginPath(); c.moveTo(x, ty - 9); c.lineTo(x + s, ty - 9); c.moveTo(x, ty + 9); c.lineTo(x + s, ty + 9);
        line(c, A ? STEEL : col, A ? 0.4 : 0.22, 2);
      }
      // Platform edge: the tactile strip between the two tracks.
      c.fillStyle = 'rgba(239, 203, 99, 0.2)';
      for (let k = 6; k < s; k += 12) { c.fillRect(x + k, y + s * 0.5 - 22, 7, 3); c.fillRect(x + k, y + s * 0.5 + 19, 7, 3); }
    },
    stalls(c, x, y, s, col, rng) {
      for (let row = 0; row < 3; row++) for (let k = 0; k < 3; k++) {
        if (rng.next() < 0.15) continue;
        const bx = x + 22 + k * 86, by = y + 26 + row * 88, w = 70, h = 52;
        slab(c, bx, by, w, h, 4, A ? mix(MATERIALS.paving.A, col, 0.2) : rgbaColor(col, 0.04), col, 0.8, 0.24);
        c.fillStyle = rgbaColor(k % 2 ? col : cityTone('#FF54AD'), A ? 0.2 : 0.12);
        for (let q = 0; q < w - 6; q += 16) c.fillRect(bx + 3 + q, by + 3, 8, h - 6);
      }
    },
    pipes(c, x, y, s, col, rng) {
      for (let k = 0; k < 4; k++) {
        const py = y + 30 + k * (s - 60) / 3, bend = x + s * (0.3 + rng.next() * 0.4), drop = (k % 2 ? -1 : 1) * 26;
        c.beginPath(); c.moveTo(x, py); c.lineTo(bend, py); c.lineTo(bend, py + drop); c.lineTo(x + s, py + drop);
        if (A) { c.strokeStyle = 'rgba(0, 0, 0, 0.3)'; c.lineWidth = 12; c.save(); c.translate(3, 3); c.stroke(); c.restore(); c.strokeStyle = mix(MATERIALS.deck.A, STEEL, 0.24); c.lineWidth = 9; c.stroke(); c.strokeStyle = 'rgba(210, 228, 245, 0.12)'; c.lineWidth = 1.5; c.save(); c.translate(-2, -2); c.stroke(); c.restore(); } else { line(c, STEEL, 0.14, 9); c.strokeStyle = MATERIALS.deck.B; c.lineWidth = 5; c.stroke(); }
        c.fillStyle = rgbaColor(col, 0.3); c.beginPath(); c.arc(bend, py, 5, 0, TAU); c.fill();
      }
    },
    holo(c, x, y, s, col, rng) {
      const cx = x + s / 2, cy = y + s / 2;
      pit(c, () => { c.beginPath(); c.rect(x + 20, y + 20, s - 40, s - 40); }, mat('water', col, 0.2), col);
      c.beginPath();
      for (let k = 0; k < 6; k++) {
        const wy = y + 44 + k * (s - 88) / 5;
        c.moveTo(x + 30, wy);
        for (let q = 0; q <= 8; q++) c.lineTo(x + 30 + q * (s - 60) / 8, wy + Math.sin(q * 1.3 + k) * 7);
      }
      line(c, col, 0.2, 1.5);
      c.beginPath(); c.arc(cx, cy, 34, 0, TAU); c.moveTo(cx + 20, cy); c.arc(cx, cy, 20, 0, TAU); line(c, cityTone('#50F0FA'), 0.2, 1.5);
    },
    terraces(c, x, y, s, col, rng) {
      const cx = x + s / 2, cy = y + s / 2;
      [0.44, 0.33, 0.22, 0.11].forEach((f, k) => {
        const w = s * f * 2;
        slab(c, cx - w / 2, cy - w / 2, w, w, w * 0.28, A ? mix(MATERIALS.grass.A, col, 0.08 + k * 0.05) : rgbaColor(col, 0.03 + k * 0.012), col, 0.7, 0.22);
      });
      c.fillStyle = 'rgba(255, 84, 173, 0.24)';
      for (let k = 0; k < 14; k++) { const a = rng.next() * TAU, d = s * (0.14 + rng.next() * 0.26); c.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2.2, 2.2); }
    },
    racks(c, x, y, s, col, rng) {
      for (let k = 0; k < 5; k++) {
        const bx = x + 22 + k * 52, by = y + 20;
        slab(c, bx, by, 34, s - 40, 3, A ? mix(MATERIALS.roof.A, STEEL, 0.12) : '#0a0f1e', col, 0.7, 0.24);
        for (let q = 8; q < s - 52; q += 12) {
          c.fillStyle = cityHash(k, q, 5) % 4 ? rgbaColor(col, 0.16) : 'rgba(70, 217, 154, 0.3)';
          c.fillRect(bx + 6, by + q, 22, 3);
        }
      }
    }
  };

  /* ---- the chunk: the same world-space features as the classic painter ---- */
  function paintChunk(c, i, j, theme) {
    const x0 = i * P - B, y0 = j * P - B, size = P + 2 * B;
    const rich = detail > 0;
    c.fillStyle = MATERIALS.asphalt[style];
    c.fillRect(x0, y0, size, size);
    const rng = new SeededRNG(cityHash(i, j, 1));
    if (rich) {
      c.fillStyle = A ? 'rgba(150, 190, 225, 0.045)' : 'rgba(150, 190, 225, 0.035)';
      for (let k = 0; k < 140; k++) c.fillRect(i * P + rng.next() * P, j * P + rng.next() * P, 1.3, 1.3);
    }
    const d = cityDistrict(i, j, theme);
    const col = cityTone(DISTRICT_COLORS[d] || '#50F0FA');
    const recipe = RECIPES[d] || RECIPES[DISTRICT_FLOOR[d]] || RECIPES.plac;
    const bx = i * P + R / 2, by = j * P + R / 2, bs = P - R;

    // Block = sidewalk slab; A lifts it off the road, B frames it in light.
    if (A) {
      c.fillStyle = 'rgba(0, 0, 0, 0.5)'; rr(c, bx + SH, by + SH, bs, bs, 10); c.fill();
      c.fillStyle = mix(MATERIALS.walk.A, col, 0.06); rr(c, bx, by, bs, bs, 10); c.fill();
    } else {
      c.fillStyle = mix(MATERIALS.walk.B, col, 0.05); rr(c, bx, by, bs, bs, 10); c.fill();
    }
    if (rich) {
      c.strokeStyle = A ? 'rgba(0, 0, 0, 0.26)' : rgbaColor(col, 0.07); c.lineWidth = 1;
      c.beginPath();
      for (let k = 18; k < bs - 4; k += 18) {
        c.moveTo(bx + k, by); c.lineTo(bx + k, by + W); c.moveTo(bx + k, by + bs - W); c.lineTo(bx + k, by + bs);
        c.moveTo(bx, by + k); c.lineTo(bx + W, by + k); c.moveTo(bx + bs - W, by + k); c.lineTo(bx + bs, by + k);
      }
      c.stroke();
    }
    const lx = bx + W, ly = by + W, ls = bs - 2 * W;
    c.save();
    c.beginPath(); c.rect(lx, ly, ls, ls); c.clip();
    c.fillStyle = mat(recipe.ground, col);
    c.fillRect(lx, ly, ls, ls);
    const lotRng = new SeededRNG(cityHash(i, j, 2));
    const variant = Math.floor(lotRng.next() * 3);
    if (rich) GROUNDS[recipe.ground](c, lx, ly, ls, col, new SeededRNG(cityHash(i, j, 3)));
    MOTIFS[recipe.motifs[variant]](c, lx, ly, ls, col, lotRng, variant);
    const sign = !theme && citySignCells()[`${i},${j}`];
    if (sign && sign !== 'rdzen') {
      const dist = DISTRICTS.find(q => q.id === sign);
      if (dist) {
        const words = T(dist.name).toUpperCase().split(' ');
        c.font = `40px ${FONT_DISPLAY}`; c.textAlign = 'center'; c.textBaseline = 'middle';
        words.forEach((w, k) => {
          const ty = ly + ls / 2 + (k - (words.length - 1) / 2) * 48;
          if (A) { c.fillStyle = 'rgba(0, 0, 0, 0.25)'; c.fillText(w, lx + ls / 2 + 2, ty + 2); c.fillStyle = rgbaColor(INK, 0.1); c.fillText(w, lx + ls / 2, ty); }
          else { c.strokeStyle = rgbaColor(col, 0.07); c.lineWidth = 5; c.strokeText(w, lx + ls / 2, ty); c.strokeStyle = rgbaColor(col, 0.26); c.lineWidth = 1.3; c.strokeText(w, lx + ls / 2, ty); }
        });
      }
    }
    if (A) {
      // The lot sits a step below the sidewalk: its NW walls shade it.
      c.strokeStyle = 'rgba(0, 0, 0, 0.3)'; c.lineWidth = 8;
      c.beginPath(); c.moveTo(lx, ly + ls); c.lineTo(lx, ly); c.lineTo(lx + ls, ly); c.stroke();
    }
    c.restore();

    // The district's identity line around the block.
    if (A) {
      c.strokeStyle = 'rgba(200, 225, 245, 0.2)'; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(bx + 0.7, by + bs - 10); c.lineTo(bx + 0.7, by + 10); c.arcTo(bx + 0.7, by + 0.7, bx + 10, by + 0.7, 9.3); c.lineTo(bx + bs - 10, by + 0.7); c.stroke();
      c.strokeStyle = rgbaColor(col, 0.34); c.lineWidth = 2;
      c.strokeRect(lx - 3, ly - 3, ls + 6, ls + 6);
    } else {
      rr(c, bx + 0.8, by + 0.8, bs - 1.6, bs - 1.6, 10); line(c, col, 0.34, 1.8);
      c.strokeStyle = rgbaColor(col, 0.14); c.lineWidth = 1; c.strokeRect(lx + 0.5, ly + 0.5, ls - 1, ls - 1);
      // Corner brackets: the "schematic" signature.
      c.strokeStyle = rgbaColor(col, 0.5); c.lineWidth = 2;
      c.beginPath();
      for (const [qx, qy, sx, sy] of [[lx, ly, 1, 1], [lx + ls, ly, -1, 1], [lx, ly + ls, 1, -1], [lx + ls, ly + ls, -1, -1]]) {
        c.moveTo(qx + sx * 16, qy + sy * 1); c.lineTo(qx + sx * 1, qy + sy * 1); c.lineTo(qx + sx * 1, qy + sy * 16);
      }
      c.stroke();
    }

    // Road markings on the 4 grid lines around this block.
    const edge = (L) => !theme && (L <= 0 || L >= CITY_CELLS);
    for (const vertical of [true, false]) {
      for (const L of [vertical ? i : j, (vertical ? i : j) + 1]) {
        for (let seg = (vertical ? j : i) - 1; seg <= (vertical ? j : i) + 1; seg++) {
          if (seg < 0 || seg >= CITY_CELLS) continue;
          const pos = L * P, a = seg * P + R / 2, b = (seg + 1) * P - R / 2;
          const ln = (off, from, to) => { if (vertical) { c.moveTo(pos + off, from); c.lineTo(pos + off, to); } else { c.moveTo(from, pos + off); c.lineTo(to, pos + off); } };
          if (edge(L)) {
            c.save();
            c.beginPath();
            if (vertical) c.rect(pos - R / 2, a - R / 2, R, b - a + R); else c.rect(a - R / 2, pos - R / 2, b - a + R, R);
            c.clip();
            c.strokeStyle = 'rgba(255, 84, 173, 0.16)'; c.lineWidth = 9;
            c.beginPath();
            for (let k = a - R; k < b + R; k += 26) { if (vertical) { c.moveTo(pos - R, k); c.lineTo(pos + R, k + 2 * R); } else { c.moveTo(k, pos - R); c.lineTo(k + 2 * R, pos + R); } }
            c.stroke();
            c.restore();
            continue;
          }
          const roadCol = cityTone(DISTRICT_COLORS[vertical ? cityDistrict(Math.max(0, L - 1), seg, theme) : cityDistrict(seg, Math.max(0, L - 1), theme)] || '#50F0FA');
          if (A) {
            // Worn lanes + paint: the road is a surface, the paint is paint.
            c.strokeStyle = 'rgba(140, 170, 200, 0.03)'; c.lineWidth = 15;
            c.beginPath(); ln(-R / 4, a, b); ln(R / 4, a, b); c.stroke();
            c.strokeStyle = rgbaColor(INK, 0.17); c.lineWidth = 2.5; c.setLineDash([20, 16]);
            c.beginPath(); ln(0, a + 30, b - 30); c.stroke(); c.setLineDash([]);
            c.fillStyle = rgbaColor(INK, 0.15);
            if (vertical) { c.fillRect(pos - R / 2 + 6, a + 26, R / 2 - 8, 2.5); c.fillRect(pos + 2, b - 28.5, R / 2 - 8, 2.5); } else { c.fillRect(a + 26, pos + 2, 2.5, R / 2 - 8); c.fillRect(b - 28.5, pos - R / 2 + 6, 2.5, R / 2 - 8); }
          } else {
            // A data lane: two guide lines and the district's conduit.
            c.strokeStyle = rgbaColor(roadCol, 0.12); c.lineWidth = 1;
            c.beginPath(); ln(-R / 2 + 6, a, b); ln(R / 2 - 6, a, b); c.stroke();
            c.setLineDash([26, 10]); c.beginPath(); ln(0, a + 30, b - 30); line(c, roadCol, 0.32, 2); c.setLineDash([]);
            if (rich) {
              // Distance ticks along the guide lines (no chevrons: those
              // belong to the impulse pads).
              c.strokeStyle = rgbaColor(roadCol, 0.2); c.lineWidth = 1;
              c.beginPath();
              for (let m = a + 20; m < b - 10; m += 40) {
                for (const side of [-R / 2 + 6, R / 2 - 6]) {
                  const inn = side < 0 ? 5 : -5;
                  if (vertical) { c.moveTo(pos + side, m); c.lineTo(pos + side + inn, m); } else { c.moveTo(m, pos + side); c.lineTo(m, pos + side + inn); }
                }
              }
              c.stroke();
            }
          }
        }
      }
    }
    // Crosswalks on every arm of the 4 corner intersections.
    for (const gi of [i, i + 1]) {
      for (const gj of [j, j + 1]) {
        const ix = gi * P, iy = gj * P;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const armL = dx ? gi + Math.min(dx, 0) : gj + Math.min(dy, 0);
          if (armL < 0 || armL >= CITY_CELLS) continue;
          if (!theme && (dx ? (gj <= 0 || gj >= CITY_CELLS) : (gi <= 0 || gi >= CITY_CELLS))) continue;
          const start = R / 2 + 5;
          if (A) {
            c.fillStyle = rgbaColor(INK, 0.15);
            for (let s = -R / 2 + 7; s < R / 2 - 7; s += 9) {
              if (dx) c.fillRect(ix + dx * start + (dx < 0 ? -18 : 0), iy + s, 18, 5); else c.fillRect(ix + s, iy + dy * start + (dy < 0 ? -18 : 0), 5, 18);
            }
          } else {
            c.strokeStyle = 'rgba(226, 236, 246, 0.2)'; c.lineWidth = 1;
            c.beginPath();
            for (let s = -R / 2 + 7; s < R / 2 - 7; s += 9) {
              if (dx) c.rect(ix + dx * start + (dx < 0 ? -18 : 0) + 0.5, iy + s + 0.5, 17, 4); else c.rect(ix + s + 0.5, iy + dy * start + (dy < 0 ? -18 : 0) + 0.5, 4, 17);
            }
            c.stroke();
          }
        }
      }
    }
    // Rdzeń Miasta: the core's energy rings around the world center.
    if (!theme || theme === 'rdzen') {
      const cx = WORLD_W / 2, cy = WORLD_H / 2;
      if (Math.abs(cx - (i + 0.5) * P) < P && Math.abs(cy - (j + 0.5) * P) < P) {
        c.save();
        c.setLineDash([26, 14]);
        for (const r of [120, 180, 250]) { c.beginPath(); c.arc(cx, cy, r, 0, TAU); line(c, cityTone('#50F0FA'), A ? 0.22 : 0.2, 2); }
        c.setLineDash([]);
        c.strokeStyle = 'rgba(203, 213, 225, 0.4)'; c.lineWidth = 2.5;
        c.beginPath();
        for (let k = 0; k <= 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; const px = cx + Math.cos(a) * 24, py = cy + Math.sin(a) * 24; if (k) c.lineTo(px, py); else c.moveTo(px, py); }
        c.stroke();
        c.beginPath();
        for (let k = 0; k < 3; k++) { const a = Math.PI / 6 + k * Math.PI / 3; c.moveTo(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12); c.lineTo(cx - Math.cos(a) * 12, cy - Math.sin(a) * 12); }
        c.stroke();
        c.restore();
      }
    }
    // Street lamps. A: warm pools (the one light that is not the district's
    // color) and a lamp head with a shadow; B: the district's light, a node.
    c.save();
    const LAMP_R = A ? 50 : 44;
    for (let ni = i - 1; ni <= i + 1; ni++) {
      for (let nj = j - 1; nj <= j + 1; nj++) {
        if (ni < 0 || nj < 0 || ni >= CITY_CELLS || nj >= CITY_CELLS) continue;
        const dc = cityTone(DISTRICT_COLORS[cityDistrict(ni, nj, theme)] || '#50F0FA');
        const lc = A ? mix('#F0DDB0', dc, 0.25) : dc;
        const o = R / 2 + W / 2, far = P - o;
        const pts = rich ? [[o, o], [far, o], [o, far], [far, far], [P / 2, o], [P / 2, far], [o, P / 2], [far, P / 2]] : [[o, o], [far, o], [o, far], [far, far]];
        for (const [px0, py0] of pts) {
          const px = ni * P + px0, py = nj * P + py0;
          if (px < x0 - LAMP_R || px > x0 + size + LAMP_R || py < y0 - LAMP_R || py > y0 + size + LAMP_R) continue;
          c.globalCompositeOperation = 'lighter';
          c.drawImage(cityLampSprite(lc), px - LAMP_R, py - LAMP_R, LAMP_R * 2, LAMP_R * 2);
          c.globalCompositeOperation = 'source-over';
          if (A) {
            c.fillStyle = 'rgba(0, 0, 0, 0.4)'; c.beginPath(); c.arc(px + 2.5, py + 2.5, 3, 0, TAU); c.fill();
            c.fillStyle = 'rgba(255, 244, 214, 0.75)'; c.beginPath(); c.arc(px, py, 2.4, 0, TAU); c.fill();
          } else {
            c.fillStyle = 'rgba(230, 250, 255, 0.6)';
            c.beginPath(); c.moveTo(px, py - 3.2); c.lineTo(px + 3.2, py); c.lineTo(px, py + 3.2); c.lineTo(px - 3.2, py); c.closePath(); c.fill();
          }
        }
      }
    }
    c.restore();
  }

  // The view's quality level reaches the painter (low-end: no micro-detail).
  for (const name of ['draw', 'prewarm']) {
    const orig = CityFloor.prototype[name];
    CityFloor.prototype[name] = function (...args) {
      const view = name === 'draw' ? args[1] : args[0];
      detail = view && view.gfx != null ? view.gfx : 2;
      return orig.apply(this, args);
    };
  }
  return { style, paintChunk, RECIPES, MATERIALS, setDetail: (v) => { detail = v; } };
})();
if (GV2) { paintCityChunk = GV2.paintChunk; window.__GV2 = GV2; }

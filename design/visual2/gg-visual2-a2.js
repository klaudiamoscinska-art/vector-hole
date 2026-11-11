/* ============================================================================
   GG-VISUAL-01 R2 -- direction A2 "Premium Vector City" (PROTOTYPE, not runtime).

   Not loaded by index.html, not part of any release: qa/visual2-shots.mjs
   splices it into game.js in memory (window.__GG_VISUAL === 'A2').

   It replaces only paintCityChunk() -- the picture painted once into a
   CityFloor chunk. No object, rule, RNG stream or layout is touched.

   What changed against A:
   - three clear value planes: road (darkest) / quarter edge (a lit stone
     curb on an extruded plinth) / lot (a material with real color);
   - big composed shapes instead of textures and fine line work: every lot
     is one composition of a few large layers;
   - designed junctions (a plate with a brass ring, bold crossings),
     wider paved sidewalks, rounder quarters;
   - 12 districts x 3 compositions of their own (36), none recolored;
   - brass inlay as the one detail color the whole city shares.
   Nothing here is raised high enough to read as a building or an obstacle:
   plates lift 2-3 units, containers / stalls / racks are painted bays.
   ============================================================================ */
const GV2_A2 = (() => {
  const VARIANT = typeof window !== 'undefined' ? window.__GG_VISUAL : null;
  if (VARIANT !== 'A2' && VARIANT !== 'A2.1') return null;
  // R3 -- A2.1: the lot's opaque materials are toned down (brighter ones
  // more), so small pickups stand further off the ground. Curb, sidewalk,
  // junctions, lamps, relief shadows, brass, paint and light strips (all
  // translucent or outside the lot) keep their A2 values.
  const DIM = VARIANT === 'A2.1';
  const P = CITY_PITCH, R = CITY_ROAD, B = CITY_BLEED;
  const TAU = Math.PI * 2;
  const WALK = 20;          // visual sidewalk width (the lot is what is left)
  const RAD = 22;           // quarter corner radius
  const DEPTH = 7;          // plinth height: the wall you see on the S and E sides
  const PAINT = '#DCE6F0';  // road paint
  const BRASS = '#A8915A';  // inlay metal, the city's shared detail color
  let detail = 2;
  let forced = null;        // evidence sheets only: paint this composition (0-2) in every lot

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
  const al = (col, a) => rgbaColor(col, a);

  /* ---- A2.1: lot material correction ---- */
  const DIM_BASE = 0.15, DIM_SLOPE = 0.7, DIM_PIVOT = 0.14, DIM_MAX = 0.34, DIM_INK = '#04080e';
  const dimCache = new Map();
  /** An opaque '#rrggbb' material, toned toward the night: 15 % for the
   *  dark ones, up to 34 % for the brightest. Anything else is returned as is. */
  function dimColor(v) {
    if (typeof v !== 'string' || v.length !== 7 || v[0] !== '#') return v;
    let out = dimCache.get(v);
    if (out) return out;
    const [r, g, b] = hexToRgb(v), L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    out = mix(v, DIM_INK, clamp(DIM_BASE + (L - DIM_PIVOT) * DIM_SLOPE, DIM_BASE, DIM_MAX));
    dimCache.set(v, out);
    return out;
  }
  const STYLE_PROPS = ['fillStyle', 'strokeStyle'].map(k => [k, Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, k)]);
  /** While a lot is painted, every opaque material set on `c` goes through dimColor(). */
  function dimLot(c, on) {
    for (const [k, desc] of STYLE_PROPS) {
      if (on) Object.defineProperty(c, k, { configurable: true, get() { return desc.get.call(c); }, set(v) { desc.set.call(c, dimColor(v)); } });
      else delete c[k];
    }
  }

  /* ---- path builders (each returns a function that builds the path) ---- */
  const circ = (c, cx, cy, r) => () => { c.beginPath(); c.arc(cx, cy, r, 0, TAU); };
  const box = (c, x, y, w, h, r = 0) => () => { if (r) roundRectPath(c, x, y, w, h, r); else { c.beginPath(); c.rect(x, y, w, h); } };
  const ell = (c, cx, cy, rx, ry, rot = 0) => () => { c.beginPath(); c.ellipse(cx, cy, rx, ry, rot, 0, TAU); };
  const poly = (c, pts) => () => { c.beginPath(); pts.forEach(([px, py], k) => (k ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath(); };
  const ngon = (c, cx, cy, r, n, rot = 0) => poly(c, Array.from({ length: n }, (_, k) => [cx + Math.cos(rot + k * TAU / n) * r, cy + Math.sin(rot + k * TAU / n) * r]));
  const fill = (c, style, path) => { c.fillStyle = style; path(); c.fill(); };
  const stroke = (c, style, w, path) => { c.strokeStyle = style; c.lineWidth = w; path(); c.stroke(); };

  /* ---- depth primitives: one light, from the north-west ---- */
  /** A low raised plate: shadow, its SE wall, the top face. */
  function plate(c, path, top, lift = 3) {
    c.save(); c.translate(lift + 3, lift + 3); fill(c, 'rgba(0, 0, 0, 0.28)', path); c.restore();
    c.save(); c.translate(lift, lift); fill(c, mix(top, '#000000', 0.5), path); c.restore();
    fill(c, top, path);
  }
  /** A sunk shape: the NW wall shades its floor. */
  function sunk(c, path, floor, d = 6) {
    fill(c, floor, path);
    c.save(); path(); c.clip();
    c.strokeStyle = 'rgba(0, 0, 0, 0.42)'; c.lineWidth = d * 2;
    c.translate(d * 0.55, d * 0.55); path(); c.stroke();
    c.restore();
  }
  /** Water: deep middle, two lighter shore bands, a few long swells. Always
   *  lighter than its surroundings' shadow -- never a dark disc in a ring. */
  function water(c, path, K, shore = 16, swell = null) {
    fill(c, K.deep, path);
    c.save(); path(); c.clip();
    stroke(c, K.water, shore * 2.6, path);
    stroke(c, K.shallow, shore, path);
    if (swell) {
      c.strokeStyle = al('#BFE9F5', 0.1); c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath();
      for (const [sx, sy, len] of swell) { c.moveTo(sx, sy); c.bezierCurveTo(sx + len * 0.3, sy - 7, sx + len * 0.7, sy + 7, sx + len, sy); }
      c.stroke(); c.lineCap = 'butt';
    }
    c.strokeStyle = 'rgba(0, 0, 0, 0.38)'; c.lineWidth = 12;
    c.translate(4, 4); path(); c.stroke();
    c.restore();
  }
  /** Diagonal / straight stripes inside a shape. */
  function stripes(c, path, style, step, w, angle = Math.PI / 4, x = 0, y = 0, s = 300) {
    c.save(); path(); c.clip();
    c.translate(x + s / 2, y + s / 2); c.rotate(angle);
    c.fillStyle = style;
    for (let k = -s; k < s; k += step) c.fillRect(k, -s, w, s * 2);
    c.restore();
  }
  function stencil(c, text, x, y, size, style) {
    c.font = `${size}px ${FONT_DISPLAY}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = style; c.fillText(text, x, y);
  }

  /* ---- a district's palette: its material, tinted by its color ---- */
  const GROUND = {
    plac: '#1b2638', park: '#113628', port: '#232a34', galeria: '#231936', dachy: '#1a1f3c', rdzen: '#13212b',
    metro: '#122b33', bazar: '#2a2420', fabryka: '#261b2a', zatoka: '#191c3a', ogrody: '#12332a', chmura: '#1c232d'
  };
  const paletteCache = {};
  function palette(d, col) {
    if (paletteCache[d]) return paletteCache[d];
    const g = mix(GROUND[d] || GROUND.plac, col, 0.08);
    return (paletteCache[d] = {
      g, g2: mix(g, '#ffffff', 0.07), g3: mix(g, '#ffffff', 0.14), lo: mix(g, '#000000', 0.32),
      tone: col, soft: mix(g, col, 0.3), strong: mix(g, col, 0.55),
      deep: '#11486a', water: '#155676', shallow: '#1b6885',
      sand: '#4b4636', wood: '#4a3a2c', steel: '#3a4654', hazard: '#8a7434', pink: mix('#7a3566', g, 0.25)
    });
  }

  /* ---- compositions: 12 districts x 3, each a few large layers ---- */
  const LOTS = {
    plac: [
      function rondo(c, x, y, s, K) {
        const cx = x + s / 2, cy = y + s / 2, r = s * 0.42;
        stripes(c, box(c, x, y, s, s), K.g2, 46, 23, Math.PI / 4, x, y, s);
        plate(c, circ(c, cx, cy, r), K.g3, 3);
        fill(c, K.g, circ(c, cx, cy, r * 0.84));
        // The plaza's eight-point star, two-tone like folded stone.
        for (let k = 0; k < 8; k++) {
          const a = k * TAU / 8 - Math.PI / 2, long = k % 2 === 0, rr = r * (long ? 0.8 : 0.5);
          for (const side of [-1, 1]) {
            fill(c, side < 0 ? K.soft : K.strong, poly(c, [[cx, cy], [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr], [cx + Math.cos(a + side * TAU / 16) * r * 0.2, cy + Math.sin(a + side * TAU / 16) * r * 0.2]]));
          }
        }
        stroke(c, al(BRASS, 0.75), 2.5, circ(c, cx, cy, r * 0.84));
        fill(c, al(BRASS, 0.9), circ(c, cx, cy, 5));
      },
      function pasaz(c, x, y, s, K, rng) {
        const horiz = rng.next() < 0.5;
        // A promenade: three broad paving bands and two light channels.
        for (let k = 0; k < 3; k++) {
          const o = s * (0.08 + k * 0.31), w = s * 0.22;
          fill(c, k === 1 ? K.g3 : K.g2, horiz ? box(c, x, y + o, s, w) : box(c, x + o, y, w, s));
          stripes(c, horiz ? box(c, x, y + o, s, w) : box(c, x + o, y, w, s), 'rgba(0, 0, 0, 0.14)', 58, 3, horiz ? 0 : Math.PI / 2, x, y, s);
        }
        for (const f of [0.345, 0.655]) {
          const p = horiz ? box(c, x + 16, y + s * f - 7, s - 32, 14, 7) : box(c, x + s * f - 7, y + 16, 14, s - 32, 7);
          sunk(c, p, K.lo, 3);
          fill(c, al(K.tone, 0.5), horiz ? box(c, x + 26, y + s * f - 2, s - 52, 4, 2) : box(c, x + s * f - 2, y + 26, 4, s - 52, 2));
        }
        for (const f of [0.2, 0.5, 0.8]) {
          const px = horiz ? x + s * f : x + s * 0.5, py = horiz ? y + s * 0.5 : y + s * f;
          const bed = horiz ? box(c, px - 26, py - 9, 52, 18, 9) : box(c, px - 9, py - 26, 18, 52, 9);
          sunk(c, bed, '#184a37', 2);
        }
      },
      function fontanna(c, x, y, s, K) {
        const cx = x + s / 2, cy = y + s / 2;
        // Square terraces stepping down to a round basin.
        fill(c, K.g2, ngon(c, cx, cy, s * 0.62, 4, 0));
        sunk(c, box(c, cx - s * 0.33, cy - s * 0.33, s * 0.66, s * 0.66, 18), K.g3, 4);
        sunk(c, box(c, cx - s * 0.27, cy - s * 0.27, s * 0.54, s * 0.54, 14), K.g2, 4);
        water(c, circ(c, cx, cy, s * 0.2), K, 9, [[cx - 30, cy - 14, 34], [cx - 8, cy + 16, 34]]);
        stroke(c, al(BRASS, 0.7), 2.5, box(c, cx - s * 0.3, cy - s * 0.3, s * 0.6, s * 0.6, 16));
        fill(c, K.shallow, circ(c, cx, cy, 8));
        for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + Math.PI / 4; fill(c, al(K.tone, 0.55), circ(c, cx + Math.cos(a) * s * 0.4, cy + Math.sin(a) * s * 0.4, 4)); }
      }
    ],
    park: [
      function laka(c, x, y, s, K, rng) {
        // Mown lawn in two tones, a sand path, three parterre beds.
        for (let k = 0; k < 4; k++) fill(c, K.g2, ell(c, x + rng.next() * s, y + rng.next() * s, 60 + rng.next() * 50, 40 + rng.next() * 30, rng.next() * 3));
        const sx = x + s * (0.1 + rng.next() * 0.25), ex = x + s * (0.65 + rng.next() * 0.25);
        const trace = () => { c.beginPath(); c.moveTo(sx, y - 14); c.bezierCurveTo(x + s * 1.05, y + s * 0.3, x - s * 0.05, y + s * 0.7, ex, y + s + 14); };
        c.lineCap = 'round';
        c.save(); c.translate(3, 3); stroke(c, 'rgba(0, 0, 0, 0.3)', 26, trace); c.restore();
        stroke(c, K.sand, 24, trace);
        stroke(c, mix(K.sand, '#ffffff', 0.12), 12, trace);
        c.lineCap = 'butt';
        for (let k = 0; k < 3; k++) {
          const fx = x + 50 + rng.next() * (s - 100), fy = y + 50 + rng.next() * (s - 100), rot = rng.next() * 3;
          // Flat parterres (no lift, muted bloom: never a pickup).
          fill(c, '#1a523b', ell(c, fx, fy, 40, 25, rot));
          stroke(c, mix(K.pink, K.g, 0.35), 5, ell(c, fx, fy, 26, 13, rot));
          fill(c, '#226349', ell(c, fx, fy, 14, 6, rot));
        }
      },
      function staw(c, x, y, s, K, rng) {
        const cx = x + s / 2, cy = y + s / 2;
        fill(c, K.g2, ell(c, cx, cy, s * 0.5, s * 0.44, 0.3));
        fill(c, K.sand, ell(c, cx, cy, s * 0.4, s * 0.33));
        water(c, ell(c, cx, cy, s * 0.36, s * 0.29), K, 15, [[cx - 62, cy - 26, 60], [cx - 6, cy + 4, 62], [cx - 54, cy + 36, 54]]);
        // A wooden jetty and stepping stones.
        plate(c, box(c, cx + s * 0.1, cy - 9, s * 0.34, 18, 3), K.wood, 2);
        stripes(c, box(c, cx + s * 0.1, cy - 9, s * 0.34, 18, 3), 'rgba(0, 0, 0, 0.22)', 11, 2, 0, x, y, s);
        for (let k = 0; k < 3; k++) plate(c, circ(c, cx - s * 0.3 + k * 22, cy + s * 0.25 - k * 13, 7), mix(K.sand, '#ffffff', 0.1), 1.5);
        for (let k = 0; k < 4; k++) { const a = rng.next() * TAU; fill(c, '#2a7a55', circ(c, cx + Math.cos(a) * s * 0.16, cy + Math.sin(a) * s * 0.11, 6)); }
      },
      function boisko(c, x, y, s, K) {
        const cx = x + s / 2, cy = y + s / 2, m = 14;
        // A running track around a striped pitch.
        fill(c, '#472a2c', box(c, x + m, y + m, s - 2 * m, s - 2 * m, 62));
        stroke(c, al(PAINT, 0.2), 1.5, box(c, x + m + 9, y + m + 9, s - 2 * m - 18, s - 2 * m - 18, 54));
        const p = box(c, x + m + 20, y + m + 20, s - 2 * m - 40, s - 2 * m - 40, 44);
        sunk(c, p, '#17503a', 3);
        stripes(c, p, '#1c5c43', 44, 22, 0, x, y, s);
        c.save(); p(); c.clip();
        c.strokeStyle = al(PAINT, 0.4); c.lineWidth = 2.5;
        c.beginPath(); c.moveTo(x, cy); c.lineTo(x + s, cy); c.moveTo(cx + 30, cy); c.arc(cx, cy, 30, 0, TAU);
        c.rect(cx - 44, y + m + 20, 88, 34); c.rect(cx - 44, y + s - m - 54, 88, 34); c.stroke();
        c.restore();
      }
    ],
    port: [
      function plac_kontenerowy(c, x, y, s, K, rng) {
        // Painted stacking bays (flat -- nothing here stands up), color-coded
        // lanes, a crane rail, a big bay number.
        const tones = ['#3f5a70', '#5b4a38', '#3c5a52', '#4d4466'];
        for (let row = 0; row < 3; row++) {
          const by = y + 18 + row * 84;
          fill(c, K.g2, box(c, x + 14, by, s - 28, 66, 4));
          for (let k = 0; k < 4; k++) {
            const bx = x + 20 + k * ((s - 40) / 4), w = (s - 40) / 4 - 6;
            if (rng.next() < 0.75) {
              fill(c, tones[Math.floor(rng.next() * tones.length)], box(c, bx, by + 6, w, 54, 2));
              stripes(c, box(c, bx, by + 6, w, 54, 2), 'rgba(0, 0, 0, 0.16)', 9, 2, 0, x, y, s);
            } else stroke(c, al(K.hazard, 0.7), 2, box(c, bx + 1, by + 7, w - 2, 52, 2));
          }
        }
        stencil(c, 'S' + (1 + Math.floor(rng.next() * 8)), x + s - 46, y + s - 30, 34, al(PAINT, 0.22));
      },
      function basen(c, x, y, s, K) {
        // Dock basin: quay with a hazard edge, two piers, bollards.
        water(c, box(c, x - 20, y + 40, s + 40, s), K, 18, [[x + 20, y + 110, 90], [x + 140, y + 150, 100], [x + 40, y + 210, 110], [x + 150, y + 250, 90]]);
        for (const fx of [0.24, 0.7]) {
          plate(c, box(c, x + s * fx - 15, y + 30, 30, s * 0.5, 4), K.g3, 3);
          fill(c, al(K.hazard, 0.9), box(c, x + s * fx - 15, y + 30 + s * 0.5 - 8, 30, 8, 2));
        }
        plate(c, box(c, x - 8, y - 8, s + 16, 48), K.g2, 4);
        stripes(c, box(c, x, y + 28, s, 10), K.hazard, 22, 11, Math.PI / 4, x, y, s);
        for (let k = 28; k < s; k += 56) plate(c, circ(c, x + k, y + 14, 5), K.steel, 2);
      },
      function nabrzeze(c, x, y, s, K, rng) {
        const cx = x + s / 2, cy = y + s / 2;
        // Truck apron: a turning circle, diagonal loading bays, a rail spur.
        stripes(c, box(c, x + 12, y + 12, s - 24, 70, 4), K.g2, 34, 26, Math.PI / 3.2, x, y, s);
        fill(c, K.lo, box(c, x, y + s - 46, s, 22));
        stripes(c, box(c, x, y + s - 46, s, 22), K.steel, 15, 5, 0, x, y, s);
        fill(c, mix(K.steel, '#ffffff', 0.2), box(c, x, y + s - 43, s, 3)); fill(c, mix(K.steel, '#ffffff', 0.2), box(c, x, y + s - 30, s, 3));
        fill(c, K.g2, circ(c, cx, cy + 6, s * 0.24));
        stroke(c, al(K.hazard, 0.85), 5, circ(c, cx, cy + 6, s * 0.24));
        fill(c, K.g, circ(c, cx, cy + 6, s * 0.11));
        stencil(c, 'P' + (1 + Math.floor(rng.next() * 6)), cx, cy + 9, 30, al(PAINT, 0.3));
      }
    ],
    galeria: [
      function szachownica(c, x, y, s, K) {
        // A polished checker whose rows slip sideways: the district's glitch.
        const t = 46;
        for (let b = 0; b * t < s; b++) {
          const slip = [0, 0, 14, 0, -20, 0, 9][b % 7];
          for (let a = -1; a * t < s; a++) if ((a + b) % 2) fill(c, b % 3 ? K.g2 : K.soft, box(c, x + a * t + slip, y + b * t, t, t));
        }
        fill(c, al(K.tone, 0.5), box(c, x + s * 0.12, y + t * 2 - 3, s * 0.5, 5)); fill(c, al('#50F0FA', 0.3), box(c, x + s * 0.4, y + t * 4 - 3, s * 0.5, 5));
      },
      function mural(c, x, y, s, K, rng) {
        // A floor mural: a few big flat shapes, hard edges.
        const cols = [K.soft, K.strong, mix(K.g, '#5a4ab0', 0.5), mix(K.g, '#2f8ea0', 0.45)];
        fill(c, cols[2], circ(c, x + s * 0.3, y + s * 0.34, s * 0.3));
        fill(c, cols[0], poly(c, [[x + s * 0.36, y + s], [x + s * 0.7, y + s * 0.3], [x + s * 1.04, y + s]]));
        fill(c, cols[3], box(c, x + s * 0.52, y + s * 0.1, s * 0.4, s * 0.16));
        fill(c, cols[1], poly(c, [[x, y + s * 0.62], [x + s * 0.3, y + s * 0.62], [x, y + s * 0.92]]));
        stripes(c, circ(c, x + s * 0.3, y + s * 0.34, s * 0.3), 'rgba(0, 0, 0, 0.2)', 22, 8, 0, x, y, s);
        for (let k = 0; k < 4; k++) fill(c, al(PAINT, 0.2), box(c, x + rng.next() * s * 0.5, y + s * (0.2 + k * 0.2), s * (0.2 + rng.next() * 0.3), 4));
      },
      function amfiteatr(c, x, y, s, K) {
        const cx = x + s / 2, cy = y + s / 2;
        // Stepped rings sunk into the floor, one slice displaced.
        [0.46, 0.37, 0.28, 0.19].forEach((f, k) => sunk(c, circ(c, cx, cy, s * f), k % 2 ? K.g2 : K.g3, 4));
        fill(c, K.strong, circ(c, cx, cy, s * 0.1));
        c.save(); c.translate(10, -8);
        fill(c, K.soft, () => { c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, s * 0.46, -0.5, 0.1); c.closePath(); });
        c.restore();
        stroke(c, al(BRASS, 0.7), 2, circ(c, cx, cy, s * 0.1));
      }
    ],
    dachy: [
      function ladowisko(c, x, y, s, K) {
        const cx = x + s / 2, cy = y + s / 2;
        stripes(c, box(c, x, y, s, s), K.g2, 52, 26, 0, x, y, s);
        plate(c, ngon(c, cx, cy, s * 0.42, 8, Math.PI / 8), K.g3, 3);
        fill(c, K.lo, circ(c, cx, cy, s * 0.31));
        stroke(c, al(PAINT, 0.55), 5, circ(c, cx, cy, s * 0.26));
        c.strokeStyle = al(PAINT, 0.55); c.lineWidth = 9;
        c.beginPath(); c.moveTo(cx - 24, cy - 30); c.lineTo(cx - 24, cy + 30); c.moveTo(cx + 24, cy - 30); c.lineTo(cx + 24, cy + 30); c.moveTo(cx - 24, cy); c.lineTo(cx + 24, cy); c.stroke();
        for (let k = 0; k < 8; k++) { const a = k * TAU / 8 + Math.PI / 8; fill(c, al('#EFCB63', 0.6), circ(c, cx + Math.cos(a) * s * 0.36, cy + Math.sin(a) * s * 0.36, 3)); }
      },
      function panele(c, x, y, s, K) {
        // A solar field in three banks with service walkways.
        for (let bank = 0; bank < 3; bank++) {
          const by = y + 16 + bank * 86;
          plate(c, box(c, x + 16, by, s - 32, 66, 3), '#16285a', 2);
          stripes(c, box(c, x + 16, by, s - 32, 66, 3), '#1d3674', 40, 36, 0, x, y, s);
          fill(c, 'rgba(0, 0, 0, 0.3)', box(c, x + 16, by + 31, s - 32, 4));
          fill(c, 'rgba(150, 180, 255, 0.12)', poly(c, [[x + 30, by], [x + 90, by], [x + 50, by + 66], [x + 16, by + 66], [x + 16, by + 30]]));
        }
      },
      function swietliki(c, x, y, s, K, rng) {
        // Skylights: flat panes of lit glass in the membrane, a cable tray.
        fill(c, K.g2, box(c, x, y + s * 0.44, s, s * 0.12));
        stripes(c, box(c, x, y + s * 0.44, s, s * 0.12), 'rgba(0, 0, 0, 0.2)', 16, 3, 0, x, y, s);
        for (const [fx, fy] of [[0.1, 0.08], [0.56, 0.08], [0.1, 0.62], [0.56, 0.62]]) {
          const p = box(c, x + s * fx, y + s * fy, s * 0.34, s * 0.3, 6);
          sunk(c, p, rng.next() < 0.5 ? '#234a72' : '#2a3f7a', 4);
          c.save(); p(); c.clip(); fill(c, 'rgba(190, 220, 255, 0.1)', poly(c, [[x + s * fx, y + s * fy + s * 0.2], [x + s * fx + s * 0.2, y + s * fy], [x + s * fx + s * 0.3, y + s * fy], [x + s * fx, y + s * fy + s * 0.3]])); c.restore();
          stroke(c, K.g3, 3, p);
        }
      }
    ],
    rdzen: [0, 1, 2].map(v => function plyta(c, x, y, s, K, rng) {
      // The city's motherboard: bus bundles turning at 45 degrees, big pads.
      const cyan = mix(K.g, '#50F0FA', 0.4);
      for (let b = 0; b < 3; b++) {
        const horiz = (b + v) % 2 === 0, o = s * (0.18 + b * 0.3), turn = s * (0.3 + rng.next() * 0.4), jog = (rng.next() < 0.5 ? -1 : 1) * 34;
        for (let k = 0; k < 4; k++) {
          const q = o + k * 8;
          c.beginPath();
          if (horiz) { c.moveTo(x, y + q); c.lineTo(x + turn - jog * 0.5, y + q); c.lineTo(x + turn + Math.abs(jog) - jog * 0.5, y + q + jog); c.lineTo(x + s, y + q + jog); }
          else { c.moveTo(x + q, y); c.lineTo(x + q, y + turn - jog * 0.5); c.lineTo(x + q + jog, y + turn + Math.abs(jog) - jog * 0.5); c.lineTo(x + q + jog, y + s); }
          c.strokeStyle = k === 1 ? cyan : K.g3; c.lineWidth = 4; c.stroke();
        }
      }
      for (let k = 0; k <= v; k++) {
        const w = 64 + rng.next() * 24, bx = x + 24 + rng.next() * (s - w - 48), by = y + 24 + rng.next() * (s - w - 48);
        fill(c, al(BRASS, 0.75), box(c, bx - 7, by + 8, w + 14, w - 16));
        fill(c, al(BRASS, 0.75), box(c, bx + 8, by - 7, w - 16, w + 14));
        stripes(c, box(c, bx - 7, by - 7, w + 14, w + 14), K.g, 10, 5, 0, x, y, s);
        stripes(c, box(c, bx - 7, by - 7, w + 14, w + 14), K.g, 10, 5, Math.PI / 2, x, y, s);
        plate(c, box(c, bx, by, w, w, 5), '#1c2e3c', 3);
        fill(c, '#26404f', box(c, bx + 10, by + 10, w - 20, w - 20, 3));
        fill(c, cyan, circ(c, bx + 12, by + 12, 3));
      }
    }),
    metro: [
      function peron(c, x, y, s, K) {
        // Two tracks in a trench, the platform between them.
        for (const f of [0.08, 0.68]) {
          const p = box(c, x - 10, y + s * f, s + 20, s * 0.24);
          sunk(c, p, K.lo, 6);
          stripes(c, p, '#2b2622', 20, 9, 0, x, y, s);
          for (const o of [0.07, 0.17]) fill(c, '#7d8a96', box(c, x - 10, y + s * (f + o) - 2, s + 20, 4));
        }
        fill(c, K.g2, box(c, x, y + s * 0.34, s, s * 0.32));
        for (const f of [0.345, 0.64]) stripes(c, box(c, x, y + s * f, s, 6), al('#EFCB63', 0.75), 12, 7, 0, x, y, s);
        plate(c, circ(c, x + s / 2, y + s / 2, 30), mix(K.g, K.tone, 0.55), 2);
        fill(c, K.g, box(c, x + s / 2 - 38, y + s / 2 - 8, 76, 16, 3));
        stencil(c, 'M', x + s / 2, y + s / 2 + 1, 15, al(PAINT, 0.75));
      },
      function schemat(c, x, y, s, K, rng) {
        // The concourse floor IS the network map: thick lines, stations.
        const lines = [mix(K.g, K.tone, 0.7), '#8a4a6a', '#8a7434', '#3d6f58'];
        stripes(c, box(c, x, y, s, s), K.g2, 60, 30, 0, x, y, s);
        lines.forEach((col, k) => {
          const a = y + s * (0.16 + k * 0.22), turn = x + s * (0.25 + rng.next() * 0.45), d = (k % 2 ? -1 : 1) * 38;
          c.lineJoin = 'round';
          stroke(c, col, 9, () => { c.beginPath(); c.moveTo(x - 6, a); c.lineTo(turn, a); c.lineTo(turn + 38, a + d); c.lineTo(x + s + 6, a + d); });
          for (const sx of [x + 30, turn, turn + 38, x + s - 34]) { const sy = sx > turn ? a + d : a; fill(c, K.g, circ(c, sx, sy, 8)); stroke(c, al(PAINT, 0.6), 2.5, circ(c, sx, sy, 8)); }
        });
        c.lineJoin = 'miter';
      },
      function rozjazd(c, x, y, s, K) {
        const p = box(c, x - 10, y + s * 0.18, s + 20, s * 0.64);
        sunk(c, p, K.lo, 6);
        stripes(c, p, '#2b2622', 20, 9, 0, x, y, s);
        c.save(); p(); c.clip(); c.strokeStyle = '#7d8a96'; c.lineWidth = 4;
        for (const o of [0, 26]) {
          c.beginPath(); c.moveTo(x - 10, y + s * 0.3 + o); c.lineTo(x + s + 10, y + s * 0.3 + o); c.stroke();
          c.beginPath(); c.moveTo(x - 10, y + s * 0.3 + o); c.bezierCurveTo(x + s * 0.45, y + s * 0.3 + o, x + s * 0.55, y + s * 0.62 + o, x + s + 10, y + s * 0.62 + o); c.stroke();
        }
        c.restore();
        for (const f of [0.1, 0.84]) stripes(c, box(c, x, y + s * f, s, 6), al('#EFCB63', 0.75), 12, 7, 0, x, y, s);
      }
    ],
    bazar: [
      function kilimy(c, x, y, s, K, rng) {
        // Market rugs laid on the stone (flat), a string of lanterns above.
        const dyes = ['#6b3040', '#7a5a2a', '#2f5560', '#4d3a6a'];
        for (let row = 0; row < 2; row++) for (let k = 0; k < 2; k++) {
          const bx = x + 20 + k * (s / 2 - 4), by = y + 22 + row * (s / 2 - 6), w = s / 2 - 36, h = s / 2 - 44;
          const dye = dyes[Math.floor(rng.next() * dyes.length)];
          plate(c, box(c, bx, by, w, h, 3), dye, 1.5);
          stroke(c, al(BRASS, 0.8), 3, box(c, bx + 7, by + 7, w - 14, h - 14, 2));
          fill(c, mix(dye, '#ffffff', 0.16), ngon(c, bx + w / 2, by + h / 2, Math.min(w, h) * 0.28, 4, 0));
          fill(c, dye, ngon(c, bx + w / 2, by + h / 2, Math.min(w, h) * 0.15, 4, 0));
        }
        for (let k = 0; k < 7; k++) fill(c, al('#EFCB63', 0.75), circ(c, x + 22 + k * (s - 44) / 6, y + s / 2 + Math.sin(k * 1.05) * 5, 3.5));
      },
      function mozaika(c, x, y, s, K) {
        // Eight-point star tiling, the bazaar's own paving.
        const t = 68;
        for (let a = 0; a * t < s + t; a++) for (let b = 0; b * t < s + t; b++) {
          const cx = x + a * t, cy = y + b * t;
          fill(c, (a + b) % 2 ? K.g3 : K.soft, ngon(c, cx, cy, t * 0.36, 4, 0));
          fill(c, (a + b) % 2 ? K.g3 : K.soft, ngon(c, cx, cy, t * 0.36, 4, Math.PI / 4));
          fill(c, al(BRASS, 0.8), circ(c, cx + t / 2, cy + t / 2, 4));
        }
      },
      function rondel(c, x, y, s, K) {
        const cx = x + s / 2, cy = y + s / 2;
        // A round market: alternating wedges, a brass well in the middle.
        fill(c, K.g2, circ(c, cx, cy, s * 0.46));
        for (let k = 0; k < 12; k += 2) fill(c, k % 4 ? '#6b3040' : '#7a5a2a', () => { c.beginPath(); c.arc(cx, cy, s * 0.42, k * TAU / 12, (k + 1) * TAU / 12); c.arc(cx, cy, s * 0.2, (k + 1) * TAU / 12, k * TAU / 12, true); c.closePath(); });
        plate(c, circ(c, cx, cy, s * 0.13), K.g3, 3);
        stroke(c, al(BRASS, 0.85), 3, circ(c, cx, cy, s * 0.13));
        fill(c, al('#EFCB63', 0.8), circ(c, cx, cy, 5));
      }
    ],
    fabryka: [
      function piksele(c, x, y, s, K, rng) {
        // The factory floor is a big pixel mosaic.
        const t = s / 8, cols = [K.g2, K.g3, K.soft, K.strong, mix(K.g, '#2f8ea0', 0.5), mix(K.g, '#8a7434', 0.6)];
        for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) {
          const q = rng.next();
          if (q < 0.42) continue;
          fill(c, cols[Math.floor(rng.next() * (q > 0.86 ? 6 : 3))], box(c, x + a * t + 2, y + b * t + 2, t - 4, t - 4, 3));
        }
      },
      function tasmy(c, x, y, s, K) {
        // Conveyor belts (flat bands with rollers) between hazard edges.
        for (const f of [0.14, 0.56]) {
          const p = box(c, x - 10, y + s * f, s + 20, s * 0.26);
          sunk(c, p, '#17131c', 5);
          stripes(c, p, '#2a2432', 18, 10, 0.25, x, y, s);
          for (const o of [0, s * 0.26 - 7]) stripes(c, box(c, x - 10, y + s * f + o, s + 20, 7), K.hazard, 22, 11, Math.PI / 4, x, y, s);
        }
        for (let k = 0; k < 4; k++) fill(c, [K.strong, mix(K.g, '#2f8ea0', 0.6), mix(K.g, '#8a7434', 0.7)][k % 3], box(c, x + 26 + k * 64, y + s * 0.2 + (k % 2) * s * 0.42, 34, 34, 4));
      },
      function kadzie(c, x, y, s, K) {
        // Three dye tanks -- cyan, magenta, yellow: what pixels are made of.
        // Square and muted, set flush in a steel deck.
        fill(c, K.g2, box(c, x + 14, y + 14, s - 28, s - 28, 30));
        stroke(c, K.steel, 10, () => { c.beginPath(); c.moveTo(x + s * 0.28, y + s * 0.3); c.lineTo(x + s * 0.72, y + s * 0.3); c.lineTo(x + s * 0.72, y + s * 0.72); });
        [['#226a7a', 0.28, 0.3], ['#6e3562', 0.72, 0.3], ['#7a6c38', 0.72, 0.72]].forEach(([dye, fx, fy]) => {
          const q = s * 0.3, tank = box(c, x + s * fx - q / 2, y + s * fy - q / 2, q, q, 12);
          fill(c, K.steel, box(c, x + s * fx - q / 2 - 6, y + s * fy - q / 2 - 6, q + 12, q + 12, 16));
          sunk(c, tank, dye, 5);
          stripes(c, tank, 'rgba(255, 255, 255, 0.06)', 26, 10, 0.5, x, y, s);
        });
        stencil(c, 'CMY', x + s * 0.28, y + s * 0.72, 26, al(PAINT, 0.22));
      }
    ],
    zatoka: [
      function projekcja(c, x, y, s, K) {
        const cx = x + s / 2, cy = y + s / 2;
        // A bay whose water carries projected rings.
        water(c, box(c, x - 20, y - 20, s + 40, s + 40), K, 0, [[x + 20, y + 40, 90], [x + 150, y + 90, 100], [x + 30, y + 230, 110]]);
        [0.42, 0.31, 0.2].forEach((f, k) => stroke(c, al(k % 2 ? '#50F0FA' : K.tone, 0.34), 7, () => { c.beginPath(); c.arc(cx, cy, s * f, k, k + TAU * 0.78); }));
        plate(c, ngon(c, cx, cy, 26, 6, 0), K.g3, 3);
        fill(c, mix(K.g, K.tone, 0.7), ngon(c, cx, cy, 14, 6, 0));
      },
      function molo(c, x, y, s, K) {
        water(c, box(c, x - 20, y - 20, s + 40, s + 40), K, 0, [[x + 10, y + 60, 80], [x + 170, y + 200, 90], [x + 20, y + 240, 100]]);
        // A boardwalk in an L with a round end.
        const deck = () => { c.beginPath(); c.rect(x + s * 0.4, y - 10, 46, s * 0.62); c.rect(x + s * 0.4, y + s * 0.5, s * 0.5, 46); c.moveTo(x + s * 0.9 + 34, y + s * 0.5 + 23); c.arc(x + s * 0.9, y + s * 0.5 + 23, 34, 0, TAU); };
        plate(c, deck, K.wood, 4);
        stripes(c, deck, 'rgba(0, 0, 0, 0.2)', 12, 2, Math.PI / 2, x, y, s);
        stroke(c, al(K.tone, 0.6), 3, circ(c, x + s * 0.9, y + s * 0.5 + 23, 20));
      },
      function plaza(c, x, y, s, K) {
        // A beach in diagonal bands: sand, wet sand, shallows, deep.
        const band = (f, col) => fill(c, col, poly(c, [[x + s * f, y - 10], [x + s + 10, y - 10], [x + s + 10, y + s + 10], [x + s * (f - 0.45), y + s + 10]]));
        fill(c, '#54503e', box(c, x, y, s, s));
        stripes(c, box(c, x, y, s, s), 'rgba(0, 0, 0, 0.1)', 30, 6, -0.42, x, y, s);
        band(0.72, '#3f4a4a'); band(0.82, K.shallow); band(0.98, K.water); band(1.2, K.deep);
        for (let k = 0; k < 3; k++) { plate(c, box(c, x + 26 + k * 34, y + 40 + k * 62, 44, 26, 4), [mix(K.g, K.tone, 0.6), '#6b3040', '#2f5560'][k], 1.5); }
      }
    ],
    ogrody: [
      function tarasy(c, x, y, s, K) {
        const cx = x + s / 2, cy = y + s / 2;
        // Stepped garden terraces, each one higher and greener.
        [[0.47, '#15402f'], [0.37, '#1a4e38'], [0.27, '#205e42'], [0.17, '#28704d']].forEach(([f, col]) => plate(c, box(c, cx - s * f, cy - s * f, s * f * 2, s * f * 2, s * f * 0.45), col, 4));
        sunk(c, circ(c, cx, cy, s * 0.09), K.water, 3);
        for (let k = 0; k < 4; k++) { const a = k * TAU / 4; fill(c, K.pink, circ(c, cx + Math.cos(a) * s * 0.22, cy + Math.sin(a) * s * 0.22, 6)); }
      },
      function plaster(c, x, y, s, K, rng) {
        // Honeycomb planters: hexagons of soil, moss and bloom.
        const r = 38, h = r * Math.sqrt(3) / 2, fills = ['#1a4e38', '#205e42', '#28704d', '#3b3226', K.pink];
        for (let b = 0; b * h < s + h; b++) for (let a = 0; a * r * 3 < s + r * 3; a++) {
          const cx = x + a * r * 3 + (b % 2 ? r * 1.5 : 0), cy = y + b * h;
          plate(c, ngon(c, cx, cy, r - 5, 6, 0), fills[Math.floor(rng.next() * (rng.next() < 0.18 ? 5 : 4))], 2);
        }
      },
      function kanaly(c, x, y, s, K) {
        const cx = x + s / 2, cy = y + s / 2;
        // A water cross between four lawns, a round pool where the rills meet.
        for (const [fx, fy] of [[0.04, 0.04], [0.56, 0.04], [0.04, 0.56], [0.56, 0.56]]) plate(c, box(c, x + s * fx, y + s * fy, s * 0.4, s * 0.4, 16), '#1a4e38', 3);
        for (const [fx, fy] of [[0.24, 0.24], [0.76, 0.24], [0.24, 0.76], [0.76, 0.76]]) fill(c, '#28704d', circ(c, x + s * fx, y + s * fy, s * 0.1));
        const rill = () => { c.beginPath(); c.rect(x - 10, cy - 12, s + 20, 24); c.rect(cx - 12, y - 10, 24, s + 20); c.moveTo(cx + 40, cy); c.arc(cx, cy, 40, 0, TAU); };
        water(c, rill, K, 5);
        fill(c, '#2a7a55', circ(c, cx - 10, cy + 8, 7)); fill(c, K.pink, circ(c, cx + 12, cy - 9, 4));
      }
    ],
    chmura: [
      function hala(c, x, y, s, K) {
        // A server hall from above: painted rack rows, cold aisles lit blue.
        for (let k = 0; k < 4; k++) {
          const bx = x + 16 + k * ((s - 32) / 4);
          fill(c, k % 2 ? '#1c3550' : K.g2, box(c, bx, y, (s - 32) / 4, s));
        }
        for (let k = 0; k < 4; k++) {
          const bx = x + 24 + k * ((s - 32) / 4), w = (s - 32) / 4 - 16;
          plate(c, box(c, bx, y + 18, w, s - 36, 4), '#27313d', 2);
          stripes(c, box(c, bx, y + 18, w, s - 36, 4), 'rgba(0, 0, 0, 0.3)', 24, 3, Math.PI / 2, x, y, s);
          for (let q = 0; q < 9; q++) fill(c, cityHash(k, q, 5) % 4 ? al(K.tone, 0.5) : al('#46D99A', 0.8), box(c, bx + 6, y + 28 + q * 26, w - 12, 4, 2));
        }
      },
      function chlodnia(c, x, y, s, K) {
        // Cooling: four big fans set flush in a deck.
        fill(c, K.g2, box(c, x + 12, y + 12, s - 24, s - 24, 26));
        for (const [fx, fy] of [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]]) {
          const cx = x + s * fx, cy = y + s * fy, r = s * 0.17;
          plate(c, circ(c, cx, cy, r + 6), K.steel, 2);
          fill(c, '#2f3d4c', circ(c, cx, cy, r));
          for (let k = 0; k < 5; k++) fill(c, '#5d7186', () => { const a = k * TAU / 5 + fx * 3; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, r * 0.92, a, a + 0.62); c.closePath(); });
          fill(c, K.g3, circ(c, cx, cy, r * 0.24));
        }
      },
      function obłok(c, x, y, s, K) {
        // A halftone cloud: the district's emblem as a field of dots.
        const cx = x + s / 2, cy = y + s / 2 + 8;
        const inCloud = (px, py) => Math.max(1 - Math.hypot(px - cx + 52, py - cy - 12) / 62, 1 - Math.hypot(px - cx - 8, py - cy + 22) / 80, 1 - Math.hypot(px - cx - 66, py - cy - 10) / 56, (Math.abs(px - cx) < 100 && py > cy && py < cy + 40) ? 0.5 : 0);
        for (let a = 10; a < s; a += 19) for (let b = 10; b < s; b += 19) {
          const v = inCloud(x + a, y + b);
          fill(c, v > 0 ? mix(K.g3, K.tone, 0.5) : K.g2, circ(c, x + a, y + b, v > 0 ? 3 + Math.min(5, v * 8) : 2));
        }
      }
    ]
  };

  /* ---- the chunk ---- */
  function paintChunk(c, i, j, theme) {
    const x0 = i * P - B, y0 = j * P - B, size = P + 2 * B;
    const rich = detail > 0;
    const d = cityDistrict(i, j, theme);
    const col = cityTone(DISTRICT_COLORS[d] || '#50F0FA');
    const K = palette(d, col);
    const bx = i * P + R / 2, by = j * P + R / 2, bs = P - R;
    const edge = (L) => !theme && (L <= 0 || L >= CITY_CELLS);

    // 1. Road: dark gutters, a lighter carriageway down every street.
    c.fillStyle = '#080d15'; c.fillRect(x0, y0, size, size);
    c.fillStyle = '#0e1622';
    for (const L of [i, i + 1]) if (!edge(L)) c.fillRect(L * P - R / 2 + 9, y0, R - 18, size);
    for (const L of [j, j + 1]) if (!edge(L)) c.fillRect(x0, L * P - R / 2 + 9, size, R - 18);
    if (rich) {
      const rng = new SeededRNG(cityHash(i, j, 1));
      c.fillStyle = 'rgba(160, 195, 230, 0.05)';
      for (let k = 0; k < 90; k++) c.fillRect(i * P + rng.next() * P, j * P + rng.next() * P, 1.5, 1.5);
    }

    // 2. Markings: world edge, lane dashes, stop bars, crossings, junction plates.
    for (const vertical of [true, false]) {
      for (const L of [vertical ? i : j, (vertical ? i : j) + 1]) {
        for (let seg = (vertical ? j : i) - 1; seg <= (vertical ? j : i) + 1; seg++) {
          if (seg < 0 || seg >= CITY_CELLS) continue;
          const pos = L * P, a = seg * P + R / 2, b = (seg + 1) * P - R / 2;
          if (edge(L)) {
            c.save(); c.beginPath();
            if (vertical) c.rect(pos - R / 2, a - R / 2, R, b - a + R); else c.rect(a - R / 2, pos - R / 2, b - a + R, R);
            c.clip();
            c.strokeStyle = 'rgba(255, 84, 173, 0.2)'; c.lineWidth = 11;
            c.beginPath();
            for (let k = a - R; k < b + R; k += 30) { if (vertical) { c.moveTo(pos - R, k); c.lineTo(pos + R, k + 2 * R); } else { c.moveTo(k, pos - R); c.lineTo(k + 2 * R, pos + R); } }
            c.stroke(); c.restore();
            continue;
          }
          c.fillStyle = al(PAINT, 0.3);
          for (let q = a + 44; q < b - 56; q += 34) { if (vertical) c.fillRect(pos - 1.5, q, 3, 18); else c.fillRect(q, pos - 1.5, 18, 3); }
          c.fillStyle = al(PAINT, 0.34);
          if (vertical) { c.fillRect(pos - R / 2 + 10, a + 34, R / 2 - 12, 4); c.fillRect(pos + 2, b - 38, R / 2 - 12, 4); }
          else { c.fillRect(a + 34, pos + 2, 4, R / 2 - 12); c.fillRect(b - 38, pos - R / 2 + 10, 4, R / 2 - 12); }
        }
      }
    }
    for (const gi of [i, i + 1]) {
      for (const gj of [j, j + 1]) {
        const ix = gi * P, iy = gj * P;
        const onEdge = !theme && (gi <= 0 || gi >= CITY_CELLS || gj <= 0 || gj >= CITY_CELLS);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const armL = dx ? gi + Math.min(dx, 0) : gj + Math.min(dy, 0);
          if (armL < 0 || armL >= CITY_CELLS) continue;
          if (!theme && (dx ? (gj <= 0 || gj >= CITY_CELLS) : (gi <= 0 || gi >= CITY_CELLS))) continue;
          const start = R / 2 + 6;
          c.fillStyle = al(PAINT, 0.3);
          for (let s = -R / 2 + 11; s < R / 2 - 14; s += 11) {
            if (dx) c.fillRect(ix + dx * start + (dx < 0 ? -22 : 0), iy + s, 22, 6); else c.fillRect(ix + s, iy + dy * start + (dy < 0 ? -22 : 0), 6, 22);
          }
        }
        if (onEdge) continue;
        // The junction plate: lighter stone set in the asphalt, a brass ring.
        fill(c, '#141e2c', ngon(c, ix, iy, R * 0.52, 8, Math.PI / 8));
        fill(c, '#0e1622', ngon(c, ix, iy, R * 0.36, 8, Math.PI / 8));
        stroke(c, al(BRASS, 0.7), 2.5, circ(c, ix, iy, 9));
        fill(c, al(BRASS, 0.8), circ(c, ix, iy, 2.5));
      }
    }

    // 3. The quarter: shadow on the road, the plinth wall, a lit stone curb,
    //    the paved sidewalk, the district's light strip.
    const quarter = (o) => box(c, bx + o, by + o, bs - 2 * o, bs - 2 * o, Math.max(4, RAD - o));
    c.save(); c.translate(DEPTH + 9, DEPTH + 9); fill(c, 'rgba(0, 0, 0, 0.22)', quarter(0)); c.restore();
    c.save(); c.translate(DEPTH + 4, DEPTH + 4); fill(c, 'rgba(0, 0, 0, 0.4)', quarter(0)); c.restore();
    const wall = mix('#0b1019', col, 0.22);
    for (let k = DEPTH; k > 0; k -= 2) { c.save(); c.translate(k, k); fill(c, wall, quarter(0)); c.restore(); }
    fill(c, '#46586d', quarter(0));
    fill(c, '#5d7188', () => { c.beginPath(); c.moveTo(bx, by + bs - RAD); c.lineTo(bx, by + RAD); c.arcTo(bx, by, bx + RAD, by, RAD); c.lineTo(bx + bs - RAD, by); c.lineTo(bx + bs - RAD, by + 5); c.lineTo(bx + RAD, by + 5); c.arcTo(bx + 5, by + 5, bx + 5, by + RAD, RAD - 5); c.lineTo(bx + 5, by + bs - RAD); c.closePath(); });
    // A2.1: the paving of the sidewalk is a surface too (small pickups lie on
    // it and measured worst there); the curb around it keeps its light.
    fill(c, DIM ? '#18222f' : '#1f2c3d', quarter(5));
    if (rich) {
      // Large pavers: every other slab a shade lighter.
      c.save(); quarter(5)(); c.clip();
      c.fillStyle = DIM ? '#1c2837' : '#243347';
      for (let k = 0; k * 34 < bs; k += 2) { c.fillRect(bx + k * 34, by, 34, WALK); c.fillRect(bx + k * 34 + 34, by + bs - WALK, 34, WALK); c.fillRect(bx, by + k * 34 + 34, WALK, 34); c.fillRect(bx + bs - WALK, by + k * 34, WALK, 34); }
      c.restore();
    }
    const lx = bx + WALK, ly = by + WALK, ls = bs - 2 * WALK;
    const lot = box(c, lx, ly, ls, ls, 9);
    stroke(c, al(col, 0.7), 2.5, box(c, lx - 4, ly - 4, ls + 8, ls + 8, 12));

    // 4. The lot: its material and one composition.
    c.save(); lot(); c.clip();
    if (DIM) dimLot(c, true);
    c.fillStyle = K.g; c.fillRect(lx, ly, ls, ls);
    const lotRng = new SeededRNG(cityHash(i, j, 2));
    const rolled = Math.floor(lotRng.next() * 3);
    const variant = forced == null ? rolled : forced;
    (LOTS[d] || LOTS.plac)[variant](c, lx, ly, ls, K, lotRng);
    if (DIM) dimLot(c, false);
    const sign = !theme && citySignCells()[`${i},${j}`];
    if (sign && sign !== 'rdzen') {
      const dist = DISTRICTS.find(q => q.id === sign);
      if (dist) {
        // The district's name, engraved across the lot.
        const words = T(dist.name).toUpperCase().split(' ');
        words.forEach((w, k) => {
          const ty = ly + ls / 2 + (k - (words.length - 1) / 2) * 42 + 2;
          stencil(c, w, lx + ls / 2 + 2.5, ty + 2.5, 36, 'rgba(0, 0, 0, 0.4)');
          stencil(c, w, lx + ls / 2, ty, 36, al(PAINT, 0.34));
        });
      }
    }
    // The lot lies a step below the sidewalk.
    c.strokeStyle = 'rgba(0, 0, 0, 0.36)'; c.lineWidth = 12;
    c.translate(3.5, 3.5); lot(); c.stroke();
    c.restore();

    // 5. Rdzeń Miasta: the core's rings, inlaid in brass over the junction.
    if (!theme || theme === 'rdzen') {
      const cx = WORLD_W / 2, cy = WORLD_H / 2;
      if (Math.abs(cx - (i + 0.5) * P) < P && Math.abs(cy - (j + 0.5) * P) < P) {
        for (const [r, w, a] of [[250, 5, 0.3], [180, 3, 0.4], [120, 6, 0.34]]) stroke(c, al(BRASS, a), w, circ(c, cx, cy, r));
        stroke(c, al('#50F0FA', 0.28), 2, circ(c, cx, cy, 150));
        fill(c, '#1a2634', ngon(c, cx, cy, 30, 6, Math.PI / 6));
        stroke(c, 'rgba(203, 213, 225, 0.55)', 3, ngon(c, cx, cy, 30, 6, Math.PI / 6));
        fill(c, al(BRASS, 0.85), ngon(c, cx, cy, 11, 6, Math.PI / 6));
      }
    }

    // 6. Street lamps: four per quarter (corners), warm, with a head and its shadow.
    c.save();
    const LAMP_R = 40;
    for (let ni = i - 1; ni <= i + 1; ni++) {
      for (let nj = j - 1; nj <= j + 1; nj++) {
        if (ni < 0 || nj < 0 || ni >= CITY_CELLS || nj >= CITY_CELLS) continue;
        const o = R / 2 + 11, far = P - o;
        for (const [px0, py0] of [[o, o], [far, o], [o, far], [far, far]]) {
          const px = ni * P + px0, py = nj * P + py0;
          if (px < x0 - LAMP_R || px > x0 + size + LAMP_R || py < y0 - LAMP_R || py > y0 + size + LAMP_R) continue;
          if (rich) { c.globalCompositeOperation = 'lighter'; c.drawImage(cityLampSprite('#F0DDB0'), px - LAMP_R, py - LAMP_R, LAMP_R * 2, LAMP_R * 2); c.globalCompositeOperation = 'source-over'; }
          fill(c, 'rgba(0, 0, 0, 0.45)', circ(c, px + 3, py + 3, 4.5));
          fill(c, '#2b3848', circ(c, px, py, 4.5));
          fill(c, '#FFF1CF', circ(c, px, py, 2.4));
        }
      }
    }
    c.restore();
  }

  for (const name of ['draw', 'prewarm']) {
    const orig = CityFloor.prototype[name];
    CityFloor.prototype[name] = function (...args) {
      const view = name === 'draw' ? args[1] : args[0];
      detail = view && view.gfx != null ? view.gfx : 2;
      return orig.apply(this, args);
    };
  }
  return { style: VARIANT, paintChunk, LOTS, setDetail: (v) => { detail = v; }, setVariant: (v) => { forced = v; } };
})();
if (GV2_A2) { paintCityChunk = GV2_A2.paintChunk; window.__GV2 = GV2_A2; }

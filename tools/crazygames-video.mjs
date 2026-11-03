// CRAZYGAMES-BASIC-1: the preview videos, from a real Arena round of the package.
// One simulated frame (1/60 s) = one video frame: the game's own update() and render(),
// nothing sped up. The player is a bot (it steers by keys, the rules are the game's);
// sections of the round are joined by plain cuts; the first frames are the static cover.
//   node tools/crazygames-video.mjs --game=DIR --cover=FILE --out=FILE.mp4 --ffmpeg=EXE
//        --size=1920x1080 --dpr=1 --seed=N [--windows=6-11,28-32,87-91] [--mission=M38:8-12.5] [--hold=0.4]
//   Without --windows it only prints the round second by second, to choose them.
//   --mission appends a section of a real Campaign mission (the bot plays it from its start).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { serve, openGame, veteranSave, QA_RANDOM, frozenDateScript } from '../qa/lib.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const FPS = 60;

const CLOCK = `(function () {
  // Timers and CSS animations follow the simulated clock once __vClockOn() ran.
  const realSet = window.setTimeout.bind(window), realClear = window.clearTimeout.bind(window);
  let on = false, now = 0, next = 1e9; const q = new Map();
  window.setTimeout = (fn, ms, ...a) => { if (!on) return realSet(fn, ms, ...a); const id = next++; q.set(id, { at: now + (ms || 0), fn, a }); return id; };
  window.clearTimeout = (id) => { if (q.has(id)) q.delete(id); else realClear(id); };
  window.__vClockOn = () => { on = true; };
  window.__vClockAdvance = (ms) => {
    now += ms;
    for (const [id, t] of [...q]) if (t.at <= now) { q.delete(id); t.fn(...t.a); }
    for (const an of document.getAnimations()) { try { an.pause(); an.currentTime = (an.currentTime || 0) + ms; const e = an.effect && an.effect.getComputedTiming(); if (e && e.progress === null && an.playState !== 'finished' && e.endTime !== Infinity && an.currentTime >= e.endTime) an.finish(); } catch (err) { /* ignore */ } }
  };
})();`;

function setupRound(seed) {
  const g = window.game;
  window.__realNow = performance.now.bind(performance);
  let vnow = 5e6;
  performance.now = () => vnow;
  window.__qaSeedRandom(seed);
  window.__vClockOn();
  g.applyGfx(2);
  g.startRound({ seed: seed % 100000 });
  cancelAnimationFrame(g.rafId);
  g.running = false;
  const p = g.player, dt = 1 / 60;
  let wander = 0, frame = 0;
  const steer = () => {
    let fx = 0, fy = 0;
    for (const b of g.bots) { const d = Math.hypot(b.x - p.x, b.y - p.y); if (b.radius > p.radius * 1.12 && d < 260 + b.radius) { fx -= (b.x - p.x) / (d + 1) * 3; fy -= (b.y - p.y) / (d + 1) * 3; } }
    if (fx || fy) { const m = Math.hypot(fx, fy); g.keyDir = { x: fx / m, y: fy / m }; return; }
    let best = null, bs = -1;
    for (const b of g.bots) { const d = Math.hypot(b.x - p.x, b.y - p.y); if (p.radius > b.radius * 1.2 && !b.invulnerable && d < 500) { const s = 40 / (d + 30); if (s > bs) { bs = s; best = b; } } }
    for (const o of g.objects) { if (o.eating || !g.holeCanEat(p, o)) continue; const d = Math.hypot(o.x - p.x, o.y - p.y), s = (o.value + 2) / (d + 40); if (s > bs) { bs = s; best = o; } }
    if (best) { const m = Math.hypot(best.x - p.x, best.y - p.y) || 1; g.keyDir = { x: (best.x - p.x) / m, y: (best.y - p.y) / m }; }
    else { wander += 0.05; g.keyDir = { x: Math.cos(wander), y: Math.sin(wander) }; }
  };
  // A Campaign mission after the round: the same bot's priorities, goal objects first.
  window.__vStartMission = (id) => {
    g.stopRun();
    g.missionBoosters = [];
    g.startCampaignMission(id);
    if (g.introPending) g.beginMissionPlay();
    cancelAnimationFrame(g.rafId);
    g.running = false;
  };
  window.__vStepMission = (n, doRender) => {
    let hp = g.player;
    for (let i = 0; i < n && g.mission && !g.mission.ended && !g.mission.finishing; i++) {
      if (g.evolutionPending) { const card = document.querySelector('#evolutionCards .evolution-card'); if (card) card.click(); else g.skipEvolutionOffer(); }
      if (g.introPending) g.beginMissionPlay();
      if (g.revivePending) { g.declineRevive(); break; }
      hp = g.player;
      const tier = g.campaignTierIndex(g.campaignPlayerTier().id), goals = g.campaignGoalEntityTypes();
      let fx = 0, fy = 0, best = null, bs = -1;
      for (const b of g.bots) { const d = Math.hypot(b.x - hp.x, b.y - hp.y); if (b.radius > hp.radius * 1.1 && d < 170 + b.radius) { fx -= (b.x - hp.x) / (d + 1); fy -= (b.y - hp.y) / (d + 1); } }
      if (fx || fy) { const m = Math.hypot(fx, fy); g.keyDir = { x: fx / m, y: fy / m }; } else {
        for (const e of g.campaignEntities) {
          if (e.consumed || e.eating || !e.live || e.type === 'gate' || tier < e.stats.minTier) continue;
          if ((e.type === 'node' || e.type === 'pylon') && !e.active) continue;
          if (e.type === 'landmark' && !e.unlocked) continue;
          const d = Math.hypot(e.x - hp.x, e.y - hp.y), sc = (goals.has(e.type) ? 4 : 1) * ((e.stats && e.stats.growth) || 2) / (d + 60);
          if (sc > bs) { bs = sc; best = e; }
        }
        if (best) { const m = Math.hypot(best.x - hp.x, best.y - hp.y) || 1; g.keyDir = { x: (best.x - hp.x) / m, y: (best.y - hp.y) / m }; }
      }
      vnow += dt * 1000;
      if (!g.evolutionPending && !g.introPending) g.updateCampaign(dt);
      if (doRender !== false) g.renderCampaign(vnow / 1000);
      window.__vClockAdvance(dt * 1000);
    }
    const m = g.mission;
    return { playing: !!m && !m.ended && !m.finishing, r: +hp.radius.toFixed(1), score: hp.score || 0, goals: g.campaignGoalItems().map(it => `${it.label} ${it.progress}/${it.target}`).join(' | ') };
  };
  window.__vStep = (n, doRender) => {
    for (let i = 0; i < n && g.state === GameState.PLAYING; i++) {
      if (g.evolutionPending) {
        const card = document.querySelector('#evolutionCards .evolution-card, #evolutionCards button');
        if (card) card.click(); else g.skipEvolutionOffer();
      }
      steer();
      vnow += dt * 1000;
      if (!g.evolutionPending && !g.introPending) g.update(dt);
      frame++;
      if (doRender !== false && g.state === GameState.PLAYING) g.render(vnow / 1000);
      window.__vClockAdvance(dt * 1000);
    }
    return { frame, playing: g.state === GameState.PLAYING, r: +p.radius.toFixed(1), score: p.score, tier: CONFIG.sizeTiers[getSizeTierIndex(p.radius)].shortId, rivals: g.rivalsEatenThisRun || 0, time: +(g.timeRemaining || 0).toFixed(1) };
  };
}

export async function makeVideo({ gameDir, cover, out, ffmpeg, width, height, dpr = 1, seed, windows, mission = null, hold = 0.4 }) {
  const site = await serve({ root: gameDir });
  const init = QA_RANDOM + frozenDateScript('2026-11-03T12:00:00Z') + CLOCK;
  const g = await openGame(site.url, { viewport: { width, height }, mobile: false, deviceScaleFactor: dpr, locale: 'en-US', initScript: init });
  const save = await veteranSave(g.page, { runsPlayed: 12, missions: 6 });
  save.guestId = 'guest_video'; save.settings.music = false; save.settings.sfx = false;
  save.privacy = { ...(save.privacy || {}), decided: true };
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
  await g.page.waitForTimeout(800);
  let enc = null;
  const log = [];
  try {
    if (windows) {
      enc = spawn(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
        '-an', '-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p', '-color_range', 'tv', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-maxrate', '16M', '-bufsize', '32M', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
      // The opening: the static cover, as the docs ask.
      const url = 'data:image/png;base64,' + fs.readFileSync(cover).toString('base64');
      await g.page.evaluate((u) => new Promise((res) => { const i = new Image(); i.id = '__cover'; i.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483647;object-fit:cover'; i.onload = res; i.src = u; document.body.appendChild(i); }), url);
      const shot = await g.page.screenshot({ type: 'jpeg', quality: 98 });
      for (let i = 0; i < Math.round(hold * FPS); i++) if (!enc.stdin.write(shot)) await new Promise(r => enc.stdin.once('drain', r));
      await g.page.evaluate(() => document.getElementById('__cover').remove());
    }
    await g.page.evaluate(setupRound, seed);
    const last = windows ? Math.max(...windows.map(w => w[1])) : (mission ? 2 : 200);
    let f = 0, shots = 0, lastInfo = null;
    const inWin = (sec) => windows && windows.some(([a, b]) => sec >= a && sec < b);
    while (f / FPS < last) {
      const sec = f / FPS;
      if (inWin(sec)) {
        lastInfo = await g.page.evaluate(() => window.__vStep(1));
        if (!lastInfo.playing) break;
        const shot = await g.page.screenshot({ type: 'jpeg', quality: 95 });
        if (!enc.stdin.write(shot)) await new Promise(r => enc.stdin.once('drain', r));
        shots++;
        f++;
      } else {
        const nextWin = windows ? Math.min(...windows.map(w => w[0]).filter(a => a > sec), last) : sec + 1;
        const n = Math.max(1, Math.min(60, Math.round((nextWin - sec) * FPS)));
        lastInfo = await g.page.evaluate((k) => window.__vStep(k), n);
        f += n;
        if (!windows) log.push({ sec: +(f / FPS).toFixed(1), ...lastInfo });
        if (!lastInfo.playing) break;
      }
      if (windows && shots && shots % 300 === 0) console.log(`  ${shots} frames, t=${(f / FPS).toFixed(1)} s, r=${lastInfo.r}, ${lastInfo.tier}`);
    }
    if (mission) {
      await g.page.evaluate((id) => window.__vStartMission(id), mission.id);
      let mf = 0;
      while (mf / FPS < mission.to) {
        const sec = mf / FPS;
        if (enc && sec >= mission.from) {
          lastInfo = await g.page.evaluate(() => window.__vStepMission(1));
          if (!lastInfo.playing) break;
          const shot = await g.page.screenshot({ type: 'jpeg', quality: 95 });
          if (!enc.stdin.write(shot)) await new Promise(r => enc.stdin.once('drain', r));
          shots++;
          mf++;
        } else {
          const n = Math.max(1, Math.min(60, Math.round((Math.min(mission.from, sec + 1) - sec) * FPS)) || 60);
          lastInfo = await g.page.evaluate((k) => window.__vStepMission(k, false), n);
          mf += n;
          if (!enc) log.push({ missionSec: +(mf / FPS).toFixed(1), ...lastInfo });
          if (!lastInfo.playing) break;
        }
      }
    }
    if (g.errors.length) console.log('page errors:', g.errors.slice(0, 3).join(' | '));
    if (enc) {
      await new Promise((res, rej) => { enc.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))); enc.stdin.end(); });
      return { shots, seconds: shots / FPS + hold, lastInfo };
    }
    return { log };
  } finally {
    await g.browser.close();
    site.server.close();
  }
}

if (process.argv[1] && path.basename(process.argv[1]) === 'crazygames-video.mjs') {
  const [width, height] = arg('size', '1920x1080').split('x').map(Number);
  const win = arg('windows', null);
  const ms = arg('mission', null);
  const r = await makeVideo({
    gameDir: path.resolve(arg('game', 'qa/out/crazygames-basic/game')), cover: arg('cover', null), out: arg('out', null), ffmpeg: arg('ffmpeg', null),
    width, height, dpr: Number(arg('dpr', 1)), seed: Number(arg('seed', 4242)), hold: Number(arg('hold', 0.4)),
    mission: ms ? { id: ms.split(':')[0], from: Number(ms.split(':')[1].split('-')[0]), to: Number(ms.split(':')[1].split('-')[1]) } : null,
    windows: win ? win.split(',').map(s => s.split('-').map(Number)) : null
  });
  if (r.log) r.log.filter((e, i) => e.missionSec != null || i % 5 === 4 || !e.playing).forEach(e => console.log(JSON.stringify(e)));
  else console.log(`frames ${r.shots}, ${r.seconds.toFixed(2)} s, end ${JSON.stringify(r.lastInfo)}`);
}

// v16 „Brzmienie” audio bots: the music bank (every track compiles, every
// lead bar is 16 steps, every district has a theme), offline renders of
// each track (no clipping, no silence, similar loudness, bounded voice
// count), the scene logic (menu rotation, a new track every Arena round,
// district themes, boss drop, Daily = one track per seed, pinned
// favourites, locked Rozdział II tracks), the final-stretch drop, the
// pause "underwater" mix, NASTĘPNY, Szafa grająca and the new event cues.
// Usage: node qa/audio.mjs
import { serve, openGame, veteranSave, report, ARENA_BOT } from './lib.mjs';

async function veteranPage(url, opts = {}, saveOpts = {}) {
  const g = await openGame(url, opts);
  const save = await veteranSave(g.page, saveOpts);
  if (opts.mutate) opts.mutate(save);
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.game.state);
  await g.page.addScriptTag({ content: ARENA_BOT });
  return g;
}

export async function runAudioChecks(url) {
  const results = [];

  // --- The bank: data integrity + offline renders ---------------------------
  {
    const g = await openGame(url);
    const bank = await g.page.evaluate(() => {
      const problems = [];
      const ids = new Set(), names = new Set();
      for (const t of MUSIC_TRACKS) {
        if (ids.has(t.id)) problems.push('dup id ' + t.id);
        if (names.has(t.name)) problems.push('dup name ' + t.name);
        ids.add(t.id); names.add(t.name);
        let s;
        try { s = compileSong(t.id); } catch (e) { problems.push(`${t.id}: ${e.message}`); continue; }
        for (const k of ['kick', 'snare', 'hat']) if (s.drums[k].length !== 16) problems.push(`${t.id} ${k} length`);
        if (s.bassLine.length !== 16 || (s.bassAlt && s.bassAlt.length !== 16)) problems.push(`${t.id} bass length`);
        if (!/^[0-9]+$/.test(s.arpLine)) problems.push(`${t.id} arp`);
        for (const f of s.form) if (!s.sections[f]) problems.push(`${t.id} form ${f}`);
        if (s.drop && !s.form.includes(s.drop)) problems.push(`${t.id} drop not in form`);
        for (const sec of Object.values(s.sections)) if (sec.lead && sec.lead.length !== sec.bars * 16) problems.push(`${t.id}.${sec.id} lead covers ${sec.lead.length / 16} bars of ${sec.bars}`);
        if (!t.menu && !s.drop) problems.push(`${t.id} has no drop`);
        if (!Object.values(s.sections).some(sec => sec.lead)) problems.push(`${t.id} has no melody`);
      }
      const missingThemes = DISTRICTS.map(d => d.id).filter(id => !DISTRICT_THEME[id]);
      // "No two tracks are the same song": tempo + key + scale + chords + hook.
      const sig = t => [t.bpm, t.key, t.scale, Object.values(t.sections).map(s => s.chords).join('/'), (t.sections.B || t.sections.A).lead || ''].join('|');
      const sigs = MUSIC_TRACKS.map(sig);
      return { n: MUSIC_TRACKS.length, menu: MENU_TRACK_IDS.length, gameplay: GAMEPLAY_TRACK_IDS.length, problems, missingThemes, uniqueSongs: new Set(sigs).size, tempos: [...new Set(MUSIC_TRACKS.map(t => t.bpm))].length, keys: [...new Set(MUSIC_TRACKS.map(t => t.key + t.scale))].length };
    });
    results.push(report('music bank: ≥15 tracks (≥3 menu, ≥12 in-game), all compile cleanly', bank.n >= 15 && bank.menu >= 3 && bank.gameplay >= 12 && bank.problems.length === 0, JSON.stringify({ n: bank.n, menu: bank.menu, gameplay: bank.gameplay, problems: bank.problems.slice(0, 4) })));
    results.push(report('music bank: every district (both chapters) has its own theme', bank.missingThemes.length === 0, bank.missingThemes.join(',')));
    results.push(report('music bank: every track is a different song (tempo/key/chords/hook) with real variety', bank.uniqueSongs === bank.n && bank.tempos >= 10 && bank.keys >= 10, JSON.stringify({ unique: bank.uniqueSongs, tempos: bank.tempos, keysScales: bank.keys })));

    // Offline renders through the real mixer (master + limiter).
    const renders = await g.page.evaluate(async () => {
      const SECS = 10;
      const out = [];
      for (const t of MUSIC_TRACKS) {
        for (const L of t.menu ? [0] : [0, 1, 3]) {
          const ctx = new OfflineAudioContext(2, 44100 * SECS, 44100);
          const e = new SoundEngine({ music: true, sfx: true });
          e.buildGraph(ctx);
          e.loadSong({ id: t.id });
          e.intensity = L;
          e.trace = [];
          e.nextNoteTime = 0.05;
          e.scheduleUntil(SECS - 0.6);
          const buf = await ctx.startRendering();
          let peak = 0, sum = 0, nan = false;
          for (let ch = 0; ch < 2; ch++) {
            const d = buf.getChannelData(ch);
            for (let i = 0; i < d.length; i++) { const v = d[i]; if (v !== v) { nan = true; break; } const a = Math.abs(v); if (a > peak) peak = a; sum += v * v; }
          }
          const rms = Math.sqrt(sum / (buf.length * 2));
          out.push({ id: t.id, L, menu: !!t.menu, peak: +peak.toFixed(3), db: +(20 * Math.log10(rms + 1e-9)).toFixed(1), voicesPerSec: Math.round(e.trace.length / (SECS - 0.6)), nan });
        }
      }
      return out;
    });
    const play = renders.filter(r => !r.menu && r.L === 1);
    const spread = Math.max(...play.map(r => r.db)) - Math.min(...play.map(r => r.db));
    const bad = renders.filter(r => r.nan || r.peak > 1 || r.peak < 0.02);
    results.push(report('music render: every track/level is audible, never clips, no NaN', bad.length === 0, bad.length ? JSON.stringify(bad.slice(0, 3)) : `peaks ${Math.min(...renders.map(r => r.peak))}–${Math.max(...renders.map(r => r.peak))}`));
    results.push(report('music render: in-round tracks sit within 8 dB of each other (no track jumps out)', spread <= 8, `spread ${spread.toFixed(1)} dB · ${play.map(r => `${r.id} ${r.db}`).join(', ')}`));
    const menuDb = Math.max(...renders.filter(r => r.menu).map(r => r.db));
    const roundDb = play.reduce((a, r) => a + r.db, 0) / play.length;
    results.push(report('music render: menu tracks are calmer than in-round music', menuDb < roundDb + 1, `menu max ${menuDb} dB · round avg ${roundDb.toFixed(1)} dB`));
    const layered = MUSIC_IDS_OK(renders);
    results.push(report('music render: layers build up with intensity (outro < round ≤ SZAŁ voices)', layered.ok, layered.details));
    const maxVoices = Math.max(...renders.map(r => r.voicesPerSec));
    results.push(report('music perf: ≤ 140 synth voices per second at the busiest level', maxVoices <= 140, `max ${maxVoices}/s`));

    // Sequencer logic, deterministic (no clock): the drop, rotation, variation.
    const seq = await g.page.evaluate(() => {
      const mk = (id) => { const e = new SoundEngine({ music: true, sfx: true }); e.loadSong({ id }); return e; };
      const bar = (e) => { for (let i = 0; i < 16; i++) e.advance(); };
      // Final stretch: within 2 bars the track is in its drop section.
      const e = mk('wir');
      e.intensity = 1; bar(e); bar(e);
      e.setIntensity(2);
      const riserBar = (bar(e), e.dropRiserBar);
      bar(e);
      const inDrop = e.song.form[e.formIdx] === e.song.drop && e.barInSection === 0;
      // Arena: after one full pass the next track is queued (menus too).
      const a = mk('fala'); a.scene = 'arena'; a.sceneOpts = {};
      const bars = a.song.form.reduce((n, f) => n + a.song.sections[f].bars, 0);
      for (let i = 0; i < bars; i++) bar(a);
      const arenaNext = a.queued && a.queued.id;
      // Final stretch: no medley -- the form wraps to hook → drop instead.
      const f = mk('glitch'); f.scene = 'arena'; f.sceneOpts = {}; f.intensity = 2;
      const fb = f.song.form.reduce((n, x) => n + f.song.sections[x].bars, 0);
      for (let i = 0; i < fb; i++) bar(f);
      const finalWrap = { queued: !!f.queued, section: f.song.form[f.formIdx] };
      // Missions loop their district theme; the 2nd pass varies (loopCount).
      const c = mk('impuls'); c.scene = 'campaign'; c.sceneOpts = { district: 'park' };
      const cb = c.song.form.reduce((n, f) => n + c.song.sections[f].bars, 0);
      for (let i = 0; i < cb; i++) bar(c);
      // Daily: never rotates away from the seed's track.
      const d = mk('glitch'); d.scene = 'arena'; d.sceneOpts = { daily: true, seed: 5 };
      const db = d.song.form.reduce((n, f) => n + d.song.sections[f].bars, 0);
      for (let i = 0; i < db; i++) bar(d);
      // A boss mission opens on the drop.
      const b = new SoundEngine({ music: true, sfx: true }); b.loadSong({ id: 'rdzen', drop: true });
      // The eat ladder follows the key (E minor -> E3 = 164.8 Hz).
      const n = mk('napiecie');
      return { finalWrap, riserBar, inDrop, arenaNext, arenaFrom: 'fala', campaignQueued: !!c.queued, campaignLoop: c.loopCount, dailyQueued: !!d.queued, bossSection: b.song.form[b.formIdx], ladder0: Math.round(n.song.ladder[0] * 10) / 10, keyRatio: +n.song.keyRatio.toFixed(3), majorRatio: compileSong('impuls').keyRatio };
    });
    results.push(report('music: final stretch arms a one-bar riser, then jumps to the drop', seq.riserBar >= 0 && seq.inDrop, JSON.stringify({ riserBar: seq.riserBar, inDrop: seq.inDrop })));
    results.push(report('music: Arena moves on to another track after a full pass', !!seq.arenaNext && seq.arenaNext !== seq.arenaFrom, seq.arenaNext));
    results.push(report('music: in the final stretch the track stays and loops hook → drop (no medley)', !seq.finalWrap.queued && seq.finalWrap.section === 'B', JSON.stringify(seq.finalWrap)));
    results.push(report('music: missions loop their district theme (with a varied 2nd pass), Daily stays on its track', !seq.campaignQueued && seq.campaignLoop === 1 && !seq.dailyQueued));
    results.push(report('music: a district boss opens on the drop', seq.bossSection === 'D', seq.bossSection));
    results.push(report('sfx: the combo ladder and stingers follow the track key', Math.abs(seq.ladder0 - 164.8) < 0.5 && seq.keyRatio < 1 && seq.majorRatio === 1, JSON.stringify(seq)));
    results.push(report('audio bank: no runtime errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // --- Live scenes in the real game ------------------------------------------
  {
    const g = await veteranPage(url, {}, { runsPlayed: 10, missions: 12 });
    await g.page.mouse.click(5, 5);
    await g.page.waitForTimeout(400);
    const wait = (ms) => g.page.waitForTimeout(ms);
    const song = () => g.page.evaluate(() => ({ id: window.game.sound.song.id, menu: !!window.game.sound.song.menu, queued: window.game.sound.queued && window.game.sound.queued.id, section: window.game.sound.song.form[window.game.sound.formIdx], timer: !!window.game.sound.musicTimer, state: window.game.sound.ctx && window.game.sound.ctx.state }));
    const menu = await song();
    results.push(report('music (live): the hub plays a lo-fi menu track after the first tap', menu.menu && menu.timer && menu.state === 'running', JSON.stringify(menu)));

    // Five Arena rounds in a row: ≥3 different tracks, never twice in a row.
    const rounds = [];
    for (let i = 0; i < 5; i++) {
      await g.page.evaluate(() => { const gm = window.game; gm.startRound({}); });
      await wait(450);
      const s = await song();
      rounds.push(s.id);
      await g.page.evaluate(() => { const gm = window.game; gm.timeRemaining = 0; gm.endRound(); });
      await wait(150);
    }
    const repeats = rounds.filter((id, i) => i > 0 && id === rounds[i - 1]).length;
    results.push(report('music (live): 5 Arena rounds = ≥3 different tracks, no back-to-back repeat', new Set(rounds).size >= 3 && repeats === 0 && rounds.every(id => GAMEPLAY_IDS.includes(id)), rounds.join(' → ')));
    const outro = await song();
    results.push(report('music (live): the result screen keeps the round track as a calm outro', !outro.menu && outro.id === rounds[4], JSON.stringify(outro)));
    await g.page.evaluate(() => window.game.showScreen('mainMenu'));
    await wait(450);
    const back = await song();
    results.push(report('music (live): back on Miasto the menu rotation returns', back.menu, back.id));

    // Campaign: district themes + boss drop.
    const theme = await g.page.evaluate(async () => {
      const gm = window.game, out = {};
      for (const id of ['M00', 'M05', 'M09', 'M04']) {
        gm.startCampaignMission(id);
        await new Promise(r => setTimeout(r, 420));
        const card = gm.sound.song.form[gm.sound.formIdx];
        if (id !== 'M00') gm.beginMissionPlay();
        await new Promise(r => setTimeout(r, 420));
        out[id] = { song: gm.sound.song.id, card, section: gm.sound.song.form[gm.sound.formIdx] };
        gm.running = false; gm.showScreen('campaignScreen');
        await new Promise(r => setTimeout(r, 380));
      }
      return out;
    });
    results.push(report('music (live): each district plays its own theme (Plac → Wir Neonów, Park → Zielony Impuls, Port → Fala Syntez)', theme.M00.song === 'wir' && theme.M05.song === 'impuls' && theme.M09.song === 'fala', JSON.stringify(theme)));
    results.push(report('music (live): the district boss (M04) waits on its intro under the start card, then drops on START', theme.M04.song === 'wir' && theme.M04.card === 'A' && theme.M04.section === 'D' && theme.M05.section !== 'D', JSON.stringify(theme)));

    // Daily / challenge: the same seed plays the same track for everybody.
    const daily = await g.page.evaluate(async () => {
      const gm = window.game, ids = [];
      for (let i = 0; i < 2; i++) {
        gm.startRound({ daily: true, seed: 424242 });
        await new Promise(r => setTimeout(r, 420));
        ids.push(gm.sound.song.id);
        gm.timeRemaining = 0; gm.endRound();
        await new Promise(r => setTimeout(r, 120));
      }
      return ids;
    });
    results.push(report('music (live): a Daily seed always plays the same (free) track', daily[0] === daily[1] && FREE_IDS.includes(daily[0]), daily.join(' = ')));

    // Pause: the mix goes underwater, the sheet names the track, NASTĘPNY skips.
    const pause = await g.page.evaluate(async () => {
      const gm = window.game, s = gm.sound;
      gm.startRound({});
      await new Promise(r => setTimeout(r, 450));
      const before = s.song.id;
      gm.pauseGame();
      await new Promise(r => setTimeout(r, 700));
      const muffled = s.musicFilter.frequency.value;
      const label = document.getElementById('pauseTrackName').textContent;
      const rowVisible = !document.getElementById('pauseTrack').classList.contains('hidden');
      document.getElementById('btnNextTrack').click();
      await new Promise(r => setTimeout(r, 500));
      const skipped = s.song.id;
      const label2 = document.getElementById('pauseTrackName').textContent;
      gm.resumeGame();
      await new Promise(r => setTimeout(r, 700));
      const open = s.musicFilter.frequency.value;
      // Now-playing chip shows during the round.
      const chip = document.getElementById('nowPlaying');
      const chipShown = chip.classList.contains('visible') && document.getElementById('nowPlayingName').textContent.length > 0;
      const chipPassThrough = getComputedStyle(chip).pointerEvents === 'none';
      gm.timeRemaining = 0; gm.endRound();
      return { before, muffled: Math.round(muffled), label, rowVisible, skipped, label2, open: Math.round(open), chipShown, chipPassThrough, beforeName: MUSIC_TRACK_BY_ID[before].name, skippedName: MUSIC_TRACK_BY_ID[skipped].name };
    });
    results.push(report('music (live): pause drops the music "underwater" (low-pass) and resume opens it again', pause.muffled < 1500 && pause.open > 10000, `${pause.muffled} Hz → ${pause.open} Hz`));
    results.push(report('music (live): the pause sheet names the track and NASTĘPNY switches it', pause.rowVisible && pause.label === pause.beforeName && pause.skipped !== pause.before && pause.label2 === pause.skippedName, JSON.stringify({ label: pause.label, label2: pause.label2 })));
    results.push(report('music (live): a "TERAZ GRA" chip names the new track in the round (never blocks taps)', pause.chipShown && pause.chipPassThrough));

    // Szafa grająca: list, locked tracks, pin, persistence, sanitize.
    const jb = await g.page.evaluate(async () => {
      const gm = window.game;
      gm.openProfileScreen();
      document.getElementById('btnJukebox').click();
      const items = [...document.querySelectorAll('.jukebox-item')];
      const locked = items.filter(b => b.classList.contains('is-locked')).map(b => b.dataset.track);
      const lockedTap = locked[0];
      if (lockedTap) document.querySelector(`.jukebox-item[data-track="${lockedTap}"]`).click();
      const afterLocked = gm.save.settings.musicPick;
      document.querySelector('.jukebox-item[data-track="fala"]').click();
      await new Promise(r => setTimeout(r, 450));
      const preview = gm.sound.song.id;
      const fullPreview = gm.sound.previewing && gm.sound.song.form[gm.sound.formIdx] === 'B';
      const saved = JSON.parse(localStorage.getItem('vectorHoleSave_v1') || '{}');
      gm.closeInfoSheet();
      const previewOff = !gm.sound.previewing;
      const label = document.getElementById('btnJukebox').textContent;
      // Pinned: an Arena round and a Plac mission both play it.
      gm.startRound({});
      await new Promise(r => setTimeout(r, 420));
      const arena = gm.sound.song.id;
      gm.timeRemaining = 0; gm.endRound();
      gm.startCampaignMission('M01');
      await new Promise(r => setTimeout(r, 420));
      const mission = gm.sound.song.id;
      gm.running = false; gm.showScreen('mainMenu');
      // Back to the mix.
      gm.pickJukeboxTrack('auto');
      const sanitized = sanitizeSave({ ...gm.save, settings: { ...gm.save.settings, musicPick: 'nie-ma-takiego' } }).settings.musicPick;
      return { n: items.length, locked, afterLocked, preview, fullPreview, previewOff, savedPick: saved.settings && saved.settings.musicPick, label, arena, mission, sanitized, pickNow: gm.save.settings.musicPick };
    });
    results.push(report('jukebox: lists every track + Mieszanka; Rozdział II tracks are locked on a Rozdział I save', jb.n === MUSIC_N + 1 && jb.locked.length === 6, JSON.stringify({ n: jb.n, locked: jb.locked })));
    results.push(report('jukebox: a locked track cannot be pinned (the row explains why)', jb.afterLocked === 'auto'));
    results.push(report('jukebox: tapping a track previews it, pins it and saves it', jb.preview === 'fala' && jb.savedPick === 'fala' && /FALA SYNTEZ/.test(jb.label), JSON.stringify({ preview: jb.preview, saved: jb.savedPick, label: jb.label })));
    results.push(report('jukebox: the preview plays the full arrangement from the hook, and stops previewing on close', jb.fullPreview && jb.previewOff));
    results.push(report('jukebox: a pinned track plays in Arena and in missions', jb.arena === 'fala' && jb.mission === 'fala', JSON.stringify({ arena: jb.arena, mission: jb.mission })));
    results.push(report('jukebox: Mieszanka restores rotation; an unknown saved pick falls back to it', jb.pickNow === 'auto' && jb.sanitized === 'auto'));

    // Unlocking a Rozdział II district adds its theme to the rotation.
    const unlock = await g.page.evaluate(() => {
      const gm = window.game;
      const before = gm.sound.unlockedGameplayTracks().length;
      gm.save.campaign.unlockedDistricts.push('metro');
      return { before, after: gm.sound.unlockedGameplayTracks().length, has: gm.sound.unlockedGameplayTracks().includes('tunele') };
    });
    results.push(report('music: unlocking Tunele Metra adds its theme to the Arena rotation', unlock.after === unlock.before + 1 && unlock.has, JSON.stringify(unlock)));

    // Music off: nothing scheduled, scenes still tracked; on again resumes.
    const off = await g.page.evaluate(async () => {
      const gm = window.game, s = gm.sound;
      document.querySelector('[data-setting="music"][data-value="0"]').click();
      const timerOff = !s.musicTimer;
      gm.startRound({});
      const loaded = s.song.id;
      gm.timeRemaining = 0; gm.endRound();
      gm.showScreen('mainMenu');
      document.querySelector('[data-setting="music"][data-value="1"]').click();
      await new Promise(r => setTimeout(r, 300));
      return { timerOff, loadedGameplay: !MUSIC_TRACK_BY_ID[loaded].menu, back: !!s.musicTimer, menuNow: !!s.song.menu };
    });
    results.push(report('music: switched off it schedules nothing, back on it resumes the right scene', off.timerOff && off.loadedGameplay && off.back && off.menuNow, JSON.stringify(off)));

    // Review regressions: NASTĘPNY during the 0.3 s fade, prototype keys.
    const rr = await g.page.evaluate(async () => {
      const gm = window.game, s = gm.sound;
      gm.showScreen('mainMenu');
      await new Promise(r => setTimeout(r, 500));
      gm.startRound({});
      const id = s.skipTrack();
      await new Promise(r => setTimeout(r, 450));
      const out = { skipped: id, menu: !!MUSIC_TRACK_BY_ID[id].menu, playing: s.song.id };
      gm.timeRemaining = 0; gm.endRound();
      out.proto = ['constructor', 'toString', '__proto__'].map(k => sanitizeSave({ ...gm.save, settings: { ...gm.save.settings, musicPick: k } }).settings.musicPick);
      out.unlockedProto = gm.isTrackUnlocked('constructor');
      return out;
    });
    results.push(report('music: NASTĘPNY right at round start skips to another in-round track (not a menu one)', !rr.menu && rr.playing === rr.skipped, JSON.stringify(rr)));
    results.push(report('save: prototype names as musicPick fall back to Mieszanka', rr.proto.every(p => p === 'auto') && rr.unlockedProto === false, JSON.stringify(rr.proto)));

    // Stress: rapid scene changes, skips and pauses -> one timer, no errors.
    const stress = await g.page.evaluate(async () => {
      const gm = window.game, s = gm.sound;
      const timer = s.musicTimer;
      for (let i = 0; i < 60; i++) {
        const r = i % 5;
        if (r === 0) s.setScene('menu');
        else if (r === 1) s.setScene('arena', {});
        else if (r === 2) s.setScene('campaign', { district: DISTRICTS[i % DISTRICTS.length].id });
        else if (r === 3) s.skipTrack();
        else { s.setDucked(i % 2 === 0); s.setIntensity(i % 4); }
        if (i % 7 === 0) await new Promise(res => setTimeout(res, 40));
      }
      s.setDucked(false); s.setIntensity(0);
      s.setScene('menu');
      await new Promise(res => setTimeout(res, 800));
      return { sameTimer: s.musicTimer === timer, menu: !!s.song.menu, queued: !!s.queued, gain: +s.musicIn.gain.value.toFixed(2) };
    });
    results.push(report('music stress: 60 rapid scene changes/skips/pauses settle on the right track, one timer, audible', stress.sameTimer && stress.menu && !stress.queued && stress.gain > 0.5, JSON.stringify(stress)));

    // Every v16 cue plays without errors.
    const cues = await g.page.evaluate(() => {
      const s = window.game.sound;
      if (!s.sfxOn()) return false;
      ['bump', 'leadTaken', 'leadLost', 'shield', 'portal', 'overdrive', 'cards', 'pick', 'danger', 'go', 'eat', 'tierUp', 'fanfare', 'star', 'golden', 'frenzy'].forEach(k => s[k](20, 3));
      return true;
    });
    results.push(report('sfx: every new event cue plays (bump, lead taken/lost, shield, portal, finale, cards, pick, danger, start)', cues && g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // --- A real bot round with the audio on: the game drives the music --------
  {
    const g = await veteranPage(url, {}, { runsPlayed: 10, missions: 12 });
    await g.page.mouse.click(5, 5);
    await g.page.waitForTimeout(300);
    const r = await g.page.evaluate(() => {
      const gm = window.game, s = gm.sound;
      const calls = {}, levels = new Set();
      for (const k of ['eat', 'tierUp', 'go', 'overdrive', 'leadTaken', 'leadLost', 'danger', 'bump', 'rivalEaten', 'tick', 'cards']) {
        const orig = s[k].bind(s);
        s[k] = (...a) => { calls[k] = (calls[k] || 0) + 1; return orig(...a); };
      }
      const setI = s.setIntensity.bind(s);
      let armed = false;
      // The bot round is synchronous: load a queued switch first (the live
      // 30 ms timer cannot run inside the loop).
      s.setIntensity = (l) => { if (s.queued) { s.loadSong(s.queued); s.queued = null; } levels.add(l); const r = setI(l); if (l >= 2 && (s.dropArmed || s.song.form[s.formIdx] === s.song.drop)) armed = true; return r; };
      const res = window.__qaPlayArena({ style: 'greedy' });
      return { calls, levels: [...levels].sort(), armed, score: res && res.score };
    });
    results.push(report('bot round: start, eating, tier-ups, the finale and the countdown all sound', r.calls.go >= 1 && r.calls.eat > 20 && r.calls.tierUp >= 1 && r.calls.overdrive === 1 && r.calls.tick >= 3, JSON.stringify(r.calls)));
    results.push(report('bot round: music climbs 1 → 2 (final stretch) and heads for the drop', r.levels.includes(1) && r.levels.includes(2) && r.armed, JSON.stringify({ levels: r.levels, armed: r.armed })));
    results.push(report('bot round: no runtime errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // --- Phone layout: the pause sheet still fits without scrolling ------------
  {
    const g = await veteranPage(url, { viewport: { width: 375, height: 667 } }, { runsPlayed: 10 });
    const lay = await g.page.evaluate(async () => {
      const gm = window.game;
      gm.startRound({});
      gm.pauseGame();
      await new Promise(r => setTimeout(r, 200));
      const vis = id => { const r = document.getElementById(id).getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.bottom <= innerHeight; };
      return { resume: vis('btnResume'), track: vis('pauseTrack'), next: vis('btnNextTrack'), leave: vis('btnLeaveRun') };
    });
    results.push(report('layout 375×667: pause sheet shows WRÓĆ, the track row and WYJDŹ without scrolling', lay.resume && lay.track && lay.next && lay.leave, JSON.stringify(lay)));
    await g.browser.close();
  }

  return results;
}

// Helpers evaluated in Node against the render list.
const GAMEPLAY_IDS = ['wir', 'impuls', 'fala', 'glitch', 'napiecie', 'rdzen', 'tunele', 'bazar', 'piksele', 'hologramy', 'ogrody', 'chmura'];
const FREE_IDS = ['wir', 'impuls', 'fala', 'glitch', 'napiecie', 'rdzen'];
const MUSIC_N = 15;
function MUSIC_IDS_OK(renders) {
  const bad = [];
  for (const id of GAMEPLAY_IDS) {
    const v = L => (renders.find(r => r.id === id && r.L === L) || {}).voicesPerSec || 0;
    if (!(v(0) < v(1) && v(1) <= v(3))) bad.push(`${id} ${v(0)}/${v(1)}/${v(3)}`);
  }
  return { ok: bad.length === 0, details: bad.length ? bad.join(', ') : 'all 12 in-game tracks' };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { server, url } = await serve();
  const res = await runAudioChecks(url);
  server.close();
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} audio checks passed`);
  process.exit(failed.length ? 1 : 0);
}

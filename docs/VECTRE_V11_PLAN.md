# Vector Hole v11 — „Złoty Strzał ULTRA” (market-readiness pass)

Single autonomous pass on top of v10 aimed at shipping to web portals and a
mobile wrapper: audio, a real monetization adapter layer, a viral loop,
GDPR/legal hygiene, anti-cheat, an economy rebalance found by bot-testing,
adaptive performance, and a committed QA bot suite. Still exactly three
runtime files, zero dependencies, no build step, no backend, no secrets.

Every claim below is backed by a check in `qa/` (`node qa/run-all.mjs`:
all checks passing at the end of this pass).

## 0. What the bot-testers found first (baseline on v10)

| Finding | Severity | Fix |
|---|---|---|
| Coins were `score/4`; one strong round (10–25k pts) paid 3–6k coins and emptied the whole Warsztat (shop total ~1.2k) | Economy-breaking | Sublinear payout (§5) |
| Player XP was `0.5 × score` → LVL 45 after 12 rounds | Economy-breaking | Sublinear XP (§5) |
| Display name went into `innerHTML` unescaped (leaderboards) — stored XSS, and a vector for any future shared name | Security | `escapeHtml()` everywhere a player string is rendered |
| Login calendar re-farmable by rolling the device clock back | Exploit | Clock guard (§4) |
| A save with a string/NaN field turned `coins += x` into string concatenation | Robustness | `sanitizeSave()` (§4) |
| Google Fonts request on every visit (visitor IP to Google: GDPR risk in the EU; blocked on some portals; 3 render-blocking round trips) | Legal / perf | Fonts self-hosted inline (§4) |
| Late-round frames with huge holes ~25 ms in software rendering; shadow-blur strokes dominate | Perf on low-end phones | Adaptive quality (§6) |
| Greedy bot still takes #1 at full difficulty | Balance note | Left as is — the bot plays with perfect information; human data needed before tuning harder |

## 1. Audio (`SoundEngine`)
- 100% synthesized WebAudio (0 KB of assets): eat blips that climb an
  A-minor pentatonic ladder with the combo, a sub "gulp" for big objects,
  rival-eaten sting, hurt, tier-up arpeggio, SZAŁ riser, countdown ticks,
  UI clicks, coin and fanfare stings, mission fail.
- Adaptive synthwave loop (Am–F–C–G, 16-step lookahead scheduler):
  intensity 0 menu (pad + soft arp, 92 BPM) → 1 round (kick/bass/snare) →
  2 final 40 s / Overdrive / campaign last 15 s (16th hats, 120 BPM) →
  3 SZAŁ (lead, 128 BPM).
- Gesture-unlocked (no autoplay), suspended when the tab is hidden, ducked
  on the pause sheet, compressor on the master bus. Toggles: Dźwięki /
  Muzyka in the pause sheet and Profil → Ustawienia (`save.settings.sfx/music`).
- Backgrounding the tab mid-round now pauses the round.

## 2. Monetization (`Monetization`, `AD_PLACEMENTS`, `IAP_PRODUCTS`, `CONFIG.ads`)
- One adapter, runtime-detected provider: **CrazyGames SDK v3**, **Poki SDK
  v2**, **Google H5 Games Ads** (`adBreak`), a **native wrapper**
  (`window.VectorHoleNative` — AdMob/Play Billing/StoreKit behind a
  Capacitor/TWA shell) or **demo** (labelled placeholder). Portal SDK
  scripts are fetched only when actually running on that portal (hostname
  or referrer match, `?portal=poki|crazygames` to test) — the default build
  makes zero third-party requests. `CONFIG.flags.monetizationAdapters` is
  now `true`.
- `gameplayStart/Stop` markers (required by portals) on round start/resume
  and pause/end; `happyTime()` on wins/PBs.
- **Rewarded placements, all opt-in, at emotional peaks:**
  result ×2 coins · **mission revive „PRAWIE!”** (+20 s when out of time
  with ≥40 % of the goal done, once per attempt, auto-declines in 7 s) ·
  free chest now (3/day) · ×2 daily login reward · +5 prisms in Warsztat
  (3/day) · free Turbo start for the rematch when you can't afford it (2/day).
- **Interstitials:** only between rounds, every 3rd replay, never in the
  first 5 runs, ≥150 s apart, never with „Bez reklam”.
- **IAP catalog:** Pakiet Startowy (one-time, 1500 coins + 60 prisms +
  exclusive Trail „Zorza Startu”), three prism packs, „Bez reklam”. The paid
  store and IAP-only cosmetics render **only** when the provider can take a
  real payment (`canPurchase`, i.e. the native wrapper); the web build never
  shows a fake checkout. `grantProduct()` is public so a wrapper can restore
  purchases. No paid random rewards (loot boxes) anywhere — EU/UK/BE/NL risk.

## 3. Viral loop
- **„RZUĆ WYZWANIE ZNAJOMEMU”** (results): a 1080×1350 JPEG score card drawn
  with the game's own vector art (the player's real hole) + a challenge link
  `?c=<seed>.<score>.<seal>&n=<name>` that replays the **same map**. Web Share
  with the image file → Web Share with link → clipboard → image download.
- Opening a link: a sealed, validated challenge is stored, the URL is cleaned,
  Miasto shows a challenge card at the top (first-run players get a note on
  the welcome card — tutorial first). In-round: live target box; beating it
  fires „WYZWANIE POBITE!”. Results: outcome line; a lost challenge turns
  the replay button into „REWANŻ — TA SAMA MAPA”.
- Near-miss hook on every result: „Zabrakło tylko N pkt do miejsca #k i podium!”
  right under the score.
- SEO/ASO: Polish title/description/keywords, Open Graph, Twitter card,
  JSON-LD `VideoGame`, theme color, mobile web-app meta, inline SVG favicon,
  `<noscript>`.

## 4. Legal, analytics, anti-cheat
- **Fonts self-hosted inline** in `style.css` (Russo One + Exo 2 variable,
  subset to Latin + Polish + used punctuation, ~40 KB, OFL-1.1) — no Google
  request.
- **Consent bar** (non-blocking, never in front of the first round): local
  save is strictly necessary; anonymous statistics are opt-in.
  `Analytics.track()` forwards events to a host sink (`window.dataLayer` /
  `VectorHoleNative.track`) **only after consent**. Profil → Prywatność:
  toggle, policy sheet (`openPrivacyPolicy()`), **Pobierz moje dane** (JSON
  export, GDPR art. 15/20); erasure = existing „Resetuj profil”.
  `CONFIG.legal.publisher/contact` must be filled before a commercial launch.
- **Retention telemetry:** `save.retention` (install date, active days,
  sessions); `retention_day {dayIndex, d1, d7}` once per active day,
  `session_end {durationMs}` — what a D1/D7 dashboard needs.
- **Save integrity:** every save carries an FNV `_sig` seal; a hand-edited
  save still loads (no lost progress) but is flagged
  `integrity.tampered`. `sanitizeSave()` repairs every field to
  `defaultSave()`'s shape/type and clamps currencies.
- **Clock guard:** a login claim dated after "today" blocks the calendar
  until the clock catches up (chest is self-protecting: its timestamp is
  absolute). Challenge links carry a seal; an edited score is ignored.
- Save schema **v11** (`migrateSave()` branch: audio settings, entitlements,
  ad caps, consent, retention, challenge, integrity).

## 5. Economy rebalance (bot-verified)
- Coins: `15 + 1.6·√score + place bonus [25, 15, 8]` (was `score/4 + 15`);
  newbie bonus ×1.5 (was ×2) for the first 5 runs.
- XP: `25 + 2.5·√score + place bonus` (was `25 + 0.5·score + …`).
- Rdzeń prices: 30 / 60 / 120 / 220 / 380 / 600 (were up to 450).
- 22-round greedy-bot career: ~1.4k coins after 3 runs including level
  rewards (was ~22k), LVL 15 after 22 runs (was 45 after 12).

## 6. Performance
- Adaptive quality (`GFX_LEVELS`, `Game.monitorFrame()`): sustained frames
  slower than ~42 fps mid-round step DPR 2 → 1.5 → 1 and finally disable
  canvas shadow blur and cut the particle cap; remembered per device in
  `save.settings.gfxLevel`. Late-round worst case in software rendering:
  ~27 ms → ~8 ms per frame.
- Weight: ~226 KB gzipped total (game.js 149 KB, style.css 63 KB incl.
  fonts, index.html 14 KB), zero third-party requests.

## 7. QA bot suite (`qa/`, dev-only)
See `qa/README.md`. Edge cases, features, a 20-round Arena career, 22
campaign missions and phone screenshots, all in virtual time.

## 8. Internal code review (second pass, all fixed + regression-tested)
An independent reviewer pass over the v11 diff found, and this pass fixed:
double-tapping the revive button wasted the ad and failed the mission
(in-flight guard); the graphics watchdog could downgrade on the first slow
frame and pin 30 Hz-capped phones to low quality forever (now judges real
work time per frame, warms up, re-probes one level up each session); a
failing portal SDK (e.g. Poki under an adblocker) fell back to the *paying*
demo ad (now keeps the portal provider, or `none` when the SDK is missing);
a challenge seed laid out a different map depending on what the recipient
had discovered (RNG now consumed for every group) and used the recipient's
own bot difficulty (challenges use the fixed Daily difficulty); challenge
links pointed at the raw CDN inside portal iframes / `null` on file:// (Poki
`shareableURL`/`getURLParam`, CrazyGames `inviteLink`/`getInviteParam`,
canonical URL fallback); the revive countdown kept running while paused;
emoji at the 16-char name cut broke the link seal (cut by code points); a
once-wrong future clock locked the login calendar indefinitely (>2 days
ahead now resets); the free-Turbo rematch dropped the challenge.

## Known gaps / decisions for the owner
- Google H5 rewarded ads call `showAdFn()` inside `beforeReward` right after
  the player's tap; Google's guidance prefers pre-requesting the break and
  calling `showAdFn` from the click. Revisit if AdSense H5 is the channel.
- **Revenue needs a host:** real ads require publishing on CrazyGames/Poki
  (or adding an AdSense H5 tag + a Google-certified CMP for the EEA); real
  IAP requires the native wrapper. The GitHub Pages build runs the demo
  provider.
- **No `og:image`** and **no PWA install/offline**: both need extra hosted
  files (an image; a manifest + service worker), which would break the
  "exactly three files" rule — flagged for the owner to decide.
- Anti-cheat is client-side only (seals deter casual edits); real
  leaderboards would need server-side validation.
- Balance is bot-verified, not human-verified; the greedy bot still wins at
  maximum difficulty. Collect D1/D7 + funnel data before tuning harder.
- The privacy text is a sensible default, not legal advice; fill in
  `CONFIG.legal` and have it reviewed before a commercial launch.

# Vector Hole v5 — UI/Visual-Parity Pass Plan & Changelog

## 1. What this pass actually is

Not a new game system. The user supplied 8 authored SVG mockups (screen
comps for Miasto/Dzielnice/Warsztat/Wyzwania/Pauza/Wynik rundy/Wybór
narzędzia, plus an "asset bible" style-guide sheet) and asked for the game
to be brought pixel-close to them, with any redundant instruction files
cleaned up along the way. The mockups now live in the repo as the visual
source of truth:

- `design/screens/miasto.svg` — Miasto / Core City hub
- `design/screens/dzielnice.svg` — Dzielnice district/mission list
- `design/screens/warsztat.svg` — Warsztat (shop) live preview + cosmetics grid
- `design/screens/wyzwania.svg` — Wyzwania (Daily Seed Challenge hero + daily mission)
- `design/screens/pauza.svg` — in-run pause sheet
- `design/screens/wybor_narzedzia.svg` — a quick cosmetic-swap popup opened from pause
- `design/screens/wynik_rundy.svg` — end-of-round results screen
- `design/reference/asset_bible.svg` — the in-round object bestiary (8 world-object icons), the T1–T5 size-tier outline system, mission goal-marker language, style rules, and the implementation color palette

## 2. What shipped in this pass

### 2.1 Palette (asset_bible.svg's "PALETA IMPLEMENTACYJNA")

A prior pass (v4) had already built a separate `--nc-*` "app chrome" palette
for the Miasto/Dzielnice/Warsztat/Wyzwania screens, close to but not
matching the new mockups' exact values. This pass replaced every hardcoded
neon hex across `style.css` and `game.js` with the bible's swatches:

| Role | Old | New |
|---|---|---|
| Cyan | `#00f3ff` / `#22d3ee` | `#50F0FA` |
| Pink | `#ff007f` | `#FF54AD` |
| Green | `#39ff14` / `#34d399` | `#46D99A` |
| Gold | `#ffd700` / `#ffae00` / `#fbbf24` | `#EFCB63` |
| Violet | `#b026ff` | `#9875FF` (new `--neon-violet`/`--nc-violet`) |
| App background | `#0a1220` flat | `#04101D` → `#081C2B` gradient |
| Panel | `#101d33` / `#0c1830` | `#0A2032` / `#071725` |

`body`/`.screen` now paint the same top-to-bottom navy gradient every
mockup uses instead of a flat fill. `.btn-primary` uses the mockups'
3-stop cyan CTA gradient (`--nc-cta-gradient`) instead of a flat fill;
`.btn-gold` (the "watch an ad" button) switched from a filled/pulsing gold
button to the mockups' dark-panel-with-gold-outline treatment.

### 2.2 In-round object bestiary (asset_bible.svg)

`WorldObject`'s canvas line-art (`draw()`) previously drew 5 generic
subtypes (`tree`/`lamp`/`car`/`house`/`skyscraper`). Replaced with the
bible's 8-object set, matched shape-for-shape: `latarnia` (lamp post),
`drzewo` (trunk + hollow canopy), `lawka` (bench), `samochod` (hatchback
silhouette + windshield + wheels), `kiosk` (roof + body + window),
`skrzynia` (crate + lid seam), `fontanna` (basin + rim + spout + spray),
plus a new `portal` subtype (concentric violet rings — the bible's
"functional accent" color) used exclusively for the Overdrive
`portal_rain` bonus wave (`spawnPortalRain()`), never a normal spawn.
`skyscraper` (the large-tier "big eat" building) isn't in the bible's 8 and
was kept as-is — it serves a different purpose (the biggest eatable tier),
not a street-object glyph.

`CONFIG.sizeTiers` gained a `label` per tier (`T1 · MAŁY` … `T5 ·
KOLOSALNY`) matching the bible's "POZIOMY WIELKOŚCI T1–T5" section —
previously tracked only for analytics (see `checkSizeTier()`'s old doc
comment), now surfaced on the results screen (§2.4).

Campaign's own goal-marker rendering (`CampaignEntity` `landmark`/`node`/
`pylon` — pulsing double-ring outlines, lock glyphs, functional accent
colors) was reviewed against the bible's "OZNACZENIA CELU MISJI" section
and already matches its visual language; left untouched rather than
reshuffled for its own sake.

### 2.3 Wyzwania — Daily Seed Challenge hero (wyzwania.svg)

The Daily Seed Challenge card was promoted to a full hero treatment: an
icon, a big countdown (`#challengeCountdown`, unchanged logic, just
restyled), and a two-box reward track pulling its numbers straight from
`CONFIG.hub.coreCity.dailyFirstClearGain`/`dailyNewBestGain` instead of
restating them as copy. The rotating daily mission card and the
day-streak indicator (both real, pre-existing features not present in the
mockup) stay as a secondary card below the hero — the mockup only shows
one of Wyzwania's two systems, but CLAUDE.md's §"Wyzwania" explicitly
calls for hosting both in one tab, so neither was dropped.

### 2.4 Wynik rundy / results screen (wynik_rundy.svg)

Replaced the old plain "place / score / coins" stack with: a glowing hero
score + a "NOWY PB" badge (shown when the run beat the previous Arena/Daily
best — computed in `endRound()` from a snapshot taken *before*
`finalizeRun()` mutates `save.stats.bestArenaScore`), a size-tier badge
(§2.2's new `CONFIG.sizeTiers[].label`) next to a gold "MIEJSCE" badge, a
coins-earned card, and a Core City "before → after" card. Its progress bar
is two-toned (a dim segment for the pre-run %, a bright segment for just
this run's gain) rather than one bar overdrawing another, computed from a
`corePctBefore`/`corePctAfter` snapshot taken around the `finalizeRun()`
call the same way. The existing daily/mission/hub-milestone result lines
and the full leaderboard are kept, just below the new hero (the mockup
doesn't show them, but they're real pre-existing features).

### 2.5 Pauza + quick-equip popup (pauza.svg, wybor_narzedzia.svg)

Pause sheet buttons got icons and mockup-matching labels (`WRÓĆ DO GRY`,
`RESTART MISJI / RUNDY`, `STEROWANIE`, `WYJDŹ DO MIASTA`), wrapped in a
bordered `.pause-panel` card. The pause sheet, leave-run confirm, and the
new quick-equip popup all switched from `.screen`'s opaque full-screen
background to a translucent `.overlay-screen` scrim — since the round is
truly paused (RAF cancelled, not just a hidden overlay), the last-drawn
canvas frame is still sitting there and now shows dimmed behind the panel,
matching the mockups instead of replacing the game with a solid color.

A new "ZMIEŃ WYGLĄD" button opens `#quickEquipScreen`
(`Game.openQuickEquip()`), the mockup's "WYBIERZ NARZĘDZIE" popup: one row
per Trail/Efekt pochłaniania/Overdrive, each tap cycling to the next
**owned** item in that category (`cycleQuickEquip()`), so a player can
swap a cosmetic mid-run without leaving to the full Warsztat. It
deliberately reuses the Warsztat's existing `pendingLoadout` +
`onEquipClick()` commit path instead of a second equip code path —
"WYBIERZ" commits, "ZAMKNIJ" discards the pending cycle back to
`save.*.selected`. Rdzeń (ring skin) isn't in this popup, matching the
mockup, which only lists the other three categories.

## 3. Repository layout

Two new non-runtime folders hold the reference mockups (see CLAUDE.md's
"Project" section — this doesn't touch the "exactly three files" runtime
constraint, which is about `index.html`/`style.css`/`game.js`):
`design/screens/*.svg` (the 7 screen comps) and
`design/reference/asset_bible.svg` (the style guide).

## 4. Duplicate-instruction-file check

The user asked to check for and refactor any repeated instruction files.
Checked: `CLAUDE.md` (the only one — `find` matched it twice only because
two glob patterns hit the same path), `README.md` (two lines, not
duplicative), `.github/pull_request_template.md` (a template, not
overlapping content). `docs/VECTRE_V2_PLAN.md`/`V3`/`V4_PLAN.md` look
similar in structure (audit → what shipped → gaps) but each documents a
*different* pass against a *different* source GDD version with its own
§-numbering — confirmed by diffing their headers, not just skimming — so
they're sequential changelogs by design, not copies of each other.
CLAUDE.md's own "Project" section already says to read the relevant one
rather than all three; merging them would destroy that audit trail for no
benefit, so they were left alone. Nothing was found worth deleting.

## 5. How this was tested

Served locally (`python3 -m http.server`) and walked Miasto → Dzielnice →
Warsztat → Wyzwania → an Arena round → pause → quick-equip → resume → end
of round → results screen, in a Chromium instance, checking each restyled
screen against its matching SVG side-by-side and confirming no console
errors. No automated test suite exists for this project (see CLAUDE.md's
"Commands" section) — this was a manual pass, same as prior phases.

## 6. Honest gaps

- Exact pixel/typography values (font sizes, corner radii, precise
  spacing) were matched closely, not to the pixel — the mockups are
  400×800/900 SVG comps for a fixed viewport; the live game is responsive
  across arbitrary screen sizes, so some proportions are approximations
  rather than literal transcriptions.
- The quick-equip popup's exact intended mechanic was somewhat ambiguous
  in the mockup (a "WYBIERZ NARZĘDZIE" title over cosmetic items, radio
  circles that could read as either mutually-exclusive or per-category
  toggles). Implemented as three independent per-category cycles (see
  §2.5) rather than a single exclusive choice, since Trail/Efekt/Overdrive
  are independent equip slots everywhere else in the game — a single
  exclusive pick across three different slot types would contradict how
  the rest of Warsztat works.

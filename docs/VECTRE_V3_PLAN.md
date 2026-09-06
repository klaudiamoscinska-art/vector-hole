# Vector Hole v3 — Campaign Mode (GDD 3.1) Plan & Changelog

This document is the Phase 0 deliverable for the "Vector Hole v3" pass:
what the new GDD (`VECTOR HOLE — Analiza projektowa i GDD 3.1 FINAL`,
6 września 2026) actually contains, what was built from it, what was
deliberately deferred, and the honest simplifications made along the way.
Like `docs/VECTRE_V2_PLAN.md`, it's a living plan — update it if a later
pass changes campaign scope.

**This is a separate PR from Golden Shot V2 on purpose.** V2 (Phases 1–9,
already merged to `main`) is untouched by this change except for the two
explicit P0 fixes called out in §3. If Campaign mode needs to be reverted
for any reason, this PR can be reverted on its own without touching V2.

## 1. What the GDD 3.1 document actually is

The uploaded document is explicit that it's an **audit of four saved
screenshots and a mockup**, not a confirmed description of a shipped
build: *"Nie została ukończona ani udokumentowana interaktywna runda.
Próby pobrania strony w tej sesji nie powiodły się. Nie potwierdzam stanu
aktualnego wdrożenia, kodu, FPS ani rzeczywistej retencji."* It also says
its own balance numbers are proposals, not measurements: *"Wartości
balansu i cele testów są propozycjami do sprawdzenia, nie wynikami
pomiarów ani prognozą sprzedaży."* Both disclaimers matter here: the
ranking bug it flags from a screenshot (§2 below) turned out to still be
live in this repo's actual code, but the specific numeric balance in
Campaign mode (mission timers, entity counts, growth thresholds) is
this pass's own reasonable approximation of the GDD's targets, not a
verified-correct tuning.

The document's own scope call (§01, "Najmniejszy zakres, który warto
zbudować") is: *"Jedna dzielnica, cztery misje, jeden moment wyboru mocy,
jedno widowiskowe pożarcie budowli, trzy kosmetyki oraz hub z jednym
odblokowaniem. Pozostałe 20 misji w tym dokumencie to plan rozszerzenia,
nie zobowiązanie na pierwszy sprint."* In practice the document only
*writes out* two chapters in full (Rozdział I "Plac Neonów", missions
01-04, and Rozdział II "Park Impulsów", missions 05-08) — chapters III-VI
are referenced as a roadmap table entry with no authored content at all.
This PR builds both authored chapters (8 missions, not just the 4-mission
minimum) since the GDD gives complete, implementable specs for both, and
leaves districts III-VI as a documented map placeholder with zero invented
content (see §5).

## 2. Confirmed pre-existing bug the GDD flagged (fixed here)

The GDD's §02/§03 screenshot audit calls out: *"Najważniejszy problem na
ekranie wyniku: pozycja #5 ma 219 punktów, a #6 ma 277. Ranking nie jest
więc uporządkowany malejąco według podpisanego wyniku."* Reading the
actual `game.js` in this repo confirmed the same defect still exists in
code, not just in an old screenshot: both the live HUD rank and
`finalizeRun()`'s results ranking sorted by `radius`, while the number
labeled "Wynik" next to each row is `score` — two different, uncorrelated
orderings. Fixed by a single `rankHoles()` helper (score descending,
radius then name as tiebreakers) used everywhere a rank is computed, plus
an explicit on-screen rule ("Wygrywa najwyższy wynik. Rozmiar to tylko
rozstrzygnięcie remisu.") and four explicit columns (Miejsce/Gracz/
Wynik/Rozmiar) on the results screen, per the GDD's own proposed fix.

## 3. What shipped in this pass

**Files changed**: `game.js`, `index.html`, `style.css` (still exactly
three files, no build step, no new dependency — see `CLAUDE.md`).
`SAVE_SCHEMA_VERSION` bumped 5 → 6 with a migration branch; existing
saves keep their coins/skins/hub/daily/mission progress untouched.

1. **Ranking fix (P0-01)** — §2 above.
2. **Campaign mode** — a second, mission-driven simulation alongside the
   existing 120s Arena round, entirely additive:
   - `CampaignEntity` (fragment/prop/vehicle/capsule/marker/node/pylon/
     landmark/gate), each with its own draw + interaction rule, instead of
     reusing Arena's `WorldObject`/`TIERS` (kept untouched so Arena/Daily's
     tuned balance can't regress).
   - `CAMPAIGN_TIERS` (T1–T6, GDD §07's growthUnits model) drives which
     object classes are eatable and, at T4, whether the mission's landmark
     is reachable at all — independent of the old radius-based HUD number.
   - 8 authored missions (`CAMPAIGN_MISSIONS`, districts `plac`/`park`),
     each with a goal, an optional medal, curated spawn layout, two NELA
     narration lines (start/success), and a first-clear coin reward — M04
     additionally unlocks the Park Impulsów district.
   - The GDD's "first big bite": Mission 04 (`kino`) and Mission 08
     (`fontanna`) are locked landmarks (dashed ring + 🔒) that unlock only
     once their activator objects (nodes/pylons) are cleared *and* the
     player has reached T4; eating one triggers a bigger shake/particle/
     ripple sequence and a dedicated `big_eat` analytics event.
   - `CAMPAIGN_POWERS` — Magnes/Reaktor/Impuls/Skaner, a small, campaign-
     only, run-only pool distinct from Arena's 7-mutation `MUTATIONS`.
     Offered once, as a 2-of-4 choice, partway into Mission 04 — matching
     the GDD's FTUE note that missions 01-03 must not interrupt play with
     a choice screen.
   - Hub gets a 4th tile ("KAMPANIA") opening a district-map screen
     (Plac Neonów / Park Impulsów unlocked; Port / Galeria shown as
     locked "wkrótce" teasers) and a mission list/detail panel, plus a
     dedicated mission-result screen (NELA line, medal, reward, "next
     mission" CTA) separate from Arena's game-over screen.
   - In-round HUD: a compact goal panel (cel + progress + tier bar + timer
     + score) replaces Arena's size/score/standings panels while a mission
     is running, per GDD §06's HUD zone table ("Pod górą: Cel + pasek
     wzrostu"); a NELA toast fades in/out at mission start, on landmark
     unlock, and on mission success.
3. **Touch-action scoping (P0-02, partial)** — `touch-action: none` moved
   off `html body` (which blocked scroll/gestures on *every* screen,
   including ones with more content than fits, like the new Campaign
   list) and onto `#gameCanvas` only, matching the GDD's *"touch-action:
   none dotyczy pola gry, nie wszystkich ekranów."* `.screen-inner` also
   gained `overflow-y:auto` as a safety net. The deeper ask in the same
   GDD item — migrating input from the existing touchstart/touchmove/
   touchend handlers to the Pointer Events API with `setPointerCapture`
   — was **not** done this pass: the existing touch-identifier tracking
   already handles `touchcancel`, and rewriting the whole input layer is
   a separate, higher-risk change better done on its own, not bundled
   into this content-focused pass.

## 4. Simplifications and honest gaps

Numeric balance (timers, entity counts, growth thresholds) is this pass's
own approximation of the GDD's intent, explicitly flagged by the GDD
itself as unverified — expect to retune after playtesting, not treat as
final:

- **Bots in Campaign are passive wanderers, not hunters.** Missions 01-03
  and 05-07 have zero bots (matches the GDD's explicit "pierwsze trzy
  misje nie uczą przez nagłą eliminację" and keeps early missions from
  ever being unfair). Missions 04/08 spawn one wandering (not hunting)
  bot so the "Zakończ bez trafienia przez bota" medal is meaningful. A
  full campaign-tuned bot AI (sizing, aggression curve) is not built.
- **Gates (Mission 05) and pylon "charging" (Mission 08) are simplified.**
  A gate cycles open/closed on a fixed timer with a 1.5s amber telegraph
  before closing (matches the GDD's "poznaj rytm otwarcia") and a closed
  crossing is a soft bounce-back, not a hard block or random penalty.
  Pylons activate on contact rather than requiring a sustained charge
  duration — the GDD doesn't specify an exact charge time, and "touch to
  activate" keeps the mechanic consistent with nodes (Mission 04).
- **World is a 1400×1400 sub-box** (`CONFIG.campaign.bounds`) centered in
  the existing shared 3000×3000 world, not a new world size — this kept
  `Hole`'s movement/clamp code completely untouched while still giving
  each 60-120s mission a travel-appropriate area.
- **Districts III-VI (Port, Galeria, + whatever comes after) have zero
  authored content in the GDD** and are not built — they render on the
  hub map as locked/teaser nodes only, per §1's scope call.
- **No backend, no ranked/league leaderboard, no real ad/IAP SDK** — all
  already-established non-goals from `docs/VECTRE_V2_PLAN.md` and
  `CLAUDE.md`, unchanged by this pass.
- Analytics gained `mission_start`, `mission_end`, `mission_bot_hit`, and
  `big_eat` events (console-log stub, same as every other event).

## 5. Save schema v6

```
save.campaign = { unlockedDistricts: ['plac'], completed: {}, medals: {} }
```

`unlockedDistricts` starts with just `plac` so a fresh save can play
Mission 01 immediately; `park` is added the first time Mission 04 is
cleared. `completed`/`medals` are keyed by mission id (`M01`..`M08`).
Migration (`migrateSave()`, v5 → v6) adds this field to existing saves
without touching coins/skins/hub/daily/mission progress; verified via a
local Playwright script that seeds a v5 save shape and reloads.

## 6. How this was tested

No test runner exists in this repo (see `CLAUDE.md`). Verified via
throwaway Playwright scripts against `python3 -m http.server`, mirroring
how prior phases were checked:

- All 8 missions driven end-to-end (an in-page script that eats the
  nearest currently-eatable entity each tick, tier-aware, with dedicated
  handling for gates and the evolution-power prompt) — all 8 completed
  successfully with their medal earned, `park` unlocking after M04, and
  save state (`completed`/`medals`/`unlockedDistricts`) persisted
  correctly.
- A v5-shaped save seeded into `localStorage`, then reloaded — confirmed
  migration to v6 with `campaign` present and prior fields untouched.
- A scripted Arena round with deliberately radius/score-uncorrelated bots
  — confirmed the results screen and live rank now sort strictly by
  score with radius as a documented tiebreaker.
- Manual screenshot review of the hub, campaign map, in-round campaign
  HUD, mission-result screen, and Arena results screen at a 390×844
  (phone) viewport.
- A full Arena round started immediately after finishing Campaign
  missions, to confirm mode-switching doesn't leak Campaign state
  (entities, HUD panels, combo window) into Arena.

No FPS/perf profiling and no real-device touch testing were done — the
GDD's own disclaimer about not being able to confirm real performance
applies here too.

## 7. Vector Hole v4 — player feedback pass

A follow-up pass fixing eight issues reported after playing this build, all
in `game.js`/`index.html`/`style.css` (no schema bump — no save-shape
change):

1. **Minimap only showed large/green objects** (Arena) and only
   landmark/node/pylon (Campaign) — both minimaps now draw every live
   object/entity, colored and sized by tier/type.
2. **No way back to the main menu from a mission** — the mission result
   screen only had Next/Retry/Map; added a MENU GŁÓWNE button, and gave
   Campaign its own `leaveCampaignMission()` (see #5's root cause below)
   instead of reusing Arena's `finalizeRun()`.
3. **Evolution/power cards didn't stop gameplay** — offers used to only
   slow the world (`slowMotionFactor`) with a 5s forced auto-pick and no
   way to decline. `loop()` now skips `update()`/`updateCampaign()`
   entirely while a card offer is open (a true pause, not just a slow
   one), a "POMIŃ" button lets the player close the offer without picking,
   and `autoPickMs` is now a 20s AFK-only safety net. Cards also gained a
   small inline-SVG icon per mutation/power and much shorter `desc` text.
4. **No play-area bounds in Campaign** — `Hole.moveToward()`/
   `moveDirection()` only ever clamped to the shared 3000×3000 world, not
   to a mission's much smaller `CONFIG.campaign.bounds` box, so the player
   (or a bot) could wander into empty space outside the box with none of
   the mission's entities in sight. Added `clampToCampaignBounds()` (player
   + bots) and a dashed boundary rectangle so the edge is visible.
5. **Pause sheet's restart button always started a random Arena round** —
   `restartFromPause()` called `startRound()` unconditionally, even mid-
   mission; it now restarts the current mission in Campaign mode. The
   pause sheet's "leave" button had the same bug in spirit: `leaveRun()`
   ran Arena-only `finalizeRun()` side effects (City Core charge, daily
   mission check) even when leaving a mission; it now calls the new
   `leaveCampaignMission()` for Campaign instead.
6. **Park Impulsów missions had long empty-board stretches** — M06
   ("Zielona fala")'s capsule waves were 40s apart (`[0, 40, 80]`); once a
   wave was cleared (well under 40s), the board sat empty for ~15-20s
   waiting for the next one. Tightened to `[0, 18, 34]`. Separately, M05's
   gate entities were invisible: `CONFIG.campaign.entityRadius` had no
   `gate` key, so gates drew at `radius=undefined` (NaN geometry, silently
   skipped by the canvas spec) — added `gate: 18`.
7. **Board objects didn't signal the mission goal** — added
   `campaignGoalEntityTypes()` (derived from the mission's `goal`) and a
   pulsing gold ring drawn behind whichever entities currently count
   toward it, so the goal text and the objects to look for are visually
   tied together.
8. **Campaign entity icons were too generic to read at a glance** — `prop`
   (plain square), `vehicle` (plain rectangle), `capsule` (hexagon), and
   `marker` (plain triangle) were redrawn as a traffic-cone, a car
   silhouette (body + roof + two wheels), a pill split down the middle,
   and a flag on a pole, respectively — still simple line art, just
   recognizable as the specific object each type represents.

Verified via the same throwaway-Playwright-script approach as prior
passes: driving all 8 missions to completion with dt-stepped
`updateCampaign()` calls (confirmed M06's empty-board gap collapsed from
~34s total to a single sub-2s blip), screenshotting the new icons/
boundary/goal-highlight/card overlay, and scripted checks that the round
truly freezes (timer and player position unchanged) while a card offer is
open and resumes immediately on skip.

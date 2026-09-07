# Vector Hole v6 — Campaign Mission-Object Enrichment Plan & Changelog

This document is the plan/audit/changelog for the "Vector Hole v6" pass:
what `design/IMPLEMENTATION_BRIEF_MISSION_SCREEN.md` asked for, what was
built from it, and what was deliberately deferred. Like
`docs/VECTRE_V2_PLAN.md` through `docs/VECTRE_V5_PLAN.md`, it's a living
document — update it if a later pass changes scope.

## 1. What this pass actually is

Not a new game system — Campaign mode's four goal shapes
(`eatCount`/`comboChain`/`gatesPassed`/`activateAndDevour`) and its 24
missions/6 landmarks/entity taxonomy all stayed exactly as v3/v4 built
them. The brief's own framing (`design/GAME_MECHANICS_AUDIT.md`, written
against the state after PR #12/v5) was: every `activateAndDevour` mission
used one generic `pylon` sprite, every generic-collectible `eatCount`
mission used one generic `marker` sprite, every landmark drew the same
pulsing double-ring, and three GDD objects with a different verb than
"pochłoń" (Portal, Mostek, Pas przelotu) were implemented as plain
`eatCount`/`activateAndDevour` with no real mechanic behind the label. This
pass replaces the sprites, gives each landmark a real silhouette, and adds
genuine mechanics for those three objects — scoped explicitly to the
mission-screen (`updateCampaign()`/`renderCampaign()`); Arena is untouched.

Source material, all under `design/`:
- `design/IMPLEMENTATION_BRIEF_MISSION_SCREEN.md` — the task brief
- `design/GAME_MECHANICS_AUDIT.md` — the pre-pass "how the game actually
  works" reference the brief was written against (now updated, see §4)
- `design/assets/vector_hole_full_object_catalog.svg` + companion
  `OBJECT_CATALOG_SPEC.md` — the 24-object catalog and the 4 structural
  exceptions (Brama/Mostek/Portal/Pas przelotu)
- `design/gameplay/vector_hole_mission_board_finale.svg` + companion
  `MISSION_BOARD_SPEC.md` — the 6 landmark silhouettes and the (optional)
  4-state collapse sequence

## 2. Step 0 — what the brief assumed vs. what the code actually had

The brief explicitly asked for a code-first verification pass before
writing anything, since it was written without direct repo access. Checked
directly in `game.js` before implementing:

- Arena's `TIERS` (small/medium/large) and `portal`'s use as an
  Overdrive-only bonus subtype (`spawnPortalRain()`) — confirmed, but
  turned out irrelevant: the whole brief operates on `CampaignEntity`
  (Campaign's own, separate entity system), not Arena's `WorldObject`.
- `activateAndDevour`'s activator entity: the brief assumed a single
  generic `pylon` used everywhere. The code actually already had **two**
  distinct `CampaignEntity` types doing this job — `'node'` (M04, M12,
  M19, M23) and `'pylon'` (M08, M16) — just with no per-mission visual
  distinction *within* each type. Corrected the plan to add glyphs on top
  of the existing two types rather than introducing a third.
- M19 ("Zasil 2 mostki i otwórz iglicę"): the brief assumed it used the
  generic `pylon` activator. It actually uses `'node'` (`activator: 'node'`
  in `CAMPAIGN_MISSIONS`) — the mostek glyph/mechanic was wired onto
  `'node'`, not `'pylon'`.
- `landmarkId` for M24: confirmed as `'rdzen_miasta_glowny'` (the brief's
  own placeholder guess was `'rdzen_miasta'`, flagged as unverified).
- `skrzynia` (M09): confirmed it did **not** exist as its own entity — M09
  used the generic `'prop'` type (drawn as a traffic cone), same as M02's
  unrelated "elementy uliczne" filler.

## 3. What shipped in this pass

**Files changed**: `game.js` only (still exactly three runtime files, no
build step, no new dependency).

### 3.1 Per-mission object glyphs (Task 1)

`CampaignEntity` gained an optional `glyph` field, set per-mission in
`buildCampaignMission()` via three lookup tables (`MARKER_GLYPHS`,
`PROP_GLYPHS`, `NODE_GLYPHS`) plus a one-line check for the two `pylon`
missions. `glyph` is purely visual — `CampaignEntity.draw()` branches on it,
but stats/eat-gating/goal-checking all stay keyed by `type` exactly as
before, so none of `CAMPAIGN_ENTITY_STATS`, `checkCampaignGoal()`, or
`tryUnlockCampaignLandmark()` changed.

| Type | Glyph | Mission(s) | GDD object |
|---|---|---|---|
| `node` | `wezel` (default) | M04, M23 | Węzeł |
| `node` | `zasilacz` | M12 | Zasilacz |
| `node` | `mostek` | M19 | Mostek (see §3.3) |
| `pylon` | `pylon` (default) | M08 | Pylon (real graphic, was a placeholder line+circle) |
| `pylon` | `lustro` | M16 | Lustro |
| `marker` | `znacznik_ogrodu` | M07 | Znacznik ogrodu |
| `marker` | `paleta` | M10 | Paleta |
| `marker` | `krysztal` | M13 | Kryształ (see §3.3) |
| `marker` | `witryna` | M14 | Witryna |
| `marker` | `klucz_sektora` | M15 | Klucz sektora |
| `marker` | `emiter` | M21 | Emiter |
| `prop` | `skrzynia` | M09 | Skrzynia |
| `prop` | `modul_dachowy` | M17 | Moduł dachowy |
| `prop` | (default cone) | M02 and all filler props | "elementy uliczne" |
| `vehicle` | (all) | M11 goal + filler everywhere | Pojazd konwoju gets a tow-hitch accent, applied to every vehicle since it's the one vehicle look in Campaign |

Not changed: `capsule` (M06) and the default `vehicle` body already had a
distinct, GDD-appropriate look before this pass (a pill and a car
silhouette respectively) — no new subtype was needed for either.

### 3.2 Unique landmark silhouettes (Task 2)

`CampaignEntity.draw()`'s `'landmark'` case now branches on `landmarkId`
for 6 unique silhouettes (per `vector_hole_mission_board_finale.svg`):
`kino` (M04), `fontanna` (M08), `dzwig` (M12), `galeria_glowna` (M16),
`iglica` (M20), `rdzen_miasta_glowny` (M24, gets the extra gold accent per
the spec's "wielki finał" rule). `iglica_wejscie` — M19's own mid-mission
gate-landmark, not one of the 6 GDD boss landmarks and not covered by the
spec — reuses the Iglica silhouette at 62% scale rather than inventing a
7th shape from nothing. The locked-padlock overlay stays a shared visual on
top of all of them, unchanged.

"Collapse" (spec §4) was implemented as the simplified version the brief
explicitly allowed: a second, cyan fragment-colored particle burst layered
under the existing gold one in `resolveCampaignEntity()`, so the landmark
visibly breaks into fragment-like debris. The full 4-state sequence (target
→ charging sub-goal counter → collapse animation → absorbed, with its own
400–600ms timing) was **not** built — this is the one part of the brief
explicitly marked optional/skippable that was, in fact, skipped.

### 3.3 Real mechanics for Portal, Mostek, Pas przelotu (Task 3)

The three GDD objects with a verb other than "pochłoń"
(`OBJECT_CATALOG_SPEC.md` §2) now have real behavior beyond a relabeled
`eatCount`/`activateAndDevour`. Brama (M05) was already correct
(`gatesPassed`) and untouched.

- **Portal (M13)**: a fixed `CampaignEntity('gate', ..., { glyph: 'portal' })`
  near the player's spawn. Touching it while lit
  (`handlePortalTouch()`) teleports the player to a fixed anchor on the far
  side of the play area, where the 6-8 kryształy (now clustered there
  instead of split into the generic route A/B halves) are waiting.
- **Mostek (M19)**: a `'node'` entity with `glyph: 'mostek'` that never
  gets eaten/consumed (`handleCampaignEating()` explicitly skips it).
  `handleCampaignBridges()` powers it in place on touch — same
  growth/score/combo reward as a normal node eat, but it stays visible on
  the board with an "active" look instead of fading out. Still increments
  `m.nodesDisabled`, so `tryUnlockCampaignLandmark()`/`checkCampaignGoal()`
  needed no changes.
- **Pas przelotu (M18)**: the 3 `'gate'` entities now carry
  `glyph: 'pas_przelotu'` and a `zoneHalfWidth`. `handleCorridorZone()`
  tracks which side the player entered/exited from and only counts a pass
  when the crossing happened fully inside the lit window — a real
  entry/exit zone check instead of a single point-touch, per the spec.

Decisions made where the spec (`OBJECT_CATALOG_SPEC.md` §4) explicitly
left the question open, since none of them were answered in the GDD:

- **Portal is one-way and single-use per run.** There's exactly one
  physical portal entity on the board, so a "return trip" has no natural
  anchor to teleport back from, and the mission goal (reach the far-side
  crystals) never requires one.
- **Mostek needs no separate "zasilacz" object** — touching the mostek
  itself powers it. It also doesn't physically block movement before being
  powered; a blocking variant was considered and dropped because it
  creates a chicken-and-egg problem (you can never touch something that
  pushes you away from it).
- **Pas przelotu stays a `'gate'`-family entity with a wider zone**, not a
  new "corridor" data type — reuses the existing open/closed cycle timing
  (`CONFIG.campaign.gate`) rather than inventing new balance numbers.
- **Brama's cycle rhythm stays fixed** (not varied per district/difficulty)
  — out of scope for this pass, no mission asked for it.

### 3.4 Two pre-existing bugs fixed along the way

Found while implementing §3.2/§3.3, not part of the original brief, but
directly blocking it (Task 2 has nothing to render for a landmark that
doesn't exist):

1. **M20 and M24 never created a landmark entity at all.**
   `buildCampaignMission()` read the landmark id from `def.goal.landmark` —
   present for M04/M08/M12/M16/M19 (which duplicate the id in both `goal`
   and `setup`), but M20 and M24's `goal` object has no `landmark` field at
   all, only `setup.landmark`. Fixed by reading from `s.landmark` instead,
   which every landmark mission sets.
2. **Even once created, that landmark could never become eatable.**
   `handleCampaignEating()` gates landmark eating on `unlocked`, which is
   only ever set by `tryUnlockCampaignLandmark()` — which only runs for
   `activateAndDevour` missions. M20/M24 are plain `eatCount` goals with no
   activator, so `unlocked` would stay `false` forever. Fixed by starting
   the landmark `unlocked: true` whenever the mission's goal isn't
   `activateAndDevour` — both GDD labels ("Pochłoń centralną iglicę" /
   "Pochłoń główny rdzeń miasta") describe a direct big-eat with no priming
   step.

Together, these two bugs meant **M20 and M24 — including the campaign
finale — could not be completed** before this pass. Verified fixed by
playing both missions start-to-finish through the real game loop (see §5).

## 4. Documentation updated alongside this pass

`design/GAME_MECHANICS_AUDIT.md` (§1.3, §3.4, §3.5) and root `CLAUDE.md`
(Campaign mode section) were updated to describe the state after this pass
instead of before it. `design/IMPLEMENTATION_BRIEF_MISSION_SCREEN.md`,
`design/assets/OBJECT_CATALOG_SPEC.md`, and
`design/gameplay/MISSION_BOARD_SPEC.md` were left as historical records of
*intent* (same posture as the GDD) with a one-line status banner added,
pointing back at this document for what actually shipped and which open
questions got resolved. `docs/VECTOR_HOLE_GDD_4_0.pdf` was not touched.

## 5. How this was tested

No automated test suite exists for this project (see CLAUDE.md's
"Commands" section). Verified with a Playwright script driving
`window.game` directly against a local static server:

- All 24 missions started and ran ~1s of simulated frames each with no
  console errors; entity glyph lists spot-checked against §3.1's table.
- Portal (M13): touching the portal while lit moved the player to the far
  anchor, with the crystal cluster nearby afterward, and the portal became
  single-use (`passCooldown` pinned high).
- Mostek (M19): touching both bridges powered them (`mostekPowered: true`),
  incremented `nodesDisabled`, unlocked the `iglica_wejscie` landmark, and
  the landmark could then be eaten to end the mission.
- Pas przelotu (M18): a slow, continuous walk across a zone while lit
  registered a pass; a fast crossing timed to straddle the closed window,
  and a crossing that started during the closed window, both correctly did
  **not** count — confirms the "must be lit at both entry and exit" rule
  actually gates completion rather than just being decorative.
- **M20 and M24 specifically** (given they involved a real bug fix, not
  just new visuals): played end-to-end through the actual production
  movement/eating/goal-checking path — driving `pointerWorld` toward the
  nearest eatable entity each frame (the same code path a real
  desktop-drag player uses via `applyPlayerMovement()`), not by manually
  teleporting the player or poking internal state. Both missions completed
  well inside their time limits, `mission.ended` was `true`,
  `save.campaign.completed` was set, coins were awarded, and M24
  specifically unlocked the `aurora` finale cosmetic
  (`save.owned.includes('aurora')`).

## 6. Honest gaps

- The full 4-state landmark collapse sequence (§3.2) was simplified to an
  extra particle burst, per the brief's own explicit permission to skip it
  if it added too much complexity for the first iteration.
- M16's "Kaskada luster" is still just a relabeled `activateAndDevour` —
  the `lustro` glyph looks like a mirror, but there's no actual
  reflection/bounce mechanic behind it. This remains an honest example of
  the "24 missions share 4 goal templates" simplification the pre-pass
  audit described — it just no longer applies to Portal/Mostek/Pas
  przelotu the way it used to.
- Vehicle movement ("Porusza się po torze" per `OBJECT_CATALOG_SPEC.md`'s
  row for Pojazd konwoju) was not built — M11's convoy vehicles are
  stationary like every other Campaign entity, just visually tagged with a
  tow-hitch accent. The spec itself frames this as flavor text describing
  the same "pochłoń" mechanic, not a required behavior.
- Balance is unverified for the new mechanics (portal travel distance,
  corridor timing window vs. player speed) beyond confirming missions are
  completable within their time limits during testing — same caveat v3/v4
  already carry for the rest of Campaign's numbers.

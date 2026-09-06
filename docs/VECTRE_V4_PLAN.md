# Vector Hole v4 — GDD 4.0 Plan & Changelog

This document is the plan/audit/changelog for the "Vector Hole v4" pass:
what `docs/VECTOR_HOLE_GDD_4_0.pdf` ("VECTOR HOLE — FINALNY KOMPLETNY GDD
4.0", explicitly written *"Wersja docelowa dla Claude"*) actually contains,
what was built from it, and what was deliberately deferred. Like
`docs/VECTRE_V2_PLAN.md` and `docs/VECTRE_V3_PLAN.md`, it's a living
document — update it if a later pass changes scope.

## 1. What GDD 4.0 actually is

The document's own stated purpose (cover page) is to **replace earlier
ambiguity about how four systems relate to each other**: *"Ten dokument
zastępuje wcześniejsze niejasności dotyczące relacji: Misje / Graj 2:00 /
Wyzwanie dnia / Core City / Warsztat."* Its single most important rule,
stated in red in §0 and repeated in §4.4/§8.4, is:

> **Misje NIE napełniają Core City. Core City napełniają wyłącznie GRAJ
> 2:00 i Wyzwanie dnia.**

and its second rule is that the Miasto/Core City screen and the
Dzielnice/Misje screen **must never show the same percentage** (§8.4
"zasady anti-confusion").

Both of these were *already* true in this repo's v3 code (`endCampaignMission()`
never called `finalizeRun()`, and the campaign map never rendered
`save.hub.coreCharge`) — so v4's job was less "fix a conflation bug" and
more "author the content and exact numbers GDD 4.0 specifies, and make the
UI actually *show* the relationship the GDD describes instead of leaving it
implicit."

## 2. What shipped in this pass

**Files changed**: `game.js`, `index.html`, `style.css` (still exactly
three files, no build step, no new dependency). `SAVE_SCHEMA_VERSION`
bumped 6 → 7 with a migration branch; existing saves keep all prior
progress (coins, skins, hub charge, campaign completion, daily records).

### 2.1 Full 24-mission, 6-district campaign (§6)

GDD 4.0 is the first version of the document to write out a complete
mission table for all six districts (`Plac Neonów`, `Park Impulsów`,
`Port Syntez`, `Galeria Glitch`, `Dachy Prądu`, `Rdzeń Miasta` — 4 missions
each). v3 only had authored content for the first two; `docs/VECTRE_V3_PLAN.md`
explicitly left III-VI as "zero authored content, locked teasers." This
pass authors all 24 missions (`CAMPAIGN_MISSIONS`) and all 6 districts
(`DISTRICTS`), reusing the existing engine primitives from v3 rather than
inventing new mechanics per mission:

- Every new mission's goal is one of the four goal shapes the v3 engine
  already supports (`eatCount`, `comboChain`, `gatesPassed`,
  `activateAndDevour`), with the entity type/count/landmark chosen to match
  the GDD table's flavor text (e.g. M09 "moduły skrzyń" reuses the `prop`
  entity type, same as v3's traffic-cone props elsewhere — the goal label
  is mission-specific even where the underlying entity type is reused,
  which is the same pattern v3 already shipped for M07's "znaczniki
  ogrodu").
- District unlock chain: M04→park, M08→port, M12→galeria, M16→dachy,
  M20→rdzen, and M24 (the campaign's final mission) grants a dedicated
  final-cosmetic reward (`reward.unlockSkin: 'aurora'`) instead of
  unlocking a further district.
- Each district's mission 4 offers a Campaign Power pick
  (`evolutionOffer`), matching the pattern M04/M08 already established.
- **Simplification, called out explicitly per the project's own practice**:
  a few GDD table rows describe a mission with two intertwined mechanics
  in one sentence (e.g. M13 "Użyj portalu i zbierz 6 kryształów"). Where
  the v3 engine's goal types support only one tracked condition per
  mission, the more central noun became the tracked goal (6 crystals) and
  the other element (the portal/gate) is present on the board as
  atmosphere/traversal rather than a second tracked condition. This is the
  same kind of numeric-balance liberty v3's own plan doc already took and
  flagged; GDD 4.0's own §1 disclaimer ("Wartości balansu... są
  propozycjami do sprawdzenia") covers it.

### 2.2 Core City economy rework (§7.2/§7.3/§8.2)

Replaced the flat "+12% every run, reset to 0% at 100%, grant next unowned
skin-then-aura" logic with the GDD's actual table:

- **Arena (GRAJ 2:00)**: +8% on completion, +2% more for a Top-3 finish,
  +3% more for 1st place (additive — GDD §7.3 explicitly resolves "does it
  replace or add to Top-3?" as *"dodaje"*), +2% more for a new personal
  best (tracked in a new `save.stats.bestArenaScore`, capped at once per
  round since it's a boolean condition).
- **Wyzwanie dnia (Daily)**: +20% for the day's first completion, +10%
  more for a new Daily best (read as the GDD's "cel premium/złoty" bonus
  row, since the document doesn't define a separate score threshold for
  "premium" beyond "lepsze wykonanie" — reusing the already-tracked
  `isNewBest` flag was the faithful reading available without inventing an
  unspecified number).
- **Overflow carries into the next level** instead of resetting to 0, per
  §7.3's worked example (92% + 20% ⇒ 100% grants the level reward, new
  level starts at 12%). `save.hub.coreCharge` is now paired with a real
  `save.hub.coreLevel` counter (previously there was no level number, only
  a repeating 0-100% bar).
- **The 6-level reward ladder (§8.2)** is implemented exactly:
  LVL2 → Trail „Impuls” + 150 monet, LVL3 → Rdzeń „Kryształ” + 200,
  LVL4 → Efekt „Pixel Burst” + 250, LVL5 → Overdrive „Fala” + 300,
  LVL6 → Zestaw „Pryzmat” (all four categories at once) + badge + 400.
  LVL7+ has no authored reward in the GDD (its own §8.2 disclaimer: beyond
  LVL6 is "a seasonal/prestige loop", explicitly out of scope) so it falls
  back to the same currency-bonus behavior the old "everything already
  owned" case used.

### 2.3 Two new Warsztat cosmetic categories (§5.3)

The GDD's Warsztat mockup shows four equip categories — Rdzeń, Trail,
Efekt pochłaniania, Overdrive — where v3 only had two (ring skins, auras).
This pass adds `EAT_EFFECTS` and `OVERDRIVE_SKINS`, each wired into a real
rendered effect rather than being inert data:

- **Rdzeń** = the existing ring skin system (`SKINS`), unchanged.
- **Trail** = the existing following-glow aura system (`AURAS`), renamed
  in the UI only — same render path.
- **Efekt pochłaniania** = a color override on `triggerEatFeedback()`'s
  particle burst/ripple, applied only to eats the player caused.
- **Overdrive** = a color override (`--overdrive-color` CSS var) on
  Arena's existing seeded Overdrive banner (`checkOverdriveTrigger()`) —
  cosmetic only, doesn't change which variant (blackout/portal_rain) a
  seed picks.

All four categories share one rendering/purchase code path
(`renderCosmeticGrid`/`cosmeticLockLabel`) instead of four near-duplicate
functions, and reward-only items show their unlock source ("CORE CITY
LVL 3", "MISJA M24") instead of a price, matching §5.3's "czytelne źródło
blokady" requirement.

### 2.4 Bottom nav + Wyzwania tab (§5.1-§5.5)

Replaced the v2/v3 hub's 4-tile grid (Kampania/Wyzwanie dnia/Warsztat/
Profil) with a persistent bottom nav (Miasto/Dzielnice/Warsztat/Wyzwania)
shown across those four screens, per the GDD's mockups. Profil moved to a
small header gear icon (⚙), matching the mockup's header (currency + gear,
no separate profile tile).

**Wyzwania** is a new screen (§5.4's "MVP może ograniczyć się do ekranu
Daily + countdown do resetu"): it now hosts both existing daily systems
(the rotating daily mission from v2, and the Daily Seed Challenge from v2)
plus a live UTC countdown to the next reset and a new consecutive-day
streak counter (`save.daily.streak`), which the v3/v2 code never tracked.

**Unlock order (§5.5)**, enforced via `renderBottomNav()`/
`isArenaUnlocked()`/`isWarsztatUnlocked()`/`isWyzwaniaUnlocked()`:
Dzielnice is always available (the campaign is the onboarding); GRAJ
2:00/Wyzwanie dnia's underlying round unlocks after M01; Warsztat unlocks
after M02 *or* owning any non-default cosmetic already (so a save that
somehow already has one isn't locked out); Wyzwania (and, per the same
table row, "full meta navigation") unlocks after M04.

### 2.5 Anti-confusion copy (§8.3/§8.4)

- Miasto header/copy matches §8.3's table exactly: "LVL X · do następnej
  nagrody", "Postęp za GRAJ 2:00 i Wyzwanie dnia", a reward-preview card
  reading "Po 100% odblokujesz: [next level's reward]", and a 3-bullet
  "Jak to działa?" panel.
- Dzielnice's district header now reads "ODBUDOWA: X% · Y z Z misji" (the
  district's own mission-completion fraction) and never the Core City
  percentage, per §8.4's explicit rule.

## 3. What's deliberately not built

Same "no half-finished implementations" policy as v2/v3:

- **A season/prestige loop past Core City LVL6** — GDD 4.0 §8.2 calls this
  out as its own future phase, not part of this document's scope.
- **A literal two-condition goal tracker** for the handful of mission
  descriptions that name two mechanics in one sentence (§2.1 above) — the
  v3 engine's one-goal-per-mission model was kept rather than adding a
  compound-goal system for a handful of missions.
- **Backend, real ad/IAP SDKs, a full authored chunk/district generator**
  — unchanged from v2/v3; still `CONFIG.flags.monetizationAdapters` /
  `proceduralDistricts` staying `false`, see `docs/VECTRE_V2_PLAN.md`.
- Balance numbers (mission timers, entity counts, Core City % values) are
  reproduced from the GDD table as-is; the GDD's own §1 disclaimer that
  these are proposals to verify, not measured targets, still applies.

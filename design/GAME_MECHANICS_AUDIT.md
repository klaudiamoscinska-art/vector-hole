# Vector Hole — jak działa gra dzisiaj + audyt zgodności z GDD 4.0

> **Cel tego dokumentu:** dać jeden aktualny, sprawdzony w kodzie opis tego, jak
> gra faktycznie działa (po pasie v5 UI, PR #12, merge do `main`), oraz
> uczciwie rozliczyć `docs/VECTOR_HOLE_GDD_4_0.pdf` z rzeczywistością —
> co dokument trafnie opisuje, a czego nie oddaje.
>
> **Metoda:** każde twierdzenie poniżej zostało zweryfikowane bezpośrednio w
> `game.js`/`index.html`/`style.css` (nie zgadywane z dokumentacji) —
> konkretne wartości liczbowe, nazwy pól i ID cytowane niżej pochodzą wprost
> z kodu. Tam gdzie porównuję z GDD, cytuję jego dokładny tekst.
>
> **Stan na:** merge PR #12 (`Vector Hole v5: match UI to the 8 authored
> screen mockups`), branch `main`.
>
> **Aktualizacja (Vector Hole v6):** §1.3, §3.4 i §3.5 poniżej zostały
> zaktualizowane po pasie wzbogacenia obiektów planszy misji (unikalne
> sprite'y per misja, unikalne landmarki, realne mechaniki Portalu/Mostku/
> Pasu przelotu) — patrz `docs/VECTRE_V6_PLAN.md` po pełny opis tego, co
> faktycznie powstało, i decyzje podjęte tam, gdzie brief zostawiał otwarte
> pytania. Reszta dokumentu (Arena, meta/ekonomia, §1.1/§1.2/§1.4–§1.12,
> §2, §3.1–§3.3, §3.6–§3.10) opisuje kod nietknięty w tym pasie i zostaje
> bez zmian.

---

## 1. Jak działa gra dzisiaj

### 1.1 Ogólna architektura

Zero-build, 3 pliki (`index.html`/`style.css`/`game.js`), wszystkie ekrany
istnieją naraz w DOM i są przełączane klasą `.hidden`. `Game` to jedna klasa
sterująca wszystkim: stanem (`GameState`: BOOT/MENU/MATCH_SETUP/PLAYING/
PAUSED/RESULTS), zapisem (`localStorage`, klucz `vectorHoleSave_v1`,
`SAVE_SCHEMA_VERSION` = 7 z łańcuchem migracji), pętlą gry (`requestAnimationFrame`)
i całą logiką ekranów. Gra ma **dwa niezależne tryby**, które nie dzielą list
encji: **Arena** (`update()`/`render()`) i **Kampania** (`updateCampaign()`/
`renderCampaign()`), przełączane przez `Game.mode`.

### 1.2 Miasto (hub, ekran główny)

Nagłówek (saldo Coins ◇ + Prisms ◆ + ⚙ do Profilu) → hero panel z sylwetką
miasta i pierścieniem postępu Core City (`%`, `LVL X · do następnej
nagrody`) → karta "Po 100% odblokujesz" → rząd CTA (`GRAJ 2:00` primary,
`WYZWANIE DNIA` secondary) → panel "Jak to działa?" → wiersz najbliższej
nagrody → dolny pasek nawigacji (Miasto/Dzielnice/Warsztat/Wyzwania).

**Core City** to jedyny "duży" pasek meta-progresu. Napełniają go **wyłącznie**
rundy Areny i Wyzwania dnia, nigdy misje kampanii (`finalizeRun()` jest
jedynym miejscem, które go rusza; `endCampaignMission()` nigdy go nie
dotyka). Realne wartości przyrostu (`CONFIG.hub.coreCity`):

| Źródło | Przyrost |
|---|---|
| Ukończona runda Areny | +8% |
| Top 3 w Arenie | +2% (dodatkowo) |
| 1. miejsce w Arenie | +3% (dodatkowo, nie zamiast Top 3) |
| Nowy rekord (PB) w Arenie | +2% (max raz na rundę) |
| Pierwsze ukończenie Wyzwania dnia | +20% |
| Nowy rekord w Wyzwaniu dnia | +10% (dodatkowo) |

Nadwyżka ponad 100% przechodzi na kolejny poziom (pętla `while`, więc jedna
duża runda może dać kilka poziomów naraz). Nagrody za poziomy (`CORE_CITY_LEVEL_REWARDS`):
LVL2 → Trail „Impuls” + 150 monet, LVL3 → Rdzeń „Kryształ” + 200, LVL4 →
Efekt „Pixel Burst” + 250, LVL5 → Overdrive „Fala” + 300, LVL6 → zestaw
„Pryzmat” (wszystkie 4 kategorie na raz) + odznaka + 400. LVL7+ nie ma
autorskiej nagrody — dostaje stały fallback (100 monet + 10 pryzmatów).

### 1.3 Dzielnice (kampania, 24 misje)

Pasek dzielnic (chip strip) → nazwa dzielnicy + „ODBUDOWA: X% · Y z 4 misji”
(nigdy duży okrąg Core City — świadomie odseparowane) → lista misji ze
statusem (ukończona/dostępna/zablokowana) → szczegóły wybranej misji → GRAJ.

Wszystkie **24 misje** (`CAMPAIGN_MISSIONS`) są w pełni zaimplementowane, po
4 na każdą z 6 dzielnic (Plac Neonów, Park Impulsów, Port Syntez, Galeria
Glitch, Dachy Prądu, Rdzeń Miasta). Każda ma jeden z 4 uniwersalnych typów
celu: `eatCount` (zjedz N sztuk danego typu), `comboChain` (zbuduj serię
pożarć), `gatesPassed` (przejdź przez bramy w oknie czasowym),
`activateAndDevour` (aktywuj N aktywatorów → odblokuj i zjedz landmark).
Misja 4 każdej dzielnicy kończy się landmarkiem i odblokowuje kolejną
dzielnicę; M24 zamiast tego daje unikalny kosmetyk finałowy (`aurora`).
Restart z pauzy restartuje **tę samą** misję, nie losową rundę Areny.

**Bestiariusz obiektów Kampanii (v6, `design/assets/vector_hole_full_object_catalog.svg` +
`design/gameplay/vector_hole_mission_board_finale.svg`):** te 4 typy celu
zostają niezmienione (patrz też §3.5), ale obiekty na planszy misji nie
wyglądają już jak jeden generyczny `pylon`/`marker` powtórzony wszędzie.
`CampaignEntity` ma opcjonalne pole `glyph`, ustawiane per misja w
`Game.buildCampaignMission()` (tabele `MARKER_GLYPHS`/`PROP_GLYPHS`/
`NODE_GLYPHS` + osobny warunek dla dwóch misji typu `pylon`) — czysto
wizualne, `CampaignEntity.draw()` rozgałęzia się po nim, ale
`CAMPAIGN_ENTITY_STATS`/`checkCampaignGoal()`/`tryUnlockCampaignLandmark()`
nadal operują wyłącznie na `type`, bez zmian:

| `type` | `glyph` | Misje | Obiekt z GDD |
|---|---|---|---|
| `node` | `wezel` (domyślny) | M04, M23 | Węzeł |
| `node` | `zasilacz` | M12 | Zasilacz |
| `node` | `mostek` | M19 | Mostek — realna mechanika, patrz niżej |
| `pylon` | `pylon` (domyślny) | M08 | Pylon (prawdziwa grafika zamiast placeholdera) |
| `pylon` | `lustro` | M16 | Lustro |
| `marker` | `znacznik_ogrodu`/`paleta`/`krysztal`/`witryna`/`klucz_sektora`/`emiter` | M07/M10/M13/M14/M15/M21 | odpowiednio |
| `prop` | `skrzynia`/`modul_dachowy` | M09/M17 | odpowiednio (reszta `prop` zostaje generycznym pachołkiem) |

Landmarki (`CampaignEntity.draw()` case `'landmark'`) mają teraz 6
unikalnych sylwetek zamiast wspólnego pulsującego podwójnego okręgu —
szczegóły w §3.4. Trzy obiekty z GDD, których czasownik to nie "pochłoń"
(Portal M13, Mostek M19, Pas przelotu M18), mają realną logikę wykraczającą
poza etykietę celu — szczegóły w §3.5. Pełny opis wszystkich decyzji:
`docs/VECTRE_V6_PLAN.md` §3.

### 1.4 Runda Areny („GRAJ 2:00”) — pętla rdzenia gry

120 sekund. Gracz i 5 botów (`NUM_BOTS`) na wspólnej mapie 3000×3000px ze
stałym gridem tła. Sterowanie: domyślnie Floating Thumb Pad (joystick
pojawiający się tam, gdzie kciuk dotknie dolnych 35% ekranu), z trybem
zapasowym „przeciąganie" (mysz/starszy dotyk) i WASD/strzałkami jako opcją
dostępności. Świat renderowany przez jeden `ctx.translate` kamery
podążającej za graczem; minimapa (prawy dolny róg) pokazuje **wszystkie**
tiery obiektów (nie tylko duże), boty, gracza i ramkę widoku kamery, plus
strzałki „danger indicator” wskazujące poza-ekranowego większego rywala.

Zjadanie: obiekt/gracz jest jadalny, jeśli jest mniejszy niż odpowiedni próg
(`EAT_OBJ_RATIO`/`EAT_HOLE_RATIO`), wzrost jest zachowawczy pod względem pola
powierzchni. Ranking zawsze po wyniku (nigdy po rozmiarze — rozmiar to tylko
tiebreaker), pokazywany na żywo w HUD.

**Bestiariusz obiektów** (od v5, dokładnie wg `design/reference/asset_bible.svg`):
tier mały = latarnia/drzewo/ławka (cyan), tier średni = samochód/kiosk/
skrzynia/fontanna (pink), tier duży = wieżowiec/"skyscraper" (green, jedyny
obiekt spoza 8-elementowego bestiariusza — to celowy "wielki kęs" tej mapy).

### 1.5 Ewolucja + Overdrive („Golden Shot”) — **to jest system, którego GDD 4.0 w ogóle nie opisuje** (patrz §3)

Przy przekroczeniu promienia 45 i 65 (`CONFIG.evolution.triggerRadii`) gra
**w pełni zatrzymuje się** (nie tylko zwalnia) i pokazuje 3 losowe karty z
puli 7 mutacji: Magnet Pulse, Slipstream, Phase Edge, Combo Reactor, Scanner,
Shockwave, Bounty Core. Gracz wybiera kartę albo wciska „POMIŃ”; po 20s
auto-pick jako zabezpieczenie przed AFK. W ostatnich 12 sekundach rundy
(`CONFIG.overdrive.triggerSecondsRemaining`) losowany jest jeden z 2
wariantów finału: `blackout` (przyciemnia świat) albo `portal_rain` (fala 10
bonusowych obiektów o wartości 15 pkt, teraz wizualnie fioletowych „portali”
z asset bible). Wynik dostaje tag „BLACKOUT FINISH”/„PORTAL STORM”.

### 1.6 Wyzwania (Wyzwanie dnia + Misja dnia)

Ta zakładka łączy **dwa niezależne systemy** (patrz uwaga w §3):

- **Wyzwanie dnia** (Daily Seed Challenge) — jedna aktywna runda dziennie,
  reset o 00:00 UTC (odliczanie na żywo), deterministyczny seed z daty UTC
  (`dailySeedForDate()`) — czyli **identyczny początkowy układ mapy dla
  wszystkich graczy tego dnia**. Karta-hero (od v5) pokazuje countdown i
  realne wartości nagród z `CONFIG.hub.coreCity` (+20%/+10% Core City).
  Prowadzi licznik dni z rzędu (`save.daily.streak`).
- **Misja dnia** — osobna, rotująca codziennie mini-misja z własnej puli
  (`MISSIONS`, `missionForDate()`), płaci tylko w monetach, **nie dotyka
  Core City w ogóle**. Istnieje od wcześniejszej fazy (Golden Shot V2),
  niezmieniona.

### 1.7 Warsztat (kosmetyki)

4 kategorie z jednym wspólnym mechanizmem render/kup/załóż: **Rdzeń**
(`SKINS`, moneta), **Trail** (`AURAS`, moneta lub pryzmat), **Efekt
pochłaniania** (`EAT_EFFECTS`, nadpisuje kolor cząsteczek przy zjadaniu),
**Overdrive** (`OVERDRIVE_SKINS`, nadpisuje kolor banera finału rundy —
kosmetyczne, nie zmienia który wariant finału wypadnie). Panel „PODGLĄD NA
ŻYWO” pokazuje aktualny loadout czystym CSS/SVG. Zmiany zbierane są w
`pendingLoadout` i zatwierdzane jednym „ZAŁÓŻ” (`onEquipClick()`).

### 1.8 Pauza + szybka zmiana wyglądu (v5)

Pauza w pełni zatrzymuje pętlę gry (`cancelAnimationFrame`), pokazuje panel
nad przyciemnioną (scrim), zamrożoną ostatnią klatką canvasu: „WRÓĆ DO GRY”,
„RESTART MISJI / RUNDY”, „STEROWANIE” (tryb sterowania/czułość/haptyka),
nowy „ZMIEŃ WYGLĄD” (v5 — otwiera popup cyklujący Trail/Efekt/Overdrive po
odblokowanych elementach bez wychodzenia z rundy) i „WYJDŹ DO MIASTA”.

### 1.9 Ekran wyniku rundy (v5)

Hero: duży wynik z poświatą + plakietka „NOWY PB” (jeśli pobito rekord Areny
lub Wyzwania dnia) → plakietki „ROZMIAR/TIER” (T1–T5, np. „T3 · DUŻY”) i
„MIEJSCE” → karta zdobytych monet → karta Core City „przed → po” z
dwukolorowym paskiem (ciemny segment = stan sprzed rundy, jasny = przyrost
z tej rundy) → istniejące linie (Wyzwanie dnia/Misja/kamień milowy Core City)
→ pełny ranking → „ZAGRAJ JESZCZE RAZ” → „OGLĄDAJ REKLAMĘ · X2 MONET”
(dobrowolne, tylko x2 monet, nigdy x2 progresu) → udostępnij wynik → link
powrotu do Miasta.

### 1.10 Profil i Run Setup

Profil: opcjonalna nazwa (nigdy wymagana przed pierwszą rundą), przechodzi
przez prosty blocklist (jawnie **nie** produkcyjna moderacja), plus stałe
Gość ID. Run Setup: przed startem rundy casualowej gracz może kupić za
monety jednorazowy dodatek na tę rundę — Tarcza (40 monet, przetrwaj 1
starcie) lub Magnes (30 monet, przyciąga obiekty przez pierwsze 8s).

### 1.11 Ekonomia i zapis gry

**Dwie waluty**: Coins (◇, główna, zarabiana wszędzie) i **Prisms** (◆,
druga waluta — powoli zarabiana co 3. rozegraną rundę, wydawana na część
Trail/kosmetyków). Zapis (`localStorage`) trzyma m.in.: `coins`, `prisms`,
`owned`/`selected` (Rdzeń), `auras`/`effects`/`overdriveSkins`
(owned+selected), `stats.bestArenaScore`, `hub.coreCharge`/`coreLevel`,
`daily.*`, `mission.*`, `campaign.{unlockedDistricts,completed,medals}`,
`badges[]`, `settings.*`.

### 1.12 Wizualia (paleta v5)

Cały system kolorów (`--nc-*`/`--neon-*` w `style.css`) pochodzi teraz
dosłownie z `design/reference/asset_bible.svg`: cyan `#50F0FA`, gold
`#EFCB63`, green `#46D99A`, pink `#FF54AD`, violet `#9875FF`, tło
`#04101D`→`#081C2B`, panele `#0A2032`/`#071725`.

---

## 2. Co GDD 4.0 trafnie opisuje (potwierdzone 1:1 w kodzie)

To jest lista **zweryfikowanych, dokładnych** trafień — nie ogólnych
podobieństw, tylko dopasowań co do wartości/nazwy:

| Twierdzenie GDD | Weryfikacja w kodzie |
|---|---|
| „Runda trwa 120 sekund” (§4.2) | `CONFIG.round.duration = 120` ✅ |
| Tabela przyrostów Core City (+8/+2/+3/+2, +20/+10, §7.3) | `CONFIG.hub.coreCity` — wartości identyczne co do jedności procenta ✅ |
| Reguła overflow „92%+20%→100% i start od 12%” (§7.3) | `finalizeRun()`: `while (coreCharge >= 100) { coreCharge -= 100; coreLevel++; ... }` ✅ |
| Nagrody LVL2–LVL6 z nazwami i kwotami (§8.2) | `CORE_CITY_LEVEL_REWARDS` — nazwy „Impuls”/„Kryształ”/„Pixel Burst”/„Fala”/„Pryzmat” i kwoty 150/200/250/300/400 identyczne ✅ |
| „Po LVL6 zakres obowiązkowy się kończy” (§8.2) | Brak zdefiniowanej nagrody dla LVL7+, jest fallback ✅ |
| Kolejność odblokowań zakładek: Dzielnice od startu, GRAJ po M01, Warsztat po M02 (lub 1. kosmetyk), Wyzwanie po M04 (§5.5) | `CONFIG.unlockGates` + `isArenaUnlocked()`/`isWarsztatUnlocked()`/`isWyzwaniaUnlocked()` — identyczne bramki ✅ |
| Cała tabela 24 misji: nazwy, dzielnice, cele, nagrody w monetach, kolejność odblokowań dzielnic M04→Park, M08→Port, M12→Galeria, M16→Dachy, M20→Rdzeń (§6) | `CAMPAIGN_MISSIONS` — **każda pozycja** (nazwa, `timeLimit`, opis celu, `reward.coins`, `reward.unlockDistrict`) zgadza się z tabelą GDD co do słowa i liczby ✅ |
| Misja 4 = landmark do pożarcia, restart misji = ta sama misja (§6.1, §11) | `activateAndDevour` na M04/M08/M12/M16/M20/M24, `restartFromPause()` woła `startCampaignMission()` dla trwającej misji ✅ |
| Mapa/minimapa musi reprezentować wszystkie kluczowe elementy, nie tylko „zielone” (§10.5) | `drawMinimap()`/`drawCampaignMinimap()` rysują **wszystkie** tiery/typy encji + botów + gracza + landmarki osobnym akcentem koloru (kod ma nawet komentarz o tej dokładnej poprawce) ✅ |
| Gracz nie może wypaść poza mapę (§11) | Świat 3000×3000 z twardym clampem pozycji w `Hole` ✅ |
| Rewarded Ad tylko x2 monet, nigdy x2 progresu (§7.4, §12.2) | `watchRewardedAd()` mnoży wyłącznie `adPendingCoins`, nie dotyka `coreCharge` ✅ |
| Elementy ekranu wyniku: wynik / rozmiar-tier / miejsce / monety / progres Core City / CTA / rewarded ad (§7.4) | Wszystkie obecne w `gameOverScreen` (v5) ✅ |
| Bestiariusz obiektów: „latarnia, ławka, samochód, kiosk, drzewo, skrzynia, portal, fontanna” (§10.3) | `WorldObject` subtypes od v5: dokładnie te 8 (+`skyscraper` poza listą) ✅ *(przed v5 to nie było prawdą — patrz §3)* |
| Popup narzędzia: ikona + krótka nazwa + 1 linijka opisu, CTA Wybierz/Zamknij, zatrzymuje rozgrywkę (§11.3) | Nowy popup „ZMIEŃ WYGLĄD” z v5 pasuje dokładnie do tego wzorca — ale patrz zastrzeżenie w §3 co do tego, **którego** ekranu to dotyczy |
| Zasada „Misje NIE napełniają Core City” (§0, §4.1, §13.2) | `endCampaignMission()` nigdy nie woła `finalizeRun()` ani nie dotyka `save.hub` ✅ |
| Anti-confusion: Dzielnice pokazują tylko % odbudowy dzielnicy, nigdy duży okrąg Core City (§8.4) | `campaignScreen` nagłówek to zawsze „ODBUDOWA: X% · Y z Z misji”, nigdy `hubChargeValue` ✅ |

**Wniosek:** warstwa meta/ekonomii/misji jest zaskakująco **bardzo wiernie**
zaimplementowana — kod momentami dosłownie cytuje liczby z tabel GDD.

---

## 3. Czego GDD 4.0 NIE oddaje (realne luki i rozjazdy)

### 3.1 Cały rdzeń rozgrywki Areny (Golden Shot) jest poza zakresem GDD 4.0

GDD 4.0 nazywa się „Finalny GDD” i tytułuje się „Gameplay · UX · Meta
progression...”, ale w praktyce **w ogóle nie opisuje** największego,
najczęściej granego systemu gry:

- **System Ewolucji** (7 mutacji: Magnet Pulse, Slipstream, Phase Edge,
  Combo Reactor, Scanner, Shockwave, Bounty Core) — zero wzmianki.
- **Overdrive** — GDD wspomina „Overdrive” wyłącznie jako kategorię
  kosmetyczną (§9.1: „efekt specjalny przy turbo/finale”), ale nie opisuje
  **mechaniki** dwóch wariantów finału (`blackout`/`portal_rain`) w Arenie.
- Floating Thumb Pad, wskaźniki zagrożenia (danger indicators), system
  combo w Arenie (`CONFIG.juice.combo`), mnożniki wzrostu — brak.
- **Rush Hour** — jedyny zaimplementowany „modyfikator rundy” (35% szans,
  boty +30% prędkości) — nie istnieje w GDD ani jako nazwa, ani jako
  koncepcja.

To nie jest błąd implementacji — te systemy pochodzą z wcześniejszego etapu
(„Golden Shot V2”, opisanego w `docs/VECTRE_V2_PLAN.md` względem innego,
wcześniejszego dokumentu źródłowego). GDD 4.0 po prostu **nadbudowuje** na
nich warstwę meta i się do nich nie odnosi. Efekt praktyczny: jeśli GDD 4.0
ma być jedynym źródłem prawdy dla kogoś nowego w projekcie, ta osoba nie
dowie się z niego, że Evolution/Overdrive w ogóle istnieją.

### 3.2 „Wyzwanie dnia” nie ma realnego twista — tylko wspólny seed

GDD (§7.2): *„Ma jeden twist: np. tylko określony typ obiektów, szybsze
combo, limit trasy, tylko jeden evolve pick.”*

W kodzie `startDailyChallenge()` robi dokładnie jedno: uruchamia zwykłą
rundę Areny z deterministycznym seedem z daty (`dailySeedForDate()`) — co
daje **identyczny początkowy układ mapy dla wszystkich graczy tego dnia**,
ale **żadnego** z przykładowych twistów z GDD (nie ma ograniczenia typu
obiektów, nie ma przyspieszonego combo, nie ma limitu trasy, nie ma
ograniczenia do jednego evolve picka). Jedyna zmienność mechaniczna, jaka
może się pojawić — modyfikator „Rush Hour” — jest losowana z 35% szansą **w
każdej** rundzie (także zwykłej Arenie), więc nie jest nawet unikalna dla
Daily.

Innymi słowy: „Wyzwanie dnia” różni się dziś od zwykłej rundy Areny
właściwie tylko tym (a) że wszyscy grają ten sam layout tego dnia i (b) inną
tabelą nagród Core City/streakiem — nie realnym „twistem” w sensie z GDD.

### 3.3 Dwa niezależne systemy dzienne w jednej zakładce — sprzeczne z własną zasadą GDD

GDD ma tylko jedno pojęcie „Wyzwanie dnia” i osobną zasadę anti-confusion
(§8.4: *„Każdy ekran ma jedną logikę progresu i jedną dominującą nazwę”*).
Zakładka Wyzwania w kodzie łączy **dwa** niezależne systemy: „Wyzwanie
dnia” (Daily Seed Challenge, karmi Core City) i „Misja dnia” (osobna rotująca
mini-misja, tylko monety, zero Core City) — czyli dokładnie ten typ
„dwóch rodzajów postępu na jednym ekranie”, przed którym GDD ostrzega w
kontekście Miasto/Dzielnice. To świadoma decyzja z wcześniejszej fazy (v4
skonsolidował dwa istniejące systemy w jedną zakładkę zamiast kasować
jeden), ale warto mieć świadomość, że nie jest to neutralne względem
własnej filozofii GDD.

### 3.4 Landmarki mają teraz unikalną grafikę — **rozwiązane w v6**

GDD (§10.6, pakiet assetów): *„Landmarks: Kino, fontanna, dźwig, galeria,
iglica, rdzeń miasta”* — sugeruje 6 różnych sylwetek.

*(Stan przed v6, dla porządku: `CampaignEntity` przechowywał `landmarkId`,
ale funkcja rysująca w ogóle go nie sprawdzała — każdy landmark renderował
się identycznie: pulsujący podwójny okrąg + kłódka.)*

Od v6 `CampaignEntity.draw()` (przypadek `'landmark'`) rozgałęzia się po
`landmarkId` i rysuje 6 unikalnych sylwetek zgodnych z
`design/gameplay/vector_hole_mission_board_finale.svg`: `kino` (M04),
`fontanna` (M08), `dzwig` (M12), `galeria_glowna` (M16), `iglica` (M20),
`rdzen_miasta_glowny` (M24, z dodatkowym złotym akcentem finału). Kłódka
zostaje wspólnym overlayem na wierzchu, niezależnie od sylwetki. Dwa
uczciwe uproszczenia, które zostały: (1) `iglica_wejscie` — własny,
nieopisany w GDD "mini-landmark" M19 (patrz §3.5) — reużywa sylwetkę Iglicy
w mniejszej skali zamiast dostawać 7. unikalny kształt znikąd; (2) pełna
4-stanowa sekwencja "collapse" z `MISSION_BOARD_SPEC.md` §4 (cel aktywny →
ładowanie → collapse → wchłonięty, z własnym timingiem 400–600ms) nie
została zbudowana — landmark dostał tylko dodatkowy, cyjanowy wybuch
cząstek nałożony na istniejący złoty, jako uproszczona wersja "rozpadu na
fragmenty", zgodnie z tym, na co brief wprost pozwalał. Szczegóły:
`docs/VECTRE_V6_PLAN.md` §3.2.

### 3.5 24 misje: treść i liczby idealne, cztery szablony celu zostają — trzy z czterech obiektów-wyjątków mają teraz realną mechanikę (v6)

Jak pokazano w §2, nazwy/nagrody/kolejność odblokowań misji są bez zarzutu.
GDD opisuje każdą misję jako mającą **unikalny mechanicznie** twist
(„Portal jako twist” w M13, „Kaskada luster” w M16, „Konwój” w M11, „Tor
lotu” w M18 itd.) — w kodzie wszystkie 24 misje nadal realizują się przez
**4 uniwersalne typy celu** (`eatCount`/`comboChain`/`gatesPassed`/
`activateAndDevour`, patrz też nowy opis bestiariusza w §1.3) — to się nie
zmieniło i nie miało się zmienić (żaden z czterech szablonów celu nie był w
zakresie pasu v6). To, co się zmieniło: dla 3 z 4 obiektów, które GDD opisuje
innym czasownikiem niż "pochłoń" (`design/assets/OBJECT_CATALOG_SPEC.md`
§2), goal type to już nie cała historia:

- **Portal (M13)** — realny, stały teleporter (`Game.handlePortalTouch()`):
  dotknięcie podczas "otwartego" okna przenosi gracza na stałą kotwicę po
  drugiej stronie planszy, gdzie czeka klaster kryształów. Jednokierunkowy
  i jednorazowy na rundę (decyzja opisana w `docs/VECTRE_V6_PLAN.md` §3.3).
- **Mostek (M19)** — strukturalny (`Game.handleCampaignBridges()`): dotyk
  zasila go w miejscu (ten sam wzrost/wynik co zwykły węzeł), ale obiekt
  **zostaje** na planszy ze zmienionym wyglądem zamiast zniknąć —
  `handleCampaignEating()` jawnie pomija encje z `glyph === 'mostek'`.
- **Pas przelotu (M18)** — realna strefa (`Game.handleCorridorZone()`):
  śledzi, z której strony gracz wszedł/wyszedł, i liczy "przejście" tylko
  jeśli całe przecięcie strefy odbyło się podczas otwartego okna — nie
  pojedynczy dotyk punktu.

**M16 „Kaskada luster” pozostaje przykładem spłaszczenia** — to nadal
zwykłe `activateAndDevour` z aktywatorem `pylon` (teraz z glifem `lustro`,
patrz §1.3), bez żadnego efektu odbić. Brama (M05) była już poprawnie
zaimplementowana przed v6 i nie została zmieniona. To wciąż udokumentowane
uczciwie jako świadome uproszczenie (`docs/VECTRE_V4_PLAN.md` §2.1,
`docs/VECTRE_V6_PLAN.md` §6) — wnioski: taksonomia 4 szablonów celu z GDD
to nadal trafny opis *struktury* misji, ale nieprawdą jest już, że *żaden*
obiekt-wyjątek nie ma realnej mechaniki poza etykietą.

### 3.6 Prisms (druga waluta) nie istnieją w GDD

GDD §12.1 („Waluty”) wymienia tylko: Neon Coins, Core City % i Kosmetyki.
Nie ma tam **żadnej** wzmianki o drugiej walucie. W kodzie **Prisms** (◆)
to w pełni działająca druga waluta: własne pole w zapisie (`save.prisms`),
własna ikona w każdym nagłówku, zarabiana automatycznie co 3. rozegraną
rundę, wydawana na część kosmetyków Trail (`AURAS` z `priceType: 'prisms'`).
To spory, niewymieniony w GDD element ekonomii.

### 3.7 Starter Pack i District Bundles z §12.2 nie istnieją

GDD §12.2 opisuje „Starter Pack «Neon Founder»” (1 rdzeń + 1 trail + 500
monet) i „District Cosmetic Bundles”. W kodzie nie ma żadnego IAP/adaptera
monetyzacji (`CONFIG.flags.monetizationAdapters = false`, świadomie — brak
sekretów/kluczy sklepowych w repo) — to jest już zresztą jawnie
udokumentowane w CLAUDE.md pod „What's deliberately not built”, ale warto
to zestawić z konkretną obietnicą z GDD.

### 3.8 RUN_TOOLS (Tarcza/Magnes) nie istnieją w GDD

Ekran „Run Setup” z jednorazowymi płatnymi dodatkami na rundę (Tarcza za 40
monet, Magnes za 30 monet) to funkcja z wcześniejszej fazy (Phase 7),
niewymieniona nigdzie w GDD 4.0 — ani jako ekran, ani jako mechanika, ani w
minimalnym modelu danych z §13.1.

### 3.9 Drobne niespójności nazewnicze

- GDD §9.3 nazywa startowy, darmowy Rdzeń „**Neon**”. W kodzie darmowy,
  domyślny skin to `'rainbow'` / „**Tęcza**” (kolor cyklicznie zmieniający
  się jak tęcza), nie stały neon cyan.
- GDD §9.3 wymienia kosmetyk „**Glitch**” (Rdzeń, odblokowywany przez „Misja
  M08 lub M16”) — taki wpis nie istnieje w `SKINS`. Jest za to dzielnica
  o nazwie „Galeria **Glitch**” — możliwe pomylenie tych dwóch przy pisaniu
  GDD, albo po prostu niedokończony wątek.
- GDD §13.1 opisuje minimalny model danych bez pól na: `badges[]`,
  `daily.streak`, `stats.bestArenaScore`, `prisms`, `campaign.medals` — to
  nie są sprzeczności, tylko elementy, których model z GDD nie przewiduje,
  a które realnie istnieją w zapisie gry.

### 3.10 Popup „wyboru narzędzia” — do którego ekranu naprawdę się odnosi GDD?

GDD §11.3 opisuje ogólny „Tool choice popup”: zatrzymuje rozgrywkę, ikona +
nazwa + 1 linijka opisu, CTA Wybierz/Zamknij. To pasuje **dosłownie** do
dwóch różnych rzeczy w kodzie:

1. Istniejący od dawna overlay Ewolucji (`evolutionOverlay`) — pokazuje karty
   mutacji w trakcie rundy, ale jako siatkę klikalnych kart z przyciskiem
   „POMIŃ” (nie osobne „Wybierz”/„Zamknij” na dole).
2. Nowy popup „ZMIEŃ WYGLĄD” z v5 (mockup `wybor_narzedzia.svg`) — lista
   wierszy z ikoną+nazwą+opisem i osobnymi przyciskami WYBIERZ/ZAMKNIJ —
   ale dotyczy **kosmetyków**, nie „narzędzi” rozgrywkowych.

GDD nie rozstrzyga, o który z tych dwóch popupów faktycznie chodziło —
warto to doprecyzować, jeśli GDD ma zostać zaktualizowany.

---

## 4. Krótkie podsumowanie

- **Warstwa meta (Miasto, Core City, Dzielnice/misje, ekonomia, odblokowania,
  Warsztat)** — GDD 4.0 jest tu bardzo wiarygodnym, aktualnym źródłem prawdy.
  Liczby, nazwy i reguły zgadzają się z kodem niemal 1:1.
- **Warstwa rdzenia rozgrywki Areny (Evolution/Overdrive/sterowanie/combo)**
  — GDD 4.0 o niej praktycznie milczy; nie jest w jej zakresie.
- **Kilka konkretnych obietnic** (realny twist Daily, Starter Pack/bundles,
  nazwy „Neon”/„Glitch”) — opisane w GDD, ale niezaimplementowane lub
  zaimplementowane inaczej. Unikalne landmarki były na tej liście przed v6
  — od v6 są zaimplementowane (§3.4), zdjęte stąd.
- **Kilka realnych mechanik** (Prisms, RUN_TOOLS, Rush Hour, dwa systemy
  dzienne w jednej zakładce, badge’e) — istnieją w grze, ale GDD 4.0 ich nie
  wspomina.

Żadna z tych rozbieżności nie jest „bugiem” — to naturalny efekt tego, że
gra przeszła więcej faz (Golden Shot V2 → v3 Kampania → v4 GDD 4.0 → v5 UI
→ v6 wzbogacenie obiektów planszy misji) niż ten jeden dokument obejmuje.
Ten plik ma służyć jako punkt odniesienia przy decyzji, czy dopisać
brakujące sekcje do GDD, czy potraktować część z powyższych punktów jako
rzeczy do zaimplementowania.

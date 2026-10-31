# DEVICE-QA-1 — naprawy z ogrywania 30.10.2026

**Werdykt:** wszystkie zgłoszenia z 22 dostępnych zrzutów zdiagnozowane;
16 problemów naprawionych (tekst, układ, czytelność, 2 błędy logiki
wskazówek/rysowania), 4 zachowania potwierdzone jako poprawne i lepiej
wyjaśnione, 3 punkty wymagają dalszego testu lub decyzji właścicielki.
Ekonomia, ceny, nagrody, zasady jedzenia, trudność kampanii, zapis v13
— bez zmian. Gałąź `deviceqa1-playtest-20261030-fixes` od `main`
`9826bafe0c2bda76584409cba53cd26ed37352a2`.

Zrzuty od właścicielki: `C:\Users\Piotrus\Desktop\Ogryw 30.10` (lokalnie,
poza repo). Czerwone linie to adnotacje właścicielki.

## 1. Ewidencja zdjęć

Folder zawiera 22 pliki: **002–012 i 014–024**. Plików **001 i 013 nie ma —
NOT AVAILABLE** (nie zgaduję ich treści). Pliki **023 i 024** nie były
wymienione w prompcie, ale są w folderze — obejrzane i uwzględnione.

Klasyfikacja: **B** = błąd, **UX** = czytelność/układ, **M** = zamierzona
mechanika źle wyjaśniona, **V** = problem wizualny.

| # | Plik | Zgłoszenie | Co widać | Przyczyna (kod) | Klasa | Poprawka | Dowód |
|---|---|---|---|---|---|---|---|
| 001 | — | — | — | **NOT AVAILABLE** | — | — | — |
| 002 | `002_krzywo.jpg` | „krzywo” (pasek akcji wyników) | ZAGRAJ JESZCZE RAZ na pełną szerokość, WYZWIJ ZNAJOMEGO węższe i przesunięte, „Wróć do Miasta” pod spodem | `.result-actions > * { max-width: 440px }`, a główny przycisk ma `max-width: none` — rząd pomocniczy był węższy | UX | rząd pomocniczy tej samej szerokości co główny | `deviceqa1` „Results” 8/8 ramek; zrzuty `results` |
| 003 | `003_krzywo.jpg` | „krzywo” (odblokowanie Warsztatu) | tekst wyśrodkowany, przyciski przy lewej krawędzi kolumny | `.btn { max-width: 320px }` w szerszej kolumnie flex bez `align-items: center` | UX | wspólny komponent kart: przyciski na osi tekstu | „Cards” 8/8 ramek (±2 px) |
| 004 | `004_dlaczego_okno_nisko.jpg` | okno zakupu za nisko | arkusz „KUP I ZAŁÓŻ” przyklejony do dołu, zasłania siatkę | `openInfoSheet({ bottom: true })` — arkusz dolny projektowany pod telefon | UX | na `wide`/`compact`: środek wysokości, prawa połowa (podgląd z lewej widoczny); telefon bez zmian | „Warsztat” 8/8 ramek; zrzuty `shopBuy` |
| 005 | `005_wiem_ze_nieodblokowane_ale_moze_podglad_powinien.jpg` | podgląd zablokowanego Finiszu pokazuje wir | tytuł „Gorący Róż” (wir), podgląd bez Finiszu | `updateWarsztatPreview()` zawsze pokazywał nazwę wiru; Finisz (kolor banera na finiszu) nie był rysowany w podglądzie | UX | podgląd podpisuje się nazwą podglądanej Smugi/Efektu/Finiszu; Finisz rysuje baner „WIELKI FINISZ!” w swoim kolorze; „NIE TERAZ” przywraca | „Warsztat 005” PASS (baza FAIL); zrzuty `shopFinisz` |
| 006 | `006_krzywo.jpg` | „krzywo” (Skrzynia gwiazd) | karta skrzyni z jednym przyciskiem PÓŹNIEJ przesuniętym w lewo | jw. (komponent kart) + „PÓŹNIEJ” przy nagrodzie już przyznanej | UX + M | komponent kart; patrz 012 | „Cards”, „Chests 006/012” |
| 007 | `007_krzywo.jpg` | „krzywo” (darmowa skrzynia) | przycisk przesunięty, pierwsza litera „Kolejna” ucięta | komponent kart; tekst pod warstwą promieni (pozycjonowana `.unlock-stage` maluje się nad tekstem) | UX + V | tekst `z-index` nad promieniami, miara tekstu; „Już na Twoim koncie.”, bez „PÓŹNIEJ” | „Chests 007”, „Cards” (`clipped: false`) |
| 008 | `008_krzywo_co_znaczy_1_na_2.jpg` | co znaczy „1/2” | „1 / 2” pod opisem Wzmocnień, ŚWIETNIE + DALEJ | licznik = numer karty w kolejce odblokowań; ŚWIETNIE nie prowadziło nigdzie (to samo co DALEJ) | UX | „Nowość 1 z 2”; Wzmocnienia z jednym przyciskiem | „Unlocks 008/009/014” PASS (baza FAIL) |
| 009 | `009_krzywo_tu_jest_2_na_2.jpg` | „2/2” | ostatnia karta kolejki (Park Impulsów) | jw. | UX | „Nowość 2 z 2”, DO DZIELNICY + PÓŹNIEJ | jw. |
| 010 | `010_krzywo.jpg` | „krzywo” (Wyzwania) | przyciski przesunięte | komponent kart | UX | komponent kart | „Cards” |
| 011 | `011_krzywo.jpg` | „krzywo” (wyniki z reklamą) | ×2 MONET + WYZWIJ ZNAJOMEGO węższe niż ZAGRAJ | jak 002 | UX | jak 002 | „Results” |
| 012 | `012_jak_otworzyc_skrzynie_i_gdzie_jest.jpg` | jak otworzyć skrzynię i gdzie jest | „Skrzynia gwiazd! +120 monet… Następna za 15 gwiazdek.” + PÓŹNIEJ | `checkStarChests()` przyznaje nagrodę **od razu** (monety, pryzmaty, wzmocnienie) i dopiero potem kolejkuje kartę — nic nie trzeba otwierać, PÓŹNIEJ tylko zamyka; nagrody nie da się stracić | M | karta: „SKRZYNIA GWIAZD OTWARTA · N GWIAZDEK Z MISJI”, „Już na Twoim koncie: …. Skrzynia otwiera się sama co 15 gwiazdek — następna przy 30.”, przycisk ŚWIETNIE/DALEJ | „Chests 006/012” (kredyt 120 monet przed kartą) |
| 013 | — | — | — | **NOT AVAILABLE** | — | — | — |
| 014 | `014_krzywo.jpg` | „krzywo” (Wir „Kryształ”, 1/2) | przyciski przesunięte, „1 / 2” | komponent kart + licznik | UX | jw. | „Cards”, „Unlocks” |
| 015 | `015_krzywo.jpg` | „krzywo” (Port Syntez) | jw. | komponent kart | UX | jw. | „Cards” |
| 016 | `016_czemu_nie_moge_wziac_wzmocnienia.jpg` | czemu nie mogę wziąć Tarczy | kafel Tarczy wyszarzony, „brak zagrożeń” ucięte | `boosterUseful('shield')`: Tarcza tylko gdy misja ma rywali, glitch lub Złodzieja; M22 nie ma żadnego (zweryfikowane: `bots 0, glitch 0, racer 0`) — wyłączenie **poprawne** | M + V | kafel „tu zbędna” (mieści się), notka: „Tarcza się tu nie przyda — w tej misji nic Ci nie zagraża.”; zakup nadal niemożliwy | „Boosters 016” PASS (baza FAIL) |
| 017 | `017_brzydko_rozowy_napis_nie_widze_waluty_na_ekranie.jpg` | brzydki różowy napis, nie widać waluty | „Brakuje 21 monet…” różowym 11,5 px, saldo przyciemnione pod arkuszem | arkusz odprawy przykrywa pasek salda; notka w kolorze `--nc-pink` | UX | „Masz N ◇” przy nagłówku WZMOCNIENIA, notka złota i pogrubiona; ceny, blokada GRAJ i zakupy bez zmian | „Boosters 017” ×2 PASS; „Briefing” 8/8 |
| 018 | `018_krzywo.jpg` | „krzywo” (Galeria Glitch) | jw. | komponent kart | UX | jw. | „Cards” |
| 019 | `019_zle_nalicza_postep_miasta.jpg` | było 67%, jest 82%, a „+10% za rundę” | karta Miasta LVL 3, 82%, „+10% za rundę” | formuła: +10 runda, +2 podium, +3 1. miejsce, +2 rekord, ×1,6 na LVL 1–2 → 1. miejsce na LVL 3 = **+15%** (67 → 82). Naliczanie **poprawne**, tekst podawał tylko część | M | zakres „+10–17% za rundę · nagroda najpóźniej za N rund” (Miasto, GRAJ), rozpisany przyrost na wyniku | „Core City 019/002/4. miejsce”, „Core City copy” |
| 020 | `020_zolty_przeciwnik_nie_jest_1_ale_wyglada_jak_wiekszy_i_nie_moge_go_zjesc.jpg` | żółty rywal (nie #1) wygląda na większego, nie da się go zjeść | finisz „ZACIEMNIENIE”, wielki fioletowy wir gracza, złote łuki wokół, nazwa gracza pod banerem | ranking punktowy; zjedzenie rywala wymaga promienia > 1,15× jego promienia (`EAT_HOLE_RATIO`) — w paśmie 1/1,15…1,15 nikt nikogo nie zje; obręcze botów (np. „sun”: kolce do 1,32 r, orbita galaxy 1,35 r) sięgają poza krawędź kolizji. **Hipoteza** co do złotych łuków: obręcz rywala podobnej wielkości pod wirem gracza (z jednego zrzutu nie da się tego rozstrzygnąć) | M + V | szary przerywany okrąg na prawdziwej krawędzi rywala „podobnej wielkości” przy graczu (nad wirami), zetknięcie: „PODOBNY ROZMIAR · URÓŚNIJ, BY ZJEŚĆ”; zasady jedzenia bez zmian | „Ranking 020” PASS (baza FAIL na tag/okręgu, **ta sama** logika jedzenia — brak błędu kolizji) |
| 021 | `021_elementy_nachodza_ciezko_zobaczyc_najmnijejsze.jpg` | elementy nachodzą, najmniejsze trudno zobaczyć | dwa wieżowce nachodzą na siebie, mała latarnia częściowo pod podstawą budynku | obiekty rysowane w kolejności tablicy (spawn), nie wg rozmiaru/głębi; rozstaw spawnu liczy promień kolizji (×0,9), a budynki rysują się w górę ponad nim | V | obiekty w kadrze: od największych, równe od tyłu do przodu (`visibleByDrawOrder()`); pozycje, jedzenie, RNG bez zmian | „Board 021” 0 inwersji (baza: 2) |
| 022 | `022_niby_1sza_a_sa_wieksi.jpg` | jestem 1., a inni są więksi | gracz T1 z koroną, #1/6 2030 pkt; wielki różowy rywal | `rankHoles()`: wynik, potem promień — **zamierzone** | M | tabela na żywo „PUNKTY”, pod wynikami „Miejsce liczy się według punktów, nie rozmiaru wiru.” | „Ranking 022” PASS |
| 023 | `023_i_co_koniec_rozbudowy_miasta.jpg` | i co, koniec rozbudowy miasta? | LVL 6, „Każda runda Areny buduje Twoje miasto”, „Następna nagroda: +100 monet”, 5% | LVL 6 to pełne miasto (`CITY_STAGES` 1–6); dalej co 100% +100 monet **i +10 pryzmatów** (karta pomijała pryzmaty) | M | „Miasto zbudowane w całości” + „co 100%: +100 monet i +10 pryzmatów”; chip z pryzmatami | „Core City 023” (tekst = to, co przyznaje LVL 7) |
| 024 | `024_zle_wskazanie_na_bajt.jpg` | złe wskazanie na bajt | „Złap 4 złote bajty 4/4” zrobione, strzałka wskazuje bajt | `campaignGuideTargets()` brał typy wszystkich kroków (także ukończonych), a gdy cel był jeszcze za duży — „jedzenie do wzrostu”, w tym bajty | **B** | strzałka tylko do otwartych kroków; awaryjne jedzenie pomija obiekty ukończonego kroku, jeśli jest inne | „Campaign 024 (M73)” 0 bajtów (baza: 5) |

## 2. Core City — pomiar i weryfikacja

Formuła (`finalizeRun()`, niezmieniona): ukończona runda +10%, podium
+2%, 1. miejsce +3%, nowy rekord Areny +2%; Wyzwanie dnia +20% (+10%
rekord); całość ×1,6 na LVL 1–2 (zaokrąglenie); nadwyżka przechodzi na
kolejny poziom. Deterministyczne testy (te same wartości na bazie
9826baf i na kandydacie — naliczanie się nie zmieniło):

| Stan przed | Runda | Po | Przyrost | Zgodność ze zrzutem |
|---|---|---|---|---|
| LVL 3, 67% | 1. miejsce, bez rekordu | 82% | +15 (10+2+3) | 019 ✔ |
| LVL 1, 0% | 1. miejsce + rekord | 27% | +27 (17×1,6) | 002 ✔ |
| LVL 2 (54%) | 1. miejsce | — | +24 (15×1,6) | 011 ✔ (z obrazu) |
| LVL 3, 40% | 4. miejsce | 50% | +10 | — |
| LVL 3, 67% | wyjście z wynikiem > 0 i = 0 | 67% | 0, `runsPlayed` bez zmian | R1 ✔ |

Samo wejście do Areny i wyjście do Miasta nie daje postępu
(`abandonRun()`/`payLeftRun()` nie dotykają Core City). Licznik, pasek i
zapis były spójne — błędny był tylko opis. Po LVL 6: co 100% +100 monet
i +10 pryzmatów (test: `grantCoreCityLevelReward(7)` przyznaje dokładnie
to, co pisze karta).

## 3. Ranking, rozmiary wirów i kolizje

- **Ranking** = punkty (`rankHoles()`: wynik, potem promień, potem nazwa);
  korona i „#1/6” należą do lidera punktowego. Mały wir z większą liczbą
  punktów prowadzi — to zamierzone; teraz nazwane w UI.
- **Jedzenie wirów** (`handleHoleCollisions()` Arena,
  `handleCampaignCollisions()` misje): zjada ten, kto ma promień > 1,15×
  promienia drugiego, przy odległości < 0,75 promienia większego. Test
  60 vs 66: brak zjedzenia w obie strony (baza i kandydat identycznie),
  80 vs 60: zjedzenie — **brak błędu kolizji**.
- **Grafika vs kolizja:** pierścień obręczy to promień kolizji;
  dekoracje stylów botów wychodzą poza niego (sun: kolce do ~1,32 r,
  galaxy: orbita 1,35 r, tech: łuki r + 1,8 grubości). Minimalna korekta:
  okrąg rzeczywistej krawędzi dla rywala w paśmie 1,15× przy graczu i
  podpowiedź przy zetknięciu. Zielony okrąg ofiary i czerwona poświata
  zagrożenia bez zmian.
- **Tiery T1–T6, skórki gracza, kamera:** bez zmian (skórki to wygląd,
  PX02 D+); etykiety i korona są kontr-skalowane przy oddaleniu
  (`labelScale`, v12) — bez zmian.
- **Nierozstrzygnięte (wymaga dalszego testu):** dokładne pochodzenie
  złotych łuków na 020 (obręcz rywala pod wirem gracza vs ozdoba gracza)
  oraz to, że w wariancie finału „ZACIEMNIENIE” świat (z wirami) jest
  przyciemniany o 55% — to zamierzony wariant finału; jego czytelność
  przy bardzo dużych wirach to decyzja projektowa (nie zmieniałam).
  Baner „WIELKI FINISZ!” przez 1,6 s zasłania nazwę gracza (020) —
  krótkotrwałe, bez zmian.

## 4. Zakupy, monety i wzmocnienia

- Saldo: „Masz N ◇” w nagłówku WZMOCNIENIA (widoczne na 8/8 ramkach).
- Łączna cena wybranych: na GRAJ (`−200 ◇`) — bez zmian.
- Brakująca kwota: 200 − 179 = 21 ✔ (test M25, Zegar z zapasu).
- GRAJ przy braku monet: nic nie pobiera, odprawa zostaje (dźwięk błędu)
  — przypadkowy zakup niemożliwy (test: 179 → 179).
- Częściowe zakupy i pryzmaty: „Turbo start za 4 ◆” → 5 → 1 ◆, Turbo w
  zapasie; GRAJ pobiera resztę monet (179 − 130 = 49) i zużywa zapas ✔.
- Reklama: na GitHub Pages działa dostawca **demo** (placeholder reklamy,
  przyznaje nagrodę — istniejące zachowanie, `Monetization`); prawdziwe
  SDK = PORTAL-1, nie wdrażane. Gdy portal zostanie wykryty, a jego SDK
  nie działa, dostawca to `none` i reklama niczego nie przyznaje (opis w
  `Monetization`) — nie weryfikowane w tej rundzie. Ten sam dostawca
  obsługuje „×2 MONET” na wynikach. WYZWIJ ZNAJOMEGO działa bez
  integracji: Web Share (obraz + link z ziarnem rundy), a bez niego link
  do schowka (`shareResult()`).
- Tarcza: wyłączona tylko bez zagrożeń (rywale / glitch / Złodziej) —
  poprawnie; kafel „tu zbędna”, notka z powodem.

## 5. Skrzynie gwiazd

`checkStarChests()` (po każdej misji): co 15 gwiazdek skrzynia otwiera
się **sama**, a monety, pryzmaty i wzmocnienie są dopisywane do zapisu
**przed** pokazaniem karty. „PÓŹNIEJ” tylko zamykało informację —
nagrody nie dało się stracić, ale tekst sugerował, że trzeba ją otworzyć
później. Teraz: „SKRZYNIA GWIAZD OTWARTA”, „Już na Twoim koncie…”,
„otwiera się sama co 15 gwiazdek — następna przy N”, przycisk
ŚWIETNIE/DALEJ. Wartości nagród i próg 15 bez zmian. To samo dla
darmowej skrzyni („Już na Twoim koncie.”).

## 6. Okna i spójność UX

Wspólny komponent `#unlockOverlay` (odblokowania, nagrody Core City,
skrzynie, zakupy): przyczyna „krzywo” była jedna — `.btn` ma
`max-width: 320px`, a kolumna tekstu jest szersza, więc przyciski
wisiały przy jej lewej krawędzi. Poprawka w CSS komponentu
(`align-items: center`, stała szerokość kolumny tekstu na `compact`,
miara tekstu, tekst nad promieniami) — działa dla wszystkich kart, także
tych spoza zrzutów (nagroda Core City, zakup, darmowa skrzynia).
Licznik „Nowość n z N”; przycisk akcji tylko gdy prowadzi dalej, bez
niego jeden przycisk (bez „PÓŹNIEJ”). Wyniki: rząd pomocniczy = szerokość
głównego. Warsztat: arkusz zakupu na środku wysokości. Kolory, neon,
animacje — bez zmian.

## 7. Dowody wizualne PRZED/PO

Zestawienia (lewo PRZED = 9826baf, prawo PO = kandydat, ta sama maszyna,
ten sam syntetyczny zapis): `.claude/vertical-hole/evidence/DEVICE-QA1/`.
Pełne komplety (12 scen × 8 ramek, 96 + 96 PNG): `qa/out/deviceqa1/before|after/<WxH>/`
(`node qa/deviceqa1.mjs --shots --tag=…`, poza gitem). Ramki: 1280×593
(laptop właścicielki 150%, układ `compact`), 1920×1080, 1366×768,
836×470, 844×390, 390×844, 360×640, 320×568. Emulacja Chromium — **nie**
jest testem fizycznego iPhone’a.

## 8. Wyniki QA

Ta sama maszyna (Windows 11, Node 22.23.4, Chromium Playwright), baza =
worktree `vh-base-9826baf`. Pełna regresja przez narzędzie spoza repo
`vh-dqa1-tools/suites.mjs`: wszystkie zestawy `run-all` + `deviceqa1`,
**bez wykonywania testów panelu TEST** (`dev-panel.mjs`, `dev-code.mjs`
nieuruchamiane; z `devices.mjs` i `px02-isolation.mjs` blok panelu
wycięty w kopii w `qa/out/dqa1-strip/`, pliki repo nietknięte).

| Przebieg | Wynik |
|---|---|
| `deviceqa1` zachowanie — kandydat / baza | **18/18 PASS** / 3/18 (bazowe PASS: wyjście z rundy, zakup za pryzmaty, brak błędów — te mechaniki były poprawne) |
| `deviceqa1` układ, 8 ramek — kandydat / baza | **32/32 PASS** / 9/32 |
| Pełna regresja kandydata (1. przebieg) | 1703/1710 PASS, 7 FAIL (niżej) |
| 5 FAIL układu wyników (moja regresja): `ftue3` 775×328, `responsive` 775×328 results/resultsFailed, `devices` iPhone 13 poziomo, `gameready1` EN 360×640 „PLAY AGAIN” | **naprawione** (reguła szerokości rzędu tylko dla układu pionowego, notka rankingu ukryta przy wysokości ≤ 420 px); ponownie: `ftue3`+`devices`+`gameready1`+`deviceqa1` **171/171 PASS**, `responsive` results/resultsFailed 775×328, 874×402, 844×390, 390×844 **PASS** |
| `v18` „no single booster makes EKSTREMALNA a sure thing” (ziarno 2015459339) | FAIL — **zastany**: baza z tym samym ziarnem FAIL identycznie (Zegar d5 90%) |
| `balance1` „daily tasks” (5 zadań zamiast 4) | FAIL — **zastany**, zależny od daty: baza FAIL identycznie (30.10.2026) |
| PERF-1 (`perf1`) | 25/25 PASS |
| SAVE (`save-safety`), PX02 (bez bloku panelu), R1 (`leave-run`), FTUE-1/3, VISUAL-1, CONTENT-1, BALANCE-1 (poza datą), GAME-READY-1, release, recovery, `instructions` | PASS |
| FLAKY | brak nowych; `v18` i `balance1` jak wyżej |
| NOT RUN | testy panelu TEST (poza zakresem); pełny `responsive` po poprawce wyników (uruchomione tylko sceny wyników na 4 ramkach — zmiana dotyczyła wyłącznie CSS paska wyników); fizyczne urządzenia |

Logi: `vh-dqa1-tools/cand-full.log`, `cand-rerun.log`,
`cand-responsive-results.log`, `base-v18-bal.log`;
`qa/out/deviceqa1/base-checks.log`, `layout.log`, `base-layout.log`.

## 9. Wydajność

`node qa/perf1.mjs --bench --pair=<baza> --tag=dqa1` (baza i kandydat na
przemian, ta sama maszyna; log `vh-dqa1-tools/perf-bench.log`). Jedyna
zmiana na ścieżce klatki: sortowanie obiektów **w kadrze** (jedna
tablica wielokrotnego użytku) i okrąg rywala podobnej wielkości.

| Scena | Baza p50 / p95 ms | Kandydat p50 / p95 ms |
|---|---|---|
| Arena, pierwsza runda (iPhone 13) | 19,4 / 28,8 | 19,4 / 28,3 |
| Arena późna | 37,3 / 51,4 | 37,1 / 51,1 |
| Arena, największy wir | 38,8 / 46,5 | 38,9 / 46,4 |
| Arena, laptop 1366×768 | 35,5 / 40,1 | 35,2 / 39,8 |
| Arena, Poki 836×470 | 10,6 / 13,8 | 10,6 / 14,0 |
| M59 | 19,9 / 29,0 | 19,9 / 28,9 |
| Misja gęsta / finał | 12,8 / 14,4 · 27,5 / 32,6 | 12,8 / 14,3 · 27,4 / 32,1 |
| Miasto LVL 6 | 16,8 / 35,6 | 16,5 / 36,4 |
| Warsztat | 12,1 / 20,9 | 12,1 / 21,2 |

Różnice w granicach szumu; `update()` p50 bez zmian; hashe powtarzalne.
Bramki PERF-1: 25/25 PASS. **NOT RUN:** ostatnie scenariusze czasu
rzeczywistego benchmarku po `rt-arena-max-phone` — strona Chromium uległa
awarii w trakcie pomiaru (środowisko headless; scenariusze przed nią
porównywalne). Liczby ms zależą od maszyny.

## 10. Bezpieczeństwo SAVE v13

Brak zmian w `defaultSave()`, `sanitizeSave()`, `migrateSave()`,
`SAVE_SCHEMA_VERSION` (13), kluczu `vectorHoleSave_v1` i ścieżce
`saveGame()`. Nowe pola są tylko w pamięci (`lastCoreGain`,
`warsztatFocus`, `drawOrderList`, `bot.lockHintAt`). Zakupy i wyposażenie
graczy nietknięte; testy wyłącznie na syntetycznych zapisach.

## 11. Otwarte ryzyka i NOT RUN

- 001, 013 — NOT AVAILABLE.
- 020: pochodzenie złotych łuków — hipoteza, wymaga testu na żywo.
- „ZACIEMNIENIE” przyciemnia wiry na finiszu — decyzja projektowa
  właścicielki, jeśli ma się zmienić.
- 021: rozmieszczenie (spawn) nie zmienione — kolejność rysowania usuwa
  chowanie się małych obiektów; nachodzenie dużych na siebie nadal możliwe
  (rzadki fallback po 30 próbach i wysokie sprite’y). Dalszy test na
  wielu ziarnach, jeśli wróci.
- Fizyczne urządzenia (iPhone, laptop) — NOT RUN (tylko emulacja).
- Testy panelu TEST — NOT RUN z założenia (poza zakresem).

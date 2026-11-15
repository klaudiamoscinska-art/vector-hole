# GG_UX_AUDIT_1 — audyt sześciu zgłoszeń właścicielki

Etap: **audyt**, bez zmian kodu gry, balansu, zapisu i grafiki. Dodane są tylko ten raport, skrypt diagnostyczny `qa/ux-audit1.mjs` i materiały w `design/ux-audit-1/`. Surowe logi i pełne zrzuty: `qa/out/ux-audit1/` (folder ignorowany przez git).

- Analizowany kod: `origin/main` = `be583642233be678aff93953646c1e3625dd622f` (merge PR #106 „Drugi brzeg”, scalony 2026-11-15 17:42 UTC — CITY-2 jest już w `main`, więc nie ma osobnej gałęzi do sprawdzania kolizji).
- Gałąź audytu: `claude/hopeful-brown-4ggvy9` (start = `be58364`).
- Skille: `vh-arena-gameplay` (karty Ewolucji, punkty vs rozmiar), `vh-ux-gamefeel` (odkrywalność, menu, ścieżka nagrody, czytelność kosmetyków). Listę kontrolną `vh-vector-art` zastosowałam ręcznie przy pkt 5; skilla nie uruchamiałam.

## Rodzaje dowodów

| Skrót | Co oznacza |
|---|---|
| **DOM** | Prawdziwe kliknięcie, klawisz lub ruch myszy Playwrighta na stronie gry (Chromium, desktop 1280×720 albo telefon 375×667 / 390×844). |
| **FN** | Wywołanie funkcji gry (np. `pickMutation(id)` — tę samą wywołuje kliknięcie karty) na wirtualnym zegarze, w ustawionej scenie. To nie jest pełna ścieżka gracza. |
| **SIM** | Runda Areny z botem `casual` z `qa/lib.mjs` (`ARENA_BOT`), na wirtualnym zegarze, z ustalonym ziarnem. |
| **KOD** | Odczyt kodu, bez odtworzenia. |

Ograniczenie: pełne rundy SIM **nie powtarzają się co do punktu między uruchomieniami skryptu** — źródła niedeterminizmu nie ustaliłam. Liczby z pełnych rund traktuję więc jako orientacyjne (mediana z 10 rund, rozrzut podany). Mikro-sceny FN dają za każdym razem ten sam wynik.

---

## 1. Krótkie werdykty

| # | Zgłoszenie | Werdykt | Przyczyna (A–D z prompta; pkt 6) |
|---|---|---|---|
| 1 | Gracz nie wie, że Dzielnice są dostępne | **Potwierdzone jako problem komunikacji, nie blokady.** Dzielnice są otwarte od 1. rundy, ale gra przedstawia je dopiero po 3. rundzie — małym kafelkiem i plakietką NOWE, w tym samym momencie co dwie prawdziwe nowości z dużymi kartami. | Komunikacja |
| 2 | Sterowanie w menu gry; czy klawiatura działa przy Myszy | **Funkcja istnieje — problem umiejscowienia.** Przełącznik jest w pauzie Areny, ale schowany za przyciskiem STEROWANIE; w Profilu jest poniżej ekranu (trzeba przewinąć ok. 480 px); w pauzie misji go nie ma. Przy Myszy klawisze działają i zaraz po ich puszczeniu wir **wraca do kursora** (zmierzone). | Umiejscowienie + jedna decyzja projektowa |
| 3 | „Załóż” otwiera złą zakładkę | **Potwierdzony błąd.** `ZAŁÓŻ W WARSZTACIE` otwiera Warsztat na ostatnio używanej zakładce (domyślnie WIR), bez wskazania przedmiotu i niczego nie zakłada. Dotyczy 5 z 5 nagród Core City. | Błąd |
| 4 | Karty Ewolucji: działają tylko 3 z 7 | **Wszystkie 7 kart zmienia grę, ale 4 z nich są niewidoczne, warunkowe albo szkodliwe.** Skaner w praktyce nie spełnia opisu, Fala wypycha jedzenie z zasięgu, Łowca daje +40 pkt (ok. 0,6% wyniku), Tarcza działa tylko po zjedzeniu. Turbo combo jest za to bardzo silne: ok. 81 s przyspieszenia na rundę i mediana wyniku ×3,4. | Mieszana (tabela w §2) |
| 5 | Kosmetyki poza wirem niejasne | **Potwierdzone.** Smuga to w grze pulsujący pierścień wokół wiru, nie „ślad za dziurą podczas ruchu” jak w opisie. Efekt to tylko kolor drobnych cząstek: na fragmentach prawie niewidoczny, a Pryzmat (biały) nie różni się od Klasycznego. Finisz zmienia kolor jednego banera na ok. 1,6 s raz na rundę. Podglądy Efektu i Finiszu w siatce to same kolorowe kółka. | A + B + niezgodność opisu (C: brak błędu rysowania) |
| 6 | Pierwsze miejsce, a przeciwnicy więksi | **A + B, do tego jeden błąd typu D.** Punkty i rozmiar są celowo rozdzielone. Gracz ma combo (średnio ×2,4–2,6 na kęs), a boty liczą ×1, więc gracz ma ok. 12 pkt na jednostkę wzrostu, a bot 5. Pasywny wzrost botów to 0–4,5% ich wzrostu (nie jest przyczyną). **Błąd:** czerwona poświata i bicie serca działają do 260 px od środka do środka, a rywal o promieniu ≥ 347 zjada z większej odległości — zjada bez ostrzeżenia. | A + B; D (ostrzeżenie) |

---

## 2. Zgłoszenie 4 — pełna tabela kart Ewolucji (Arena)

Lista z kodu: `MUTATIONS` (`game.js:2564–2572`), parametry `CONFIG.evolution` (`game.js:291–306`). Oferty: 3 karty przy promieniu 46 i 66 (1. runda: okna 25–30 s i 60–65 s), losowanie bez powtórzeń (`pickMutationCards()` `game.js:19136`), wybór `pickMutation()` `game.js:19171`, efekty co klatkę `updateMutationEffects()` `game.js:19316`. To **nie** są wzmocnienia misji (`MISSION_BOOSTERS`) ani moce kampanii (`CAMPAIGN_POWERS`).

Podłączenie i reset (DOM + FN, `qa/out/ux-audit1/cards.json`):
- Prawdziwe kliknięcie pierwszej oferowanej karty (oferta: Tarcza / Magnes / Fala) ustawia `activeMutations = ['phase_edge']` i zamyka ofertę — **PASS**.
- Nowa runda czyści wszystko: `activeMutations` = [], `comboWindowOverride` = null, `magnetUntil` = 0, `bountyTarget` = null, `speedBoostUntil` = 0, `scannerTarget` = null (`startRound()` → `game.js:17684–17711`) — **PASS**.
- Kumulacja: w rundzie są najwyżej 2 karty (2 oferty), ta sama karta nie wraca, póki w puli są co najmniej 3 inne. Efekty się nie znoszą; nie ma też paska aktywnych kart w HUD.

Warunki pomiaru:
- **Mikro-scena FN:** ta sama mapa (ziarno 61), rywale odstawieni, scena z kartą i bez niej.
- **Pełne rundy SIM:** 10 ziaren, bot `casual`, karta wybrana przy 1. ofercie (średnio przy 9,8 s i r ≈ 47), 2. oferta pominięta, ten sam punkt kariery (`runsPlayed` = 3, t = 0). Mediana wyniku bez karty: **6090** (zakres 3058–7732).

| Karta PL / EN (ID) | Opis dla gracza (tag) | Oczekiwane działanie | Warunek / czas | Kod efektu | Pomiar bez → z kartą | Informacja zwrotna | Werdykt | Minimalna naprawa |
|---|---|---|---|---|---|---|---|---|
| **Magnes** / Magnet (`magnet_pulse`) | „Obiekty, które możesz zjeść, same lecą do Ciebie z bliskiej okolicy.” (CAŁĄ RUNDĘ) | Przyciąga jadalne obiekty z promienia 160 | Od wyboru; **wyłącza się, gdy promień wiru ≥ 160** | `updateMutationEffects()` `game.js:19318–19333`, rysunek `drawMagnetField()` `game.js:19292` | FN, 10 fragmentów, wir stoi, 3 s: r=30: **0 → 9 zjedzonych**; r=90: **0 → 5**; r=170: **0 → 0**, pierścień znika. SIM: aktywny średnio **34,7 s** z ok. 110 s po wyborze; mediana 6090 → **7859** (+29%) | Fala przy wyborze, pierścień zasięgu, kreski przy przyciąganych obiektach | **Działa tylko przy warunku**; tag „CAŁĄ RUNDĘ” nie odpowiada działaniu | Tekst: „DO ROZMIARU T5” / „póki wir jest mniejszy niż pole”. Zasięg względem rozmiaru wiru = decyzja balansowa (GDD R5-03) |
| **Turbo combo** / Turbo Combo (`slipstream`) | „Zjedz 3 rzeczy szybko po sobie, a dostaniesz +60% prędkości na 1,5 s.” (PO COMBO ×3) | +60% prędkości na 1,5 s po combo ×3 | **Każdy kęs przy combo ≥ 3 odnawia 1,5 s** | `registerCombo()` `game.js:18889–18891`, mnożnik `game.js:19335` | FN: 141,8 → **226,8 px/s** (+60%), 1,9 s po serii 6 fragmentów. SIM: przyspieszenie **81 s na rundę**, promień 240 → **443**, mediana 6090 → **20 776** (×3,4; najgorsza runda z kartą 9510 > najlepsza bez 7732) | Brak wizualnego znaku przyspieszenia — tylko szybszy ruch | **Działa; opis myli** (w praktyce przyspieszenie trwa niemal całą rundę); **hipoteza balansowa: zdecydowanie za silna** | Tekst: „Combo ×3 i więcej = +60% prędkości, dopóki je trzymasz”. Siła = osobna decyzja |
| **Tarcza** / Shield (`phase_edge`) | „Gdy rywal Cię pochłonie, po odrodzeniu masz 4 s ochrony zamiast 2 s.” (GDY CIĘ ZJEDZĄ) | Ochrona po odrodzeniu 2 s → 4 s | Tylko po zjedzeniu gracza | `handleHoleCollisions()` `game.js:19002–19004`, `shrinkAndRespawn()` `game.js:10856` | FN: ochrona **2000 → 4000 ms**. SIM (t=0): gracz ginie 0–0,2 razy na rundę, więc karta zwykle **nie ma okazji zadziałać**; w rundach z zjedzeniem zmierzono 4000 ms | Miganie wiru (bez licznika czasu ochrony) | **Działa tylko przy warunku**; słabo widoczna | Komunikat po odrodzeniu „TARCZA · 4 s ochrony” (sama treść). Ewentualny inny efekt = decyzja |
| **Długie combo** / Long Combo (`combo_reactor`) | „Między kolejnymi kęsami masz ok. 2,9 s zamiast 1,8 s…” (WIĘCEJ PUNKTÓW) | Okno combo 1,8 → 2,88 s | Cała runda | `pickMutation()` `game.js:19187`, `registerCombo()` `game.js:18874` | FN: zegar combo po kęsie **1,77 → 2,85 s**; drugi kęs po 2,5 s: mnożnik **1,00 → 1,15**. SIM: mediana 6090 → 5144 (w innym uruchomieniu +54%) — **pełne rundy nie rozstrzygają** | Pasek combo w HUD gaśnie wolniej | **Działa zgodnie z opisem**; zysk zależy od stylu gry (bot `casual` i tak trzyma combo) | Brak naprawy kodu |
| **Skaner** / Scanner (`scanner`) | „Co 4 s podświetla najcenniejszy obiekt na mapie — od razu widać, dokąd jechać.” (CO 4 S) | Wskazuje cel do zjedzenia | Co 4 s cała runda | `updateMutationEffects()` `game.js:19337–19352`, `drawScannerTarget()` `game.js:20473` | SIM: 27,9 sygnału na rundę, ale **1,1 różnego celu** (zawsze ta sama wieża T6 — najwyższa wartość na całej mapie). Cel na ekranie w 7,3 z 27,9 sygnałów (26%), jadalny w 15,4, **jadalny i na ekranie w 4,4 (16%)**, mediana odległości **1417 px**. Mediana 6090 → 6659 (w granicach rozrzutu) | Pierścień 2 s **tylko gdy cel jest na ekranie**; brak strzałki i znacznika na minimapie | **Opis nie odpowiada działaniu**; w praktyce efekt prawie niewidoczny | Wybór celu: najcenniejszy **jadalny** obiekt w pobliżu + strzałka przy krawędzi ekranu (mała zmiana logiki, bez zmiany balansu punktów) — wymaga zgody |
| **Fala** / Wave (`shockwave`) | „Gdy urośniesz o rozmiar, fala rozrzuca pobliskie obiekty na 140 px wokół Ciebie.” (NA NOWYM ROZMIARZE) | Odpycha obiekty od wiru przy awansie T | Tylko przy awansie T **po** wyborze (karta przy r=46 nie łapie już T3, bo awans T3 dzieje się w tej samej klatce przed ofertą); SIM: 3 awanse na rundę | `checkSizeTier()` `game.js:19120–19130` | FN: 8 fragmentów 20–104 px od środka, awans T3→T4: w zasięgu **4 → 0**, zjedzone w 1 s **4 → 0** (odepchnięte na 80–122 px przy zasięgu 57 px). SIM: mediana 6090 → 5359 | Różowy pierścień 140 px | **Działa, ale szkodzi** — oddala jedzenie, a gracz wybiera ją jako ulepszenie; opis nie mówi, po co | Decyzja: odwrócić kierunek (zassanie) albo zmienić cel. Tylko tekst nie naprawi karty |
| **Łowca** / Bounty Hunter (`bounty_core`) | „Najbliższy rywal dostaje różowy celownik. Zjedz go, a zgarniesz +40 punktów ekstra.” (RYWALE) | +40 pkt za zjedzenie oznaczonego rywala | Cel wyznaczany raz, przy wyborze; po zjedzeniu nie ma nowego | `assignBountyTarget()` `game.js:19206`, `handleHoleCollisions()` `game.js:18976–18979`, `drawBountyMarker()` `game.js:20452` | FN: rywal r=20 daje **40 → 80 pkt**. SIM: cel mniejszy od gracza przy wyborze w **6/10** rund, zjedzony w **3/10**; +40 to ok. **0,6%** wyniku rundy | Obracający się różowy celownik; premia ukryta w „ZJEDZONY! +N” | **Działa; zbyt słaby i często niedostępny** (hipoteza balansowa) | Osobny napis „+40 ŁOWCA”, cel tylko spośród mniejszych rywali, nowy cel po zjedzeniu. Wartość premii = decyzja |

Wniosek: właścicielka dobrze widzi trzy karty, które dają wyraźny i ciągły efekt (Magnes, Długie combo, Turbo combo). Pozostałe działają, ale albo rzadko (Tarcza), albo niewidocznie lub obok opisu (Skaner), albo przeciw graczowi (Fala), albo marginalnie (Łowca). Dodatkowo nazwa karty „Fala” powtarza się z Finiszem „Fala” w Warsztacie.

---

## 3. Zgłoszenie 1 — Dzielnice

Dowody: KOD + SIM (rundy botem) + DOM (zrzuty Miasta na 375×667 i 1280×720), `qa/out/ux-audit1/districts.json`.

- **Dostępność trybu:** brak warunku. `btnNavDzielnice` ma `unlocked: true` zawsze (`renderBottomNav()` `game.js:14750`), a wpis `kampania` w `FEATURE_UNLOCKS` (`game.js:3610`) to `hubIntro` — nigdy nie pokazuje karty „ODBLOKOWANO!”.
- **Widoczność przycisku:**
  - 1. uruchomienie: brak nawigacji (ekran powitalny, `isFirstRun()`).
  - Od 1. ukończonej rundy: zakładka Dzielnice widoczna, bez kłódki. Warsztat i Wyzwania mają kłódki.
  - Kafelek pod GRAJ od 1. rundy pokazuje „PLAC NEONÓW · M01 · Pierwszy apetyt · Pochłoń 3 kapsuły” i otwiera odprawę M01. Nie mówi, że to osobny tryb (`design/ux-audit-1/1-miasto-po-1-rundzie.jpg`).
- **Onboarding:**
  - Dopiero po **3. rundzie** (`CONFIG.ftue.campaignIntroRuns = 3`, `campaignIntroDue()` `game.js:3579`) kafelek zmienia się na „DRUGI TRYB · Kampania: 240 misji”, a zakładka i kafelek dostają NOWE.
  - W tej samej chwili NOWE dostają Warsztat i Wyzwania, które **naprawdę** się odblokowały i mają pełnoekranowe karty „ODBLOKOWANO!” (po 2. i 3. rundzie) (`1-miasto-po-3-rundzie.jpg`). Dzielnice wyglądają więc jak kolejna „odblokowana” rzecz, tylko bez zapowiedzi — stąd zgłoszenie.
  - Linia „NASTĘPNA RUNDA” na wyniku (`nextRoundHook()` `game.js:13980`) zapowiada kolejno Warsztat, Wyzwania i nagrodę Core City, a Dzielnic nigdy.
- **Kolejne dzielnice:** odblokowuje boss poprzedniej. Karta „NOWA DZIELNICA” pokazuje się po wyniku misji (`queueUnlockCelebrations()` `game.js:17276`). Tylko KOD — nie odtwarzałam.
- **Typy graczy:**
  - Nowy: rundy 1–2 bez słowa o kampanii; kafelek M01 można wziąć za „misję Areny”.
  - Grający głównie na Arenie: po 3. rundzie ma 4 plakietki NOWE naraz i łatwo pominąć kafelek pod GRAJ.
  - Powracający (już odwiedził Dzielnice): kafelek wraca do „PLAC NEONÓW · M01…”, NOWE znika — poprawnie.
- **Najmniejsza skuteczna poprawka (tylko tekst, bez blokady):** od 1. rundy nadtytuł kafelka „KAMPANIA · PLAC NEONÓW” zamiast samego „PLAC NEONÓW” (`updateHubQuickTiles()` `game.js:13845`), z podpisem „drugi tryb · otwarty”. Do tego jedna pozycja w `nextRoundHook()` po Wyzwaniach: „Dzielnice są otwarte · 240 misji” (tylko gdy `!knowsCampaign`). Niezależność Areny i kampanii bez zmian; nie dodaje fałszywego „odblokowano”. Złożoność: **mała**. Kolizja z CITY-2: dotyczy tylko kafelka i linii wyniku, nie sceny miasta — ryzyko niskie.

## 4. Zgłoszenie 2 — sterowanie

Dowody: DOM na desktopie (prawdziwe kliknięcia, klawisze, ruch myszy), `qa/out/ux-audit1/controls.json`.

| Wejście | Czy jest Mysz / Klawiatura | Etykieta | Jak znaleźć |
|---|---|---|---|
| Koło zębate w Mieście → Profil | Tak (`profileDeskControlsRow`) | „Sterowanie na Arenie” | Wiersz zaczyna się na y = 843 przy oknie 720 px — **trzeba przewinąć ok. 480 px** (`2-profil-bez-przewiniecia.jpg`) |
| Pauza Areny (Esc / P / Spacja / przycisk) | Tak (`deskControlsRow`) | „Sterowanie” — bez „na Arenie” | Ukryte za przyciskiem STEROWANIE; po kliknięciu jest pierwsze w panelu (`2-pauza-areny.jpg`, `2-pauza-areny-sterowanie.jpg`) |
| Pauza misji | **Nie** (świadomie: misje sterują po staremu) | — | Panel STEROWANIE ma tylko Czułość, Dźwięki i Muzykę (`2-pauza-misji-sterowanie.jpg`) |
| Telefon / tablet | Nie (`hasDeskPointer` = false) | — | Zamiast tego Przeciąganie / Joystick |
| Urządzenie hybrydowe (dotyk + gładzik) | Oba wiersze: Tryb dotyku i Mysz / Klawiatura | — | Dotyk steruje zawsze, niezależnie od wyboru (`applyPlayerMovement()` `game.js:19360`) |

Zachowanie (DOM, pozycja x wiru):
- **Mysz**, kursor po prawej, A trzymane 0,9 s: 827 → 744 → 700 (w lewo). **Po puszczeniu A wir wraca do kursora:** 700 → 781 → 894 w 1,2 s. Klawisze mają pierwszeństwo, a potem znowu prowadzi kursor.
- **Klawiatura**, ruch myszy: 910 → 904 (kursor nie prowadzi), A w lewo: 824 → 775, po puszczeniu stop: 765 → 765.

Warianty:

| | A. Mysz + pomocnicze WASD; Klawiatura tylko klawisze (stan obecny) | B. Ściśle rozłączne |
|---|---|---|
| Przewidywalność | Dobra przy samej myszy. Przy mieszaniu wir po puszczeniu klawisza „sam” jedzie do starego punktu kursora | Pełna, ale w trybie Mysz WASD nic nie robi — wygląda na zepsute |
| Przypadkowe przełączenia | Brak (to ustawienie, nie automat) | Brak |
| Powrót do kursora | **Tak** (zmierzony) | Nie dotyczy |
| Pointer Lock (paczka CrazyGames) | Mysz blokuje kursor jak dotąd, Klawiatura zwalnia blokadę od razu (`setDeskControls()` `game.js:11739`) | Bez zmian |
| Dotyk / hybryda | Dotyk zawsze działa | Dotyk zawsze działa |

**Rekomendacja: A z jedną poprawką (A′) — „ostatnie użyte urządzenie prowadzi”.** W trybie Mysz wciśnięcie klawisza kasuje punkt kursora (`pointerScreen = null`, tak jak dziś robi `setDeskControls()`), więc po puszczeniu wir staje, a kursor znowu prowadzi od następnego ruchu myszy. Pomocnicze WASD zostaje, nie ma powrotu „samego”, Pointer Lock bez zmian. Decyzja należy do właścicielki; nie wdrażam.

Umiejscowienie (osobno od decyzji, **mała** zmiana UI):
- w pauzie Areny na komputerze pokazać wiersz Mysz / Klawiatura od razu, bez rozwijania STEROWANIA;
- w obu miejscach etykieta „Sterowanie na Arenie”;
- w Profilu przenieść wiersz na początek „Ustawienia”;
- w pauzie misji jedna linia „W misjach: mysz i klawiatura razem” zamiast braku informacji.

## 5. Zgłoszenie 3 — „ZAŁÓŻ W WARSZTACIE”

Ścieżka (SIM runda doprowadza Core City do następnego LVL, potem **DOM**: karta, prawdziwe kliknięcie CTA, stan Warsztatu; telefon 375×667), `qa/out/ux-audit1/reward.json`:

| Nagroda (LVL) | Kategoria | Zakładka po CTA (świeża sesja) | Zakładka po CTA (wcześniej oglądany EFEKT) | Przedmiot widoczny | Wskazany | Założony |
|---|---|---|---|---|---|---|
| Smuga „Impuls” (2) | Smuga | **WIR** | **EFEKT** | Nie | Nie | Nie |
| Wir „Kryształ” (3) | Wir | WIR (trafienie przypadkiem) | **EFEKT** | Tak / Nie | Nie | Nie |
| Efekt „Pikselowy Wybuch” (4) | Efekt | **WIR** | EFEKT (przypadkiem) | Nie / Tak | Nie | Nie |
| Finisz „Fala” (5) | Finisz | **WIR** | **EFEKT** | Nie | Nie | Nie |
| Zestaw „Pryzmat” (6) | 4 kategorie | WIR, wir „Pryzmat” poniżej ekranu | **EFEKT** | Nie | Nie | Nie |

- Przyczyna (KOD):
  - `onUnlockGo()` `game.js:14149` wywołuje `openWarsztatScreen()` bez argumentów.
  - `openWarsztatScreen()` `game.js:12736` nie przełącza zakładki (zostaje ostatnia z sesji, domyślnie WIR — `index.html:725`), czyści `warsztatFocus` i niczego nie zakłada.
  - Karta nagrody nie przekazuje ID ani kategorii: `queueRewardCelebration()` dostaje tylko tekst (`grantCoreCityLevelReward()` `game.js:17974`). Ta sama ścieżka obsługuje wir „Aurora Finału” (M24, `game.js:17076`) — tylko KOD.
- Bez skutków ubocznych: nagroda nie jest przyznawana ani kupowana drugi raz, inne założone kosmetyki bez zmian (`equip-unchanged` we wszystkich 10 przypadkach).
- Etykieta „ZAŁÓŻ W WARSZTACIE” obiecuje założenie. Dziś przycisk tylko otwiera Warsztat i to często na złej zakładce.
- Dwa uczciwe warianty:
  - **(a) „POKAŻ W WARSZTACIE”:** właściwa zakładka, przewinięcie do karty, jej wyróżnienie, nic nie jest zakładane;
  - **(b) „ZAŁÓŻ”:** to samo co (a) i do tego faktyczne założenie tylko tej kategorii (zapis jak przy dotknięciu karty w Warsztacie).
  - **Rekomendacja: (b) dla pojedynczego przedmiotu, (a) dla zestawu LVL 6** (zestaw zmienia 4 kategorie naraz — założenie wszystkiego bez pytania byłoby zaskoczeniem).
- Złożoność: **mała** (przekazanie `{cat, id}` w pozycji nagrody, wybór zakładki tym samym kodem co kliknięcie zakładki, `scrollIntoView` i klasa wyróżnienia).

## 6. Zgłoszenie 5 — Warsztat: Smuga, Efekt, Finisz

Kategorie (`index.html:725–739`, dane `game.js:2315–2390`): **WIR** (`SKINS`), **SMUGA** (`AURAS`: Brak, Iskra, Żar, Zawirowanie, Impuls, Pryzmat, Zorza Startu — ta ostatnia tylko z pakietu IAP), **EFEKT** (`EAT_EFFECTS`: Klasyczny, Pikselowy Wybuch, Neonowa Róża, Fioletowa Szczelina, Pryzmat), **FINISZ** (`OVERDRIVE_SKINS`: Klasyczny, Fala, Złoty Szczyt, Zielona Burza, Pryzmat).

Klatki z działającej gry (`Game.render()`, ta sama scena z ziarnem 77, ten sam ruch, ta sama skala w każdym wierszu):

| Kategoria | Co zmienia w grze (KOD) | Kiedy widać | Dowód (klatki) | Ocena |
|---|---|---|---|---|
| **Smuga** | Pulsujący kolorowy pierścień o promieniu r + 8…11, alfa 0,25–0,40, poświata 22 (`Hole.drawBody()` `game.js:10917–10930`). **Nie zostaje za wirem**, rysuje się tak samo w ruchu i w miejscu | Cały czas | `design/ux-audit-1/5-smuga-klatki-gfx2.jpg`, `5-smuga-klatki-r120.jpg`, `5-smuga-klatki-gfx0.jpg` | **Opis ≠ działanie:** karta nagrody, Warsztat i tłumaczenie mówią „świetlny ślad, który ciągnie się za dziurą podczas ruchu” (`rewardCategoryExplanation()` `game.js:14226`). (B) Iskra (cyjan) na wirze Horyzont (cyjan) prawie niewidoczna. Przy jakości 0 (`applyGfx()` wyłącza `shadowBlur`, `game.js:11544`) zostaje cienka obwódka. (C) Brak błędu rysowania — rysuje się to, co zakodowano |
| **Efekt pochłaniania** | Tylko kolor: cząstki wciągania i ślad połykanego obiektu w kolorze efektu (`triggerEatFeedback()` `game.js:18838`, `eatTint()` `game.js:20187`). Kształt bez zmian („Pikselowy Wybuch” nie ma pikseli) | Przy każdym kęsie gracza; większe cząstki i pierścień tylko przy obiektach r > 24 | `5-efekt-klatki-fragmenty.jpg` (fragmenty: różnic praktycznie nie widać), `5-efekt-klatki-duzy-kes.jpg` (węzły r=32: widać tylko barwę cienkiej obwódki i śladu) | (B) Na telefonie warianty prawie nieodróżnialne. Pryzmat (#ffffff) wygląda jak Klasyczny. (A) W siatce Warsztatu tylko kolorowe kółko (`5-warsztat-efekt.jpg`). Nazwa obiecuje kształt, którego nie ma |
| **Finisz** | Kolor banera „WIELKI FINISZ!” w 108. s rundy (`checkOverdriveTrigger()` `game.js:19244–19266`); błysk ekranu ma stały kolor #9875FF dla wszystkich | Raz na rundę, ok. 1,6 s | `5-finisz-klatki-baner.jpg` | (A) Siatka: same kółka (`5-warsztat-finisz.jpg`), podgląd banera tylko po wybraniu zablokowanego przedmiotu. (B) Efekt bardzo krótki. Pryzmat ma #ff00ea — kolor spoza palety `--nc-*` (do sprawdzenia z asset bible) |

Podglądy w Warsztacie (`5-warsztat-smuga.jpg`, `-efekt`, `-finisz`):
- Duża karta u góry zawsze pokazuje nazwę i opis **wiru** („Horyzont · WYPOSAŻONE · Czarna dziura — wir startowy”), także na zakładkach SMUGA, EFEKT i FINISZ. Wybrana smuga, efekt czy finisz trafia tylko do drobnej linii „Smuga: … · Efekt: … · Finisz: …”.
- Miniatury smug pokazują ten sam pierścień co w grze — podgląd jest zgodny z grą, ale zgodny z czymś, co nie jest „smugą”.

Podział:
- **A (prezentacja w Warsztacie):** karta u góry nie opisuje wybranej kategorii; Efekt i Finisz bez animowanego podglądu w siatce.
- **B (czytelność w grze):** Efekt prawie niewidoczny na fragmentach; Finisz trwa 1,6 s; Iskra na cyjanowych wirach ginie.
- **C (błąd rysowania):** nie znalazłam. Jest za to **niezgodność opisu z działaniem** Smugi.
- **D (subiektywna atrakcyjność):** wartość Finiszu (jeden kolor napisu) i Efektu (sam kolor) jest niska — ocena, nie pomiar.

Propozycje w obecnym stylu, bez ogólnego zwiększania poświaty i cząsteczek:
1. **Smuga:** albo zmienić opis na „poświata wokół wiru” (mała, tylko tekst PL/EN), albo zrobić prawdziwy ślad: 6–8 punktów historii pozycji, jedna ścieżka wektorowa o malejącej szerokości, bez `shadowBlur` przy jakości 0 (średnia; koszt rysowania do zmierzenia `qa/perf1.mjs`). Rekomendacja: **prawdziwy ślad**, bo tak tę kategorię obiecują wszystkie teksty i nagroda LVL 2.
2. **Warsztat:** po wybraniu smugi, efektu lub finiszu karta u góry pokazuje tę rzecz (nazwa, jedno zdanie „kiedy to zobaczysz”). Podgląd w ruchu: dla Smugi wir przesuwający się po łuku, dla Efektu pętla 1,2 s z połknięciem obiektu, dla Finiszu banner w pętli obok Klasycznego (mała / średnia; podgląd banera już istnieje — `drawFinishPreview()`).
3. **Efekt:** różnicować kształtem, nie jasnością — kwadratowe „piksele” dla Pikselowego Wybuchu, płatki dla Róży, szczelina dla Fioletowej (średnia, tylko ścieżki Canvas, ta sama liczba cząstek).
4. **Finisz:** kolor banera i błysku oraz krótkiego obrysu wiru w ostatnich 12 s (mała). Większy zakres = decyzja.

## 7. Zgłoszenie 6 — Arena: pierwsze miejsce, a przeciwnicy więksi

Dowody: SIM 24 rundy (8 ziaren × 3 etapy kariery: t = 0–0,33, 0,33–0,67, 1), wzrost liczony przez opakowanie `growUnits()` i `growFromArea()` każdego wiru, pasywny wzrost liczony z `botTuning.passive`; FN dla ostrzeżenia; DOM dla zrzutu. Plik `qa/out/ux-audit1/ranking.json` (zapis co 5 s: czas, punkty, miejsce, promień, odrodzenia każdego wiru; co 1 s momenty „gracz prowadzi, bot większy”).

Jak naliczane są punkty i wzrost (KOD):
- **Gracz:**
  - wzrost = jednostki obiektu × 1 (`game.js:19496`);
  - punkty = wartość × combo (do ×3, +0,15 za kęs, okno 1,8 s) × SZAŁ ×2 (`game.js:19497–19500`);
  - rywal: 2·r × combo.
- **Bot:**
  - wzrost = jednostki × min(paceMult, 2);
  - punkty = wartość × paceMult (zwykłe boty: paceMult = 1, więc **bez combo**).
- **Pacer** (pierwszy bot, `updatePacer()` `game.js:19561`): poniżej krzywej punktowej (mediana ostatnich rund × 0,72–1,05 × f^1,5, nie mniej niż 70–90% wyniku gracza) mnożnik punktów do ×8 i wzrostu do ×2; powyżej krzywej od ×0,35.
- **Pasywny wzrost botów:** 0 → 0,22 jedn./s wg trudności (`game.js:19484`), niezależny od jedzenia.
- **Start botów:** r 15 → 24 wg trudności (`CONFIG.difficulty` `game.js:107`).
- Bycie zjedzonym: powrót do r = 18, punkty zostają.
- Ranking: tylko punkty (`rankHoles()`); w rundzie nagłówek „PUNKTY”, na wyniku zdanie „Miejsce liczy się według punktów, nie rozmiaru wiru.” (`index.html:944`).

Wyniki (ostatnie uruchomienie):

| Etap kariery | Rund | 1. miejsce | 1. miejsce bez bycia zjedzonym | Śr. sekund „prowadzę, bot większy” | Śr. sekund „prowadzę, bot może mnie zjeść” | Śr. combo gracza | Pkt / jedn. wzrostu: gracz – bot | Udział pasywnego wzrostu u botów |
|---|---|---|---|---|---|---|---|---|
| t 0–0,33 | 8 | 7 | 7 (**wszystkie 7 z większym botem**) | 58 | 28 | ×2,53 | 12,4 – 5,0 | 0,8% |
| t 0,33–0,67 | 8 | 7 | 5 (5) | 103 | 79 | ×2,46 | 11,7 – 5,0 | 2,2% |
| t 1 | 8 | 6 | 2 (2) | 66 | 52 | ×2,43 | 12,1 – 5,0 | 4,5% |

- **Konkretny moment (DOM, ta sama klatka co dane):** ziarno 7100, 55,2 s:
  1. GRACZ 3531 pkt, r = 150
  2. VoidRunner 2802 pkt, **r = 175** (może zjeść gracza: 175 > 150 × 1,15)
  3. RetroWave 885, r = 115
  4. ByteViper 880, r = 117
  5. ZeroPulse 295, r = 70
  6. CyberFox 255, r = 32

  Zrzut tej klatki: `design/ux-audit-1/6-ranking-lider-mniejszy.jpg` („Ty” z koroną i #1/6 w panelu PUNKTY, większy VoidRunner u góry). W innym uruchomieniu tej samej procedury przy 102,8 s: GRACZ 11 183 pkt, r = 340, VoidRunner 7900 pkt, **r = 417**.
- **Pacer:** jego jednostki ze wzrostem przyspieszonym do ×2 przekraczały wzrost bez przyspieszenia nawet o 50–90% (np. 639 vs 457 jedn.). To wzrost **za faktycznie zjedzone obiekty**, nie „z powietrza”. Mimo to pacer często jest największym wirem na planszy.
- **Werdykt:**
  - **A (prawidłowe rozdzielenie)** — gracz zbiera ok. 2,4× więcej punktów na jednostkę wzrostu, bo ma combo; boty jedzą więcej i rosną szybciej;
  - **B (słabo wyjaśniona zasada)** — w rundzie jest tylko słowo „PUNKTY”; zdanie o zasadzie pojawia się dopiero pod tabelą wyniku, a lider z koroną bywa mniejszy niż kilka botów;
  - **C (nadmierny automatyczny wzrost)** — **nie**: pasywny wzrost to ≤ 4,5% wzrostu botów, a przyspieszenie pacera dotyczy zjedzonych obiektów (balans pacera to osobna decyzja);
  - **D (błąd prezentacji)** — **tak, jeden**: patrz niżej.
- **Lider może zostać zjedzony przez niżej punktowanego większego bota** — tak (próg 1,15× promienia, `EAT_HOLE_RATIO`). Przy t = 1 lider bywał zjadany 3–5 razy w rundzie i wciąż wygrywał na punkty.
- **Błąd ostrzeżenia (FN, `dangerVsReach`):**
  - czerwona poświata (`drawDangerHalos()` `game.js:20564`) i bicie serca (`updateDangerWarnings()` `game.js:19609`) włączają się przy odległości środków ≤ `dangerHaloRange` = 260 (`game.js:288`);
  - rywal zjada, gdy odległość środków < 0,75·r_rywala. Dla r_rywala ≥ 347 zasięg zjedzenia przekracza 260;
  - zmierzone: gracz r = 200, rywal r = 420 w odległości 299 → **zjedzony bez poświaty i bez dźwięku**; gracz r = 300, rywal r = 480 w odległości 342 → to samo. Przy rywalach r ≤ 300 ostrzeżenie zawsze przychodzi przed zjedzeniem.
- Rozmiar widoczny a rzeczywisty: wir rysuje się chwilowo większy o ≤ 14% (pulsowanie przy wzroście, 0,26 s) i ozdoby obręczy sięgają dalej. Przy rywalu podobnej wielkości szary przerywany okrąg pokazuje prawdziwą krawędź (DEVICE-QA-1). Zasady pochłaniania czytają `radius`, nie rysunek — bez rozbieżności w regułach. Zasięgu ozdób w pikselach nie mierzyłam (NOT VERIFIED).
- **Najmniejsza skuteczna poprawka — komunikacja (mała):**
  - ostrzeżenie liczone od krawędzi: `d − r_rywala·0,75 ≤ stała`, zamiast stałej 260 od środka;
  - w panelu „PUNKTY” mała ikonka przy rywalu, który jest większy od gracza (może zjeść), bez pokazywania liczb rozmiaru;
  - jedno zdanie coacha przy pierwszej sytuacji „prowadzisz, a większy rywal jest blisko”: „Prowadzisz na punkty — ale ten wir jest większy i może Cię zjeść”.
- **Balans (osobna decyzja, nie ruszam):** wysokość przyspieszenia wzrostu pacera (`maxGrowthBoost` 2), pasywny wzrost, combo tylko dla gracza.

---

## 8. Lista potwierdzonych błędów (oddzielona od propozycji)

| ID | Zgłoszenie | Błąd | Dowód | Złożoność naprawy |
|---|---|---|---|---|
| BUG-1 | 3 | `ZAŁÓŻ W WARSZTACIE` otwiera ostatnią zakładkę (domyślnie WIR), nie pokazuje i nie zakłada przedmiotu; 5/5 nagród Core City | DOM, `reward.json` | mała |
| BUG-2 | 6 | Ostrzeżenie o zagrożeniu (poświata i bicie serca) nie pojawia się przed zjedzeniem przez rywala r ≥ 347 | FN, `ranking.json` → `dangerVsReach` | mała |
| BUG-3 | 5 | Smuga opisana jako „ślad za dziurą podczas ruchu”, a rysowana jako pierścień wokół wiru (opis ≠ działanie, wszystkie miejsca i EN) | KOD + klatki | mała (tekst) / średnia (prawdziwy ślad) |
| BUG-4 | 4 | Skaner: „najcenniejszy obiekt — od razu widać, dokąd jechać”, a w praktyce cały czas ta sama, zwykle niewidoczna i często niejadalna wieża T6 (16% sygnałów jadalnych i na ekranie) | SIM, `cards.json` | mała / średnia |
| BUG-5 | 4 | Magnes ma tag „CAŁĄ RUNDĘ”, a wyłącza się przy r ≥ 160 (aktywny średnio 35 s z ok. 110 s) | FN + SIM | mała (tekst) |
| BUG-6 | 4 | Turbo combo: opis „+60% na 1,5 s” przy faktycznym ok. 81 s przyspieszenia na rundę | FN + SIM | mała (tekst); siła = decyzja |

Propozycje UX (bez balansu): kafelek i linia wyniku dla Dzielnic (§3); wiersz Mysz / Klawiatura od razu w pauzie, etykieta „na Arenie”, kolejność w Profilu (§4); karta u góry Warsztatu i podglądy w ruchu (§6); napis „+40 ŁOWCA”, komunikat Tarczy (§2); ikonka „większy” w panelu PUNKTY i zdanie coacha (§7); nazwa karty „Fala” koliduje z Finiszem „Fala”.

Hipotezy balansowe (każda wymaga osobnej decyzji): siła Turbo combo (mediana wyniku ×3,4); Fala odpycha jedzenie; wartość i cel Łowcy; zasięg Magnesu względem rozmiaru wiru; przyspieszenie wzrostu pacera.

## 9. Rekomendowana kolejność napraw

1. **BUG-1 „ZAŁÓŻ”** — mała; bez wpływu na grę, widoczna przy każdej nagrodzie. QA: nowy test DOM (wzór: `partReward` w `qa/ux-audit1.mjs`) + `ui2 --only=warsztat`.
2. **BUG-2 ostrzeżenie** — mała; czysta prezentacja. QA: `dangerVsReach` + `visual1` / `perf1` (rysowanie poświaty).
3. **Teksty kart** (BUG-5, BUG-6, nazwa „Fala”) i **Smugi** (BUG-3 wariant tekstowy, jeśli właścicielka nie wybierze prawdziwego śladu) — mała; `node qa/v19.mjs` (EN).
4. **Sterowanie: umiejscowienie** (§4) — mała; `arena-fix1`, `responsive`, `bridge` (liczba listenerów).
5. **Dzielnice: tekst kafelka i linia wyniku** (§3) — mała; `ftue1`, `ftue3`, `v22`, `flow`.
6. **Skaner i Łowca** — mała / średnia; po decyzji.
7. **Warsztat: karta u góry + podglądy w ruchu; Efekt kształtami; ewentualnie prawdziwy ślad Smugi** — średnia; `perf1 --bench`, `ui2`, `visual1`.
8. **Balans** (Turbo combo, Fala, pacer) — osobny etap z `qa/balance1.mjs`.

## 10. Decyzje wymagane od właścicielki (z rekomendacją)

| # | Decyzja | Rekomendacja |
|---|---|---|
| D1 | „ZAŁÓŻ” na karcie nagrody: (a) „POKAŻ W WARSZTACIE” bez zakładania czy (b) prawdziwe „ZAŁÓŻ” | **(b) dla pojedynczego przedmiotu, (a) dla zestawu LVL 6** |
| D2 | Sterowanie na komputerze: A (stan obecny), A′ (ostatnie urządzenie prowadzi) czy B (rozłączne) | **A′** |
| D3 | Czy wybór Mysz / Klawiatura ma dotyczyć też misji | **Nie teraz** — w pauzie misji jedna linia informacji; osobny etap, jeśli gracze o to poproszą |
| D4 | Smuga: zmienić opis na „poświata” czy zbudować prawdziwy ślad | **Prawdziwy ślad** (lekka ścieżka wektorowa, test wydajności) |
| D5 | Dzielnice: tekst kafelka od 1. rundy + pozycja w „NASTĘPNA RUNDA” (bez zmiany progu 3 rund FTUE-1) | **Tak** |
| D6 | Turbo combo: tylko poprawić opis czy też osłabić (np. przyspieszenie nie odnawia się przez 4 s) | **Najpierw opis**; osłabienie dopiero po `balance1` |
| D7 | Fala: odwrócić na zassanie / zmienić efekt / usunąć z puli | **Zmienić na krótkie zassanie** w tym samym promieniu (bez zmiany punktacji) — do potwierdzenia testem |
| D8 | Skaner: cel = najcenniejszy **jadalny** obiekt w zasięgu ekranu + strzałka przy krawędzi | **Tak** |
| D9 | Łowca: cel tylko z mniejszych rywali, nowy cel po zjedzeniu, widoczny napis premii; wartość +40 bez zmian | **Tak** (wartość = osobna decyzja) |
| D10 | Ranking: ikonka „większy od Ciebie” w panelu PUNKTY + zdanie coacha | **Tak**, bez pokazywania liczb rozmiaru |
| D11 | Kolor Finiszu „Pryzmat” #ff00ea spoza palety | Sprawdzić z `design/reference/asset_bible.svg`; **zamienić na kolor z palety**, jeśli tam go nie ma |

## 11. SHA, testy i ograniczenia

- Analizowany kod: `be583642233be678aff93953646c1e3625dd622f` (`origin/main`, merge PR #106). Drzewo przed audytem czyste.
- SHA raportu: commit na `claude/hopeful-brown-4ggvy9`, który dodał ten plik (podany w HANDOFF poniżej i w odpowiedzi dla właścicielki).
- Uruchomione (wszystkie na tej samej maszynie, Chromium z Playwright):

| Polecenie | Wynik | Uwagi |
|---|---|---|
| `node qa/ux-audit1.mjs --only=ranking` | wykonane (24 rundy SIM + FN + DOM) | `ranking.json`, zrzut |
| `node qa/ux-audit1.mjs --only=cards` | wykonane (DOM 1 klik, 8 mikro-scen FN, 80 rund SIM) | `cards.json` |
| `node qa/ux-audit1.mjs --only=reward` | wykonane (10 ścieżek: SIM → DOM) | `reward.json` |
| `node qa/ux-audit1.mjs --only=districts` | wykonane (2 viewporty × 4 rundy SIM + DOM) | `districts.json` |
| `node qa/ux-audit1.mjs --only=controls` | wykonane (DOM desktop + telefon) | `controls.json` |
| `node qa/ux-audit1.mjs --only=cosmetics` | wykonane (6 pasków klatek + Warsztat DOM) | `cosmetics.json` |
| `node qa/instructions.mjs` | **PASS 4/4** | kontrola ścieżek i reguł dokumentów |
| `node qa/run-all.mjs` | **NOT RUN** | celowo — audyt nie zmienia kodu gry (zgodnie z promptem) |

- Skrypt diagnostyczny nie jest asercyjnym testem PASS / FAIL — zapisuje pomiary. Nie jest częścią `run-all`.
- Ograniczenia:
  - pełne rundy SIM nie są powtarzalne co do punktu między uruchomieniami (niedeterminizm nieustalony) — liczby z pełnych rund orientacyjne;
  - tylko Chromium, bez prawdziwego telefonu, bez paczki CrazyGames (Pointer Lock oceniony z kodu i dokumentacji — NOT VERIFIED w przeglądarce);
  - ścieżka „Aurora Finału” (M24) i karta „NOWA DZIELNICA” tylko z kodu;
  - promień ozdób obręczy w pikselach NOT VERIFIED;
  - zamiast wideo są paski klatek JPEG (ok. 0,1–0,4 MB każdy).

## 12. HANDOFF

```
STAN PRAC: GG_UX_AUDIT_1 — audyt 6 zgłoszeń ukończony; bez zmian kodu gry/balansu/zapisu/grafiki.
REPO: klaudiamoscinska-art/vector-hole, gałąź claude/hopeful-brown-4ggvy9; baza origin/main = be583642233be678aff93953646c1e3625dd622f (PR #106 scalony); SHA raportu — patrz odpowiedź końcowa; PR: brak (nie zlecono).
TESTY: qa/ux-audit1.mjs (6 części) — wykonane, pomiary w qa/out/ux-audit1/*.json; qa/instructions.mjs PASS 4/4; run-all NOT RUN (celowo).
ZMIANY: docs/GG_UX_AUDIT_1.md (raport), qa/ux-audit1.mjs (skrypt diagnostyczny), design/ux-audit-1/ (18 obrazów JPG, ok. 2,3 MB).
NIEDOKOŃCZONE: brak w zakresie audytu. Poza zakresem: test na prawdziwym telefonie, Pointer Lock w paczce CG, ścieżka M24.
RYZYKA: liczby z pełnych rund SIM orientacyjne (niedeterminizm); naprawy kart i kosmetyków wymagają decyzji D1–D11.
NASTĘPNY KROK: decyzje właścicielki D1–D11 → osobny etap napraw w kolejności z §9 (start: BUG-1 i BUG-2). STOP przed każdą zmianą balansu.
PUNKT WZNOWIENIA: docs/GG_UX_AUDIT_1.md §8–§10; pomiary odtwarza `node qa/ux-audit1.mjs --only=<część>`.
BEZPIECZNA KONTYNUACJA: preflight (git status, origin/main SHA, worktree list); nie ruszać main, SAVE v13, workflow; przeczytać najpierw §8–§10 tego raportu i docs/GAME_DESIGN.md §2–§3.
PROMPT KONTYNUACYJNY: „Kontynuuj po GG_UX_AUDIT_1 w klaudiamoscinska-art/vector-hole. Przeczytaj docs/GG_UX_AUDIT_1.md §8–§10. Właścicielka zdecydowała: <D1…D11>. Zrób tylko: BUG-1 i BUG-2 na nowej gałęzi, z testem DOM i kontrolą bazy vs kandydat. Bez merge i deploymentu. Raport i HANDOFF po polsku.”
```

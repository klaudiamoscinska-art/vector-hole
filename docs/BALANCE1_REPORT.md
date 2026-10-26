# BALANCE-1 — ekonomia, progresja i trudność (raport)

Gałąź `balance1-progression-economy`, baza `321c561` (produkcja po PR #82). Wszystkie liczby z `node qa/balance1.mjs` (ta sama maszyna, ziarno 20261026; PRZED = `--root <worktree 321c561> --tag before`). **Gracze w tym raporcie to boty — symulacje, nie obserwacje ludzi.** Pełne dane: `qa/out/balance1/<tag>/` (careers.json, boosters.json, missions.json).

Model symulacji: 4 profile — **słaby** (bot „casual” reaguje co ~0,8 s, co trzecią decyzję błądzi), **przeciętny** (bot „casual”, miara projektowa z `qa/README.md`), **ekspert** (bot „greedy” + ekspert kampanii), **przerywający** (przeciętny, opuszcza 35% rund Areny i 25% prób misji). Grają Arenę, Wyzwanie dnia i kolejne misje (połowa czasu na Arenę, pierwsze 3 rundy to Arena — FTUE) przez prawdziwy kod nagród (`finalizeRun`, `payLeftRun`, `endCampaignMission`, `grantXp`, Core City, kalendarz, darmowa skrzynia). Czas: runda 120 s + 15 s ekranu wyniku, misja = czas gry + 20 s (odprawa, start, wynik), runda opuszczona = czas do wyjścia + 8 s. 1. dzień = jedna sesja 60 min, kolejne dni po 30 min (2 / 5 / 10 h = dni 4 / 10 / 20). Zakupy: najtańszy dostępny kosmetyk od razu; wzmocnienie misji z zapasu po 1–2 porażkach, za monety po 2–3 (ekspert nigdy). Przebiegi są ziarniste, ale nie bit w bit (zegar ścienny w Dacie) — rozrzut między dwoma przebiegami tego samego kodu to ok. ±10% zarobków; wnioski poniżej są wielokrotnie większe.

## 1. Mapa ekonomii (z kodu)

| Źródło | Ile | Właściciel |
|---|---|---|
| Ukończona runda Areny | 15 + 1,6·√wynik + miejsce 25/15/8 monet; 5 pierwszych rund ×1,5; reklama ×2 (nie po 1. rundzie); co 3. runda +2 ◆ | Arena |
| Runda opuszczona (R1) | 1,6·√wynik (×1,5 nowicjusz), XP 2,5·√wynik; przy wyniku 0 nic | Arena |
| Wyzwanie dnia | +30 monet, rekord dnia +50 i +3 ◆ | Arena |
| Misja dnia (Arena) | 50–80 monet raz dziennie | Arena |
| Core City LVL 2–6 | 150/200/250/300/400 monet + kosmetyk; od LVL 7: 100 monet + 10 ◆ za poziom | tylko Arena / Wyzwanie dnia |
| Misja kampanii — 1. ukończenie | 20 + 10·nr dzielnicy + 10·trudność (bossy 120–1200) | Dzielnice |
| Skrzynia gwiazd (co 15 ★) | 120 monet, 3 ◆, 1 wzmocnienie | Dzielnice |
| Poziom gracza | XP: runda 25 + 2,5·√wynik + miejsce 60/40/25; misja 90 / porażka 25. Awans: 40 + 15·poziom monet, co 3. poziom +5 ◆ | oba tryby |
| Kalendarz 7 dni / darmowa skrzynia co 4 h | 60–500 monet, 3–15 ◆ / 40–140 monet (20%: 2–5 ◆) | wspólne |

Wydatki: Warsztat (wiry i Smuga „Iskra” za monety, 6 kosmetyków za 15–40 ◆ — sam wygląd, PX02 D+), wzmocnienia misji (zużywalne, 60–70 monet albo 4 ◆), +20 s w misji (8 ◆). W Arenie nic nie jest na sprzedaż (PX02 D+); jedyny przepływ między trybami: monety z Areny mogą opłacić wzmocnienie misji.

**Skąd naprawdę są monety** (przeciętny gracz, PRZED; po 1 h / po 10 h): rundy Areny 34% / 30%, misje (1. ukończenie) 19% / 28%, **awanse poziomu 24% / 19%**, Core City 7% / 4%, Wyzwanie dnia 6% / 8%, skrzynie gwiazd 4% / 3%, kalendarz + skrzynia 4% / 6%, misja dnia 1% / 2%.

## 2. Wykryte problemy (PRZED)

| # | Problem | Dowód | Waga |
|---|---|---|---|
| P1 | **Warsztat za monety rozdany w kilkadziesiąt minut.** Katalog 7 przedmiotów = 5370 monet; pierwsza runda płaci ~300–500 monet (×1,5 nowicjusza + 2 awanse + misja dnia). | Komplet: słaby 44,6 min, przeciętny 35,7, ekspert 26,4, przerywający 36,1. Przeciętny po 2. rundzie kupuje od razu 3–4 rzeczy. Po 10 h: 51–102 tys. niewydanych monet. | wysoka |
| P2 | **Magnes prawie nie działa.** Zasięg 1,4 × promień od środka, siła maleje do 0 na brzegu zasięgu. | Fragment 1,5 × promienia od nieruchomego wiru nie rusza się ani przy T1, ani T3, ani T4 (przyciągany tylko z 1,2×: 4–21 px poza zasięgiem jedzenia). Wartość: +6 pkt przejść (szum ±7) przy cenie 40. Karta obiecuje „obiekty same płyną do wiru”. | wysoka (opis ≠ działanie) |
| P3 | **Misje dnia bez wyzwania.** | „150 punktów”, „combo ×3”, „T4” spełnia 96–100% rund nawet słabego gracza; „5 rywali” 0% (słaby) – 6% (przeciętny). Nagrody odwrotne do trudności (150 pkt = 70, 5 rywali = 80). | średnia |
| P4 | **Nieaktualna kalibracja M180 i M226.** | Ekspert w limicie: M180 2/10, M226 2/10 ziaren (średnio na BARDZO TRUDNEJ 90%, EKSTREMALNEJ 78%). Mediana bota zapisana 55 / 60 s, zmierzona 71 / 124 s (20 przejść). | średnia |
| P5 | Pryzmaty i monety bez długofalowego ujścia | Komplet za ◆ po 3,1–3,6 h; po 10 h ~320–440 ◆ i dziesiątki tysięcy monet. | obserwacja — wymaga nowych treści |
| P6 | Ściana trudności Areny dla słabego gracza | Po 24. rundzie (t = 1) słaby: 6. miejsce w 40–51% rund. Przeciętny wygrywa ~50%. | obserwacja — zmiana globalna |
| P7 | XP misji płaskie (90 za M01 i M240) | Kod `xpMissionSuccess`. Monety za misję rosną z trudnością. | niska |

Działa poprawnie (sprawdzone): Zegar +15 s, Turbo start od T2, Sprint ×1,15, Tarcza przyjmuje 2 zderzenia (3. kosztuje wzrost); R1 (wynik 0 = nic, wynik > 0 = tylko 1,6·√wynik i XP, bez rundy i Core City); Core City tylko z Areny; pierwszy zakup zaraz po otwarciu Warsztatu (4,5 min); Wyzwania 6,8 min; nagrody misji rosną z trudnością i dzielnicą (śr. 43 / 87 / 122 / 155 / 243 monety dla trudności 1–5).

## 3. Warianty

| | A — minimalny | **B — umiarkowany (wybrany)** | C — szeroki (niewdrożony) |
|---|---|---|---|
| Zakres | P2 Magnes (zasięg + cena), P3 misje dnia, P4 kalibracja | A + drabinka cen Warsztatu za monety (Cyjan bez zmian) | B + awanse ½ monet, pryzmaty ×1,5, XP misji wg trudności, Arena: trudność zależna od wyników, droższe wzmocnienia |
| Komplet za monety (przeciętny) | 35,7 min (bez zmian) | **79,7 min** (zmierzone) | szac. 95–110 min |
| Satysfakcja / tempo | P1 zostaje: po 40 min nic do kupienia | zakup co 5–35 min przez pierwsze 80 min | dłużej, ale mniej „+monet” po rundzie |
| Ryzyko grindu | brak | niskie (słaby: komplet w 95 min) | średnie |
| Inflacja | bez zmian | lekko mniejsza (po 10 h 42–90 tys.) | mniejsza, nadal bez ujścia |
| Dotychczasowi gracze | nic | nic nie tracą; nowe ceny tylko dla niekupionych | mniej monet i XP za to samo (odczuwalna zmiana) |
| Zakupione rzeczy / zapis | bez zmian | bez zmian, zwrot D+ po starych cenach | bez zmian |
| Koszt wdrożenia / utrzymania | mały | mały (stałe w `SKINS`/`AURAS`) | duży, wiele testów do strojenia |
| Ryzyko regresji | niskie | niskie | wysokie (Arena = FTUE, PX02, pacer) |

**Wybór: B.** A nie rozwiązuje P1 (najmocniej udowodniony problem). C zmienia odczuwalne nagrody wszystkich graczy i dotyka Areny (FTUE-1/3, pacer) bez dowodu, że to konieczne; jej punkty P5–P7 to decyzje produktowe. B usuwa P1–P4 samymi stałymi, bez zmiany zarobków, zapisów i Areny.

## 4. Zmienione parametry (PRZED → PO)

| Parametr | PRZED | PO |
|---|---|---|
| Wir Cyjan / Gorący Róż / Toksyczna Zieleń | 100 / 220 / 450 | 100 / **300** / **700** |
| Wir Ultrafiolet / Neonowe Złoto / Biała Plazma | 800 / 1300 / 2000 | **1500** / **2500** / **3800** |
| Smuga „Iskra” | 500 | **1000** |
| Katalog za monety razem | 5370 | **9900** |
| Magnes (wzmocnienie) — cena | 40 | **60** |
| Magnes — zasięg / siła (`CONFIG.campaign.magnet`) | 1,4 × promień od środka, 140·(1 − d/zasięg) | **70 px poza krawędzią**, 120 px/s przy krawędzi → 0 |
| Misja dnia „rywale” | 5 rywali, 80 | **3 rywali**, 80 |
| Misja dnia „rozmiar” | T4 (r 66), 60 | **T5 (r 90), 50** |
| Misja dnia „combo” | ×3, 50 | **×30, 60** |
| Misja dnia „punkty” | 150 pkt, 70 | **4000 pkt**, 70 |
| `MISSION_BOT_TIME` M180 / M226 | [55, 86] / [60, 174] | **[71, 109] / [124, 288]** → limit 70 → **90 s** / 80 → **165 s** |
| `LOOKS_ONLY_REFUND` (zwrot D+) | 4870 | 4870 (celowo bez zmian) |

Bez zmian: nagrody rund Areny, R1, Wyzwania dnia, misji, poziomów, Core City, kalendarza, skrzyń; krzywa XP; ceny za ◆; Zegar / Turbo start / Sprint / Tarcza; długość rund, fizyka, sterowanie, trudność Areny, FTUE-1/2/3, plansze i opisy misji (CONTENT-1).

## 5. Wyniki symulacji (PRZED → PO)

### Momenty (minuty gry)

| gracz | 1. zakup | Wyzwania | wzmocnienia | Core City 2 | Core City 6 | komplet za monety | komplet za ◆ |
|---|---|---|---|---|---|---|---|
| słaby | 4,5 → 4,5 | 6,8 → 6,8 | 18,1 → 18,1 | 9,1 → 9,1 | 127 → 134 | **44,6 → 95,2** | 218 → 218 |
| przeciętny | 4,5 → 4,5 | 6,8 → 6,8 | 22,9 → 22,9 | 9,1 → 9,1 | 121 → 121 | **35,7 → 79,7** | 202 → 219 |
| ekspert | 4,5 → 4,5 | 6,8 → 6,8 | 16,6 → 16,6 | 9,1 → 9,1 | 111 → 111 | **26,4 → 53,6** | 188 → 190 |
| przerywający | 5,4 → 5,4 | 13,5 → 13,5 | 24 → 24 | 15,9 → 15,9 | 116 → 119 | **36,1 → 70,1** | 216 → 216 |

Zakupy za monety PO (minuta): przeciętny — Cyjan i Róż 4,5, Zieleń 6,8, Iskra 13,1, Ultrafiolet 26,6, Złoto 45,6, Biała Plazma 79,7; słaby — 4,5 / 4,5 / 9,1 / 17 / 31,9 / 61,4 / 95,2; ekspert — 4,5 ×3 / 9,1 / 17,3 / 34,3 / 53,6.

### Kamienie milowe — przeciętny gracz (pełne tabele dla 4 profili: `qa/out/balance1/report-tables.md`)

| min | rundy Areny | misje | poziom | Core City | monety na koncie | zarobione łącznie | wiry/smugi za monety | za ◆ |
|---|---|---|---|---|---|---|---|---|
| 5 | 3 | 0 | 5 → 4 | 1 | 393 → 115 | 1663 → 1215 | 4/7 → 3/7 | 0/6 |
| 15 | 4 | 7 | 7 → 6 | 2 | 917 → 237 | 2987 → 2337 | 5/7 → 4/7 | 1/6 |
| 30 | 7 | 14 | 10 → 9 | 3 | 1627 → 788 | 4997 → 4388 | 6/7 → 5/7 | 1/6 |
| 60 | 14 | 26 | 14 → 13 | 4 | 3136 → 1701 | 8506 → 7801 | 7/7 → 6/7 | 2/6 |
| 120 | 27 | 47 | 19 | 6 | 10754 → 5875 | 16244 → 15895 | 7/7 | 3/6 |
| 300 | 67 | 85 | 29 → 28 | 12 | 30200 → 23986 | 37550 → 35866 | 7/7 | 6/6 |
| 600 | 133 | 126 → 129 | 39 → 38 | 22 | 54651 → 49239 | 68681 → 67959 | 7/7 | 6/6 |

Zarobki PRZED/PO różnią się tylko rozrzutem przebiegów (zasady nagród bez zmian; misja dnia trudniejsza = kilkaset monet mniej na 10 h).

**Pierwsze 5 minut:** bez zmian w przebiegu (3 rundy, Warsztat po 2. rundzie, Cyjan kupiony od razu, FTUE-3 „NASTĘPNA RUNDA · Odblokujesz Warsztat · nowy wygląd wiru” nadal prawdziwe); różnica: gracz kupuje 2–3 rzeczy zamiast 3–4 i zostaje mu cel na kolejne rundy.
**Przeciętny gracz:** nowy wygląd mniej więcej co 1–3 rundy w 1. kwadransie, potem co 15–35 min aż do 80. minuty (wcześniej wszystko w 36 min).
**Zaawansowany gracz:** komplet za monety w 54 min (było 26); po ~3 h komplet za ◆; dalej monety służą tylko wzmocnieniom misji, a Core City od LVL 7 daje 100 monet + 10 ◆ — długofalowo nadal nie ma na co wydawać (P5).

### Arena (PO, miejsca 1./2./3./4./5./6.)
- słaby: rundy 1–3: 3/0/0/0/0/0 · 4–24: 5/1/0/4/3/8 · 25+: 3/10/7/10/14/46 (śr. 2068 pkt)
- przeciętny: 3/0/0/0/0/0 · 16/4/0/0/1/0 · 46/9/14/5/10/6
- ekspert: 3/0/0/0/0/0 · 19/2/0/0/0/0 · 58/9/5/2/5/11
- przerywający: 3/0/0/0/0/0 · 14/5/1/1/0/0 · 42/16/16/6/8/3

Pierwsze 3 rundy wygrywa każdy profil (FTUE), trudność rośnie do 24. rundy. Arena nie była zmieniana — to te same rozkłady co PRZED w granicach rozrzutu.

### Misje dnia (odsetek rund spełniających cel, PO; stary cel w nawiasie)
- słaby: 3 rywali 0% (5: 0%) · 4000 pkt 8% (150: 100%) · combo ×30 35% (×3: 100%) · T5 60% (T4: 85%)
- przeciętny: 18% (6%) · 79% (100%) · 93% (100%) · 91% (99%)
- ekspert: 8% (2%) · 84% (98%) · 77% (100%) · 91% (96%)

Uwaga: dla przeciętnego gracza combo ×30 i T5 nadal są łatwe (91–93% rund) — świadomie, to „łatwe” dni; rywale to najtrudniejsza misja dnia i najwyżej płatna.

## 6. Warsztat, ceny i wzmocnienia

| Przedmiot | Cena | Odblokowanie | Działanie | Ocena |
|---|---|---|---|---|
| Wiry (6) i Smuga „Iskra” | 100–3800 monet | Warsztat (2 rundy Areny albo M02) | sam wygląd (PX02 D+, `qa/px02-isolation.mjs`) | opis = działanie; ceny teraz rozłożone na ~1–1,5 h |
| Smugi / Efekty / Finisze za ◆ (6) | 15–40 ◆ | Warsztat | sam wygląd | komplet po ~3,5 h — najdłuższy cel |
| Nagrody Core City / M24 / Pakiet | nie na sprzedaż | LVL 2–6, M24, IAP | wygląd | bez zmian |
| Zegar | 60 | po M04 (+1 w prezencie) | +15 s (zmierzone 70 → 85 s) | +14 pkt przejść |
| Turbo start | 70 | j.w. | start od T2 (6 jedn.) | +11 pkt |
| Sprint | 70 | j.w. | prędkość ×1,15 (zmierzone) | +11 pkt |
| Tarcza | 70 | j.w. | 2 zderzenia (zmierzone; 3. zabiera wzrost), tylko w misjach z zagrożeniem | bez pomiaru wartości (nie pasuje do misji testowych) |
| **Magnes** | **40 → 60** | j.w. | **PRZED: przyciągał tylko z 1,2 × promienia; PO: z 70 px poza krawędzią** | **+6 → +12 pkt** |

Wartość: bot „casual”, 32 misje (po 8 ŚREDNICH, TRUDNYCH, BARDZO TRUDNYCH, EKSTREMALNYCH) × 2, te same układy z i bez wzmocnienia; bez wzmocnień 69%. Zasięg Magnesu PO (czas do pochłonięcia fragmentu od nieruchomego wiru): 2 × promień — 0,2 s (T1), 0,7 s (T3), 1,8 s (T4); 3 × promień przy T3/T4 i 5 × przy T1 — nic (poza zasięgiem). Zakupy jednorazowe, bez wielokrotnego naliczania (wzmocnienie zużywane w `launchMission()`; Magnes z karty mocy i z wzmocnienia to ten sam efekt, nie sumuje się).

## 7. Trudność 240 misji

Audyt: każda misja bot-ekspert × 3 ziarna (20261026, **1018968824** — ziarno, przy którym wcześniej padała bramka EKSTREMALNEJ, 20261018) + bot „casual” × 3, prawdziwe limity; misje nieukończone przez eksperta — dodatkowo bez limitu. Podejrzane — 10 ziaren eksperta + 6 casual.

**PRZED:** ekspert w limicie 92% prób. W 3 ziarnach nie ukończył w limicie: M175 (EKSTREMALNA) i M217 (BARDZO TRUDNA). Na 10 ziarnach **żadna misja nie jest dla eksperta nie do przejścia** — najsłabsze: M180 2/10, M226 2/10, M211 4/10 (Złodziej: 2× porażka „racer”), M175 5/10 (misja bimodalna: kalibracja 10 przejść daje medianę 69 s, inne 123 s; casual 5/6), M38 (id M47), M145, M150, M198, M217, M240 po 6/10. Przyczyna porażek eksperta: zawsze czas (poza M211). Bazowy `qa/difficulty.mjs` (ziarno 20261026, 2 próby) wskazał inne „nigdy w limicie”: M115, M132, M145, M215, M226, M240 — na 10 ziarnach to 6–9/10, czyli losowość układu, nie blokada.

Wg trudności (PRZED, ekspert / casual / średnia nagroda): ŁATWA 100% / 100% / 43 · ŚREDNIA 100% / 100% / 87 · TRUDNA 98% / 90% / 122 · BARDZO TRUDNA 90% / 63% / 155 · EKSTREMALNA 78% / 57% / 243. Nagroda rośnie z trudnością i dzielnicą; bossy 120 → 1200.

Dzielnice (ekspert / casual PRZED): Plac 100/100, Park 100/97, Port 93/90, Galeria 93/93, Dachy 90/77, Rdzeń 97/67, Metro 96/77, Bazar 93/71, Fabryka 86/63, **Zatoka 91/84** (łatwiejsza niż Fabryka i Ogrody przed i po niej), Ogrody 97/61, Chmura 80/62.

Odstające względem sąsiadów (casual, 3 próby — duży szum): trudniejsze 0/3 przy sąsiadach ≥ 75%: M30 (id M12), M55 (M56), M82, M83, M99, M108, M112, M118, M130, M132 …; łatwiejsze: M57 (M58), M80, M81, M84, M85. **M118** („Złodziej bajtów”, EKSTREMALNA) to stała ściana dla bota „casual”: 0/3 w audycie, w karierze przeciętnego 41–43 porażki z rzędu (ekspert 3/3) — bot nie umie łapać uciekających bajtów przy ścianie; czy to ściana dla ludzi, nie wiadomo (do testu z ludźmi / decyzji).

**Zmiana:** tylko M180 i M226 (nieaktualna kalibracja). PO (10 ziaren): M180 ekspert 8/10, casual 2/6 (nadal trudny boss); M226 ekspert 9/10, casual 5/6. Skutek uboczny: M226 ma teraz limit ≥ 110 s, więc w 25. s dostaje ofertę 2 kart mocy (jak każda długa misja od 2. dzielnicy). Pozostałe odstające — bez zmian (szum 3 prób, plansze CONTENT-1, brak dowodu z ludźmi).

**PO (pełny audyt, te same ziarna):** ekspert w limicie 92% prób (bez zmian); wg trudności ekspert / casual: 100/100 · 100/100 · 98/90 · 90/63 · 78/58%. Różnice tylko w 9 misjach: M180 (limit 90 s, ekspert 1/3 → 2/3) i M226 (165 s, 1/3 → 3/3, casual 1/3 → 3/3) oraz ±1 próba w długich misjach z kartami mocy (M85, M90, M168, M207, M230, M234, M240 — karta „Magnes” jest teraz silniejsza; w granicach szumu 3 prób). M175 i M217 w 3 ziarnach nadal 0/3 eksperta (na 10 ziarnach 5/10 i 6/10) — zmienność układu, nie zmieniane.

## 8. Zapisy (SAVE v13)

- `SAVE_SCHEMA_VERSION` = 13, klucz `vectorHoleSave_v1`, bez migracji i nowych pól. Ceny i misje dnia nie są w zapisie (zapis trzyma tylko `{dateKey, completed}` misji dnia i listy posiadanych rzeczy).
- Sprawdzone (`qa/balance1.mjs` część „saves”): zapis v13 z całą starą drabinką (założona Biała Plazma, Iskra, 1234 monet, 56 ◆, wzmocnienia, poziom 17) — po wczytaniu identyczny; zapis sprzed PX02 D+ dostaje raz zwrot 4870 (stare ceny); 2000 monet przy Białej Plaźmie za 3800 — nic nie kupione, nic nie zabrane („brakuje jeszcze 1800”); R1 (wynik 0 = nic; wynik > 0 = 1,6·√wynik + zwykła nagroda za awans, bez rundy i Core City).
- Ryzyko dla dotychczasowych graczy: gracz, który odkładał na przedmiot po starej cenie, zobaczy wyższą cenę (np. Biała Plazma 3800 zamiast 2000). Nikt nic nie traci; po 2 h przeciętny gracz i tak miał już wszystko.

## 9. Wyniki testów

Ta sama maszyna (Windows 11, Node 22.23.4), `VH_QA_SEED=20261026` dla bazy i kandydata.

| Zestaw | Baza `321c561` | Kandydat | Uwagi |
|---|---|---|---|
| `node qa/run-all.mjs` | 1662/1665 | 1673/1681 | +16 sprawdzeń BALANCE-1 (wszystkie PASS) |
| `qa/balance1.mjs --quick` (w run-all) | — | 16/16 PASS | kariery 1. godziny, wzmocnienia, Magnes, zapisy, R1 |
| `qa/balance1.mjs` kariery 10 h / 240 misji (raport) | dane PRZED | dane PO | tabele w §5 i §7 |
| `qa/v18.mjs` (w run-all, ziarno 20261026) | PASS (Magnes 66% / d5 75%) | PASS (Magnes 68% / d5 70%) | Zegar 80 → 77%, reszta bez zmian |
| `qa/difficulty.mjs` (w run-all) | PASS 100→93→81→64→47% | PASS 100→93→81→66→49% | EKSTREMALNA ≤ 55% |
| `qa/px02-isolation.mjs` | — | FAIL w run-all → **95/95 PASS** | ISO-D miało cenę Magnesu 40 na sztywno → czyta cenę z gry |
| `qa/dev-panel.mjs` | — | FAIL w run-all → **66/66 PASS** | test miał 5000 − 2000 na sztywno → czyta cenę z gry |
| `qa/visual.mjs` perf gfx0 | 4,53 ms PASS | FAIL w run-all (25 ms, obciążenie) → **4,43 ms PASS** | powtórka jeden po drugim |
| `qa/v20.mjs` M11 1. klatka | 12/12 | FAIL w run-all → **12/12** | znany niestabilny |
| `qa/responsive.mjs --only=821x462` | 16/16 | FAIL w run-all (wynik misji) → **16/16** | niestabilny, PASS na obu |
| `python .claude/vertical-hole/tools/check_pages_workflow.py --repo .` | — | PASS | workflow i skrypt wydania bez zmian |
| `qa/release.mjs`, `qa/release-recovery.mjs` (w run-all) | PASS | PASS | poza checkerem przez `python3` |

**Błędy bazowe** (te same na `main`, nie regresje BALANCE-1): checker Pages wołany jako `python3` (alias Windows Store) zwraca pusty wynik; perf `arena-bots` gfx0 > 12 ms; `v19` — data „26 PAŹDZIERNIKA” bez tłumaczenia EN.

NOT RUN: testy z prawdziwymi ludźmi i na fizycznych urządzeniach; produkcyjny deployment (merge zablokowany — §11).

## 10. Otwarte ryzyka i decyzje dla właścicielki

1. **Długofalowe ujście monet i pryzmatów** (P5): po ~1,5 h (monety) i ~3,5 h (◆) nie ma nic do kupienia; potrzebne nowe treści / sezony — poza zakresem (bez prestiżu i nowych walut w tym etapie).
2. **Arena dla słabego gracza po 24. rundzie** (P6): 6. miejsce w ok. połowie rund; ewentualna trudność zależna od wyników to zmiana globalna — do decyzji.
3. **M118** i inne ściany bota „casual” — sprawdzić na ludziach przed zmianą planszy.
4. Symulacje to boty: realni gracze mogą zarabiać mniej (niższe wyniki) — wtedy drabinka trwa dłużej; warto potwierdzić analityką po wdrożeniu (czas do 1. / ostatniego zakupu).

## 11. Merge i wdrożenie

CLAUDE.md wymaga przed merge na produkcję niezależnego przeglądu GPT i zgody właścicielki; przegląd nie został wykonany, więc etap kończy się na gotowym PR (bez merge i deploymentu).

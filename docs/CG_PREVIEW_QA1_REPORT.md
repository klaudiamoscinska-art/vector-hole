# CG-PREVIEW-QA-1 — zgłoszenia z CrazyGames Preview (R1: CG-QA-01–08, R2-01–03, R3-01–04 i 06–08)

Baza: `main` 3e3089de23f0976e5e0a9a201fa29544d5841925 (paczka d47aa022…). Gałąź `cg-preview-qa1`.
Zapis v13, klucz `vectorHoleSave_v1`, ekonomia, balans, RNG, audio, sterowanie i FTUE bez zmian.
Testy: `node qa/cg-preview-qa1.mjs` (mock SDK — to nie jest wynik CrazyGames Preview).

## Przyczyny i poprawki

| ID | Przyczyna (kod) | Poprawka |
|---|---|---|
| 01 | Wynik Areny zawsze miał „Wróć do Miasta”; nowy gracz widział ten ekran tylko jako kartę powitalną, a na ekranie wyniku nie ma nawigacji z zakładką „Miasto”. | „Menu główne / Main menu”, dopóki gracz nie zna Miasta (wizyta w Mieście po rundzie, ≥ 3 rundy albo ukończona misja); potem „Wróć do Miasta / Back to City”. Cel (ekran Miasta) bez zmian. |
| 02 | Jedna linia `MISJA DNIA UKOŃCZONA: „…” — +N monet` w stylu podpowiedzi. | Złota karta: ikona, „MISJA DNIA UKOŃCZONA”, nazwa misji, „+N monet”. Nagroda i warunek bez zmian (raz dziennie, `save.mission.completed`). |
| 03 | Przyciski języka z `translate="no"` i stałym „English”. | „Polski / Angielski” w PL, „Polish / English” w EN (słownik `I18N_EN`). |
| 04 | Reset w paczce usuwa klucze przez Data Module i od razu przeładowuje; zalogowany gracz zapisuje przez portal z opóźnieniem (patrz 05). | Decyzja właścicielki: brak przycisku w paczce (kod resetu zostaje). Tekst prywatności: usunięcie = dane strony w przeglądarce (gość) / kontakt z CrazyGames (konto). GitHub Pages bez zmian. |
| 05 | `setLanguage()` zapisuje i natychmiast przeładowuje. Data Module zalogowanego gracza wysyła zapis do portalu (`saveSdkGameData`), który go odracza (dokumentacja: 1 s, do 30 s); po przeładowaniu SDK pobiera dane od portalu (`requestSdkGameDataNew`), więc może dostać stary język. Trafienia w przyciski poprawne we wszystkich 9 ramkach. Asymetria PL→EN z Preview NIE została odtworzona (model gubi wybór w obu kierunkach). | Paczka przekazuje wybór przez samo przeładowanie (`#lang=en` w adresie, czytany i usuwany przy starcie, potem zapisany w zapisie). GitHub Pages bez zmian. |
| 06 | Wiersz „Haptyka” zawsze widoczny; Chrome na PC ma `navigator.vibrate`. | Widoczny tylko przy `navigator.vibrate` i `(pointer: coarse) and (hover: none)`. |
| 07 | W paczce `Monetization.provider = 'none'`, więc `gameplayStart/Stop` nigdy nie szły do SDK (SDK ładowane tylko dla zapisu). CrazyGames: przy zintegrowanym SDK Basic Launch wymaga `Gameplay start`, a „initial download size” mierzy do pierwszego `gameplayStart`. | Markery idą przez SDK z `cgDataBoot()` (`Monetization.crazySdk()`), w istniejących miejscach cyklu gry, z ochroną przed duplikatami. `loadingStart/Stop` nie dodane (opcjonalne, brak doładowań po starcie). |
| 08 | Wzór poprawny; okno nagród mówiło „+20% za pierwsze dziś”, a gra (i GDD) daje +20% za każde ukończone Wyzwanie dnia; zakresy liczone osobno w kilku miejscach. | `coreGainRange()` jako jedno źródło zakresów; okno nagród podaje sumę części, mnożnik i bieżący zakres; tekst Wyzwania „za każde ukończenie”. Wzór i liczby bez zmian. |

## R2

| ID | Ustalenie (kod) | Zmiana |
|---|---|---|
| R2-01 | „ZMIEŃ WYGLĄD” w pauzie przełączał tylko między już posiadanymi kosmetykami (`cycleQuickEquip`); przy jednym posiadanym w kategorii karta nic nie robi — tak wygląda u nowego gracza. | Decyzja właścicielki: przycisk usunięty z arkusza pauzy (Areny i misji — to ten sam arkusz). Wygląd zmienia się w Warsztacie; kosmetyki, zakupy, odblokowania i wybory bez zmian. Kod okienka zostaje (nieosiągalny). |
| R2-02 | Pad kciuka działa tylko w obsłudze `touchstart`; mysz i WASD go nie używają, więc na PC bez dotyku przełącznik nic nie zmienia. | „Tryb sterowania” tylko przy dotyku (zdarzenia dotyku lub `maxTouchPoints > 0` — ta sama detekcja co `isTouchDevice`; laptop dotykowy go ma, bo pad działa na jego ekranie). Zapisany tryb zostaje. „Czułość” bez zmian. |
| R2-03 | `vibrate()` jest wywoływane przy ~20 zdarzeniach (kęs, tier, rywal, wynik…), gdy ustawienie włączone i jest API. Chrome (55+) blokuje `navigator.vibrate` w ramce innej domeny niż strona główna i wymaga dotknięcia strony; CrazyGames zawsze uruchamia grę w takiej ramce; Firefox na Androidzie ma API bez wibracji, Safari nie ma API. | Haptyka tylko poza ramką innej domeny, z API i z palcem jako głównym wskaźnikiem → w paczce CrazyGames nigdy (wiersz ukryty, brak wywołań); na GitHub Pages na Androidzie zostaje. Fizyczna wibracja: NOT VERIFIED (brak telefonu). |

## R3

Testy: `node qa/cg-preview-qa3.mjs [--legacy-root=DIR]` (mock SDK — to nie jest wynik CrazyGames Preview).

| ID | Przyczyna (kod) | Zmiana |
|---|---|---|
| R3-01 | R2 ukryło tylko „Haptyka” w STEROWANIU; wiersz „Wibracje” w Ustawieniach Profilu (`data-setting="haptics"`) był zawsze widoczny. | Decyzja właścicielki: w paczce brak wiersza (`#vibrationRow`); `canVibrate` i tak jest tam zawsze fałszywe. Zapisane ustawienie bez zmian. GitHub Pages bez zmian. |
| R3-02 | Paczka ustawia `.result-actions { align-items: stretch }`, a link menu ma `max-width: 440px` przy 480 px PLAY AGAIN → link przy lewej krawędzi, tekst przesunięty o 20 px logicznych (32 px na 1920×1080 i 2560×1440). W układzie wide+compact (laptop w pełnym ekranie przy skalowaniu 125–175%, np. 1097×617, 1093×614) pasek akcji przylegał do lewej krawędzi kolumny, a karty były wyśrodkowane (10 px; także GitHub Pages). Karty pod rankingiem miały różne szerokości (360 / 320 / 440 px). | Link wyśrodkowany (`align-self: center`), pasek akcji wyśrodkowany w kolumnie wide/compact, karty pod rankingiem tej samej szerokości i kształtu co przyciski. Tylko CSS ekranu wyników. Baza ca996b1: FAIL w 1920×1080, 2560×1440, 2560×1080, 1536×864, 1366×768, 1280×720, 1097×617, 1093×614…; kandydat: 16/16 ramek EN i PL. |
| R3-03 | Panel KOPIA ZAPASOWA (kod `VH1.…`) w paczce, w której zapis robi Data Module. | Decyzja właścicielki: w paczce brak panelu (`#backupBlock`); komunikat o uszkodzonym zapisie w paczce nie odsyła do kodu. `encodeSaveCode/decodeSaveCode`, `.bak`, `.rescue` bez zmian; GitHub Pages bez zmian. |
| R3-04 | Audyt względem docs.crazygames.com (sdk/game, requirements/technical, odczyt 2026-11-07): `gameplayStart` „gdy gracz wchodzi w stan grywalny (bez menu)”, także przy wznowieniu, **revive** i następnym poziomie; `gameplayStop` przy każdej przerwie. Dwie niezgodności: misja wysyłała start już przy karcie startowej (świat zamrożony, „zegar ruszy po dotknięciu”); oferta przedłużenia misji po końcu czasu nie była przerwą. | Start misji przy START (`beginMissionPlay()`); oferta revive — `gameplayStop`, przedłużenie — `gameplayStart`; wznowienie do karty / oferty nic nie wysyła. Reszta zgodna i bez zmian (patrz sekwencje niżej). |
| R3-06 | Panel Wyzwania dnia miał sztywne „+20% / +10% Core City” bez mnożnika (na LVL 1–2 realnie +32% / +16%); okno nagród i wynik pokazywały części bazowe i „×1,6” do samodzielnego mnożenia. | Jedno źródło: `coreGainScaled()` (ten sam wzór co `finalizeRun()`) i `coreRewardValues()`. Wszędzie wartości już z premią; na LVL 1–2 „Premia startowa: +60% postępu miasta na LVL 1–2” i wartości od LVL 3; od LVL 3 bez premii. Mnożnik i warunki bez zmian. |
| R3-07 | `finalizeRun()` dawało +20% (+10% za rekord) przy każdym ukończonym Wyzwaniu. | Decyzja właścicielki (zmiana ekonomii): Core City z Wyzwania raz na dzień UTC — podstawa za pierwsze ukończenie, bonus za pierwszy nowy rekord dnia. Monety i pryzmaty Wyzwania bez zmian. |
| R3-08 | Profil pokazywał `ID gościa: guest_…` i jedną linię „Dni w grze: … · sesje: …”. | „Grasz jako: Gość” / „Playing as: Guest” (albo nazwa gracza, bez tłumaczenia), cztery kafelki statystyk PL/EN. `save.guestId`, Data Module i zapis bez zmian; gest panelu testowego (7 stuknięć) przeniesiony na linię „Grasz jako”. |

### R3-07 — zasady i istniejące zapisy

- Podstawa wypłacona dziś ⇔ `save.daily.lastPlayedDate === dziś`; bonus za rekord wypłacony dziś ⇔ `save.daily.lastSeedDate === dziś`.
  Dawna gra ustawiała `lastPlayedDate` przy każdym ukończonym Wyzwaniu (zawsze z wypłatą podstawy), a `lastSeedDate` tylko przy
  nowym rekordzie dnia (zawsze z wypłatą bonusu) — więc te same pola jednoznacznie opisują wypłaty także w zapisach sprzed zmiany.
  Brak nowych pól: SAVE v13, `.bak`, `.rescue` i Data Module bez zmian kształtu.
- Wypłata i znacznik są w tym samym obiekcie i tym samym `saveGame()`: zapis, który nie dotarł (np. opóźniony zapis konta przed
  przeładowaniem), traci oba — wypłata wraca raz przy następnym ukończeniu, nigdy podwójnie.
- Runda przerwana (wynik 0 lub > 0) nie wypłaca Core City i nie ustawia znaczników.
- Dzień liczony jak dotąd w chwili zakończenia rundy (UTC); runda rozpoczęta przed północą i skończona po niej liczy się do nowego dnia.
- Kolejne podejścia poprawiają rekord (`lastSeedScore`) bez kolejnych procentów; panel Wyzwania pokazuje „Odebrane dziś”.

### R3-04 — sekwencje (mock, `window.__cgMockGame`)

| Ścieżka | Zdarzenia |
|---|---|
| Start gry, ekran powitalny, Miasto, Dzielnice, Warsztat, Profil | brak |
| GRAJ → koniec rundy | start → stop |
| ZAGRAJ JESZCZE RAZ, pauza, wznowienie, pauza, wyjście | start → stop → start → stop |
| Restart z pauzy | start → stop → start → stop |
| Utrata fokusu (gra staje, arkusz pauzy), powrót fokusu, WZNÓW | start → stop → (nic) → start → stop |
| Karta ukryta / minimalizacja, powrót, WZNÓW | start → stop → (nic) → start → stop |
| Zmiana rozmiaru jak pełny ekran w trakcie rundy | brak dodatkowych |
| Wyzwanie dnia + powtórka | start → stop → start → stop |
| Misja: karta startowa (+ pauza/wznowienie na niej) | brak |
| Misja: START → koniec | start → stop |
| Misja: wycofanie z karty startowej | brak |
| Misja: START, pauza, wznowienie, wyjście | start → stop → start → stop |
| Misja: koniec czasu z ofertą (przerwa), pauza/wznowienie na ofercie, przedłużenie, koniec | start → stop → (nic) → start → stop |
| Misja: oferta odrzucona | start → stop |
| Przeładowanie | brak do pierwszej gry |

Utrata fokusu: dokumentacja mówi „nie wywołuj tego zdarzenia przy przełączeniu fokusu (obsługujemy to sami)”. Gra przy utracie
fokusu naprawdę się zatrzymuje (arkusz pauzy, czeka na WZNÓW — zachowanie z FTUE-2, zmiana byłaby zmianą rozgrywki), więc
`gameplayStop` opisuje stan gry, a start idzie dopiero po kliknięciu WZNÓW. Do potwierdzenia w Preview / przez CrazyGames.
Karty Ewolucji w rundzie (świat zamrożony na wybór) traktowane jak część rozgrywki — bez zdarzeń (bez zmian).
`loadingStart/Stop` (opcjonalne) i `happytime` nie są wysyłane; Basic Launch nie ma reklam.

## Core City — wzór (finalizeRun)

Arena: `10 + 2 (miejsca 1–3) + 3 (1. miejsce) + 2 (nowy rekord)`; Wyzwanie dnia: `20 + 10 (rekord dnia)`.
Na LVL 1–2 suma × 1,6 i zaokrąglenie. Możliwe przyrosty Areny: LVL 1–2 16 / 19 / 22 / 24 / 27 %, LVL ≥ 3
10 / 12 / 14 / 15 / 17 %; Wyzwanie: 32 / 48 % i 20 / 30 %. „+16–27%” na GRAJ jest poprawne dla LVL 1–2.

**Rozstrzygnięte w R3-07 (decyzja właścicielki):** Wyzwanie dnia ładuje Core City raz dziennie — +20% za pierwsze
ukończenie dnia i +10% za pierwszy nowy rekord dnia (na LVL 1–2: +32% i +16%, razem +48%).

## Ręczny test w CrazyGames Preview

1. Developer Portal → gra → podmień plik na nowy `game.zip` (SHA-256 w HANDOFF) → Preview.
2. Bez logowania i zalogowana: uruchom, kliknij GRAJ od razu po starcie i rozegraj rundę.
3. Requirements: czy `Load size` / `Load time` mają wartości zamiast `waiting...`.
4. SDK functionality: czy zaznaczone są `Game → Gameplay Start` i `Gameplay Stop` (obok Data i Auth Listener).
5. Profile → Settings: „Polish | English”; wybierz Polish → „Polski | Angielski”; wybierz Angielski → angielski. Powtórz 3×, potem odśwież.
6. Profile: brak RESET PROFILE; Privacy policy: brak obietnicy resetu.
7. Pauza: brak CHANGE LOOK. STEROWANIE na PC: tylko Sensitivity; na telefonie: Control mode + Sensitivity, bez Haptics (paczka).
8. Pierwszy wynik nowego profilu: „Main menu”; po wizycie w Mieście — „Back to City”.
9. Misja dnia na wyniku: złota karta z nagrodą, raz dziennie.
10. ~~R1: okno Core City Rewards „Now (LVL 1) every gain ×1.6”~~ — zastąpione przez R3-06 (krok 15).

**R3 (nowa paczka):**

11. Profile → Settings (PC i telefon): brak „Vibration”; brak bloku BACKUP (COPY / LOAD); bloki bez pustej przerwy.
12. Profile: „Playing as: Guest” zamiast „Guest ID: guest_…”; cztery kafelki Days played / Sessions / Rounds / Missions.
13. Wynik rundy w pełnym ekranie (F11 / przycisk pełnego ekranu portalu) i w oknie: „Main menu” / „Back to City”
    wyśrodkowane pod PLAY AGAIN, karta DAILY MISSION COMPLETE tej samej szerokości co PLAY AGAIN.
14. SDK functionality: Gameplay Start / Stop dalej zaznaczone; misja w Districts — start dopiero po START na karcie.
15. LVL 1–2: GRAJ „+16–27% city build”, Miasto „… with the starting bonus”, Challenges „+32% / +16% Core City” i
    „Starting bonus: +60%…”; okno Core City Rewards bez „×1.6”, z wartościami od LVL 3. Po LVL 3: +10–17%, +20% / +10%.
16. Wyzwanie dnia: ukończ (Core City rośnie), ukończ drugi raz z lepszym wynikiem → „Daily Challenge: today’s Core City
    rewards already claimed”, pasek Core City bez zmian, rekord wyższy; Challenges: „Claimed today”. Odśwież i powtórz.

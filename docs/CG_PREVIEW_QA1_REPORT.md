# CG-PREVIEW-QA-1 — zgłoszenia z CrazyGames Preview (R1: CG-QA-01–08, R2-01–03)

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

## Core City — wzór (finalizeRun)

Arena: `10 + 2 (miejsca 1–3) + 3 (1. miejsce) + 2 (nowy rekord)`; Wyzwanie dnia: `20 + 10 (rekord dnia)`.
Na LVL 1–2 suma × 1,6 i zaokrąglenie. Możliwe przyrosty Areny: LVL 1–2 16 / 19 / 22 / 24 / 27 %, LVL ≥ 3
10 / 12 / 14 / 15 / 17 %; Wyzwanie: 32 / 48 % i 20 / 30 %. „+16–27%” na GRAJ jest poprawne dla LVL 1–2.

**Do decyzji właścicielki (bez zmian w kodzie):** komentarz w `CONFIG` nazywał `dailyFirstClearGain` „pierwszym
ukończeniem dnia”, a gra daje je przy każdej ukończonej rundzie Wyzwania (każda powtórka +20%, na LVL 1–2 +32%,
czyli więcej niż najlepsza runda Areny). Jeśli intencją był limit raz dziennie — to zmiana ekonomii.

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
10. Okno Core City Rewards: opis sumy i „Now (LVL 1) every gain ×1.6: Arena round +16–27%”.

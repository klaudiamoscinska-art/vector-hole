# CrazyGames — teksty do formularza (CRAZYGAMES-BASIC-1)

Teksty po angielsku są gotowe do skopiowania. Opisują tylko to, co gra ma dziś.
Nazwy pól w Developer Portalu mogą się różnić: formularz jest za logowaniem i nie był
oglądany (`NOT RUN`). Dokumentacja wymaga opisu, sterowania, okładek i filmów
(`docs.crazygames.com/requirements/intro/`, sprawdzone ponownie 2026-11-05).

## OWNER INPUT REQUIRED

| Pole | Co jest potrzebne | Uwaga |
|---|---|---|
| Znak towarowy GLITCH GULP | Formalna weryfikacja | Nazwę wybrała właścicielka; badanie znaków pozostaje otwarte. |
| Developer / studio | Nazwa wyświetlana publicznie | Nie wpisano żadnych danych osobowych. |
| Kontakt | Adres dla CrazyGames i ewentualnie graczy | Nie trafia do repozytorium. |
| Polityka prywatności | URL lub decyzja, że wystarcza tekst w grze | Projekt: `PRIVACY_POLICY_DRAFT.md`. |
| Warunki dla deweloperów | Przeczytanie i akceptacja przez właścicielkę | `files.crazygames.com/documents/developer_terms_20250818.pdf`. |
| Prawa i inne portale | Oświadczenie o prawach; czy jest lub będzie umowa z Poki | Warunki CrazyGames nie wymagają wyłączności (wyłączność czasowa pkt 5.5 jest opcją po Full Launch). |
| Ocena wieku | Potwierdzenie, jeśli formularz o nią pyta | Gra: rysunkowy wektorowy świat, bez krwi i bez treści dla dorosłych. |

## Game title

```
GLITCH GULP
```

## Short description

```
Steer a black hole through a neon city, swallow everything smaller and clear 240 missions or outgrow AI rivals in 2-minute rounds.
```

## Long description

```
GLITCH GULP puts you in control of a growing black hole in a glowing neon city. Start small enough to swallow crystals and capsules, then move on to cars, buses, billboards and towers. The bigger you get, the more of the city you can eat.

CAMPAIGN
Play 240 missions across 12 districts, each with its own goal, five difficulty levels, three stars to earn and optional boosters for the hard ones.

ARENA
Face five AI rivals in 2-minute rounds. Swallow smaller rivals, stay away from bigger ones, pick upgrades as you grow and finish with the most points. Grow through six size tiers in every round.

MORE TO DO
- A daily challenge on a map that is new every day
- A Core City that grows with your finished Arena rounds
- Vortex looks, trails and effects to unlock (looks only: they never change how a round plays)
- Progress saved in your browser

No account, no energy and no wait between rounds. Press play and start swallowing.
```

## Gameplay description

```
You steer a black hole seen from above. Anything small enough falls in and makes you bigger, which opens up larger objects. In Arena you compete with five AI rivals for points until the 2-minute timer ends; rivals smaller than you can be swallowed, and bigger ones can swallow you. In Campaign each mission has its own goal, such as swallowing certain objects within the time limit.
```

## Genre and tags

Kategorie wybierz z listy portalu (lista nie była widoczna, `NOT RUN`). Propozycja:

```
Genre: Arcade / Casual
Tags: arcade, casual, neon, city, growth, missions, single player, 2D
```

Nie zaznaczaj Multiplayer ani `.io`: rywale są botami i gra nie ma trybu online.

## Controls

```
Desktop
Move: mouse, or WASD / arrow keys
Lock the mouse to the game: click the board during a round
Unlock the mouse and pause: Esc
Pause: Esc, P or Space

Mobile
Move: drag your finger (a thumb pad is available in Settings)
Pause: on-screen pause button
```

## Platforms, orientation, languages

```
Platforms: Desktop browsers and mobile browsers
Orientation: Landscape and portrait
Languages: English, Polish (follows the browser's language; can be changed in the profile)
```

Uwaga do pól technicznych: Chrome i Edge są sprawdzone automatycznie, Safari i prawdziwe
telefony nie (`NOT RUN`, raport §17). Jeśli obawiasz się zachowania na telefonach, możesz
na początek zaznaczyć tylko komputery; to decyzja właścicielki.

## Saves and implementation

```
Progress is saved locally in the player's browser (localStorage). There are no accounts, no cloud save and no external login.
The game does not use the CrazyGames SDK in this build and shows no ads. It has no in-game purchases and sends no data to any server.
```

## Features (krótka lista, jeśli formularz o nią pyta)

```
- 2-minute Arena rounds against five AI rivals
- 240 Campaign missions in 12 districts
- Six size tiers
- Daily challenge
- Growing Core City
- Unlockable cosmetic looks
- Plays in the browser with no install
```

## Czego nie pisać

Prawdziwy multiplayer, gra ze znajomymi online, natywna aplikacja, CrazyGames SDK, zapis
w chmurze, reklamy z nagrodą, zakupy, wyzwania znajomych. Nie używaj nazw innych gier ani porównań do nich.

## Jak wypełnić zgłoszenie

1. Otwórz `developer.crazygames.com/games` i zacznij nową grę. **Nie klikaj końcowego
   Submit, dopóki nie zdecydujesz o tym po odbiorze.**
2. Wgraj `game.zip` albo zawartość folderu `game/`, zależnie od tego, co pokaże portal.
   `index.html` jest w głównym katalogu paczki.
3. Uruchom Preview i QA Tool. Sprawdź Arenę, Dzielnice, pauzę, ponowne wejście (zapis)
   i brak ofert reklam, a **fizyczną myszą**: kliknięcie planszy blokuje kursor, ruch we
   wszystkie strony, Esc odblokowuje i pauzuje, wznowienie blokuje ponownie. Tych kroków nie
   dało się wykonać lokalnie.
4. Wgraj trzy okładki z `covers/` i dwa filmy z `videos/`.
5. Wklej teksty z tego pliku i uzupełnij pola OWNER INPUT REQUIRED.
6. Dopiero po odbiorze GPT, scaleniu PR i Twojej decyzji wyślij zgłoszenie. Decyzję
   o przyjęciu podejmuje CrazyGames.

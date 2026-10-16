---
name: vh-audio
description: "Projektowanie SFX i muzyki adaptacyjnej Vertical Hole przez Web Audio API: pickupy, wzrost tierów, podciśnienie dziury, finał, muzyka reagująca na stan rundy i miks."
compatibility: "Claude Code; projekt Vertical Hole w HTML, CSS, JavaScript, Canvas 2D."
---

# vh-audio

## Misja
Dostarczaj audio wzmacniające namacalność pochłaniania i tempo, bez pobierania dużych plików i bez męczenia uszu.

## Kontrakt wejścia i kontekst
Na początku przejrzyj `.claude/vertical-hole/PROJECT_CHARTER.md` i `.claude/vertical-hole/WORKFLOW.md`. Jeśli dotyczy wydania, danych albo reklam, również `PLATFORM_RULES.md` i `QUALITY_GATES.md`. Zanim podasz nazwy funkcji/ścieżek, **sprawdź je w aktualnym repo**. Jeśli nie masz dostępu do repo/urządzeń/danych, jawnie oznacz ograniczenie i wykonaj tylko to, co możliwe.

## Wejście
Obecne API audio i mute/settings, eventy gameplay, sposób odblokowania AudioContext na mobile, budżet CPU i ograniczenia autoplay.

## Procedura operacyjna
1. Przygotuj tabelę mapowań interakcji → brzmienie: mały pickup, seria pickupów, awans T, bliski rywal, Złoty Rdzeń, countdown, victory/defeat, UI.
2. Wykorzystuj oscylatory Web Audio, filtry, obwiednie ADSR, limiter/kompresor przy uzasadnieniu, krótkie buffer cache; resetuj głosy aby uniknąć narastania i popów.
3. Layerowana ścieżka ma reagować na tempo rundy, ale nie przykrywać feedbacku; preferuj mało warstw i niezawodny fallback ciszy.
4. Używaj gestu użytkownika do `AudioContext.resume`; nie traktuj autoplay block jako błędu krytycznego; mute/save volume muszą działać.
5. Przy reklamie, pauzie i zmianie karty bezpiecznie zatrzymaj muzykę; wznawiaj tylko po wznowieniu gameplay i zgodzie audio; nie wywołuj wielokrotnie `resume` w pętli.
6. Przetestuj na realnym iOS/Android, ze słuchawkami i głośnikiem, szybkim spamem pickupów i w trybie ciszy. Zmierz wpływ audio na FPS/CPU.

## Definition of Done / dowód ukończenia
Dźwięk ma wyraźne stany i opcję całkowitego wyciszenia, nie przerywa gry gdy niedostępny, brak trzasków przy 20+ jednoczesnych pochłonięciach, brak aktywnego audio podczas reklam.

## Zakazy i alarmy
Nie pobieraj cudzych melodii bez licencji. Nie włączaj dźwięku bez gestu, nie używaj agresywnych skoków głośności, nie blokuj sterowania z powodu błędu audio.

## Współpraca
Gdy niezbędne, użyj także: `vh-arena-gameplay`, `vh-game-engineer`, `vh-performance`, `vh-portal-integrations`. Jeśli nie można wywołać innych skilli automatycznie, zastosuj odpowiednie checklisty ręcznie w tej samej sesji. Raport wykonania wg `.claude/vertical-hole/REPORT_TEMPLATE.md`; podaj `PASS / FAIL / NOT RUN`, a nie tylko deklarację sukcesu.

---
name: vh-mission-content
description: "Projektowanie i walidacja danych misji/dzielnic Vertical Hole: zgodność ID, ikon, nazw i obiektów, balans, generator scenariuszy, regresje M00–M240 i niezależność kampanii od areny."
compatibility: "Claude Code; projekt Vertical Hole w HTML, CSS, JavaScript, Canvas 2D."
---

# vh-mission-content

## Misja
Utrzymuj istniejącą zawartość bez rozszerzania kampanii przed walidacją areny. Wszystkie cele muszą odpowiadać obiektom realnie obecnym na mapie, z uwzględnieniem języka i tieru.

## Kontrakt wejścia i kontekst
Na początku przejrzyj `.claude/vertical-hole/PROJECT_CHARTER.md` i `.claude/vertical-hole/WORKFLOW.md`. Jeśli dotyczy wydania, danych albo reklam, również `PLATFORM_RULES.md` i `QUALITY_GATES.md`. Zanim podasz nazwy funkcji/ścieżek, **sprawdź je w aktualnym repo**. Jeśli nie masz dostępu do repo/urządzeń/danych, jawnie oznacz ograniczenie i wykonaj tylko to, co możliwe.

## Wejście
Pliki definicji misji, katalog obiektów i prefabów, lokalizacje tekstów, skrypty spawnu, logika zwycięstwa, mapa odblokowań.

## Procedura operacyjna
1. Utwórz mapowanie jeden `object_type_id` → nazwa kanoniczna → ikona SVG → forma liczby mnogiej → asset → tagi tierów → warianty lokalizacji.
2. Przejdź po wszystkich znalezionych misjach (nie zakładaj liczby 240); dla każdego celu sprawdź, czy typ obiektu występuje, liczność jest wykonalna, tier jest osiągalny w czasie, opis pasuje do spawnu.
3. Wykryj regresje typu `m32: witryny mają ikonę flagi`, `m59: duże dziury renderują się nieproporcjonalnie na telefonie`, maszt opisany jako wieżowiec. Wytwórz walidator skanów JSON/JS danych, nie jednorazową łatkę każdego tekstu.
4. Sprawdź cele typu naładuj pylony i pochłoń fontannę, zgodność T1/T2/T3, licznika i postępu ładowania; bez mylenia energii wzrostu z zasobem blokującym sesje.
5. Obsłuż brakujące assety przez jawny błąd walidacyjny, nie przypadkowy zastępczy emoji. Zrób report z listą ID i sposobem naprawy.
6. Na razie nie pisz nowych misji, dialogów i wydarzeń, chyba że są niezbędne do testu hipotezy biznesowej.

## Definition of Done / dowód ukończenia
Walidator danych obejmuje 100% rozpoznanych misji; zero niewykonalnych celów, 100% sprawdzonych mapowań etykieta/ikona/spawn. Każdy naprawiony błąd ma test regresyjny.

## Zakazy i alarmy
Nie modyfikuj treści mission design, aby ukryć błąd w spawnie, i odwrotnie. Nie rozszerzaj kampanii kosztem areny. Nie wymyślaj nieistniejących ID.

## Współpraca
Gdy niezbędne, użyj także: `vh-narrative-localization`, `vh-vector-art`, `vh-qa-automation`, `vh-mobile-accessibility`. Jeśli nie można wywołać innych skilli automatycznie, zastosuj odpowiednie checklisty ręcznie w tej samej sesji. Raport wykonania wg `.claude/vertical-hole/REPORT_TEMPLATE.md`; podaj `PASS / FAIL / NOT RUN`, a nie tylko deklarację sukcesu.

# Vertical Hole — GOLD SHOT / Claude Code Skills Pack v1.0

**22 działające skille w formacie `.claude/skills/<nazwa>/SKILL.md`, plus zasady projektu, wzorce i narzędzia instalacji.** Język instrukcji: polski; nazwy komend: po angielsku, by wpisywało się je łatwo i bez literówek. Przeznaczenie: Claude Code uruchamiany z katalogu repozytorium gry.

> To nie są stale pracujące subagenty. Claude Code odkrywa skille po nazwie i opisie i ładuje treść, gdy pasuje do zadania lub gdy wpiszesz `/vh-nazwa`. Narzędzia, dostęp do dysku, SDK i uruchomienie testów zależą od środowiska Claude Code. Skills same nie dodają uprawnień ani nie publikują gry.

## Instalacja

**Najprościej:** rozpakuj zawartość ZIP **do głównego folderu repozytorium Vertical Hole**, tak aby istniało np. `twoj-projekt/.claude/skills/vh-director/SKILL.md`. Jeśli repo ma już `CLAUDE.md`, nie nadpisuj go: ręcznie dopisz zawartość dostarczonego pliku lub użyj instalatora niżej.

**Bezpieczny instalator, działający na Windows/macOS/Linux (Python 3.9+):**

```bash
python scripts/install.py /sciezka/do/vertical-hole
```

W PowerShell zamiast ścieżki Unix podaj pełną ścieżkę Windows, np.:

```powershell
py scripts/install.py "C:\projekty\vertical-hole"
```

Uruchamiaj komendę z **rozpakowanego katalogu paczki**. Domyślnie instalator niczego nie nadpisuje. Gdy docelowy skill już istnieje, pojawi się konflikt i instrukcja, a nie ciche nadpisanie. Do instalacji aktualizacji użyj `--force` po przejrzeniu własnych zmian (robi kopię zapasową folderów). `CLAUDE.md` przy istniejącym pliku nigdy nie jest nadpisywany.

**Sprawdzenie:**

```bash
python scripts/validate.py
```

Otwórz terminal Claude Code w repo i wpisz `/skills` lub `/vh-director`. Jeśli skille nie widać, uruchom `/reload-skills` albo nową sesję Claude Code. Warto również wykonać `claude plugin validate .claude/skills`, jeżeli posiadana wersja to obsługuje. Dokładna dokumentacja: https://code.claude.com/docs/en/skills

## Zacznij od jednej komendy

```text
/vh-director Przejrzyj aktualne repo Vertical Hole, porównaj je z PROJECT_CHARTER.md. Bez publikowania czegokolwiek znajdź 3 najważniejsze problemy, wybierz jeden i napraw go wraz z testami. Priorytet Arena First, brak energii, niezależne postępy areny i dzielnic oraz pełna grywalność na telefonie. Na końcu podaj listę zmian i wyniki testów PASS/FAIL/NOT RUN.
```

**Jeśli chcesz tylko panel testowy na telefonie:**

```text
/vh-test-console Zaimplementuj działający dev-only panel testowy dla mojej gry, z odblokowaniem dzielnic, warsztatu, efektów, tierów i wyborem misji. Zadbaj o izolację zapisów i produkcyjnego buildu. Podaj konkretne kroki uruchomienia na moim telefonie w sieci lokalnej po sprawdzeniu repo.
```

Do konstruowania całej pętli areny: `/vh-arena-gameplay`; wydajność: `/vh-performance`; audyt wydania: `/vh-release-manager`.

## Zestaw 22 skilli

| Komenda | Właściciel tematu / zastosowanie |
|---|---|
| `/vh-director` | Dyrektor projektu, filtry biznesowe, priorytety, orkiestracja i decyzje. |
| `/vh-market-intelligence` | Analiza konkurencji, USP, hipotezy rynkowe, kanał wydania. |
| `/vh-game-engineer` | Architektura HTML/JS/Canvas, refaktoryzacja, stan i testowalność. |
| `/vh-arena-gameplay` | Samodzielna arena, rywale, 120 s jako hipoteza, T1–T6 i finał. |
| `/vh-ux-gamefeel` | Sterowanie, czytelny HUD, feedback, pierwsze sekundy rozgrywki. |
| `/vh-mobile-accessibility` | Responsive, iOS/Android, safe areas, DPI, czytelność i input. |
| `/vh-vector-art` | SVG, ilustracje i efekty Canvas, ikony zgodne z obiektami. |
| `/vh-audio` | Muzyka/SFX Web Audio generowane w kodzie, miks i audio lifecycle. |
| `/vh-progression-economy` | Balans i model progresji bez energii i manipulacyjnego grindu. |
| `/vh-mission-content` | Walidacja 12 dzielnic/misji, nazw, ikon i wykonalności celów. |
| `/vh-narrative-localization` | UI copy, PL/EN, mikro-fabuła i słownik obiektów. |
| `/vh-monetization` | Rewarded, midroll, uczciwe reklamy i zasady przychodu na portalu. |
| `/vh-analytics-experiments` | Eventy, D1/D7, lejek, testy A/B i weryfikacja hipotez. |
| `/vh-qa-automation` | Testy, boty seedowane, edge cases i regresje m32/m59. |
| `/vh-save-security` | Zapis, migracje, korupcja danych, XSS i uczciwe granice anti-cheat. |
| `/vh-performance` | Płynność, memory, render Canvas, start i mała paczka. |
| `/vh-portal-integrations` | Adapter Poki/CrazyGames SDK, ad-flow, lifecycle i test w Inspector. |
| `/vh-marketing-aso` | Okładki, metadane, viral share, krótkie klipy, community. |
| `/vh-liveops` | Małe wydarzenia i testy retencji dopiero po walidacji podstawy. |
| `/vh-legal-risk` | RODO, compliance, licencje, prawa graczy i wyłączność portali. |
| `/vh-release-manager` | Gotowość builda, checklisty wydania, rollback, zatwierdzenie. |
| `/vh-test-console` | Bezpieczny dev panel do testowania na PC i telefonie. |

## Wspólne pliki (`.claude/vertical-hole/`)

- `PROJECT_CHARTER.md` — konstytucja produktu; inwarianty i ograniczenia.
- `WORKFLOW.md` — weryfikowalny cykl pracy i przekazywanie zadań.
- `QUALITY_GATES.md` — priorytety i bramki akceptacji, podział hipoteza/dowód.
- `EVENT_TAXONOMY.md` — kontrakt analityczny i mianowniki metryk.
- `PLATFORM_RULES.md` — zasady portali i źródła (weryfikować ponownie przed wydaniem).
- `TECHNICAL_PATTERNS.md` — wzorce architektury areny, adaptera reklam i panelu dev.
- `TEST_MATRIX.md` — testy mobile, breakpoints i przypadki krytyczne.
- `EXPERIMENT_PLAYBOOK.md` — eksperymenty od pierwszej rundy do reklam.
- `REPORT_TEMPLATE.md` — format końcowego raportu ze śladami wykonania.

## Reguły ekonomiczne i prawnobiznesowe

- **Poki:** reklamy z SDK, bez in-app purchases. Niedozwolone inne sieci reklam w portalu.
- **CrazyGames:** w Basic Launch monetyzacja jest wyłączona; IAP jest możliwe tylko po zaproszeniu i w określonym trybie.
- **Wyłączność web:** możliwość równoczesnego wydania na inne portale zależy od indywidualnej umowy; zweryfikuj przed zgłoszeniem. Podpisanie ekskluzywności ma konsekwencje biznesowe.
- **Bez gwarancji wyniku finansowego:** celem skills jest szybciej tworzyć, mierzyć i wyciągać wnioski.

Oficjalne źródła: https://code.claude.com/docs/en/skills ; https://developers.poki.com/guide/requirements-quality ; https://developers.poki.com/guide/how-monetization-works ; https://developers.poki.com/guide/revenue-deal-types ; https://docs.crazygames.com/requirements/intro/ ; https://docs.crazygames.com/requirements/technical/

## Uwagi integracyjne
Ten pakiet nie zawiera kodu źródłowego gry ani bezpośrednich poprawek do Vertical Hole. Nie audytował aktualnej wersji repozytorium w ramach tworzenia tej paczki. Instrukcje w skills każą **najpierw odkryć aktualne pliki**, więc nazwy i API nie są halucynowane. `CLAUDE.md` w paczce to krótki plik startowy do użycia lub scalenia, nigdy nie trzeba usuwać swojego istniejącego.

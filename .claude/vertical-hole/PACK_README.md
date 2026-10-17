# Vertical Hole — GOLD SHOT / Claude Code Skills Pack v1.4

**22 działające skille w formacie `.claude/skills/<nazwa>/SKILL.md`, plus zasady projektu, wzorce i narzędzia instalacji.** Język instrukcji: polski; nazwy komend: po angielsku, by wpisywało się je łatwo i bez literówek. Przeznaczenie: Claude Code uruchamiany z katalogu repozytorium gry.

> To nie są stale pracujące subagenty. Claude Code odkrywa skille po nazwie i opisie i ładuje treść, gdy pasuje do zadania lub gdy wpiszesz `/vh-nazwa`. Narzędzia, dostęp do dysku, SDK i uruchomienie testów zależą od środowiska Claude Code. Skills same nie dodają uprawnień ani nie publikują gry.

## Instalacja

**Bezpieczna metoda: rozpakuj ZIP do ODDZIELNEGO folderu poza repo gry**, następnie uruchom poniższy instalator, wskazując katalog repo. **Nie rozpakowuj całej paczki bezpośrednio na repo!** ZIP zawiera pliki głównego katalogu (`README.md`, `CLAUDE.md`, `scripts/`), które mogłyby nadpisać istniejące instrukcje lub testy gry. Instalator domyślnie przerywa przy konflikcie; aktualizacja `--force` wymaga najpierw sprawdzenia listy zmian i kopii zapasowej. `CLAUDE.md` repo pozostaje zachowany i wymaga ręcznego scalenia wskazówek.

Po instalacji powinien istnieć np. `twoj-projekt/.claude/skills/vh-director/SKILL.md`. Jeśli instalator nie jest dostępny, można ręcznie skopiować wyłącznie potrzebne katalogi `.claude/skills/vh-*` i `.claude/vertical-hole/` z kontrolą konfliktów — nie kopiuj w ciemno plików z katalogu głównego paczki.

**Bezpieczny instalator (v1.3: staging, unikalny backup, próba rollback po błędzie), działający na Windows/macOS/Linux (Python 3.9+):**

```bash
python scripts/install.py /sciezka/do/vertical-hole
```

W PowerShell zamiast ścieżki Unix podaj pełną ścieżkę Windows, np.:

```powershell
py scripts/install.py "C:\projekty\vertical-hole"
```

Uruchamiaj komendę z **rozpakowanego katalogu paczki**. Domyślnie instalator niczego nie nadpisuje. Gdy docelowy skill już istnieje, pojawi się konflikt i instrukcja, a nie ciche nadpisanie. Do instalacji aktualizacji użyj `--force` po przejrzeniu własnych zmian (robi kopię zapasową folderów). `CLAUDE.md` przy istniejącym pliku nigdy nie jest nadpisywany.

**Przed aktualizacją:** `python scripts/install.py /ścieżka/do/repo --dry-run`. Przy `--force` istniejące skille/dokumenty zastępowane są po kopii zapasowej; zmiany dostosowane ręcznie należy później scalić. Własny `CLAUDE.md` nigdy nie jest nadpisywany.

**Sprawdzenie:**

```bash
python scripts/validate.py                      # walidacja tej paczki
python scripts/validate.py --repo /sciezka/do/vertical-hole # sprawdza INSTALACJĘ, a nie gameplay
python -m unittest discover -s scripts/tests -v      # statyczne testy zgodności paczki
```

Otwórz terminal Claude Code w repo i wpisz `/skills` lub `/vh-director`. Jeśli skille nie widać, uruchom `/reload-skills` albo nową sesję Claude Code. Warto również wykonać `claude plugin validate .claude/skills`, jeżeli posiadana wersja to obsługuje. Dokładna dokumentacja: https://code.claude.com/docs/en/skills

## Najpierw obowiązkowy P00

Z paczki `Vertical_Hole_Prompty_Claude` uruchom `P00.md` **w trybie wyłącznie weryfikacyjnym** (lub ręcznie wg `.claude/vertical-hole/PREFLIGHT_GATES.md`) **przed nowymi feature’ami**. Bramki są **rozdzielone**: `GO_CORE` wymaga braku aktywnej energii, izolacji trybów, poprawnej pętli i bezpiecznej migracji legacy save (wszystkie PASS). `GO_TOOLS` wymaga działającego, odizolowanego panelu dev i braku jego kodu w produkcji. Brak panelu NIE blokuje niezależnych zmian FTUE po `GO_CORE`, ale blokuje testy wymagające panelu i wydanie. Raport P00 dotyczy rzeczywistego revision, nie specyfikacji.

## Zacznij od jednej komendy

```text
/vh-director Przejrzyj aktualne repo Vertical Hole, porównaj je z PROJECT_CHARTER.md. Bez publikowania czegokolwiek znajdź 3 najważniejsze problemy, wybierz jeden i napraw go wraz z testami. Priorytet Arena First, brak energii, niezależne postępy areny i dzielnic oraz pełna grywalność na telefonie. Na końcu podaj listę zmian i wyniki testów PASS/FAIL/NOT RUN.
```

**Jeśli chcesz zweryfikować już istniejący panel testowy na telefonie:**

```text
/vh-test-console Sprawdź istniejący dev-only panel testowy z odblokowaniem dzielnic, warsztatu, efektów, tierów i wyborem misji; sprawdź izolację zapisów i brak panelu w wydaniu. Podaj konkretne kroki uruchomienia na moim telefonie. Nie twórz drugiego panelu ani nie zmieniaj kodu bez osobnego zlecenia.
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
- `PREFLIGHT_GATES.md` — obowiązkowa bramka P00 po instalacji i przed nowymi funkcjami.
- `ARENA_DISTRICT_CONTRACT.md` — twarde granice zapisu, boostów i progresji trybów.
- `WORKFLOW.md` — weryfikowalny cykl pracy i przekazywanie zadań.
- `QUALITY_GATES.md` — priorytety i bramki akceptacji, podział hipoteza/dowód.
- `EVENT_TAXONOMY.md` — kontrakt analityczny i mianowniki metryk.
- `PLATFORM_RULES.md` — zasady portali i źródła (weryfikować ponownie przed wydaniem).
- `TECHNICAL_PATTERNS.md` — wzorce architektury areny, adaptera reklam i panelu dev.
- `TEST_MATRIX.md` — testy mobile, breakpoints i przypadki krytyczne.
- `EXPERIMENT_PLAYBOOK.md` — eksperymenty od pierwszej rundy do reklam.
- `REPORT_TEMPLATE.md` — format końcowego raportu ze śladami wykonania.
- `SAVE_MIGRATION_CONTRACT.md` — historyczne salda/nagrody, atomowe i idempotentne migracje bez przywracania energii.
- `SKILL_EVALUATION.md` — scenariusze testów działania skilli na rzeczywistej grze, w tym negative cases i jawne NOT RUN.
- `CHANGE_SAFETY.md` — małe patche, zabezpieczenie migracji i rollback.
- `EVIDENCE_FRESHNESS.md` — stan gita i fingerprint kodu przed GO.
- `RELEASE_DEBUG_GUARD.md` — oddzielny build dev/release i wykluczenie panelu.

**Uwaga o testach:** `validate.py` i `scripts/tests/` potwierdzają strukturę/spójność instrukcji, NIE skuteczność Claude ani gameplay. Dla rzeczywistego repo potrzebne są jego testy runtime/urządzenia i dowody; `scripts/check_evidence.py` tylko sprawdza kompletność manifestu testów.

## Reguły ekonomiczne i prawnobiznesowe

- **Poki:** reklamy z SDK, bez in-app purchases. Niedozwolone inne sieci reklam w portalu.
- **CrazyGames:** w Basic Launch monetyzacja jest wyłączona; IAP jest możliwe tylko po zaproszeniu i w określonym trybie.
- **Wyłączność web:** możliwość równoczesnego wydania na inne portale zależy od indywidualnej umowy; zweryfikuj przed zgłoszeniem. Podpisanie ekskluzywności ma konsekwencje biznesowe.
- **Bez gwarancji wyniku finansowego:** celem skills jest szybciej tworzyć, mierzyć i wyciągać wnioski.

Oficjalne źródła: https://code.claude.com/docs/en/skills ; https://developers.poki.com/guide/requirements-quality ; https://developers.poki.com/guide/how-monetization-works ; https://developers.poki.com/guide/revenue-deal-types ; https://docs.crazygames.com/requirements/intro/ ; https://docs.crazygames.com/requirements/technical/

## Uwagi integracyjne
Ten pakiet nie zawiera kodu źródłowego gry ani bezpośrednich poprawek do Vertical Hole. Nie audytował aktualnej wersji repozytorium w ramach tworzenia tej paczki. Instrukcje w skills każą **najpierw odkryć aktualne pliki**, więc nazwy i API nie są halucynowane. `CLAUDE.md` w paczce to krótki plik startowy do użycia lub scalenia, nigdy nie trzeba usuwać swojego istniejącego.

## Zmiany v1.3 i kontrola instalacji
- Naprawiono `scripts/validate.py`: przełącznik `--repo` wymusza sprawdzenie wybranego celu, oczekiwanej listy 22 skilli, dokumentów i odwołania w repozytoryjnym `CLAUDE.md`. Nie uruchamiaj samego `validate.py` jako dowodu, że instalacja się udała.
- Rozdzielono GO_CORE/GO_TOOLS; dodano kontrakt migracji i BOOST-01..03, ewalucję skilli oraz raportowanie mianownika R5 z brakami danych.
- Sprawdzaj rzeczywiste testy gry, nie tylko strukturę ZIP.
- Jeśli repo ma własny `CLAUDE.md`, instalator go zachowa. Po scaleniu instrukcji i wskazaniu źródeł ponów `validate.py --repo ...`. W razie konieczności użycia `install.py --force` przejrzyj kopie zapasowe i istniejące modyfikacje.

## Najważniejsze poprawki v1.3
- **Skończ z nieaktualnym PASS:** `scripts/check_evidence.py` wymaga SHA256 aktualnego working tree, nie tylko `git HEAD`. Wygeneruj fingerprint flagą `--snapshot` i przetestuj finalny stan; `source_snapshot_sha256` + `source_snapshot_file_count` w manifeście. To nie uruchamia gry.
- **P00 bez zmian gry:** tylko read-only diagnoza i dowody. Naprawy wykonuj osobnymi promptami PX01–PX05, każdy z testami, potem ponów P00. Migracje starego zapisu mają jawny STOP przy nieznanej destrukcji.
- **Debug release:** dwa osobne buildy i `python .claude/vertical-hole/tools/verify_release_artifact.py --dev-build ... --release-build ...`, przy implementacji wymagany marker `VH_DEV_CONSOLE_ONLY`. Skrypt jest tylko jedną z kontroli; ręczne testy UI, globali i storage nadal konieczne.
- **Aktualizacje:** instalator ma `--dry-run`, nie zapisuje przy konfliktach bez `--force`, zachowuje unikalne backupy przy aktualizacji i próbuje rollback w razie awarii.
- **R5:** opóźniony timer JS nie potwierdza obecności dokładnie w t=300; missing/unknown są raportowane.

**Narzędzia audytu są teraz także instalowane w repo:** `.claude/vertical-hole/tools/check_evidence.py`, `.claude/vertical-hole/tools/verify_release_artifact.py`, `.claude/vertical-hole/tools/example_evidence_manifest.json`; testy paczki `scripts/tests/` uruchamiaj z rozpakowanego ZIP. Bezpośrednie rozpakowanie ZIP do repo również instaluje narzędzia.

## Audyt v1.4 — ważne
- Trzy zgłoszone jako zakończone zadania (**energia, izolacja areny i panel dev**) są sprawdzane przez P00, a nie programowane ponownie. FAIL → osobne zlecenie.
- Narzędzia dowodów są dostarczane razem ze skillami pod `.claude/vertical-hole/tools/`. `validate.py --repo` weryfikuje ich obecność.
- `check_evidence.py` odrzuca dowody wskazujące na pliki poza `.claude/vertical-hole/evidence/`: wskazanie źródła gry jako „loga” nie może ukryć edycji przed fingerprintem. Manifest zapisuj jako `VH_PREFLIGHT_MANIFEST.json`.

## Dodatkowe weto audytowe 2026-10-17 (v1.4.1)
Przed produkcją: `python .claude/vertical-hole/tools/check_pages_workflow.py --repo .` oraz `python .claude/vertical-hole/tools/verify_release_artifact.py --dev-build ... --release-build ...`. Publiczny repo `vector-hole` ma weryfikowane zagrożenia: `DevPanel` w monolitycznym `game.js`, wspólna moneta/XP i `SKINS.perks` umożliwiają kampanii pośrednią przewagę w Arenie, `loadSave` zapisuje migrację podczas odczytu, a Pages publikuje branch `claude/**` i `path: "."`. Te punkty nie są automatycznie naprawiane przez instalację ZIP i są zadaniami rozdzielonymi od weryfikacyjnego P00.

## Uzupełnienie v1.4.2 — poprawki wynikające z niezależnego audytu
- **Krytyczna luka narzędzia:** poprzedni `check_pages_workflow.py` przepuszczał niebezpieczne `path: ./`, dynamiczne `${{ github.workspace }}` oraz inne branche publikujące Pages. Teraz zachowuje się fail-closed; testy regresyjne sprawdzają omijanie walidacji.
- **Sprzeczne instrukcje:** `CHANGE_SAFETY.md` i starszy akapit README myląco nazywały naprawy częścią P00. Poprawiono: P00 jest read-only, a naprawy wykonuje się wyłącznie jako osobne PX01–PX05.
- Wewnętrzne testy ZIP nie uruchamiają aktualnej gry, nie dowodzą wersji live i nie zastępują ustawień GitHub wymagających ręcznej konfiguracji.

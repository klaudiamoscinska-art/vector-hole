# Audyt Vertical Hole — gra, skille Claude Code v1.4 i prompty v1.4

**Data:** 2026-10-17  
**Źródło gry:** https://klaudiamoscinska-art.github.io/vector-hole/ oraz publiczny `klaudiamoscinska-art/vector-hole` (gałąź `main`, stan udostępniony do odczytu w dniu audytu).  
**Paczki wejściowe:** `Vertical_Hole_Claude_Code_Skills_22_v1.4_AUDYT_KRYTYCZNY(1).zip`, `Vertical_Hole_Claude_Prompty_P00_plus_15_v1.4_AUDYT_KRYTYCZNY(1).zip`.

## Metoda i ograniczenia
- Sprawdzono strukturę i wewnętrzne kontrakty obu ZIP, 22/22 skilli, 16/16 umów/dokumentów, wszystkie 16 indywidualnych promptów, ich plik zbiorczy oraz narzędzia walidacyjne. Porównano wskazówki z publicznym kodem gry, publicznym HTML, workflow Pages i scenariuszem QA dev panelu.
- Testy narzędzi paczki skilli na kopiach/fixture: **18/18 PASS**; statyczna struktura skilli **PASS**, statyczna spójność promptów **PASS**.
- **Nie wykonano** interaktywnego gameplay 120 sekund, rzeczywistego testu na fizycznym telefonie, integracji płatności/reklam, pomiaru retencji, uruchomienia całej istniejącej baterii E2E aplikacji ani porównania SHA256 pliku *aktualnie serwowanego* z rewizją `main`. Nie oznaczać tych obszarów jako PASS.
- Zmodyfikowano **jedynie dwie paczki instrukcji/narzędzi**, nie kod oryginalnej gry ani jej repozytorium, nie uruchamiano deploymentu.

## Zidentyfikowane krytyczne luki / warunki wydania

| ID | Priorytet | Obszar | Zweryfikowana obserwacja | Ryzyko i wymagane rozwiązanie |
|---|---|---|---|---|
| VH-01 | **P0 release** | Panel testowy | Publiczny `game.js` ma `class DevPanel`, mechanizm dostępu, funkcje debug, `window.game.devPanel`. Interfejs może być schowany, ale implementacja istnieje w tym samym JS co gra. | Wydzielić **oddzielny artefakt dev/test**. Release musi wykluczać debug implementację, dev globals oraz mutatory. Negatywny test release z rzeczywistego URL. Samo hasło nie wystarcza. |
| VH-02 | **P1 core** | Izolacja Arena↔Dzielnice | Oba tryby używają wspólnych monet/XP, monety z kampanii mogą nabywać arena `RUN_TOOLS`/skiny z premiami `SKINS.perks`. | Pośrednia przewaga rozgrywki w arenie wynikająca z dzielnic podważa kontrakt „pełnego rozdzielenia”. Właścicielka decyduje, czy rozdzielić zasoby/bonusy; dopóki wymaganie obowiązuje, `CORE-ISOLATION=FAIL`. Chronić istniejące zakupy i salda podczas napraw. |
| VH-03 | **P1 core** | Migracje save | `loadSave()` normalizuje/migruje i **zapisuje** wynik podczas odczytu; w nieobsługiwanym kształcie/malformed/future-schema migrator może wrócić do domyślnego save. | Potencjalna utrata lub nadpisanie postępu. Wymaga oddzielnej kopii, fail-closed przy nieznanym schemacie, bezstratnego/idempotentnego upgrade'u i testów starych/przyszłych/corrupt save. Dokładny zakres wpływu wymaga uruchomienia testów na fixture. |
| VH-04 | **P0 release** | Deployment | Workflow GitHub Pages uruchamia publikację po push na `main` **oraz** `claude/**`, z `actions/upload-pages-artifact` ustawionym na `path: "."`. | Może opublikować niezatwierdzony kod roboczy, testy i pełne repo zamiast kuratorowanego release. Zawęzić zaufane wyzwalacze i katalog publikacji, dodać ręczne zatwierdzenie i weryfikację byte/hash publicznych assetów. |
| VH-05 | **P0 dowodu QA/release** | Fałszywe poczucie testu prod | `qa/dev-panel.mjs` w sekcji `production host (simulated)` przechwytuje `https://klaudiamoscinska-art.github.io/vector-hole/` i spełnia requesty plikami **lokalnymi**; przy prawdziwym `VH_DEV_CODE` test oczekuje nawet otwarcia panelu. | Ten test nie jest testem opublikowanej strony. Wymaga osobnego E2E/negative test z żywego URL bez interception i porównania hashów. `LIVE-PRODUCTION=NOT RUN` aż do rzeczywistego dowodu. |

**Status trzech wcześniej zgłoszonych poprawek:** (1) Energia — w widocznym menu nie ma limitu wejść, ale jej brak w *każdej ścieżce runtime* to `NOT RUN`. (2) Izolacja — **niepełna według przyjętego ścisłego wymogu ekonomicznego** (VH-02). (3) Panel — **istnieje**, ale izolacja dev/release nie jest zachowana (VH-01). Nie jest uzasadnione ponowne implementowanie tych funkcji w P00: potrzebne są tylko osobne kontrolowane poprawki po audycie.

## Co było krytyczne w paczce skilli v1.4 i co poprawiono

| ID | Luka instrukcji/narzędzi | Krytyczna korekta v1.4.1 |
|---|---|---|
| S-01 | Walidator release mógł zaakceptować kod debug bez spodziewanego pojedynczego markera. | `verify_release_artifact.py` skanuje także znane **sygnatury prawdziwego panelu** w JS/HTML/sourcemap; regresyjny unit test. Nadal konieczny ręczny przegląd nowego kodu debug. |
| S-02 | Brak automatycznego weta dla ryzykownego Pages workflow. | Nowy `check_pages_workflow.py`, kopia instalowana pod `.claude/vertical-hole/tools`, testy wykrywające `claude/**` i publikację katalogu `.`. Kontrola statyczna nie zastępuje audytu GitHub settings/hosta. |
| S-03 | Kontrakt izolacji mógł zaliczyć test wejścia do areny, pomijając pośredni wpływ wspólnej waluty i kupowanych premii. | `ARENA_DISTRICT_CONTRACT`, preflight, skill ekonomii, TEST_MATRIX i QA wymagają łańcucha `misja→monety/XP→warsztat→bonus areny` i ochrony zakupów. |
| S-04 | Kontrakt save nie żądał wyraźnych negatywnych testów nieznanego schematu i zapisania danych podczas samego odczytu. | Dodano SAVE-08/09, idempotencję, fail-closed i wymóg nietykalnego źródła/odwracalności. |
| S-05 | Dokumenty zbyt łatwo mogły zaufać testowi `production host`, mimo że był to mock. | `RELEASE_DEBUG_GUARD`, `QUALITY_GATES` i QA wymagają osobnego testu realnego serwera z fingerprintem artefaktu oraz stanu `NOT RUN` przy braku dowodu. |

**Pliki modyfikowane:** `CLAUDE.md`, `README.md`, dokumenty kontraktowe w `.claude/vertical-hole/`, odpowiednie `SKILL.md`, skrypty walidacyjne oraz unit testy. Weryfikację wszystkich instalowanych skilli zapewnia `scripts/validate.py`.

## Co było krytyczne w promptach v1.4 i co poprawiono

| Prompt | Krytyczna korekta |
|---|---|
| **P00** | Wymóg audytu *read-only* kodu, realnych stanów `FAIL/NOT RUN`, izolacji ekonomii i skin-perks, migratora save, DevPanel, deploymentu i QA mocka produkcji. Bez samowolnego refaktoru ani deploymentu. |
| **P11 / P12 / P14E** | Ostrzeżenia o pośrednich kanałach ekonomii z dzielnic do areny i o migracji istniejącego inventory/pryzmatów bez utraty praw. |
| **P04-05** | Zatrzymanie zmian UX, jeśli udowodnione blokery fundamentów nie są naprawione. |
| **README / WSZYSTKIE_PROMPTY.md / check_prompts.py** | Zgodne zasady użycia, odtworzony agregat źródłowy oraz test spójności wymagań. |

Pozostałych promptów **nie zmieniano tylko dla stylistyki lub optymalizacji**, jeśli nie było krytycznej sprzeczności.

## Niekrytyczne sugestie — niezmienione

1. Zmierzyć rzeczywistą retencję pierwszych 5 minut z kwalifikacją urządzeń i zgód; boty nie są dowodem utrzymania graczy.
2. Zbadać rzeczywisty mobile UX (m32/m59, HUD, proporcje dziury, skala obiektów, dotyk/orientacja) na kilku telefonach; tego audytu nie zastąpiła analiza HTML.
3. Rozważyć podział monolitycznego JS na moduły dla niezawodności refaktorów, ale dopiero po zabezpieczeniu artefaktów i snapshotów; nie robić wielkiego refaktoru teraz.
4. Uzupełnić legal/publisher/contact, polityki i zgodność SDK portali przed **komercyjną** publikacją; na etapie analizy mechanik to osobna bramka wydawnicza.
5. Zautomatyzować porównywanie artefaktu produkcyjnego oraz regresje UI/screeny z prawdziwych urządzeń; nowa paczka zawiera warunki odbioru, nie gotowe CI gry.

## Zasady użycia wersji v1.4.1

- Zainstalować paczkę skilli **w faktycznym repo gry**, nie mylić sprawdzenia ZIP z audytem gry. Przed `--force` zrobić kopię lokalnych zmian; `CLAUDE.md` scalić ręcznie.
- Uruchomić `python scripts/validate.py --repo /sciezka/do/gry` **ze ścieżki rozpakowanej paczki**. Testy skilli: `python -m unittest discover -s scripts/tests -v` w katalogu paczki.
- W folderze promptów `python check_prompts.py`.
- W Claude Code rozpocząć od **P00.md** (bez zmiany kodu); sporządzić niezależne małe zadania napraw VH-01..VH-05 i poddać je kontroli właścicielki; nie nakazywać Claude wdrażania wszystkiego jednym dużym patchem.
- Po wdrożeniu osobnych napraw ponowić testy skilli, kodu, zmian save, QA na telefonie, weryfikację źródła publikacji i prawdziwego URL. Do tego momentu nie twierdzić `GO_RELEASE=PASS`.

**Werdykt:** w aktualnym publicznym kodzie potwierdzono istotne ryzyka bezpieczeństwa wydania i spójności trybów. Poprawione paczki v1.4.1 skuteczniej wyłapują zagrożenia i zapobiegają pochopnemu uruchamianiu kolejnych promptów, ale same **nie naprawiają gry**. Wersja live nie została certyfikowana jako gotowa do premiery.

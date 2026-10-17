# Kontrakt bezpiecznej migracji danych — v1.2 (obowiązkowy)

## Główna zasada
**Usunięcie starego systemu energii z *aktywnej gry* NIE oznacza usunięcia kompatybilnego czytnika starszych zapisów.**
Nie usuwaj/nie wyzerowuj sald, zakupionych przedmiotów, ekwipunku, nagród, osiągnięć, odblokowań, statystyk areny ani progresji dzielnic jako ubocznego skutku migracji. Zapisz osobno własność areny, dzielnic i neutralnych kosmetyków wg `ARENA_DISTRICT_CONTRACT.md`.

## Przed zmianą repo
1. Ustal rzeczywiste klucze i formaty (`localStorage`, IndexedDB, SDK cloud sync, eksport, stare wersje). Przed podaniem nazw API sprawdź kod. Opisz mapowanie wersji `legacy → current` dla wszystkich występujących schematów. NIE zakładaj wymyślonych wersji ani nazw pól.
2. Wygeneruj **syntetyczne fixture'y** reprezentujące istniejące schematy, w tym zapis z historycznymi polami energii, aktywną nagrodą, wydanym pryzmatem, częściowym inventory, ukończoną kampanią, rekordem areny. Nie dodawaj prawdziwych danych graczy do repo.
3. Przed migracją zapewnij odwracalną kopię oryginalnego serializowanego zapisu, jeżeli mechanizm na to pozwala (bez ujawniania danych). W multi-tab/cloud wybierz strategię wersjonowania/konfliktów i atomicznego commitu. Nie przenoś testowych danych do produkcji.

## Semantyka migratora
- Parser historyczny może **czytać** dawne `energy`, `energyRegen`, cooldown itp. wyłącznie jako dane wejściowe, ale nie może **przywracać** mechaniki, limitu wejść, regeneracji, timerów, zakupów ani pól energetycznych w aktywnym schemacie.
- Migracja ma być idempotentna: `migrate(migrate(old)) ≡ migrate(old)` względem wszystkich pól postępu; awaria w połowie nie może pozostawić stanu częściowego.
- Zachowaj integralność bilansów (pryzmaty, zakupy i reward claim ids); bez podwójnych przyznań i bez zniknięcia historycznych uprawnień. Przy niejasnym legacy ID nie zgaduj wartości, oznacz przypadek do decyzji/obsługi.
- Uszkodzony/nieznany zapis nie może nadpisać prawidłowego ani resetować drugiego trybu. Bezpieczny fallback + ślad błędu, nigdy cicha utrata danych.
- Pierwszy zapis nowego schematu następuje dopiero po walidacji. Gdy migracja wymaga destrukcyjnej konwersji, **STOP i zgoda właścicielki** przed operacją. Rollback kodu nie może bez planu uszkodzić już przekonwertowanych zapisów.

## Obowiązkowe testy na AKTUALNYM repo (nie na samych skillach)
| ID | Wejście / działanie | Oczekiwanie |
|---|---|---|
| SAVE-01 | stary save z energią i odblokowaniami → migrate → reload | brak limitu energii w runtime, wszystkie inne odblokowania zachowane |
| SAVE-02 | stary ekwipunek/saldo/pryzmaty/claim → migrate → reload | żadne salda i przedmioty nie giną, żaden reward nie przyznany dwukrotnie |
| SAVE-03 | migracja 2× tej samej próbki | wyniki logicznie identyczne |
| SAVE-04 | błąd/odmowa storage w połowie migracji | odtwarzalny oryginał albo kontrolowany fallback, bez częściowego zapisu |
| SAVE-05 | corrupt/missing districts + poprawna arena i odwrotnie | niezależna gra i postęp drugiego trybu |
| SAVE-06 | starszy klient/ponowny update albo konflikt chmury (jeżeli wspierane) | strategia jawnie udokumentowana, brak cichej destrukcji |
| SAVE-07 | prod/dev izolacja, dwa reloady, wiele kart jeśli dotyczy | żaden postęp testowy nie przechodzi do prod |

**Dowód:** path fixture/test, komenda, wynik, git revision, brak urządzenia/cloud jako `NOT RUN`. Samo zaznaczenie checkboxów nie jest PASS. Przejrzyj `SKILL_EVALUATION.md`.

## Zatrzymanie niebezpiecznej migracji v1.3
Nie uruchamiaj destrukcyjnej migracji w zadaniu P00 „przy okazji” porządkowania energii. Najpierw wykaż na fixture: wersje legacy z repo, idempotencję, przerwany commit, dwa taby, cloud offline→online (jeśli wspierane), rollback po nowej wersji. Legacy musi pozostać bezpiecznie czytelne lub archiwizowane przed zapisem; niepotwierdzona semantyka zakupu/nagrody to STOP i prośba o decyzję. Szczegóły `CHANGE_SAFETY.md`; potwierdzony PASS musi być na bieżącym snapshotcie `EVIDENCE_FRESHNESS.md`.

## SAVE-08/09 — krytyczny odczyt bez destrukcji (2026-10-17)
- `SAVE-08`: wejście `schemaVersion > SAVE_SCHEMA_VERSION`, poprawne uprawnienia/salda i niestandardowe pola; próba załadowania NIE może normalizować ani nadpisywać oryginału po cichu. Tryb read-only / komunikat aktualizacji / odłożenie surowych bajtów jest dopuszczalny; nowego formatu nie wolno traktować jako `defaultSave()`. Sprawdź identyczność serializowanego inputu po nieudanym ładowaniu.
- `SAVE-09`: błędne `owned`/`coins`, częściowy JSON, quota exceeded, kolizja dwóch kart — zachowaj kopię oryginału lub wyraźny bezpieczny fallback; brak jakiegokolwiek destrukcyjnego `localStorage.setItem` podczas niepewnej migracji. Aktualny wzorzec `loadSave() -> migrateSave() -> sanitizeSave() -> saveGame()` w sprawdzonym repo **wymaga testu**, nie automatycznego PASS.
- W P00 nie implementuj naprawy: dokumentuj konkretny test, ryzyko, wejściowy i wynikowy hash, minimalną propozycję odwracalnej modyfikacji. Żadnego eksperymentu na prawdziwym zapisie użytkownika.

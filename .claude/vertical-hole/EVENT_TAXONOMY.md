# Taksonomia analityki — wersja 1, bez danych wrażliwych

## Zasady
Preferuj telemetry provider/portal, jeśli istnieje; **nie wysyłaj eventów do nieznanego endpointu**. Dla własnej analityki: consent/legal basis i konfiguracja retencji zgodnie z `vh-legal-risk`. Eventy liczone jednokrotnie; `session_id` losowy i krótkotrwały, `run_id` per runda, `variant` kontrolowany, `platform` (`local|poki|crazygames|...`), `app_version`. Nigdy emaila, IP w payloadzie, fingerprintingu, dokładnej geolokalizacji, free-textu lub identyfikatorów reklam bez podstawy prawnej.

## Minimalny kontrakt eventów (przykładowe nazwy — zaadaptuj do obecnego repo)
| Event | Moment | Właściwości minimalne | Weryfikacja |
|---|---|---|---|
| `game_ready` | pierwsza interaktywna klatka | platform, version, ms_since_navigation | dokładnie raz/load |
| `first_input` | pierwszy ruch/dotyk | input_mode, elapsed_ms | raz/session |
| `r5_entry_300s` | weryfikacja obecności/aktywności po 300 s **od wejścia do strony**, nie od pierwszego inputu | elapsed_wall_ms, foreground, eligible, measurement_quality | raz/kwalifikowana sesja; nie wysyłać po exicie |
| `active_play_300s` | suma aktywnego gameplay ≥300 s, bez reklam/tła/pauzy | active_play_ms, elapsed_wall_ms | raz/kwalifikowana sesja |
| `first_swallow` | pierwszy udany pickup | tier, elapsed_ms | raz/session |
| `run_start` | pierwsza klatka aktywnej rundy | run_id, mode=`arena`, variant | raz/run |
| `tier_up` | awans T1..T6 | run_id, from, to, t_ms | każda legalna zmiana |
| `run_end` | koniec rundy | run_id, reason, score, duration_ms, max_tier | dokładnie raz/run |
| `restart_click` | intencja nowej rundy | previous_run_id, source | przed nową rundą |
| `ad_opportunity` | naturalna przerwa | placement, type, platform | nie oznacza impresji |
| `rewarded_offer_shown` | faktycznie pokazana oferta | placement, reward_id | bez oszustw |
| `rewarded_chosen` | dobrowolne kliknięcie | placement, reward_id | przed żądaniem |
| `rewarded_result` | rezultat SDK | placement, outcome=success/fail/cancel | once/attempt |
| `error_caught` | błąd, jeżeli dozwolone | sanitized_code, scene | bez logów osobowych |

## Metryki: nie pomyl pojęć
- Retencja D1: udział nowych, kwalifikujących się graczy z kohorty dnia 0, którzy wrócili następnego **dnia kalendarzowego** w ustalonej strefie; D7 analogicznie siódmego dnia. Zdefiniuj identyfikator gracza legalnie, raportuj ograniczenia cookies/SDK.
- `session_length` = koniec–start aktywnej sesji; przerwy/reklamy osobno. Jeśli brak śledzenia wyjścia, pomiar cenzurowany — nie udawaj dokładności.
- `ARPDAU` = raportowany przychód / DAU tylko gdy te źródła dotyczą tej samej populacji i okresu; nie mieszaj dashboardów.
- Wyniki małych kohort pokazuj z licznością `n`, najlepiej przedziałem niepewności. Nie ogłaszaj „wzrostu retencji” z 20 graczy.

## Definicje pięciu minut: nie zamieniaj wskaźników
- **R5-entry (cel produktowy):** `n` kwalifikujących się nowych wejść, u których istnieje legalny i wiarygodny pomiar obecności **w chwili t=300 s** względem początku wejścia na stronę, z aktywnym/faktycznie widocznym doświadczeniem. Wstawienie pauzy/ads nie zmienia osi czasu; powrót po długim ukryciu strony nie jest dowodem, że gracz był aktywny w 300. sekundzie. Dla zamkniętych/utraconych sesji podaj zasady klasyfikacji i udziały `unknown`, nie przypisuj automatycznie sukcesu.
- **A5-playtime (diagnostyczny, inny KPI):** udział sesji osiągających 300 s sumarycznego aktywnego gameplay, bez ukrycia karty, pauzy i reklam. Gracz może osiągnąć A5 później niż 300 s czasu ściennego.
- Zgoda/odmowa/niedostępna telemetria: w pierwszym pomiarze nie zakładaj populacji wszystkich wejść, jeśli eventy wymagają zgody; przedstaw bias kohorty i, jeśli dostępne zgodne z prawem, zagregowane dane portalu osobno.
- Definicję kwalifikacji, punktu `t=0`, strefy czasu, fragmentacji sesji i sposobu wykrycia exit uzgodnij **przed** eksperymentem; analizuj `n`, brakujące dane oraz daty.

## Kontrakt R5 v1.2 — mianownik, cenzura i bias (przed testem FTUE)
**Jednostka analizy:** kwalifikowane *nowe wejście*, nie „użytkownik z eventem 300 s”. Zamroź `t=0` (nawigacja/otwarcie strony dla dozwolonego źródła) oraz definicję nowej sesji, platformę, datę i strefę przed eksperymentem. Sesje z samym `r5_entry_300s` nie tworzą mianownika.

**Źródła i pola do raportu (osobno na każde źródło):**
- `N_all_eligible_entries`: liczba wszystkich kwalifikowanych wejść **tylko jeśli** dostawca/portal legalnie i wiarygodnie ją udostępnia dla tej samej kohorty; w innym wypadku `UNAVAILABLE`.
- `N_observed_at_entry`: wejścia objęte legalnym i ciągłym kanałem obserwacji od t=0; `N_success_at_300`: potwierdzone aktywne i foreground dokładnie w chwili t=300; `N_known_exit_before_300`: udokumentowane wyjścia przed t=300; `N_unknown`: brak potwierdzenia t=300 (zamknięcie strony nie zawsze emituje exit); `N_excluded`: niekwalifikowane wg reguł ustalonych przed testem.
- `N_no_consent_or_unmeasured`: podaj, o ile legalne źródło pozwala to określić (inaczej `UNAVAILABLE`), bez śledzenia odmów przez tracking wymagający zgody.

`R5_observed = N_success_at_300 / N_observed_at_entry` opisuj jawnie jako **wynik obserwowanej kohorty**, a nie retencję wszystkich wejść. Jeśli `N_all_eligible_entries` jest rzetelne, podaj udokumentowany zakres możliwego `R5_all` przy brakach: **dolny** = `N_success_at_300 / N_all_eligible_entries`, **górny** = `(N_success_at_300 + N_unresolved_all) / N_all_eligible_entries`, gdzie `N_unresolved_all` obejmuje wszystkie nieznane stany w tej populacji (nie zaliczaj potwierdzonych odejść); gdy źródeł nie da się połączyć lub nie znasz unresolved — *nie licz zakresu*, oznacz `UNAVAILABLE`. Wynik/zakres nie stanowią estymacji nieobciążonej, jeżeli brakujące obserwacje nie są losowe.

**Event `r5_entry_300s` to licznik sukcesów, nie pełny rejestr kohorty.** Wymagany legalny mechanizm mianownika (`entry`/agregat portalu), niezależny od sukcesu. Nie zbieraj eventów przed zgodą, jeśli wymagają zgody; nie wysyłaj ich wstecz po zgodzie. Testy: wyjście w 20 s, background 280–340 s, brak zgody, zgoda po tutorialu, błąd sieci, ad pause, reload/nowy tab. W każdym scenariuszu oczekiwany status obserwacji, brak dubletów, gra działająca bez trackingu. Jeśli pełny mianownik niedostępny — wolno raportować tylko obserwowaną kohortę i jakościowe playtesty; **zakaz hasła „R5 wzrosło w całej grze”**.

## Test czasu t=300 i utraty sygnału v1.3
Nie zakładaj, że `setTimeout(..., 300000)` wykona callback **w dokładnie 300. sekundzie** — ukryte karty i mobile mogą blokować timery. Prowadź monotoniczny znacznik startu i przedziały `visible/focused/paused/ad`, a w chwili rzeczywistej obserwacji oceń, czy dane **uprawniają** do potwierdzenia stanu w `t=300`. Brak wiarygodnej obserwacji tego punktu = `UNKNOWN`, nie sukces; ponowny fokus po 310 s nie „naprawia” brakującego pomiaru. Wcześniejszy jawny exit może potwierdzić porzucenie, ale brak `pagehide` nie dowodzi obecności. Inny fallback licz wyłącznie jako odrębny proxy KPI z tolerancją pomiaru i opisanym błędem, nie przemianowuj go na dokładny R5. Rejestracja jakichkolwiek eventów musi przestrzegać podstawy prawnej i wyboru zgody. Test scenariuszy: tab freeze przed 300 s, powrót po 300 s, OS kill, wyłączenie sieci, reklama na granicy t=300, zgoda późno, zmiana zegara urządzenia.

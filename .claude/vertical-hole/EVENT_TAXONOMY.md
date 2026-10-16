# Taksonomia analityki — wersja 1, bez danych wrażliwych

## Zasady
Preferuj telemetry provider/portal, jeśli istnieje; **nie wysyłaj eventów do nieznanego endpointu**. Dla własnej analityki: consent/legal basis i konfiguracja retencji zgodnie z `vh-legal-risk`. Eventy liczone jednokrotnie; `session_id` losowy i krótkotrwały, `run_id` per runda, `variant` kontrolowany, `platform` (`local|poki|crazygames|...`), `app_version`. Nigdy emaila, IP w payloadzie, fingerprintingu, dokładnej geolokalizacji, free-textu lub identyfikatorów reklam bez podstawy prawnej.

## Minimalny kontrakt eventów (przykładowe nazwy — zaadaptuj do obecnego repo)
| Event | Moment | Właściwości minimalne | Weryfikacja |
|---|---|---|---|
| `game_ready` | pierwsza interaktywna klatka | platform, version, ms_since_navigation | dokładnie raz/load |
| `first_input` | pierwszy ruch/dotyk | input_mode, elapsed_ms | raz/session |
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

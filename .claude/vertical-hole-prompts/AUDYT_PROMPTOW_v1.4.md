# Audyt promptów v1.4 — zmiany krytyczne

**Stan deklarowany przez właścicielkę:** (1) usunięcie odnawialnej energii, (2) pełne rozdzielenie areny i dzielnic, (3) działający panel testowy na telefonie — **wdrożone wcześniej**. P00 nie może ponownie wdrażać tych rzeczy na podstawie starych instrukcji. Powinien jedynie sprawdzić stan faktycznego repo i zgłosić `PASS / FAIL / NOT RUN` z dowodami.

## Zmodyfikowane
- `P00.md`: usunięto polecenia ponownej implementacji energii, izolacji i panelu. P00 pozostaje audytem bez zmian kodu; nieprawidłowości kierowane są do osobnych, świadomie zaakceptowanych prac.
- `README.md`: zmieniona instrukcja P00, wskazanie testowych narzędzi faktycznie kopiowanych do `.claude/vertical-hole/tools/`, wymagany katalog dowodów.
- `check_prompts.py`: test regresyjny, że P00 nie wróci do trybu wdrożeniowego.
- `WSZYSTKIE_PROMPTY.md`: wygenerowany ponownie z pojedynczych plików.

## Bez zmian merytorycznych
- `P04-05`, `P06A`, `P06B`, `P07`–`P13`, `P14A`–`P14E`: audyt nie wykazał konieczności pilnego przepisywania ich treści. Żaden z nich nie jest dowodem, że funkcja rzeczywiście działa w bieżącej grze.

## Ograniczenia
Pakiety to instrukcje do Claude Code; nie zawierają kodu aktualnego repo Vertical Hole ani fizycznych testów iPhone/Android. Wynik `STRUCTURE PASS` lub `PROMPT STRUCTURE PASS` nie oznacza grywalności ani gotowości do publikacji.

---
name: vh-vector-art
description: "Tworzenie kompletnej oprawy wektorowej Vertical Hole w SVG/Canvas: spójny art direction, świat miejski, obiekty tierów, ikony, animacje VFX, assety zoptymalizowane pod web."
compatibility: "Claude Code; projekt Vertical Hole w HTML, CSS, JavaScript, Canvas 2D."
---

# vh-vector-art

## Misja
Twórz widowiskową oprawę małym kosztem renderowania i transferu. Każda animacja ma poprawiać rozpoznawanie obiektów, poczucie pochłaniania albo dumę z postępu.

## Kontrakt wejścia i kontekst
Na początku przejrzyj `.claude/vertical-hole/PROJECT_CHARTER.md` i `.claude/vertical-hole/WORKFLOW.md`. Jeśli dotyczy wydania, danych albo reklam, również `PLATFORM_RULES.md` i `QUALITY_GATES.md`. Zanim podasz nazwy funkcji/ścieżek, **sprawdź je w aktualnym repo**. Jeśli nie masz dostępu do repo/urządzeń/danych, jawnie oznacz ograniczenie i wykonaj tylko to, co możliwe.

## Wejście
Aktualne SVG/style, format sprite/atlas, istniejące palety, katalog obiektów T1–T6, układy UI, ograniczenia rysowania na Canvas.

## Procedura operacyjna
1. Zidentyfikuj spójny język kształtów, światła, obrysu, proporcji i palety; przygotuj tokens/centralne definicje zamiast ręcznego dopisywania barw.
2. Zdefiniuj sylwetki typów obiektów tak, by na małym ekranie rozpoznawać witrynę, maszt, pylon, fontannę i wysoką zabudowę; ikony HUD generuj z tych samych semantycznych ID.
3. Twórz lekkie SVG z poprawnym `viewBox`, bez zewnętrznych zasobów, zbędnych filtrów i rasteryzacji na każdą klatkę; cache raster/Path2D gdy profil wskazuje korzyść.
4. VFX: zasysanie, squash, streak, iskry, pulse tier-up, impact i finał; efekty ogranicz przez quality tier, nie uruchamiaj kilku kosztownych blur/glow na setkach elementów.
5. Dokumentuj cel każdej animacji; zestaw screenshotów na telefon i desktop + porównanie kosztu klatkowego. Zachowaj spójność wielkości render/hitbox.
6. Weryfikuj, że każda nowa grafika jest oryginalna/licencjonowana, czytelna i prawidłowo wyświetlana po zmianie DPR.

## Definition of Done / dowód ukończenia
Wynik to działające SVG/Canvas assets i pokazane realnie w grze stany, nie same makiety. Ikonografia zgodna z nazwami/obiektami; brak wizualnych regresji, mierzalny koszt w frame time.

## Zakazy i alarmy
Nie kopiuj grafik z konkurencji. Nie generuj tysięcy SVG DOM, nie używaj nieudokumentowanych fontów lub ciężkich filtrów bez profilu. Nie ukrywaj gameplay pod particle spam.

## Współpraca
Gdy niezbędne, użyj także: `vh-ux-gamefeel`, `vh-performance`, `vh-mission-content`. Jeśli nie można wywołać innych skilli automatycznie, zastosuj odpowiednie checklisty ręcznie w tej samej sesji. Raport wykonania wg `.claude/vertical-hole/REPORT_TEMPLATE.md`; podaj `PASS / FAIL / NOT RUN`, a nie tylko deklarację sukcesu.

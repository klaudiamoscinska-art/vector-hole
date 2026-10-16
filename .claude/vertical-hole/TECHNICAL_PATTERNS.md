# Techniczne wzorce wdrożenia — adaptuj po rozpoznaniu repo

**Uwaga:** Poniższe fragmenty są wzorcami, a nie gotowym kodem opartym na obecnych plikach Vertical Hole. Przed użyciem dostosuj API do aktualnego SDK i przetestuj na portalu.

## 1. Niezależne stany gry

```js
// Przykładowy podział odpowiedzialności, bez narzucania nazw klas/pliku.
const application = {
  mode: 'menu', // 'arena' | 'districts' | 'menu'
  settings: { soundEnabled: true },
  cosmetics: { selectedSkin: 'default' },
  arena: null,    // transient state; new each start
  districts: null // separate persisted progress
};

function startArena(seed) {
  application.arena = createArenaRun({ seed });
  application.mode = 'arena';
  // Never check district unlocks, energy or regenerating entry tickets here.
}
```

## 2. Bezpieczne przejścia lifecycle do portalu

```js
// Pseudowzorzec; SDK i polityka zdarzeń mogą się różnić.
let playing = false;
function setPlaying(next, sdk) {
  if (next === playing) return; // no duplicate start/start or stop/stop
  playing = next;
  if (next) sdk.gameplayStart();
  else sdk.gameplayStop();
}

async function takeNaturalAdBreak(adapter, { rewarded = false } = {}) {
  pauseSimulation();
  disableGameInput();
  suspendGameAudio();
  setPlaying(false, adapter);
  try {
    // Calling an ad does not mean an impression was served.
    return rewarded ? await adapter.rewarded() : await adapter.midroll();
  } catch (e) {
    return { status: 'error' }; // graceful fail-open
  } finally {
    enableGameInput();
    // Resume audio only when allowed/unmuted and after a user gesture if required.
    restoreAudioIfAllowed();
    setPlaying(true, adapter);
    resumeSimulation();
  }
}
```

Zastrzeżenia: kod powyżej zakłada świadomą decyzję *wznowienia*, nie automatyczne wznawianie po każdym zamknięciu zakładki. W prawdziwym wdrożeniu oddziel `commercialBreak` od `rewardedBreak`, rozróżnij outcome, ad overlay, focus i user-intent, zgodnie z aktualnymi wymaganiami SDK. `PokiSDK.gameLoadingFinished()` wywołuje się tylko przy faktycznie gotowej grze.

## 3. Izolowany debug build

- Produkcja nie może zawierać *implementacji* panelu, a nie tylko przycisku do niego.
- Dev build może mieć `const DEBUG_BUILD = true` zastępowane w czasie budowania lub osobny `index.dev.html`. Przy statycznej stronie bez bundlera preferuj osobny dev entrypoint i listę assetów; zapewnij, że produkcyjny `index.html` nie ładuje debug JS.
- Oddziel klucze: `vh:dev:v2:*` od `vh:prod:v2:*`. Nie dopuszczaj do odczytu/zapisu prod danych z dev, chyba że jawna migracja i potwierdzenie.
- Udostępnienie dev buildu pod adresem sieciowym nie jest równoznaczne z autoryzacją dostępu; służy do prywatnego testu w zaufanym środowisku. Nie hostuj test panelu publicznie bez dodatkowej autoryzacji.

## 4. Balans i pełny czas efektu

```js
// Kontrakt testu: magnes „na całą misję/rundę” ma działać aż do końca.
const run = createArenaRun({ seed: 123, upgrades: ['magnet_full_run'] });
for (let t = 0; t < run.durationMs; t += 100) {
  run.update(100);
  if (run.active) assert(run.hasEffect('magnet'));
}
```

## 5. Osobne pomiary rendrowania
- FPS średni może ukrywać zacięcia: mierz frame-time p50/p95/p99, a minimum klatek na rzeczywistym telefonie.
- `window.devicePixelRatio` nie oznacza CSS px: oblicz koordynaty świata z rect canvasa i rzeczywistego rozmiaru bufora.
- Sprawdź czy warstwa efektów i HUD nie zmienia skali collision bounding boxes.

## 6. Zasady eventów
- Emituj `run_end` jednokrotnie (`idempotency key = run_id`).
- `ad_opportunity` jest stanem możliwości, nie `ad_impression`; w przychodzie preferuj raport SDK zamiast zgadywania.
- Zdarzenie w lokalnym dev buildzie taguj `environment=dev` i filtruj z raportu produkcyjnego.

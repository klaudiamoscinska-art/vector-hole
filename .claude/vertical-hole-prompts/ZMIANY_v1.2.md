# Vertical Hole Prompty v1.2 — zakres poprawek

- `P00`: oddzielne P00-CORE (energia, Arena↔Districts, pętla, migracja) i P00-TOOLS (dev panel), GO_CORE/GO_TOOLS/GO_RELEASE bez wzajemnego blokowania napraw FTUE.
- `P11`: kampanijny magnes ma test w kampanii, a nie na arenie; kontrakty BOOST-01..03, explicit `owner/activation_scope`.
- `P12`: zachowanie historycznych inventory, entitlement, sald i idempotentnych nagród (SAVE-01..07).
- `P14E`: ochrona już nabytych pryzmatów i uprawnień nawet przy wycofaniu waluty.
- `P14D`: legalny niezależny mianownik R5, unknown i selection bias, test zgoda/odmowa/exity; nie utożsamiaj R5 z A5.
- `P04-05`: testy 0–300 s, jakościowa obserwacja nowych graczy i warunki decyzji/guardrails.
- **Wszystkie 15 promptów po P00:** wspólna formuła bramek identyczna z dokumentacją skilli.
- `WSZYSTKIE_PROMPTY.md` wygenerowany ponownie z pojedynczych źródeł (P00 + 15).

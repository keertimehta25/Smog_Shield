# Testing

## Result

`npm run verify` runs the type checker, the linter, every unit and component test with a coverage gate, the contrast check and the build. On this tree:

```text
 Test Files  19 passed (19)
      Tests  291 passed (291)

Statements   : 100%
Branches     : 100%
Functions    : 100%
Lines        : 100%
```

Thresholds are set to 100 for all four measures in `vitest.config.ts`, so a drop fails the command. `npm run test:e2e` adds 4 browser tests (all passing).

## What is tested, by layer

| Layer          | Files                                                       | Tests | What they prove                                                                                                                                                                                      |
| -------------- | ----------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pure logic     | `shared/aqi`, `forecast`, `schemas`, `impact`               | 118   | AQI categories and EPA breakpoints, risk, best and worst hour, validation rules, every impact formula with hand-checked numbers, exclusive alternatives, qualitative impacts                         |
| Architecture   | `shared/layers.test.ts`                                     | 4     | `shared` imports nothing from `server` or `client`; `server` and `client` never import each other                                                                                                    |
| Data providers | `server/data/*`                                             | 19    | Open-Meteo parsing and geocoding, missing values, upstream errors, coordinate rounding, cache hit, expiry, eviction, manual AQI bypass                                                               |
| AI             | `server/ai/*`                                               | 68    | Gemini request shape (key in a header), model failover, time budget, fatal key errors, schema validation, number firewall, prompt content, plan caching, offline advisor for both audiences and chat |
| HTTP API       | `server/api.test.ts`, `app.extra.test.ts`, `config.test.ts` | 58    | Validation, 400 / 404 / 413 / 429 / 502 / 500, fallback, headers, CORS, rate limit behind a proxy, static hosting, caching headers, gzip, configuration parsing                                      |
| Interface      | `client/src/*.test.*`                                       | 24    | Both audiences, every field, validation messages, device location success and failure, chat, aborted requests, axe audits                                                                            |
| Browser        | `e2e/`                                                      | 4     | Real Chromium: both flows, keyboard-only use, security headers, axe, no console errors                                                                                                               |

## How tests stay trustworthy

- No test touches the network: air data uses recorded-style fixtures and Gemini uses a mocked `fetch`. Fixtures are built with the real engine, so tests do not drift from the code.
- Hand calculations are written into tests as plain numbers (for example a bedroom purifier at 100 µg/m³ gives 168 µg), so a wrong formula fails visibly.
- Failure paths are tested as carefully as success paths: retired model, junk JSON, invented figure, rejected key, slow upstream, non-Error rejections.
- A bug found while testing became a test: a 5% tolerance in the number firewall let invented figures pass; matching is now by rounding only and the figures 170 µg, 73% and 88% are asserted as rejected.

## Excluded from coverage, and why

Test files and `fixtures.ts` helpers, the three start-up files that only call `listen` or `render` (`server/index.ts`, `server/e2e.ts`, `client/src/main.tsx`), and two files that contain only TypeScript types (`server/ai/aiService.ts`, `shared/impact/types.ts`). Each is listed in `vitest.config.ts`.

## What is not covered

The live Open-Meteo and Gemini services are not called by any automated test, so a change on their side would show up only in a real smoke test after deployment: open `/api/health`, then submit one plan. Screen-reader behaviour is not automated (see ACCESSIBILITY.md). The Docker image has not been built in CI.

## CI

`.github/workflows/ci.yml` runs `verify` (typecheck, lint, coverage, contrast, build, `npm audit`) and then `e2e`; `codeql.yml` and `dependency-review.yml` run separately.

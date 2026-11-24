# Smog Shield

A GenAI assistant that helps **families and communities** get through severe winter smog. It checks live air quality and the next 24 hours for your place, then gives low-emission routines, indoor air hacks and sustainable alternatives, and shows the **direct impact of each choice with the working behind every number**.

Challenge: _Urban Air Quality Assistant_ (Virtual PromptWars, Challenge 6). See **[PROBLEM_ALIGNMENT.md](PROBLEM_ALIGNMENT.md)** for how each part of the brief maps to features, code and tests.

## What it does

- **Two audiences.** A household (children, older adults, asthma, commute, cooking, heating) or a community group (housing society, school, neighbourhood) with group-level actions.
- **Tailored to location.** City name, PIN code or privacy-rounded device location; live data from Open-Meteo, no key needed.
- **When to go out.** Cleanest and worst hour of the next 24, with the full hourly table.
- **Plan.** Daily routines, indoor air hacks, sustainable alternatives, each with _why it helps_.
- **Direct impact.** PM2.5 inhaled (µg/day) and CO2e (kg/month), computed by tested code. Every factor is labelled **Published figure** or **Assumption**, with its source and the formula shown.
- **Follow-up chat** for questions such as "which mask should I buy?".
- **Reliable AI.** Gemini with automatic failover across five models, then a built-in rule-based advisor, so users always get safe guidance.

## How it works

```
React client -> Express API -> Open-Meteo (live AQI + 24 h forecast, cached 10 min)
                   |
                   +-> shared/  Zod schemas, AQI + risk, impact engine (strategy registries)
                   +-> Gemini advisor (JSON -> Zod -> number firewall) --fails--> rule-based advisor
```

- **Numbers are computed, not generated.** The AI explains figures; it never produces them. A _number firewall_ rejects any quoted figure (%, kg, µg, g) that is not in the engine's facts, and the advisor is retried on the next model.
- **Model output is untrusted.** It must pass `PlanSchema`; user text is passed as data.
- **Patterns:** `AiService` and `AirQualityProvider` interfaces, a caching decorator, strategy registries for impact calculations.

## Run it locally

Requires Node.js 20+.

```bash
npm install
cp .env.example .env     # optionally set GEMINI_API_KEY and GEMINI_MODEL=gemini-3.6-flash
npm run dev              # http://localhost:5173 (API on 8787)
```

No key? Leave `GEMINI_API_KEY` empty; the rule-based advisor and live air data still work.

Efficiency measures (compression, immutable asset caching, air and AI-plan caches) are described in [EFFICIENCY.md](EFFICIENCY.md).

## Hosting

See **[DEPLOY.md](DEPLOY.md)** (Render blueprint, Cloud Run, Dockerfile). One Node service serves the API and the built site: `npm run build && npm start`.

## Scripts

| Command                              | What it does                                                  |
| ------------------------------------ | ------------------------------------------------------------- |
| `npm run dev`                        | API and client with hot reload                                |
| `npm run build` / `npm start`        | Build the client / run the server                             |
| `npm run typecheck` / `npm run lint` | Strict TypeScript / ESLint with accessibility and hooks rules |
| `npm run test:coverage`              | 287 tests with a **100% coverage gate**                       |
| `npm run test:e2e`                   | Playwright browser tests (real Chromium, axe audit, CSP)      |
| `npm run check:contrast`             | WCAG AA contrast of the palette, light and dark               |
| `npm run verify`                     | Typecheck, lint, coverage tests, contrast, build (as in CI)   |

## API

| Method | Path          | Body                                                 | Returns                                                |
| ------ | ------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| GET    | `/api/health` | none                                                 | `{ ok, advisor }`                                      |
| POST   | `/api/plan`   | household or community profile (`shared/schemas.ts`) | air, forecast, risk, impacts, totals, plan, `aiSource` |
| POST   | `/api/chat`   | `{ message, profile }`                               | `{ reply, advisor }`                                   |

Errors are JSON: `400` invalid input, `413` too large, `429` rate limited, `502` air data unavailable.

## Documentation

[Problem alignment](PROBLEM_ALIGNMENT.md) · [Security](SECURITY.md) · [Accessibility](ACCESSIBILITY.md) · [Testing](TESTING.md) · [Efficiency](EFFICIENCY.md) · [Code quality](CODE_QUALITY.md) · [Deploy](DEPLOY.md)

## Layout

```
shared/    schemas, AQI, forecast, impact engine (used by client and server)
server/    Express app, config, advisors, air-quality providers, middleware
client/    React + Vite app (components/, labels, form state, location)
e2e/       Playwright tests          scripts/  contrast checker
*.md       problem, security, a11y, testing, efficiency, quality  .github/  CI, CodeQL, Dependabot
```

## Disclaimer

General guidance, not medical advice. For breathing difficulty, chest pain or severe symptoms, contact a doctor or emergency services. Impact figures are estimates built on stated assumptions.

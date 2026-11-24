# Code quality

How the code is organised, the rules it is held to, and where each rule is enforced. All of it is checked by `npm run verify`.

## SOLID, with the files that apply each principle

| Principle             | How it is applied                                                                                                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single responsibility | One job per module: `failover.ts` (model order and time budget), `numberFirewall.ts` (invented figures), `facts.ts` (what the model is told), `prompt.ts` (wording), `cachedAirQuality.ts` (reuse), one file per impact family and per UI section |
| Open/closed           | A new household or community action is one entry in `HOUSEHOLD_STRATEGIES` or `COMMUNITY_STRATEGIES` plus a test; `computeImpacts` does not change                                                                                                |
| Liskov substitution   | `GeminiService`, `RuleBasedService` and `CachedAiService` are interchangeable behind `AiService`; `OpenMeteoProvider` and `CachedAirQualityProvider` behind `AirQualityProvider`                                                                  |
| Interface segregation | `AirQualityProvider` has one method; `AiService` has two; UI sections receive only the data they show                                                                                                                                             |
| Dependency inversion  | `createApp(deps)` receives its advisor and air provider; `loadConfig` is the single place that picks implementations and stacks the caches                                                                                                        |

## Layers

| Area      | May import           | Enforced by             |
| --------- | -------------------- | ----------------------- |
| `shared/` | `shared/` only       | `shared/layers.test.ts` |
| `server/` | `server/`, `shared/` | `shared/layers.test.ts` |
| `client/` | `client/`, `shared/` | `shared/layers.test.ts` |

Test helpers such as `client/src/fixtures.ts` may reach into `server/` to build realistic responses; they are excluded from the rule and from the production bundle.

## Limits enforced by lint

From `eslint.config.js`, zero errors allowed in CI:

| Rule                                 | Limit                                              |
| ------------------------------------ | -------------------------------------------------- |
| `@typescript-eslint/no-explicit-any` | none allowed                                       |
| `complexity`                         | 15 per function                                    |
| `max-lines`                          | 250 per file (tests exempt)                        |
| `max-depth`                          | 4                                                  |
| `eqeqeq`                             | strict equality (comparing with `null` is allowed) |
| `no-unused-vars`                     | none; `_` prefix for intentional                   |
| `react-hooks` and `jsx-a11y`         | recommended rules on all client code               |

`npm run format:check` fails on any file that is not formatted by Prettier, so style is not a review topic.

## One source of truth

- `shared/schemas.ts`: every profile, plan and response shape is a Zod schema; TypeScript types are inferred from it, and both the browser form and the server use the same schema.
- `shared/impact/factors.ts`: every impact factor with its value, unit, kind (published or assumption) and source. Formulas read from it; the interface prints from it.
- `server/config.ts`: every environment variable is parsed here, with defaults and invalid values handled, and tested.
- `client/src/labels.ts`: every user-facing label for a value such as a cooking fuel.

## Failure is designed in

Model failover with a time budget, schema validation of every model and upstream response, an offline advisor, caches that never keep failures, and aborts for stale browser requests. Each has tests for the failing case.

## Front end

State lives in `App.tsx`; components are presentational and take plain props. Native HTML elements are preferred to custom widgets. Form text is converted to a typed profile by one function (`toProfile`) using the same schema as the server.

## Known limits

Two functions are close to the complexity limit (`householdPlan` and `GeminiClient.generate`) and would be the first to split if they grew. The impact factors are assumptions, not measurements, and are labelled as such.

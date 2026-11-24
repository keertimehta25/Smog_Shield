# Problem alignment

**Brief:** a GenAI-powered assistant that helps families and communities navigate severe winter smog and urban air pollution with low-emission daily routines, indoor air quality hacks, sustainable alternatives tailored to location and lifestyle, and a clear explanation of the direct impact of choices.

## 1. Who it is for and what they decide

| Person                                             | Decision they face on a smog day                                                              | What Smog Shield answers                                                                                                         |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Parent or household                                | Is it safe to walk the children to school? Do we open windows? Do we need a purifier or mask? | Live AQI, a risk score for _their_ household, the cleanest hour to go out, routines and indoor steps                             |
| Older adult or someone with asthma                 | How careful do we need to be today?                                                           | Risk score raised for sensitive members, health alert, doctor guidance                                                           |
| Housing society, school or neighbourhood committee | What can we do together, and is it worth the effort?                                          | Group actions with group-sized impact figures (for example a clean-air room, staggered outdoor time, no idling, no open burning) |

## 2. Requirements traceability matrix

| ID  | Requirement (phrase in the brief)  | Feature                                                                                                                        | Code                                                                            | Evidence                                                       |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| R1  | GenAI-powered assistant            | Gemini writes the plan and answers follow-up questions; five-model failover; offline rule-based advisor when AI is unavailable | `server/ai/geminiService.ts`, `failover.ts`, `ruleBasedService.ts`              | `ai/gemini.test.ts`, `ai/failover.test.ts`, `ai/rules.test.ts` |
| R2  | Families                           | Household profile: adults, children, older adults, respiratory condition, purifier                                             | `shared/schemas.ts` (`HouseholdSchema`), `ProfileForm.tsx`                      | `schemas.test.ts`, `App.test.tsx`                              |
| R3  | Communities                        | Community profile: housing society, school, neighbourhood; size, driving share, clean-air room                                 | `CommunitySchema`, `shared/impact/community.ts`, `server/ai/rules/community.ts` | `impact.test.ts`, `rules.test.ts`, e2e community flow          |
| R4  | Severe winter smog                 | Live US AQI and PM2.5, six-level categories, risk score, health alert, 24-hour forecast                                        | `shared/aqi.ts`, `shared/forecast.ts`, `server/data/airQuality.ts`              | `aqi.test.ts`, `forecast.test.ts`, `airQuality.test.ts`        |
| R5  | Low-emission daily routines        | Routines with _when_ and _why it helps_; best time to go out                                                                   | `PlanSchema.routines`, `timingAdvice`, `ForecastSection.tsx`                    | `rules.test.ts`, `App.test.tsx`                                |
| R6  | Indoor air quality hacks           | Indoor hacks with cost level (free, low, medium) and why they help                                                             | `PlanSchema.indoorHacks`, `rules/household.ts`                                  | `rules.test.ts`                                                |
| R7  | Sustainable alternatives           | Metro, carpool, induction cooking, clean heating, stop open burning (household); transit shift, carpool, no idling (community) | `shared/impact/household.ts`, `community.ts`                                    | `impact.test.ts`                                               |
| R8  | Tailored to location               | City name, PIN code, or device location (rounded to about 1 km); live Open-Meteo data for that place                           | `airQuality.ts`, `client/src/location.ts`                                       | `airQuality.test.ts`, `location.test.ts`, `App.test.tsx`       |
| R9  | Tailored to lifestyle              | Commute mode and distance, cooking fuel, heating, who lives in the home                                                        | impact strategies, `server/ai/facts.ts`                                         | `impact.test.ts`                                               |
| R10 | Clear explanation of direct impact | PM2.5 µg per day and CO2e kg per month, a plain-language table, and a "Show the maths" view with formula and sourced factors   | `shared/impact/`, `ImpactSection.tsx`                                           | `impact.test.ts`, `App.test.tsx`, e2e                          |

## 3. Where the numbers come from

Numbers are computed by deterministic, unit-tested code in `shared/impact/`. The AI explains them but never produces them: a number firewall (`server/ai/numberFirewall.ts`) rejects any quoted figure with a unit (%, kg, µg, g) that is not in the engine's facts, and the request moves to the next model.

Each factor carries a kind and a source. Only the EPA AQI breakpoints are labelled **Published figure**. Breathing rates, indoor infiltration, purifier and mask effectiveness, working days and vehicle emission factors are labelled **Assumption** in the interface. Worked checks that were done by hand and are in `impact.test.ts`:

| Case                                                   | Formula                                  | Result                 |
| ------------------------------------------------------ | ---------------------------------------- | ---------------------- |
| Purifier in the bedroom at 100 µg/m³ PM2.5             | 100 × 0.5 m³/h × 8 h × 0.7 × 0.6         | 168 µg per day         |
| Move outdoor time from average 80 to cleanest 30 µg/m³ | (80 − 30) × 1.2 m³/h × 1 h               | 60 µg per day          |
| Metro instead of a 10 km car commute                   | 10 km × 2 × 22 days × (0.192 − 0.041) kg | 66.4 kg CO2e per month |

## 4. Same words, in the interface

| Brief                       | Interface text                         |
| --------------------------- | -------------------------------------- |
| Low-emission daily routines | "Your daily low-emission routine"      |
| Indoor air quality hacks    | "Indoor air quality hacks"             |
| Sustainable alternatives    | "Sustainable alternatives"             |
| Direct impact of choices    | "The direct impact of your choices"    |
| Families and communities    | "My household" and "A community group" |

## 5. What is deliberately not done

- No medical diagnosis; every result carries a doctor and emergency note.
- No invented statistics: alternatives such as metro and carpool are not added together in totals, and qualitative effects have no number.
- No user accounts or stored profiles: nothing about a household is kept.
- No claim that live data was verified against the real Open-Meteo API from the build environment; the parser is tested against recorded-style responses and the deploy check is `/api/health` plus one real plan request.

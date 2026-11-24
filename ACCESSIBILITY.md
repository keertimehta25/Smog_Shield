# Accessibility

Target: WCAG 2.1 level AA. This page says what is tested, how, and where the evidence stops.

## What is tested, and how

| Check                                                                              | Tool                                               | Where                                                 |
| ---------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------- |
| Automated rule audit of the form, of the results and of the community results      | axe-core in jsdom, before and after results appear | `client/src/App.test.tsx`                             |
| The same audit in a real browser, plus console errors (for example CSP violations) | axe-core with Playwright in Chromium               | `e2e/smog-shield.spec.ts`                             |
| Keyboard-only flow (focus a field, press Enter, get results)                       | Playwright                                         | `e2e/smog-shield.spec.ts`                             |
| Colour contrast for both themes                                                    | WCAG 2.1 luminance formula                         | `scripts/check-contrast.mjs`, run in `npm run verify` |
| Static accessibility lint of React code                                            | `eslint-plugin-jsx-a11y`                           | `npm run lint`, CI                                    |

## Success criteria and evidence

| Criterion                                           | How it is met                                                                                                                                             |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1.1 Non-text content                              | The page has no images; the risk meter and tables are text-equivalent                                                                                     |
| 1.3.1 Info and relationships                        | Landmarks (`header`, `main`, labelled `section`s), one `h1`, ordered headings, `fieldset` and `legend` for grouped inputs, table `caption` and `th scope` |
| 1.3.5 Identify input purpose                        | The city field uses `autocomplete="address-level2"`                                                                                                       |
| 1.4.1 Use of colour                                 | AQI level, risk level and factor kinds (Published figure or Assumption) are always written as text                                                        |
| 1.4.3 Contrast (minimum)                            | Measured below; all text pairs are at least 6.85:1                                                                                                        |
| 1.4.11 Non-text contrast                            | Level indicators and focus colour measured at 4.77:1 or higher                                                                                            |
| 1.4.4 and 1.4.10 Resize and reflow                  | Relative units and a single-column layout that works at phone width                                                                                       |
| 2.1.1 Keyboard                                      | Every control is a native element; the 24-hour table and the workings are native `<details>`                                                              |
| 2.4.1 Bypass blocks                                 | "Skip to main content" link                                                                                                                               |
| 2.4.3 Focus order and 2.4.7 Focus visible           | Natural DOM order; a 3:1 focus ring; focus moves to the results region after submit                                                                       |
| 2.5.5 Target size (AAA, met anyway)                 | Buttons are at least 44 px high                                                                                                                           |
| 3.2.2 On input                                      | Nothing changes context until the person presses the submit button                                                                                        |
| 3.3.1 and 3.3.3 Error identification and suggestion | Validation errors name the field in plain words and say what is wrong                                                                                     |
| 3.3.2 Labels or instructions                        | Every input has a visible `<label>`; hints are linked with `aria-describedby`                                                                             |
| 4.1.2 Name, role, value                             | Native controls; the device-location button text changes while it works                                                                                   |
| 4.1.3 Status messages                               | One `role="alert"` region for errors; polite live regions for results, location status and chat answers                                                   |

## Measured contrast

Computed by `scripts/check-contrast.mjs`, which fails the build below the minimum (4.5:1 for text, 3:1 for indicators).

| Pair                                                     | Light                  | Dark                   |
| -------------------------------------------------------- | ---------------------- | ---------------------- |
| Text on page / on card                                   | 15.49 / 16.53          | 16.46 / 14.82          |
| Muted text on page / on card                             | 6.85 / 7.30            | 10.10 / 9.09           |
| Button text on accent                                    | 7.87                   | 10.72                  |
| Error text on card / on page                             | 8.15 / 7.64            | 8.20 / 9.10            |
| AQI level indicators on card (green, amber, red, purple) | 5.02, 4.77, 6.54, 9.94 | 8.44, 7.99, 7.24, 7.89 |
| Focus ring on card / on page                             | 5.13 / 4.81            | 7.91 / 8.78            |

## Design decisions

- Native HTML first: the radio group, `<details>`, `<progress>` and tables need no custom ARIA.
- Device location is optional and never the only way in; every failure has a plain-language message and says to type a city or PIN code.
- The page follows `prefers-color-scheme` and `prefers-reduced-motion`.
- Errors do not steal focus; they are announced, so a screen-reader user keeps their place.

## Limits of this evidence

Automated tools find only part of the real problems. No test here replaces a manual pass with a screen reader (NVDA, VoiceOver or TalkBack), zoom to 400% on a phone, or testing with disabled users. The success-criteria table lists how each criterion is addressed in the design; it is not an independent audit or a conformance certificate.

# Security

## Threat model

| Asset                                    | Threat                                                                | Defence                                                                                                                                    |
| ---------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Gemini API key and quota                 | Leak through source, logs or the browser; abuse by automated requests | Key only in environment variables, sent in a header, never in a URL or to the client; per-IP rate limiting; 10 KB body limit; cached plans |
| The AI's answers                         | Prompt injection through free text; invented numbers or unsafe claims | User text passed as quoted data; prompt guardrails; JSON must pass `PlanSchema`; number firewall; rule-based fallback                      |
| Visitors' location and household details | Over-collection, storage, leakage in logs                             | Device location rounded to 2 decimals (about 1 km) in the browser and again on the server; nothing is stored; no accounts                  |
| The page                                 | Script injection, clickjacking, mixed content                         | Strict CSP, `frame-ancestors 'none'`, React escaping, no `dangerouslySetInnerHTML`                                                         |
| Availability                             | Slow or failing dependencies                                          | Timeouts on every outbound call, model failover with a time budget, offline advisor, manual AQI                                            |

## 1. The request gate

- Helmet security headers with an explicit Content-Security-Policy: `default-src 'self'`, `script-src 'self'`, `style-src 'self'`, `img-src 'self' data:`, `connect-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`.
- `Permissions-Policy`: geolocation only for the page itself; camera, microphone, payment and USB off (`server/middleware/securityHeaders.ts`).
- `Cache-Control: no-store` on every `/api` response, since answers describe one household.
- `x-powered-by` removed; CORS allow-list from `CORS_ORIGINS`.
- Per-IP rate limit (30 requests a minute by default), correct behind a hosting proxy through `TRUST_PROXY` (production defaults to one proxy).

## 2. Validation

- One Zod schema set in `shared/schemas.ts` is used by the browser form and by the server, so the two cannot disagree.
- The city field allows letters, digits and basic punctuation only; coordinates must be supplied as a pair and within range; counts, percentages and distances are bounded integers or numbers.
- Malformed JSON returns 400, oversized bodies 413, unknown API routes 404 JSON. Tests: `server/api.test.ts` (request validation, failures).

## 3. The model boundary

- The prompt states that FACTS and QUESTION are untrusted data (`server/ai/prompt.ts`).
- Output must be JSON matching `PlanSchema`; anything else is rejected and the next model is tried (`geminiService.ts`).
- The number firewall rejects quoted figures that are not in the facts (`numberFirewall.ts`). It matches rounded values only, after a test showed a 5% tolerance let invented figures through.
- A rejected API key (401 or 403) stops the chain at once instead of retrying across models.
- Errors returned to users never include model or provider text; details go to the server log only.

## 4. Outbound calls

- Open-Meteo replies are validated with Zod before use; redirects are refused; an 8-second timeout applies.
- Coordinates are rounded again before leaving the server.

## 5. Privacy

No cookies, no analytics, no database, no stored profiles. The device-location button asks the browser for low-accuracy, cached positions only, and the interface says so.

## 6. Supply chain and CI

`npm audit` runs in CI (0 vulnerabilities at the time of writing), Dependabot updates npm packages and GitHub Actions weekly, a dependency-review check runs on pull requests, CodeQL scans on every push and weekly, and workflow permissions are read-only unless a job needs more. A `.well-known/security.txt` is served by the site.

## 7. Reporting

Report vulnerabilities privately to the repository owner through GitHub's "Report a vulnerability" feature or the contact in `security.txt`. Any key that has ever been pasted into a chat, log or commit must be rotated.

## What this service deliberately does not do

- It does not authenticate users or keep per-user data, so there is no session or account takeover surface.
- It does not execute model output or render it as HTML.
- Rate limiting is in memory per process; a multi-instance deployment needs a shared store.

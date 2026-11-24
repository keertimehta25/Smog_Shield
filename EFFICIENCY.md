# Efficiency

Where time, bytes and API quota go, and what was done about each. Sizes were measured on this tree with `npm run build`; latency figures were measured locally and say what they measure.

## Bytes sent to the browser

| Asset                                            | Raw      | Over the wire (gzip) |
| ------------------------------------------------ | -------- | -------------------- |
| JavaScript (React, form validation, all screens) | 252.9 kB | 78.5 kB              |
| CSS                                              | 3.9 kB   | 1.5 kB               |
| `index.html`                                     | 0.6 kB   | 0.4 kB               |

- No UI framework beyond React, no icon or font packages, no images: the page is text, one stylesheet and one script.
- `compression` middleware serves text responses as gzip (checked in `server/app.extra.test.ts`).
- Build files in `/assets` have content hashes, so they are sent with `Cache-Control: public, max-age=31536000, immutable`; repeat visits download nothing. `index.html` is `no-cache`, so a new deploy is picked up at once.

## Network calls and quota

| Decision                                                                                               | Effect                                                                                                                           |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Air readings cached 10 minutes per place (max 200), by rounded coordinates or lower-cased name         | Many visitors in one city cost one Open-Meteo call (`server/data/cachedAirQuality.ts`)                                           |
| Identical plan requests cached 10 minutes (max 100), keyed by SHA-256 of the profile, air and forecast | A repeat request is answered without a model call; requests that arrive together share one call (`server/ai/cachedAiService.ts`) |
| Failed model calls are not cached                                                                      | The next request tries again                                                                                                     |
| Model failover with a total time budget (default 45 s) and a per-call timeout (default 20 s)           | A retired or slow model costs at most a few seconds, then the offline advisor answers                                            |
| Upstream timeouts on Open-Meteo (8 s), redirects refused                                               | No request hangs on a slow dependency                                                                                            |
| One air request returns both the current reading and 24 hours of forecast                              | One upstream call serves the whole screen                                                                                        |
| Manual AQI skips the network entirely                                                                  | Works instantly when data is unavailable                                                                                         |

## Server cost

- All impact numbers are small pure functions over a profile; there is no database and no per-request I/O beyond the two upstream calls above.
- The offline advisor needs no network at all.
- Request bodies are limited to 10 KB and rate limiting protects the model quota from abuse.
- One Node process serves the API and the website, so a free instance is enough.

## Client work

- Results render from one response; no polling and no waiting loops.
- Starting a new request aborts the previous one (`AbortController`), and leaving the page aborts the pending one, so no stale responses are processed.
- The 24-hour table and the "Show the maths" workings sit in `<details>`, so they cost nothing visible until opened.

## What was measured, and what was not

Measured on this tree: the bundle sizes above, and the gzip and cache headers (by test). Locally, with a stubbed air source and the offline advisor, `POST /api/plan` took about 22 ms for the first call and about 1 to 2 ms after warm-up; that excludes the network and the model. Live latency with Open-Meteo and Gemini depends on those services and the host, and has not been measured here, so no figure is claimed for it.

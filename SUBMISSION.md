# Submission kit: Challenge 6, Urban Air Quality Assistant

## Public GitHub Repository Link

```
https://github.com/keertimehta25/Smog_shield
```

## Project Deployed Link

```
https://smog-shield.onrender.com/
```

## Describe the changes/updates made in the deployed version

```
The deployed version runs as one production service: Express serves the built React site and the API from a single URL, so there is no CORS setup and no second backend. Added for production: reverse-proxy-aware per-visitor rate limiting, an explicit Content-Security-Policy and Permissions-Policy, no-store API caching headers, a /api/health check, a 10-minute air-quality cache, a Dockerfile and a Render blueprint. The Gemini key lives only in the host's settings. Live Open-Meteo data covers any city or PIN code, plus a privacy-rounded device location. If a Gemini model is retired or slow, the app fails over across five models, then to a rule-based advisor. CI enforces strict TypeScript, 287 unit tests at 100% coverage, Playwright browser tests with axe audits, CodeQL and dependency audits.
```

## Gen AI services utilized, and where

```
Google Gemini API (GEMINI_MODEL, default gemini-3.6-flash, with automatic failover to four backup Gemini models), called server-side in server/ai/geminiService.ts. 1) Plan generation: from a household or community profile, live Open-Meteo AQI, the 24-hour forecast and engine-computed impact figures, Gemini writes routines, best-time-to-go-out advice, indoor air hacks and sustainable alternatives, each with a 'why it helps' explanation. 2) Follow-up chat answering questions such as which mask to buy. Output is JSON validated with Zod, and a number firewall rejects any figure Gemini invents. User text is treated as untrusted data. If Gemini fails, a rule-based advisor takes over.
```

## Demo video script

## LinkedIn post

# Submission kit: Challenge 6, Urban Air Quality Assistant

The character counts shown were measured before the final edit; paste each block into the form and check the counter (limit 1024). Fill the two links in `<angle brackets>` after you deploy and record. Everything else is ready to paste.

## Public GitHub Repository Link

```
https://github.com/<your-username>/smog-shield
```

(The repository must be public. See DEPLOY.md, step 1.)

## Project Deployed Link

```
https://<your-service>.onrender.com
```

Open it once yourself right before submitting, because free hosting sleeps when idle.

## Describe the changes/updates made in the deployed version

```
The deployed version runs as one production service: Express serves the built React site and the API from a single URL, so there is no CORS setup and no second backend. Added for production: reverse-proxy-aware per-visitor rate limiting, an explicit Content-Security-Policy and Permissions-Policy, no-store API caching headers, a /api/health check, a 10-minute air-quality cache, a Dockerfile and a Render blueprint. The Gemini key lives only in the host's settings. Live Open-Meteo data covers any city or PIN code, plus a privacy-rounded device location. If a Gemini model is retired or slow, the app fails over across five models, then to a rule-based advisor. CI enforces strict TypeScript, 287 unit tests at 100% coverage, Playwright browser tests with axe audits, CodeQL and dependency audits.
```

## Gen AI services utilized, and where

```
Google Gemini API (GEMINI_MODEL, default gemini-3.6-flash, with automatic failover to four backup Gemini models), called server-side in server/ai/geminiService.ts. 1) Plan generation: from a household or community profile, live Open-Meteo AQI, the 24-hour forecast and engine-computed impact figures, Gemini writes routines, best-time-to-go-out advice, indoor air hacks and sustainable alternatives, each with a 'why it helps' explanation. 2) Follow-up chat answering questions such as which mask to buy. Output is JSON validated with Zod, and a number firewall rejects any figure Gemini invents. User text is treated as untrusted data. If Gemini fails, a rule-based advisor takes over.
```

If you deploy with a different model name, change `gemini-3.6-flash` above to match.

## Demo video script (about 2 minutes)

1. **0:00 to 0:15, the problem.** "Every winter, families in smog-hit cities don't know when it is safe to go out, what to do at home, or what their own choices change. Smog Shield answers that."
2. **0:15 to 0:45, the input.** Show the form. Enter your city, family members (include a child), commute by car and distance, LPG cooking. Say that it fetches _live_ air quality for that city.
3. **0:45 to 1:15, the result.** Press **Get my smog plan.** Point to the AQI card and household risk meter, then the daily routine, indoor hacks and sustainable alternatives, noting each says _why it helps_.
4. **1:15 to 1:35, impact.** Scroll to "The direct impact of your choices": the table and the estimated kg of CO2e saved per month. Say the numbers are computed by tested code, and Gemini only explains them.
5. **1:35 to 1:50, chat.** Ask "Which mask should I buy for my child?" and show the tailored answer.
6. **1:50 to 2:10, quality.** Briefly show the GitHub repo, the CI badge or the test run (`npm run test:coverage`, 100%), and mention accessibility checks and the rule-based fallback.
7. Close: "Smog Shield: clear steps, clear reasons, for every family."

Tip: also show `/api/health` returning `"advisor":"gemini"` to prove the live site really uses Gemini.

## LinkedIn post (draft)

Winter smog isn't just a headline. For families it's a daily question: Is it safe to walk to school? Should I open a window? What actually makes a difference?

For the Virtual PromptWars Challenge 6, I built **Smog Shield**, a GenAI assistant that turns live air quality into a plan a family can act on today.

What it does:

- Checks live air quality and the next 24 hours for your city, PIN code or device location
- Works for a household or a whole housing society, school or neighbourhood
- Tailors advice to your household (children, older adults, asthma), your commute, cooking and heating
- Suggests low-emission routines, indoor air hacks and sustainable alternatives
- Explains the direct impact of each choice, including estimated CO2e saved per month

Under the hood: React + Express + Google Gemini. The numbers are computed by tested code and Gemini explains them in plain language, so it never invents statistics. If the AI is unavailable, a built-in advisor keeps working. The project has 287 unit tests at 100% coverage, browser tests with accessibility audits and a WCAG AA contrast check.

Try it: https://<your-service>.onrender.com
Code: https://github.com/<your-username>/smog-shield

#GenAI #GoogleGemini #AirQuality #ClimateTech #PromptWars #React #TypeScript

(Add your LinkedIn post URL to the submission form. It must start with https://.)

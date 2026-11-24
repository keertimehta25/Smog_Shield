# Deploying Smog Shield

The app is one Node service: Express serves the API **and** the built website from the same address, so there is
nothing to configure for CORS and only one URL to submit.

> **Before anything else:** the Supabase and Gemini keys you pasted earlier were exposed. Create a _new_ Gemini key at
> https://aistudio.google.com/apikey and use only that one. This app does not use Supabase at all.

## 1. Put the code on GitHub

```bash
cd smog-shield
git init
git add .
git commit -m "Smog Shield: GenAI smog assistant"
git branch -M main
git remote add origin https://github.com/<your-username>/smog-shield.git
git push -u origin main
```

`.env` is git-ignored, so your key will not be uploaded. Check with `git status` that no `.env` file is listed
before you commit. The repository must be **public** for the submission form.

## 2. Host it on Render (free, about 5 minutes)

1. Sign in at https://render.com with GitHub.
2. **New > Blueprint**, choose your `smog-shield` repository. Render reads `render.yaml` automatically.
3. When asked for `GEMINI_API_KEY`, paste your new key. Everything else is pre-filled.
4. Click **Apply** and wait for the first build (a few minutes). Your site appears at an address like
   `https://smog-shield.onrender.com` (Render shows the exact one).

Free Render services go to sleep after a period of inactivity, and the first visit afterwards can take up to a
minute. **Open the site yourself shortly before you record the demo or submit**, so the evaluator does not hit
a cold start. Check Render's current free-plan terms, as they can change.

## 3. Alternative: Google Cloud Run

The `Dockerfile` works as-is. With the gcloud CLI installed and a project selected:

```bash
gcloud run deploy smog-shield --source . --region asia-south1 --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,GEMINI_MODEL=gemini-3.6-flash \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest
```

(Create the secret first with `gcloud secrets create gemini-api-key --data-file=-`, or replace `--set-secrets` with
`--set-env-vars GEMINI_API_KEY=<key>` if you prefer to keep it simple.) Cloud Run sets `PORT` itself; the app reads it.
This path was not run during development because the build sandbox had no Docker daemon, so test it once before relying on it.

## 4. Confirm the live site is working

1. Open `https://<your-site>/api/health`. You should see `{"ok":true,"advisor":"gemini"}`.
   If it says `"advisor":"rules"`, the key is missing or empty in the host's environment settings.
2. Open the site, press **Get my smog plan** and check the footer of the "Air today" card:
   it should say the advice was written by **Google Gemini** and the data came from **Open-Meteo**.
3. Ask a follow-up question and confirm you get an answer.

If Gemini rejects the model name (for example after a model is retired), the app quietly falls back to its built-in advisor.
If a model is retired the app automatically tries the next one in its chain. To change the first choice, set `GEMINI_MODEL` in the host's environment settings to a current model from https://ai.google.dev/gemini-api/docs/models.

## Environment variables

| Name                     | Required                               | Purpose                                                               |
| ------------------------ | -------------------------------------- | --------------------------------------------------------------------- |
| `GEMINI_API_KEY`         | No (strongly recommended)              | Enables Gemini. Without it the built-in advisor is used.              |
| `GEMINI_MODEL`           | No                                     | Model name, default `gemini-3.6-flash`                                |
| `GEMINI_FALLBACK_MODELS` | No                                     | Comma-separated backup models tried in order, default: built-in chain |
| `AI_TIMEOUT_MS`          | No                                     | Timeout for one model call, default 20000                             |
| `AI_TOTAL_BUDGET_MS`     | No                                     | Total time across all model attempts, default 45000                   |
| `NODE_ENV`               | Set to `production`                    | Turns on proxy trust for correct per-visitor rate limiting            |
| `PORT`                   | Set by the host                        | Port to listen on                                                     |
| `CORS_ORIGINS`           | Only if the client is hosted elsewhere | Comma-separated allowed origins                                       |
| `TRUST_PROXY`            | No                                     | Number of proxies in front of the app; overrides the default          |

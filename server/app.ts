import compression from 'compression';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { categorizeAqi, riskFor } from '../shared/aqi';
import { summarizeForecast } from '../shared/forecast';
import { computeImpacts, totalImpacts } from '../shared/impact';
import { ChatRequestSchema, ProfileSchema, type PlanResponse, type Profile } from '../shared/schemas';
import type { AdviceContext, AiService } from './ai/aiService';
import { RuleBasedService } from './ai/ruleBasedService';
import type { AirQualityProvider } from './data/airQuality';
import { createRateLimiter } from './middleware/rateLimit';
import { noStore, permissionsPolicy } from './middleware/securityHeaders';
import { validateBody } from './middleware/validate';

export interface AppDeps {
  ai: AiService;
  air: AirQualityProvider;
  corsOrigins: string[];
  /** Requests per minute per IP. */
  rateLimitMax?: number;
  /** Folder with the built web client. Served when it exists. */
  staticDir?: string;
  /**
   * Number of reverse proxies in front of the app (Render, Cloud Run and similar use 1).
   * Needed so rate limiting sees each visitor's real IP instead of the proxy's. Default: none.
   */
  trustProxy?: number | false;
}

const FALLBACK = new RuleBasedService();

const reason = (err: unknown) => (err instanceof Error ? err.message : err);

/** Reads the air for the profile's place and runs the impact engine: everything an advisor needs. */
async function buildContext(profile: Profile, deps: AppDeps): Promise<AdviceContext> {
  const air = await deps.air.get({ city: profile.city, latitude: profile.latitude, longitude: profile.longitude }, profile.aqiOverride);
  const forecast = summarizeForecast(air.forecast ?? []);
  const impacts = computeImpacts(profile, air, forecast);
  return { profile, air, forecast, impacts, totals: totalImpacts(impacts), risk: riskFor(air.usAqi, profile) };
}

export function createApp(deps: AppDeps) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', deps.trustProxy ?? false);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
    }),
  );
  app.use(compression());
  app.use(permissionsPolicy);
  app.use(cors({ origin: deps.corsOrigins }));
  app.use(express.json({ limit: '10kb' }));

  app.use('/api', noStore);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, advisor: deps.ai.name });
  });

  app.use('/api', createRateLimiter(deps.rateLimitMax));

  app.post('/api/plan', validateBody(ProfileSchema), async (req, res, next) => {
    try {
      const profile = req.body as Profile;
      let ctx: AdviceContext;
      try {
        ctx = await buildContext(profile, deps);
      } catch (err) {
        res.status(502).json({
          error: `Could not get air quality for "${profile.city}". Check the place name, or enter today's AQI manually.`,
          detail: reason(err) ?? 'Unknown error',
        });
        return;
      }

      let source = deps.ai;
      let plan;
      try {
        plan = await source.generatePlan(ctx);
      } catch (err) {
        console.warn(`[ai] ${source.name} failed, using rule-based advisor:`, reason(err));
        source = FALLBACK;
        plan = await source.generatePlan(ctx);
      }

      const response: PlanResponse = {
        audience: profile.audience,
        air: ctx.air,
        category: categorizeAqi(ctx.air.usAqi),
        risk: ctx.risk,
        forecast: ctx.forecast,
        impacts: ctx.impacts,
        totals: ctx.totals,
        plan,
        aiSource: source.name,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/chat', validateBody(ChatRequestSchema), async (req, res, next) => {
    try {
      const { message, profile } = req.body as { message: string; profile: Profile };
      let ctx: AdviceContext;
      try {
        ctx = await buildContext(profile, deps);
      } catch {
        res.status(502).json({ error: "Could not get air quality. Enter today's AQI manually and try again." });
        return;
      }
      let reply: string;
      let advisor = deps.ai.name;
      try {
        reply = await deps.ai.chat(ctx, message);
      } catch (err) {
        console.warn(`[ai] ${deps.ai.name} chat failed, using rule-based advisor:`, reason(err));
        reply = await FALLBACK.chat(ctx, message);
        advisor = FALLBACK.name;
      }
      res.json({ reply, advisor });
    } catch (err) {
      next(err);
    }
  });

  const staticDir = deps.staticDir ?? fileURLToPath(new URL('../dist/client', import.meta.url));
  if (existsSync(staticDir)) {
    // Hashed build files never change, so browsers may keep them for a year; the page itself is always re-checked.
    app.use('/assets', express.static(join(staticDir, 'assets'), { maxAge: '1y', immutable: true, index: false }));
    app.use(express.static(staticDir, { dotfiles: 'allow', setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));
    app.get(/^(?!\/api).*/, (_req, res) => res.setHeader('Cache-Control', 'no-cache').sendFile('index.html', { root: staticDir }));
  }

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = (err as { status?: number } | null)?.status;
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: 'Malformed JSON body' });
      return;
    }
    if (status === 413) {
      res.status(413).json({ error: 'Request body too large' });
      return;
    }
    console.error('[server] unhandled error:', reason(err));
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  return app;
}

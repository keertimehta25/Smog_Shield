import { GeminiClient, GeminiService } from './ai/geminiService';
import type { AiService } from './ai/aiService';
import { RuleBasedService } from './ai/ruleBasedService';
import type { AppDeps } from './app';
import { OpenMeteoProvider } from './data/airQuality';
import { CachedAiService } from './ai/cachedAiService';
import { CachedAirQualityProvider } from './data/cachedAirQuality';

export const DEFAULT_PORT = 8787;
/** Tried in order. A retired or overloaded model must not take the AI feature down. */
export const DEFAULT_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
/** Per model attempt. */
export const DEFAULT_TIMEOUT_MS = 20_000;
/** Across all model attempts for one request. */
export const DEFAULT_BUDGET_MS = 45_000;

export interface ServerConfig {
  port: number;
  deps: AppDeps;
}

/** Splits a comma-separated list, trimming blanks. */
const splitList = (value: string): string[] =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export const parseOrigins = (value: string | undefined): string[] => splitList(value ?? 'http://localhost:5173');

const positiveNumber = (raw: string | undefined, fallback: number): number => {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

/**
 * Models to try, in order: GEMINI_MODEL first, then GEMINI_FALLBACK_MODELS (comma-separated),
 * or the built-in list when none is set. Duplicates are dropped.
 */
export function parseModels(env: NodeJS.ProcessEnv): string[] {
  const primary = splitList(env.GEMINI_MODEL ?? '');
  const fallbacks = env.GEMINI_FALLBACK_MODELS === undefined ? DEFAULT_MODELS : splitList(env.GEMINI_FALLBACK_MODELS);
  return [...new Set([...primary, ...fallbacks].map((m) => m.replace(/^models\//, '')))];
}

/** Chooses the Gemini advisor when a key is present, otherwise the rule-based advisor. */
export function createAdvisor(env: NodeJS.ProcessEnv): AiService {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) return new RuleBasedService();
  const gemini = new GeminiService(new GeminiClient({ apiKey, timeoutMs: positiveNumber(env.AI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS) }), {
    models: parseModels(env),
    budgetMs: positiveNumber(env.AI_TOTAL_BUDGET_MS, DEFAULT_BUDGET_MS),
  });
  return new CachedAiService(gemini);
}

/**
 * How many reverse proxies to trust. An explicit TRUST_PROXY wins (a whole number, 0 = none);
 * otherwise production assumes one proxy (as on Render and Cloud Run) and development assumes none.
 */
export function parseTrustProxy(env: NodeJS.ProcessEnv): number | false {
  const raw = env.TRUST_PROXY?.trim();
  if (raw === undefined || raw === '') return env.NODE_ENV === 'production' ? 1 : false;
  return /^\d+$/.test(raw) && Number(raw) > 0 ? Number(raw) : false;
}

/** Builds everything the server needs from environment variables. */
export function loadConfig(env: NodeJS.ProcessEnv): ServerConfig {
  const port = Number(env.PORT);
  return {
    port: Number.isInteger(port) && port > 0 ? port : DEFAULT_PORT,
    deps: {
      ai: createAdvisor(env),
      air: new CachedAirQualityProvider(new OpenMeteoProvider()),
      corsOrigins: parseOrigins(env.CORS_ORIGINS),
      trustProxy: parseTrustProxy(env),
    },
  };
}

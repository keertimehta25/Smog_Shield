import { afterEach, describe, expect, it, vi } from 'vitest';
import { CachedAirQualityProvider } from './data/cachedAirQuality';
import { advice } from './fixtures';
import { createAdvisor, DEFAULT_MODELS, DEFAULT_PORT, loadConfig, parseModels, parseOrigins, parseTrustProxy } from './config';

afterEach(() => vi.unstubAllGlobals());

describe('parseOrigins', () => {
  it('defaults to the local dev origin', () => {
    expect(parseOrigins(undefined)).toEqual(['http://localhost:5173']);
  });

  it('splits, trims and drops blanks', () => {
    expect(parseOrigins(' https://a.com , ,https://b.com ')).toEqual(['https://a.com', 'https://b.com']);
  });
});

describe('parseModels', () => {
  it('uses the built-in chain when nothing is set', () => {
    expect(parseModels({})).toEqual(DEFAULT_MODELS);
    expect(DEFAULT_MODELS[0]).toBe('gemini-3.6-flash');
  });

  it('puts GEMINI_MODEL first and keeps the built-in chain behind it, without duplicates', () => {
    const models = parseModels({ GEMINI_MODEL: 'gemini-3.8-flash' });
    expect(models[0]).toBe('gemini-3.8-flash');
    expect(models.slice(1)).toEqual(DEFAULT_MODELS);
    expect(parseModels({ GEMINI_MODEL: 'gemini-2.5-flash' }).filter((m) => m === 'gemini-2.5-flash')).toHaveLength(1);
  });

  it('uses GEMINI_FALLBACK_MODELS instead of the built-in chain when given, and strips a "models/" prefix', () => {
    expect(parseModels({ GEMINI_MODEL: ' models/a ', GEMINI_FALLBACK_MODELS: 'b, models/c ,,a' })).toEqual(['a', 'b', 'c']);
  });

  it('allows an empty fallback list, meaning only the chosen model is tried', () => {
    expect(parseModels({ GEMINI_MODEL: 'only', GEMINI_FALLBACK_MODELS: '' })).toEqual(['only']);
  });
});

describe('createAdvisor', () => {
  it('uses the rule-based advisor without a key, or with a blank one', () => {
    expect(createAdvisor({}).name).toBe('rules');
    expect(createAdvisor({ GEMINI_API_KEY: '   ' }).name).toBe('rules');
  });

  it('uses Gemini when a key is set', () => {
    expect(createAdvisor({ GEMINI_API_KEY: 'k' }).name).toBe('gemini');
  });

  it('tries the configured models in order and reports why each failed', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response('{"error":{"message":"gone"}}', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    const advisor = createAdvisor({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'first', GEMINI_FALLBACK_MODELS: 'second', AI_TIMEOUT_MS: '5000' });
    await expect(advisor.chat(advice(), 'hi')).rejects.toThrow(/first: Gemini request failed with status 404: gone; second:/);
    expect(fetchMock.mock.calls.map((c) => String(c[0]).match(/models\/(\w+):/)![1])).toEqual(['first', 'second']);
  });

  it('honours the total time budget, and ignores invalid timeouts and budgets', async () => {
    const slowFailure = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      return new Response('{}', { status: 503 });
    });
    vi.stubGlobal('fetch', slowFailure);
    const limited = createAdvisor({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'a', GEMINI_FALLBACK_MODELS: 'b,c', AI_TOTAL_BUDGET_MS: '5' });
    await expect(limited.chat(advice(), 'hi')).rejects.toThrow(/time budget used up/);
    expect(slowFailure).toHaveBeenCalledTimes(1);

    for (const bad of ['soon', '-5', '0']) {
      const advisor = createAdvisor({ GEMINI_API_KEY: 'k', AI_TIMEOUT_MS: bad, AI_TOTAL_BUDGET_MS: bad });
      expect(advisor.name).toBe('gemini');
    }
  });
});

describe('parseTrustProxy', () => {
  it('trusts one proxy in production and none in development by default', () => {
    expect(parseTrustProxy({ NODE_ENV: 'production' })).toBe(1);
    expect(parseTrustProxy({ NODE_ENV: 'development' })).toBe(false);
    expect(parseTrustProxy({})).toBe(false);
    expect(parseTrustProxy({ NODE_ENV: 'production', TRUST_PROXY: '  ' })).toBe(1);
  });

  it('lets TRUST_PROXY override the default', () => {
    expect(parseTrustProxy({ TRUST_PROXY: '2' })).toBe(2);
    expect(parseTrustProxy({ NODE_ENV: 'production', TRUST_PROXY: '0' })).toBe(false);
  });

  it.each(['true', '-1', '1.5', 'abc'])('treats invalid TRUST_PROXY=%s as none', (value) => {
    expect(parseTrustProxy({ NODE_ENV: 'production', TRUST_PROXY: value })).toBe(false);
  });
});

describe('loadConfig', () => {
  it('uses the defaults for an empty environment, with air readings cached', () => {
    const cfg = loadConfig({});
    expect(cfg.port).toBe(DEFAULT_PORT);
    expect(cfg.deps.ai.name).toBe('rules');
    expect(cfg.deps.air).toBeInstanceOf(CachedAirQualityProvider);
    expect(cfg.deps.corsOrigins).toEqual(['http://localhost:5173']);
    expect(cfg.deps.trustProxy).toBe(false);
  });

  it('trusts the hosting proxy in production', () => {
    expect(loadConfig({ NODE_ENV: 'production' }).deps.trustProxy).toBe(1);
  });

  it('reads the port and origins from the environment', () => {
    const cfg = loadConfig({ PORT: '9000', CORS_ORIGINS: 'https://smog.example' });
    expect(cfg.port).toBe(9000);
    expect(cfg.deps.corsOrigins).toEqual(['https://smog.example']);
  });

  it.each(['abc', '0', '-1', '80.5'])('falls back to the default port for PORT=%s', (port) => {
    expect(loadConfig({ PORT: port }).port).toBe(DEFAULT_PORT);
  });
});

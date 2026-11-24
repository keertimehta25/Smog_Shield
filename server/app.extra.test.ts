import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { household } from '../shared/fixtures';
import type { AiService } from './ai/aiService';
import { RuleBasedService } from './ai/ruleBasedService';
import { createApp } from './app';
import type { AirQualityProvider } from './data/airQuality';

const air: AirQualityProvider = {
  get: async (location) => ({ city: location.city, usAqi: 90, source: 'open-meteo', fetchedAt: '2026-11-22T00:00:00Z' }),
};

afterEach(() => vi.restoreAllMocks());

describe('static client hosting', () => {
  it('serves the built client and falls back to index.html for client routes, but not for /api', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'smog-static-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Smog Shield</title>');
    try {
      const app = createApp({ ai: new RuleBasedService(), air, corsOrigins: [], staticDir: dir });
      expect((await request(app).get('/')).text).toContain('Smog Shield');
      expect((await request(app).get('/some/client/route')).text).toContain('Smog Shield');
      const api = await request(app).get('/api/unknown');
      expect(api.status).toBe(404);
      expect(api.body.error).toBe('Not found');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps hashed assets for a year, always re-checks the page, and compresses text', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'smog-cache-'));
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Smog Shield</title>');
    mkdirSync(join(dir, '.well-known'));
    writeFileSync(join(dir, '.well-known', 'security.txt'), 'Contact: https://example.com');
    writeFileSync(join(dir, 'assets', 'app-abc123.js'), 'console.log("x");'.repeat(500));
    try {
      const app = createApp({ ai: new RuleBasedService(), air, corsOrigins: [], staticDir: dir });
      const asset = await request(app).get('/assets/app-abc123.js').set('Accept-Encoding', 'gzip');
      expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');
      expect(asset.headers['content-encoding']).toBe('gzip');
      expect((await request(app).get('/.well-known/security.txt')).text).toContain('Contact:');
      expect((await request(app).get('/')).headers['cache-control']).toBe('no-cache');
      expect((await request(app).get('/some/route')).headers['cache-control']).toBe('no-cache');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('works with the default static folder whether or not a build exists', async () => {
    const app = createApp({ ai: new RuleBasedService(), air, corsOrigins: [] });
    expect((await request(app).get('/api/health')).status).toBe(200);
  });
});

describe('non-Error failures are handled safely', () => {
  it('returns 502 and names the failure, or "Unknown error" when there is none (plan)', async () => {
    const withText: AirQualityProvider = { get: () => Promise.reject('string failure') };
    const text = await request(createApp({ ai: new RuleBasedService(), air: withText, corsOrigins: [] }))
      .post('/api/plan')
      .send(household());
    expect(text.status).toBe(502);
    expect(text.body.detail).toBe('string failure');

    const withNothing: AirQualityProvider = { get: () => Promise.reject(undefined) };
    const nothing = await request(createApp({ ai: new RuleBasedService(), air: withNothing, corsOrigins: [] }))
      .post('/api/plan')
      .send(household());
    expect(nothing.body.detail).toBe('Unknown error');
  });

  it('falls back when the advisor throws a non-Error value', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ai: AiService = { name: 'gemini', generatePlan: () => Promise.reject('boom'), chat: () => Promise.reject('boom') };
    const app = createApp({ ai, air, corsOrigins: [] });
    const plan = await request(app).post('/api/plan').send(household());
    expect(plan.body.aiSource).toBe('rules');
    const chat = await request(app).post('/api/chat').send({ message: 'hi', profile: household() });
    expect(chat.body.advisor).toBe('rules');
  });

  it('logs a generic message and returns 500 when something unexpected throws a non-Error value', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ai = {
      get name(): 'gemini' {
        throw 'weird';
      },
      generatePlan: () => Promise.reject('boom'),
      chat: async () => '',
    } as unknown as AiService;
    const res = await request(createApp({ ai, air, corsOrigins: [] }))
      .post('/api/plan')
      .send(household());
    expect(res.status).toBe(500);
    expect(errorSpy).toHaveBeenCalledWith('[server] unhandled error:', 'weird');
  });
});

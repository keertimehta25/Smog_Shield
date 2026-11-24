import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { community, household } from '../shared/fixtures';
import type { AiService } from './ai/aiService';
import { RuleBasedService } from './ai/ruleBasedService';
import { createApp } from './app';
import type { AirQualityProvider, LocationQuery } from './data/airQuality';
import { defaultHours } from './fixtures';

const calls: Array<{ location: LocationQuery; override?: number }> = [];

const goodAir: AirQualityProvider = {
  get: async (location, override) => {
    calls.push({ location, override });
    return {
      city: location.city,
      usAqi: override ?? 185,
      pm25: override === undefined ? 90 : undefined,
      forecast: override === undefined ? defaultHours() : undefined,
      source: override === undefined ? 'open-meteo' : 'user-provided',
      fetchedAt: '2026-11-22T00:00:00Z',
    };
  },
};

const build = (over: Partial<Parameters<typeof createApp>[0]> = {}) =>
  createApp({
    ai: new RuleBasedService(),
    air: goodAir,
    corsOrigins: ['http://localhost:5173'],
    staticDir: '/nonexistent',
    rateLimitMax: 1000,
    ...over,
  });

describe('security and platform headers', () => {
  it('reports the active advisor and sets security headers', async () => {
    const res = await request(build()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, advisor: 'rules' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['permissions-policy']).toContain('geolocation=(self)');
    expect(res.headers['permissions-policy']).toContain('camera=()');
  });

  it('marks API answers as not cacheable', async () => {
    const res = await request(build()).get('/api/health');
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('POST /api/plan for a household', () => {
  it('returns air, category, risk, forecast, impacts, totals and the plan', async () => {
    const res = await request(build())
      .post('/api/plan')
      .send(household({ hasPurifier: false }));
    expect(res.status).toBe(200);
    expect(res.body.audience).toBe('household');
    expect(res.body.air.usAqi).toBe(185);
    expect(res.body.category.label).toBe('Unhealthy');
    expect(res.body.risk.score).toBeGreaterThan(0);
    expect(res.body.forecast.cleanest.time).toBe('2026-11-22T03:00');
    expect(res.body.forecast.worst.time).toBe('2026-11-22T05:00');
    expect(res.body.impacts.map((i: { id: string }) => i.id)).toContain('purifier-bedroom');
    expect(res.body.totals.pm25UgPerDay).toBeGreaterThan(0);
    expect(res.body.totals.co2eKgPerMonth).toBeGreaterThan(0);
    expect(res.body.plan.timingAdvice).toMatch(/3 am/);
    expect(res.body.aiSource).toBe('rules');
  });

  it('honours a manual AQI, estimating PM2.5 and skipping the forecast', async () => {
    const res = await request(build())
      .post('/api/plan')
      .send({ ...household({ hasPurifier: false }), aqiOverride: 320 });
    expect(res.body.air.source).toBe('user-provided');
    expect(res.body.category.label).toBe('Hazardous');
    expect(res.body.forecast).toBeNull();
    const purifier = res.body.impacts.find((i: { id: string }) => i.id === 'purifier-bedroom');
    expect(purifier.factors.some((f: { kind: string }) => f.kind === 'published')).toBe(true);
    expect(res.body.plan.timingAdvice).toMatch(/not available/);
  });

  it('passes device coordinates and the label through to the air provider', async () => {
    calls.length = 0;
    const res = await request(build())
      .post('/api/plan')
      .send({ ...household(), city: 'Your location', latitude: 28.61, longitude: 77.21 });
    expect(res.status).toBe(200);
    expect(calls[0]!.location).toEqual({ city: 'Your location', latitude: 28.61, longitude: 77.21 });
    expect(res.body.air.city).toBe('Your location');
  });
});

describe('POST /api/plan for a community', () => {
  it('returns a group plan with group-sized impacts', async () => {
    const res = await request(build())
      .post('/api/plan')
      .send(community({ members: 300, groupType: 'school', hasCleanAirRoom: false }));
    expect(res.status).toBe(200);
    expect(res.body.audience).toBe('community');
    const ids = res.body.impacts.map((i: { id: string }) => i.id);
    expect(ids).toEqual(
      expect.arrayContaining(['community-stagger-outdoor', 'community-clean-air-room', 'community-transit-shift', 'community-no-idling']),
    );
    expect(res.body.plan.summary).toMatch(/school of 300 people/);
    expect(res.body.totals.pm25UgPerDay).toBeGreaterThan(0);
  });
});

describe('request validation', () => {
  it.each([
    ['an empty body', {}],
    ['invalid city characters', { ...household(), city: 'Delhi; DROP TABLE' }],
    ['an out-of-range AQI', { ...household(), aqiOverride: 9999 }],
    ['wrong types', { ...household(), adults: 'two' }],
    ['a lone latitude', { ...household(), latitude: 28.6 }],
    ['a group that is too small', community({ members: 3 })],
    ['an unknown audience', { ...household(), audience: 'company' }],
  ])('rejects %s with 400', async (_name, body) => {
    const res = await request(build()).post('/api/plan').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(build()).post('/api/plan').set('content-type', 'application/json').send('{bad json');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Malformed JSON body');
  });

  it('rejects oversized bodies', async () => {
    const res = await request(build())
      .post('/api/plan')
      .send({ ...household(), junk: 'x'.repeat(20_000) });
    expect(res.status).toBe(413);
    expect(res.body.error).toBe('Request body too large');
  });
});

describe('failures', () => {
  it('returns 502 with a helpful message when air data is unavailable', async () => {
    const air: AirQualityProvider = { get: async () => Promise.reject(new Error('upstream down')) };
    const res = await request(build({ air })).post('/api/plan').send(household());
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/enter today's AQI/);
    expect(res.body.detail).toBe('upstream down');
  });

  it('falls back to the rule-based advisor when the AI provider fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failing: AiService = {
      name: 'gemini',
      generatePlan: async () => Promise.reject(new Error('quota')),
      chat: async () => Promise.reject(new Error('quota')),
    };
    const plan = await request(build({ ai: failing }))
      .post('/api/plan')
      .send(household());
    expect(plan.status).toBe(200);
    expect(plan.body.aiSource).toBe('rules');
    expect(warn).toHaveBeenCalledWith('[ai] gemini failed, using rule-based advisor:', 'quota');
    warn.mockRestore();
  });

  it('uses the AI provider when it succeeds', async () => {
    const rules = new RuleBasedService();
    const ai: AiService = { name: 'gemini', generatePlan: (ctx) => rules.generatePlan(ctx), chat: async () => 'ok' };
    const res = await request(build({ ai })).post('/api/plan').send(household());
    expect(res.body.aiSource).toBe('gemini');
  });

  it('returns 500 without leaking details on unexpected errors', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    // An advisor whose name getter throws, so the failure reaches the global handler.
    const broken = {
      get name(): 'gemini' {
        throw new Error('secret internal detail');
      },
      generatePlan: async () => Promise.reject(new Error('model down')),
      chat: async () => '',
    } as unknown as AiService;
    const res = await request(build({ ai: broken }))
      .post('/api/plan')
      .send(household());
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Something went wrong. Please try again.');
    expect(JSON.stringify(res.body)).not.toContain('secret internal detail');
    vi.restoreAllMocks();
    error.mockRestore();
  });
});

describe('POST /api/chat', () => {
  const body = (message: string, profile: unknown = household()) => ({ message, profile });

  it('answers a question about masks and about timing', async () => {
    const mask = await request(build()).post('/api/chat').send(body('Which mask should I buy?'));
    expect(mask.status).toBe(200);
    expect(mask.body.reply).toMatch(/N95/);
    expect(mask.body.advisor).toBe('rules');
    const timing = await request(build()).post('/api/chat').send(body('When is the best time to go out?'));
    expect(timing.body.reply).toMatch(/3 am/);
  });

  it('answers community questions', async () => {
    const res = await request(build()).post('/api/chat').send(body('Do we need a purifier?', community()));
    expect(res.body.reply).toMatch(/clean-air room/);
  });

  it('falls back when the AI provider fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failing: AiService = {
      name: 'gemini',
      generatePlan: async () => Promise.reject(new Error('x')),
      chat: async () => Promise.reject(new Error('x')),
    };
    const res = await request(build({ ai: failing }))
      .post('/api/chat')
      .send(body('purifier?'));
    expect(res.status).toBe(200);
    expect(res.body.advisor).toBe('rules');
    warn.mockRestore();
  });

  it('validates the message and the profile', async () => {
    expect((await request(build()).post('/api/chat').send(body(''))).status).toBe(400);
    expect(
      (
        await request(build())
          .post('/api/chat')
          .send(body('x'.repeat(501)))
      ).status,
    ).toBe(400);
    expect(
      (
        await request(build())
          .post('/api/chat')
          .send(body('hi', { audience: 'household' }))
      ).status,
    ).toBe(400);
  });

  it('returns 502 when air data is unavailable', async () => {
    const air: AirQualityProvider = { get: async () => Promise.reject(new Error('down')) };
    const res = await request(build({ air })).post('/api/chat').send(body('hi'));
    expect(res.status).toBe(502);
  });

  it('returns 500 for an unexpected failure after the fallback answers', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const ai = {
      get name(): 'gemini' {
        throw new Error('hidden');
      },
      generatePlan: async () => Promise.reject(new Error('x')),
      chat: () => Promise.reject(new Error('x')),
    } as unknown as AiService;
    const res = await request(build({ ai })).post('/api/chat').send(body('hi'));
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('hidden');
    vi.restoreAllMocks();
  });
});

describe('platform behaviour', () => {
  it('returns 404 JSON for unknown API routes', async () => {
    const res = await request(build()).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });

  it('rate limits excessive requests', async () => {
    const app = build({ rateLimitMax: 2 });
    const send = () => request(app).post('/api/chat').send({ message: 'a', profile: household() });
    await send();
    await send();
    expect((await send()).status).toBe(429);
  });

  it('limits each visitor separately when a proxy is trusted', async () => {
    const app = build({ rateLimitMax: 1, trustProxy: 1 });
    const hit = (ip: string) => request(app).post('/api/chat').set('X-Forwarded-For', ip).send({ message: 'hi', profile: household() });
    expect((await hit('203.0.113.1')).status).toBe(200);
    expect((await hit('203.0.113.1')).status).toBe(429);
    expect((await hit('203.0.113.2')).status).toBe(200);
  });

  it('only allows configured CORS origins', async () => {
    const ok = await request(build()).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const other = await request(build()).get('/api/health').set('Origin', 'https://evil.example');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { air } from '../../shared/fixtures';
import type { AirQualityProvider } from './airQuality';
import { cacheKey, CachedAirQualityProvider } from './cachedAirQuality';

const inner = () => {
  const get = vi.fn<AirQualityProvider['get']>(async (location, override) => air({ city: location.city, usAqi: override ?? 100 }));
  return { get } satisfies AirQualityProvider;
};

describe('cacheKey', () => {
  it('keys by lower-cased trimmed name, or by coordinates rounded to two decimals', () => {
    expect(cacheKey({ city: ' Delhi ' })).toBe('name:delhi');
    expect(cacheKey({ city: 'x', latitude: 28.613, longitude: 77.209 })).toBe('geo:28.61,77.21');
    expect(cacheKey({ city: 'x', latitude: 28.6 })).toBe('name:x');
  });
});

describe('CachedAirQualityProvider', () => {
  it('reuses a reading for the same place within the time limit', async () => {
    const source = inner();
    let time = 0;
    const cached = new CachedAirQualityProvider(source, { ttlMs: 1000, now: () => time });
    await cached.get({ city: 'Delhi' });
    time = 999;
    await cached.get({ city: 'DELHI ' });
    expect(source.get).toHaveBeenCalledTimes(1);
  });

  it('asks again once the reading is too old', async () => {
    const source = inner();
    let time = 0;
    const cached = new CachedAirQualityProvider(source, { ttlMs: 1000, now: () => time });
    await cached.get({ city: 'Delhi' });
    time = 1000;
    await cached.get({ city: 'Delhi' });
    expect(source.get).toHaveBeenCalledTimes(2);
  });

  it('keeps places separate, and treats nearby coordinates as one place', async () => {
    const source = inner();
    const cached = new CachedAirQualityProvider(source);
    await cached.get({ city: 'Delhi' });
    await cached.get({ city: 'Pune' });
    await cached.get({ city: 'Here', latitude: 28.611, longitude: 77.201 });
    await cached.get({ city: 'Here', latitude: 28.612, longitude: 77.204 });
    expect(source.get).toHaveBeenCalledTimes(3);
  });

  it('never caches a manual AQI, and passes it straight through', async () => {
    const source = inner();
    const cached = new CachedAirQualityProvider(source);
    expect((await cached.get({ city: 'Delhi' }, 300)).usAqi).toBe(300);
    expect((await cached.get({ city: 'Delhi' })).usAqi).toBe(100);
    expect(source.get).toHaveBeenCalledTimes(2);
  });

  it('forgets the oldest place when it is full', async () => {
    const source = inner();
    const cached = new CachedAirQualityProvider(source, { maxEntries: 2 });
    for (const city of ['A', 'B', 'C']) await cached.get({ city });
    await cached.get({ city: 'B' });
    await cached.get({ city: 'C' });
    expect(source.get).toHaveBeenCalledTimes(3);
    await cached.get({ city: 'A' });
    expect(source.get).toHaveBeenCalledTimes(4);
  });

  it('does not cache failures', async () => {
    const source = { get: vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue(air()) };
    const cached = new CachedAirQualityProvider(source);
    await expect(cached.get({ city: 'Delhi' })).rejects.toThrow('down');
    await expect(cached.get({ city: 'Delhi' })).resolves.toBeDefined();
    expect(source.get).toHaveBeenCalledTimes(2);
  });
});

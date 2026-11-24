import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, openMeteoAir, openMeteoGeocode } from '../fixtures';
import { OpenMeteoProvider } from './airQuality';

const provider = (fetchImpl: ReturnType<typeof vi.fn>) => new OpenMeteoProvider(fetchImpl as unknown as typeof fetch);

describe('OpenMeteoProvider', () => {
  it('skips the network when an AQI override is supplied', async () => {
    const fetchImpl = vi.fn();
    const air = await provider(fetchImpl).get({ city: 'Pune' }, 142.6);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(air).toMatchObject({ city: 'Pune', usAqi: 143, source: 'user-provided' });
    expect(air.forecast).toBeUndefined();
  });

  it('geocodes the place, then reads the current air and the next 24 hours', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(openMeteoGeocode)).mockResolvedValueOnce(jsonResponse(openMeteoAir()));
    const air = await provider(fetchImpl).get({ city: 'delhi' });
    expect(air).toMatchObject({ city: 'Delhi', country: 'India', usAqi: 212, pm25: 120.3, pm10: 200.1, source: 'open-meteo' });
    expect(air.forecast).toHaveLength(24);
    expect(air.forecast![0]).toEqual({ time: '2026-11-22T10:00', usAqi: 110, pm25: 60 });
    expect(air.forecast![23]!.time).toBe('2026-11-23T09:00');

    const [geoUrl] = fetchImpl.mock.calls[0]!;
    const [airUrl, init] = fetchImpl.mock.calls[1]!;
    expect(String(geoUrl)).toContain('name=delhi');
    expect(String(airUrl)).toContain('latitude=28.6');
    expect(String(airUrl)).toContain('hourly=us_aqi,pm2_5');
    expect(String(airUrl)).toContain('timezone=auto');
    expect((init as RequestInit).redirect).toBe('error');
    expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  it('looks up a PIN code the same way as a name', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(openMeteoGeocode)).mockResolvedValueOnce(jsonResponse(openMeteoAir()));
    await provider(fetchImpl).get({ city: '110001' });
    expect(String(fetchImpl.mock.calls[0]![0])).toContain('name=110001');
  });

  it('uses device coordinates without geocoding, rounded to about 1 km, and keeps the label', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(openMeteoAir()));
    const air = await provider(fetchImpl).get({ city: 'Your location', latitude: 28.613939, longitude: 77.209021 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const url = String(fetchImpl.mock.calls[0]![0]);
    expect(url).toContain('latitude=28.61&longitude=77.21');
    expect(url).not.toContain('28.613939');
    expect(air.city).toBe('Your location');
    expect(air.country).toBeUndefined();
  });

  it('fails clearly for unknown places', async () => {
    await expect(provider(vi.fn().mockResolvedValue(jsonResponse({}))).get({ city: 'Nowhereville' })).rejects.toThrow(
      /Could not find a place called "Nowhereville"/,
    );
  });

  it('fails when either upstream service errors', async () => {
    await expect(provider(vi.fn().mockResolvedValue(jsonResponse({}, 500))).get({ city: 'X' })).rejects.toThrow(
      /Geocoding failed with status 500/,
    );
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(openMeteoGeocode)).mockResolvedValueOnce(jsonResponse({}, 503));
    await expect(provider(fetchImpl).get({ city: 'X' })).rejects.toThrow(/Air quality lookup failed with status 503/);
  });

  it.each([
    ['no current block', {}],
    ['an empty current block', { current: {} }],
    ['a null AQI', { current: { us_aqi: null } }],
  ])('fails when the reading has %s', async (_name, body) => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(openMeteoGeocode)).mockResolvedValueOnce(jsonResponse(body));
    await expect(provider(fetchImpl).get({ city: 'X' })).rejects.toThrow(/No air quality reading/);
  });

  it('rejects a response that does not match the expected shape', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(openMeteoGeocode))
      .mockResolvedValueOnce(jsonResponse({ current: { us_aqi: 'high' } }));
    await expect(provider(fetchImpl).get({ city: 'X' })).rejects.toThrow();
    await expect(provider(vi.fn().mockResolvedValue(jsonResponse({ results: [{ name: 5 }] }))).get({ city: 'X' })).rejects.toThrow();
  });

  it('copes with missing optional values: no PM readings, no clock, no hourly data', async () => {
    const noTime = jsonResponse({ current: { us_aqi: 50, pm2_5: null, pm10: null }, hourly: openMeteoAir().hourly });
    const noHourly = jsonResponse({ current: { time: '2026-11-22T10:00', us_aqi: 50 } });
    for (const response of [noTime, noHourly]) {
      const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(openMeteoGeocode)).mockResolvedValueOnce(response);
      const air = await provider(fetchImpl).get({ city: 'X' });
      expect(air.usAqi).toBe(50);
      expect(air.pm25).toBeUndefined();
      expect(air.pm10).toBeUndefined();
      expect(air.forecast).toEqual([]);
    }
  });

  it('uses the global fetch and a default timeout when none are given', async () => {
    const globalFetch = vi.fn().mockResolvedValueOnce(jsonResponse(openMeteoGeocode)).mockResolvedValueOnce(jsonResponse(openMeteoAir()));
    vi.stubGlobal('fetch', globalFetch);
    try {
      expect((await new OpenMeteoProvider().get({ city: 'Delhi' })).usAqi).toBe(212);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

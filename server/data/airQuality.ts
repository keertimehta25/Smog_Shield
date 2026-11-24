import { z } from 'zod';
import { nextHours } from '../../shared/forecast';
import type { AirQuality } from '../../shared/schemas';

/** Where to read the air. Coordinates win over the name; the name is also the label shown to the user. */
export interface LocationQuery {
  city: string;
  latitude?: number;
  longitude?: number;
}

/** Source of air quality readings. Swappable so tests never touch the network. */
export interface AirQualityProvider {
  get(location: LocationQuery, aqiOverride?: number): Promise<AirQuality>;
}

const GeocodeResponse = z.object({
  results: z.array(z.object({ name: z.string(), country: z.string().optional(), latitude: z.number(), longitude: z.number() })).optional(),
});

const AirResponse = z.object({
  current: z
    .object({
      time: z.string().optional(),
      us_aqi: z.number().nullable().optional(),
      pm2_5: z.number().nullable().optional(),
      pm10: z.number().nullable().optional(),
    })
    .optional(),
  hourly: z
    .object({
      time: z.array(z.string()).default([]),
      us_aqi: z.array(z.number().nullable()).default([]),
      pm2_5: z.array(z.number().nullable()).default([]),
    })
    .prefault({}),
});

/** Device coordinates are rounded to about 1 km before they leave the server, so exact positions are never sent on. */
const roundCoordinate = (value: number): number => Math.round(value * 100) / 100;

/** Live data from Open-Meteo (free, no API key). A manual AQI skips the network entirely. */
export class OpenMeteoProvider implements AirQualityProvider {
  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 8000,
  ) {}

  private async getJson(url: string, what: string): Promise<unknown> {
    const res = await this.fetchImpl(url, { signal: AbortSignal.timeout(this.timeoutMs), redirect: 'error' });
    if (!res.ok) throw new Error(`${what} failed with status ${res.status}`);
    return res.json();
  }

  private async locate(location: LocationQuery): Promise<{ name: string; country?: string; latitude: number; longitude: number }> {
    if (location.latitude !== undefined && location.longitude !== undefined) {
      return { name: location.city, latitude: roundCoordinate(location.latitude), longitude: roundCoordinate(location.longitude) };
    }
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location.city)}&count=1&language=en&format=json`;
    const place = GeocodeResponse.parse(await this.getJson(url, 'Geocoding')).results?.[0];
    if (!place) throw new Error(`Could not find a place called "${location.city}"`);
    return place;
  }

  async get(location: LocationQuery, aqiOverride?: number): Promise<AirQuality> {
    if (aqiOverride !== undefined) {
      return { city: location.city, usAqi: Math.round(aqiOverride), source: 'user-provided', fetchedAt: new Date().toISOString() };
    }

    const place = await this.locate(location);
    const url =
      'https://air-quality-api.open-meteo.com/v1/air-quality' +
      `?latitude=${place.latitude}&longitude=${place.longitude}&current=us_aqi,pm2_5,pm10&hourly=us_aqi,pm2_5&forecast_days=2&timezone=auto`;
    const data = AirResponse.parse(await this.getJson(url, 'Air quality lookup'));
    const current = data.current;
    if (current?.us_aqi == null) throw new Error('No air quality reading available for this location');

    const { hourly } = data;
    return {
      city: place.name,
      country: place.country,
      usAqi: Math.round(current.us_aqi),
      pm25: current.pm2_5 ?? undefined,
      pm10: current.pm10 ?? undefined,
      forecast: current.time ? nextHours(hourly.time, hourly.us_aqi, hourly.pm2_5, current.time) : [],
      source: 'open-meteo',
      fetchedAt: new Date().toISOString(),
    };
  }
}

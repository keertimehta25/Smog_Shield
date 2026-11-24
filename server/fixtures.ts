import { riskFor } from '../shared/aqi';
import { air, hours, household } from '../shared/fixtures';
import { summarizeForecast } from '../shared/forecast';
import { computeImpacts, totalImpacts } from '../shared/impact';
import type { AirQuality, HourPoint, Profile } from '../shared/schemas';
import type { AdviceContext } from './ai/aiService';

/** Next hours used by default: average PM2.5 80, cleanest hour 3 am (PM2.5 30), worst 5 am. */
export const defaultHours = (): HourPoint[] =>
  hours(
    [
      [160, 130],
      [90, 30],
      [150, 80],
      [170, 80],
    ],
    2,
  );

/** Builds the full context an advisor receives. Pass `hours: null` for a reading with no forecast. */
export function advice(
  profile: Profile = household(),
  over: { air?: Partial<AirQuality>; hours?: HourPoint[] | null } = {},
): AdviceContext {
  const reading = air({ forecast: over.hours === null ? undefined : (over.hours ?? defaultHours()), ...over.air });
  const forecast = summarizeForecast(reading.forecast ?? []);
  const impacts = computeImpacts(profile, reading, forecast);
  return { profile, air: reading, forecast, impacts, totals: totalImpacts(impacts), risk: riskFor(reading.usAqi, profile) };
}

/** A recorded-style Open-Meteo air-quality response: 48 hourly readings from midnight on 22 Nov 2026. */
export function openMeteoAir(over: Record<string, unknown> = {}) {
  const time = Array.from({ length: 48 }, (_, i) => `2026-11-${i < 24 ? '22' : '23'}T${String(i % 24).padStart(2, '0')}:00`);
  return {
    current: { time: '2026-11-22T10:00', us_aqi: 212.4, pm2_5: 120.3, pm10: 200.1 },
    hourly: { time, us_aqi: time.map((_, i) => 100 + i), pm2_5: time.map((_, i) => 50 + i) },
    ...over,
  };
}

export const openMeteoGeocode = { results: [{ name: 'Delhi', country: 'India', latitude: 28.6, longitude: 77.2 }] };

export const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

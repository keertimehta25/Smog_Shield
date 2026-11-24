import { aqiToPm25 } from '../aqi';
import type { ForecastSummary } from '../forecast';
import type { AirQuality, Profile } from '../schemas';
import { COMMUNITY_STRATEGIES } from './community';
import { HOUSEHOLD_STRATEGIES } from './household';
import type { Context, Impact, Strategy, Totals } from './types';

export { commuteCo2KgPerMonth, savingsByShifting } from './dose';
export { EMISSION, FACTORS } from './factors';
export type { Factor, Impact, Totals } from './types';

const round1 = (n: number) => Math.round(n * 10) / 10;

function run<C extends Context>(strategies: ReadonlyArray<Strategy<C>>, ctx: C): Impact[] {
  return strategies.filter((s) => s.applies(ctx)).map((s) => s.build(ctx));
}

/**
 * Deterministic, explainable impact estimates for one household or community group.
 * The AI explains these numbers but never creates them, so every claim can be traced and tested.
 */
export function computeImpacts(profile: Profile, air: AirQuality, forecast: ForecastSummary | null): Impact[] {
  const base = {
    pm25: air.pm25 ?? aqiToPm25(air.usAqi),
    pm25Source: air.pm25 === undefined ? ('converted' as const) : ('measured' as const),
    forecast,
  };
  return profile.audience === 'household'
    ? run(HOUSEHOLD_STRATEGIES, { ...base, profile })
    : run(COMMUNITY_STRATEGIES, { ...base, profile });
}

/**
 * Adds up the impacts that can be added. Impacts that share an exclusive group are
 * alternatives (for example metro or carpool), so only the largest one counts.
 */
export function totalImpacts(impacts: Impact[]): Totals {
  let pm25 = 0;
  const co2ByGroup = new Map<string, number>();
  for (const impact of impacts) {
    if (!impact.countsInTotal || impact.value === null) continue;
    if (impact.metric === 'pm25_ug_per_day') {
      pm25 += impact.value;
    } else {
      const key = impact.exclusiveGroup ?? impact.id;
      co2ByGroup.set(key, Math.max(co2ByGroup.get(key) ?? 0, impact.value));
    }
  }
  const co2 = [...co2ByGroup.values()].reduce((sum, v) => sum + v, 0);
  return { pm25UgPerDay: round1(pm25), co2eKgPerMonth: round1(co2) };
}

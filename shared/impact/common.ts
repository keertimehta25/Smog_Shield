import { FACTORS } from './factors';
import { round1 } from './dose';
import type { Context, Factor, Impact } from './types';

/** The published conversion is listed as a factor only when PM2.5 had to be estimated from the AQI. */
export const pm25Factors = (ctx: Context): Factor[] => (ctx.pm25Source === 'converted' ? [FACTORS.epaBreakpoints] : []);

export interface OutdoorShift {
  /** Mean PM2.5 over the next 24 hours, µg/m³. */
  average: number;
  /** PM2.5 in the cleanest hour, µg/m³. */
  cleanest: number;
  /** µg of PM2.5 one person avoids by doing the outdoor hour at the cleanest time instead of an average one. */
  perPersonUg: number;
}

/** Null when there is no forecast, or when no hour is cleaner than the average (so shifting would not help). */
export function outdoorShift(ctx: Context): OutdoorShift | null {
  const forecast = ctx.forecast;
  if (!forecast || forecast.averagePm25 === null || forecast.cleanest.pm25 === null || forecast.averagePm25 <= forecast.cleanest.pm25) {
    return null;
  }
  const perPersonUg = round1((forecast.averagePm25 - forecast.cleanest.pm25) * FACTORS.walkBreathing.value * FACTORS.outdoorHours.value);
  return { average: forecast.averagePm25, cleanest: forecast.cleanest.pm25, perPersonUg };
}

export const shiftFactors: Factor[] = [FACTORS.walkBreathing, FACTORS.outdoorHours];

/** An impact we explain in words but do not put a number on, because no defensible figure exists. */
export const qualitative = (id: string, title: string, exposureEffect: string): Impact => ({
  id,
  title,
  metric: 'qualitative',
  value: null,
  unit: '',
  formula: '',
  factors: [],
  exposureEffect,
  countsInTotal: false,
});

import type { CommuteMode } from '../schemas';
import { EMISSION, FACTORS } from './factors';

export const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Formats a number for a formula: at most one decimal, no trailing zero. */
export const fmt = (n: number): string => String(round1(n));

const safeKm = (km: number): number => (Number.isFinite(km) ? Math.max(0, km) : 0);

/** PM2.5 breathed in, in µg: concentration (µg/m³) × breathing rate (m³/h) × hours. */
export const inhaledUg = (pm25: number, m3PerHour: number, hours: number): number => pm25 * m3PerHour * hours;

/** Kilograms of CO2e per month for a round trip on every working day, before rounding. */
export function monthlyKg(mode: CommuteMode, km: number): number {
  return EMISSION[mode].value * safeKm(km) * 2 * FACTORS.workDays.value;
}

/** Monthly commute emissions in kg CO2e. */
export const commuteCo2KgPerMonth = (mode: CommuteMode, km: number): number => round1(monthlyKg(mode, km));

/** Monthly kg CO2e saved by moving the same trip from one mode to another, never negative. */
export function savingsByShifting(from: CommuteMode, to: CommuteMode, km: number): number {
  return Math.max(0, round1(monthlyKg(from, km) - monthlyKg(to, km)));
}

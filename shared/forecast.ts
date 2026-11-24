import type { HourPoint } from './schemas';

export type { HourPoint };

export interface ForecastSummary {
  /** The next 24 hours, oldest first. */
  hours: HourPoint[];
  cleanest: HourPoint;
  worst: HourPoint;
  /** Mean PM2.5 over the hours that have a reading, or null when none do. */
  averagePm25: number | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Picks the cleanest and the worst hour. Returns null when there are no hours. Ties keep the earliest hour. */
export function summarizeForecast(hours: HourPoint[]): ForecastSummary | null {
  const first = hours[0];
  if (!first) return null;
  let cleanest = first;
  let worst = first;
  for (const hour of hours) {
    if (hour.usAqi < cleanest.usAqi) cleanest = hour;
    if (hour.usAqi > worst.usAqi) worst = hour;
  }
  const readings = hours.flatMap((h) => (h.pm25 === null ? [] : [h.pm25]));
  const averagePm25 = readings.length ? round1(readings.reduce((sum, v) => sum + v, 0) / readings.length) : null;
  return { hours, cleanest, worst, averagePm25 };
}

/** "2026-11-22T15:00" becomes "3 pm". Anything unreadable is returned unchanged. */
export function hourLabel(time: string): string {
  const match = /T(\d{2}):\d{2}$/.exec(time);
  const hour = match ? Number(match[1]) : Number.NaN;
  if (!Number.isInteger(hour) || hour > 23) return time;
  return `${hour % 12 || 12} ${hour < 12 ? 'am' : 'pm'}`;
}

/**
 * Takes the 24 hours starting at the first hour at or after `now`. Both sides use the place's own
 * local clock ("YYYY-MM-DDTHH:MM"), which sorts correctly as plain text.
 */
export function nextHours(times: string[], aqi: Array<number | null>, pm25: Array<number | null>, now: string, count = 24): HourPoint[] {
  const points: HourPoint[] = [];
  times.forEach((time, i) => {
    const value = aqi[i];
    if (time >= now && value != null && points.length < count) {
      points.push({ time, usAqi: Math.round(value), pm25: pm25[i] ?? null });
    }
  });
  return points;
}

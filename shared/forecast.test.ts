import { describe, expect, it } from 'vitest';
import { hours } from './fixtures';
import { hourLabel, nextHours, summarizeForecast } from './forecast';

describe('summarizeForecast', () => {
  it('returns null when there are no hours', () => {
    expect(summarizeForecast([])).toBeNull();
  });

  it('finds the cleanest and the worst hour and the mean PM2.5', () => {
    const points = hours([
      [150, 60],
      [90, 30],
      [210, 120],
      [90, 31],
    ]);
    const summary = summarizeForecast(points)!;
    expect(summary.cleanest).toBe(points[1]);
    expect(summary.worst).toBe(points[2]);
    expect(summary.averagePm25).toBe(60.3);
    expect(summary.hours).toBe(points);
  });

  it('keeps the earliest hour on ties', () => {
    const points = hours([
      [100, 10],
      [100, 10],
    ]);
    const summary = summarizeForecast(points)!;
    expect(summary.cleanest).toBe(points[0]);
    expect(summary.worst).toBe(points[0]);
  });

  it('skips missing PM2.5 readings, and reports null when none exist', () => {
    expect(
      summarizeForecast(
        hours([
          [100, null],
          [120, 40],
        ]),
      )!.averagePm25,
    ).toBe(40);
    expect(summarizeForecast(hours([[100, null]]))!.averagePm25).toBeNull();
  });
});

describe('hourLabel', () => {
  it.each([
    ['2026-11-22T00:00', '12 am'],
    ['2026-11-22T01:00', '1 am'],
    ['2026-11-22T11:00', '11 am'],
    ['2026-11-22T12:00', '12 pm'],
    ['2026-11-22T15:00', '3 pm'],
    ['2026-11-22T23:00', '11 pm'],
  ])('formats %s as %s', (time, label) => {
    expect(hourLabel(time)).toBe(label);
  });

  it.each(['not a time', '2026-11-22T24:00', ''])('returns unreadable input %j unchanged', (value) => {
    expect(hourLabel(value)).toBe(value);
  });
});

describe('nextHours', () => {
  const times = ['2026-11-22T10:00', '2026-11-22T11:00', '2026-11-22T12:00', '2026-11-22T13:00'];

  it('starts at the first hour at or after now', () => {
    const result = nextHours(times, [10, 20, 30, 40], [1, 2, 3, 4], '2026-11-22T11:00');
    expect(result.map((p) => p.time)).toEqual(['2026-11-22T11:00', '2026-11-22T12:00', '2026-11-22T13:00']);
    expect(result[0]).toEqual({ time: '2026-11-22T11:00', usAqi: 20, pm25: 2 });
  });

  it('starts at the next hour when now falls between two hours', () => {
    expect(nextHours(times, [10, 20, 30, 40], [1, 2, 3, 4], '2026-11-22T11:30')[0]!.time).toBe('2026-11-22T12:00');
  });

  it('limits how many hours it returns', () => {
    expect(nextHours(times, [10, 20, 30, 40], [1, 2, 3, 4], '2026-11-22T10:00', 2)).toHaveLength(2);
  });

  it('skips hours with no AQI, rounds the AQI, and uses null for a missing PM2.5', () => {
    const result = nextHours(times, [10.6, null, 30, 40], [1, 2], '2026-11-22T10:00');
    expect(result.map((p) => p.usAqi)).toEqual([11, 30, 40]);
    expect(result.map((p) => p.pm25)).toEqual([1, null, null]);
  });

  it('returns nothing when every hour is in the past', () => {
    expect(nextHours(times, [10, 20, 30, 40], [1, 2, 3, 4], '2026-11-23T00:00')).toEqual([]);
  });
});

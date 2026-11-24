import { describe, expect, it } from 'vitest';
import { aqiToPm25, categorizeAqi, groupRisk, householdRisk, riskFor } from './aqi';
import { household, community } from './fixtures';

const base = { children: 0, seniors: 0, respiratoryCondition: false, hasPurifier: false };

describe('categorizeAqi', () => {
  it.each([
    [0, 'Good', 0],
    [50, 'Good', 0],
    [51, 'Moderate', 1],
    [100, 'Moderate', 1],
    [101, 'Unhealthy for Sensitive Groups', 2],
    [150, 'Unhealthy for Sensitive Groups', 2],
    [151, 'Unhealthy', 3],
    [200, 'Unhealthy', 3],
    [201, 'Very Unhealthy', 4],
    [300, 'Very Unhealthy', 4],
    [301, 'Hazardous', 5],
    [999, 'Hazardous', 5],
  ])('maps AQI %i to %s', (aqi, label, level) => {
    const c = categorizeAqi(aqi);
    expect(c.label).toBe(label);
    expect(c.level).toBe(level);
    expect(c.advice.length).toBeGreaterThan(10);
  });

  it('treats negative and non-finite values as Good', () => {
    expect(categorizeAqi(-20).label).toBe('Good');
    expect(categorizeAqi(Number.NaN).label).toBe('Good');
  });
});

describe('aqiToPm25', () => {
  it.each([
    [0, 0],
    [50, 12],
    [51, 12.1],
    [100, 35.4],
    [150, 55.4],
    [200, 150.4],
    [300, 250.4],
    [400, 350.4],
    [500, 500.4],
  ])('converts the band edge AQI %i to %f µg/m³', (aqi, pm25) => {
    expect(aqiToPm25(aqi)).toBe(pm25);
  });

  it('interpolates inside a band', () => {
    expect(aqiToPm25(75)).toBe(23.5);
  });

  it('clamps out-of-range and invalid values', () => {
    expect(aqiToPm25(900)).toBe(500.4);
    expect(aqiToPm25(-5)).toBe(0);
    expect(aqiToPm25(Number.NaN)).toBe(0);
  });

  it('never decreases as the AQI rises', () => {
    let previous = -1;
    for (let aqi = 0; aqi <= 500; aqi += 5) {
      const pm25 = aqiToPm25(aqi);
      expect(pm25).toBeGreaterThanOrEqual(previous);
      previous = pm25;
    }
  });
});

describe('householdRisk', () => {
  it('is low for clean air with no vulnerable members', () => {
    expect(householdRisk(20, base)).toEqual({ score: 5, label: 'Low' });
  });

  it('rises with each vulnerable group', () => {
    const plain = householdRisk(150, base).score;
    const withKids = householdRisk(150, { ...base, children: 1 }).score;
    const everything = householdRisk(150, { ...base, children: 1, seniors: 1, respiratoryCondition: true }).score;
    expect(withKids).toBe(plain + 10);
    expect(everything).toBe(plain + 30);
  });

  it('is reduced by owning a purifier', () => {
    expect(householdRisk(200, { ...base, hasPurifier: true }).score).toBe(householdRisk(200, base).score - 8);
  });

  it('caps at 100 and floors at 0', () => {
    const worst = householdRisk(900, { ...base, children: 1, seniors: 1, respiratoryCondition: true });
    expect(worst.score).toBe(100);
    expect(worst.label).toBe('Severe');
    expect(householdRisk(-50, { ...base, hasPurifier: true }).score).toBe(0);
  });

  it.each([
    [60, 'Low'],
    [150, 'Moderate'],
    [260, 'High'],
    [300, 'High'],
  ])('labels AQI %i as %s for a household with no vulnerable members', (aqi, label) => {
    expect(householdRisk(aqi, base).label).toBe(label);
  });

  it('labels a vulnerable household in very unhealthy air as Severe', () => {
    expect(householdRisk(260, { ...base, children: 1, seniors: 1 }).label).toBe('Severe');
  });
});

describe('groupRisk and riskFor', () => {
  it('assumes one vulnerable group and lowers risk when a clean-air room exists', () => {
    expect(groupRisk(150, false).score).toBe(householdRisk(150, { ...base, children: 1 }).score);
    expect(groupRisk(150, true).score).toBe(groupRisk(150, false).score - 8);
  });

  it('picks the right calculation for each audience', () => {
    expect(riskFor(150, household({ children: 2, hasPurifier: false }))).toEqual(householdRisk(150, { ...base, children: 2 }));
    expect(riskFor(150, community({ hasCleanAirRoom: false }))).toEqual(groupRisk(150, false));
  });
});

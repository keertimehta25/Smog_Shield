import { describe, expect, it } from 'vitest';
import { air, community, hours, household } from '../fixtures';
import { summarizeForecast } from '../forecast';
import { aqiToPm25 } from '../aqi';
import { COMMUNITY_STRATEGIES } from './community';
import { fmt, inhaledUg, monthlyKg, round1, commuteCo2KgPerMonth, savingsByShifting } from './dose';
import { EMISSION, FACTORS } from './factors';
import { HOUSEHOLD_STRATEGIES } from './household';
import { commuteCo2KgPerMonth as exportedCommute, computeImpacts, totalImpacts } from './index';
import type { CommunityContext, HouseholdContext, Impact } from './types';
import { outdoorShift, pm25Factors, qualitative } from './common';

// Next 24 hours: average PM2.5 80, cleanest hour (3 am) 30.
const forecast = summarizeForecast(
  hours(
    [
      [160, 130],
      [90, 30],
      [150, 80],
      [170, 80],
    ],
    2,
  ),
);

const hCtx = (profile = household(), over: Partial<HouseholdContext> = {}): HouseholdContext => ({
  profile,
  pm25: 100,
  pm25Source: 'measured',
  forecast,
  ...over,
});
const cCtx = (profile = community(), over: Partial<CommunityContext> = {}): CommunityContext => ({
  profile,
  pm25: 100,
  pm25Source: 'measured',
  forecast,
  ...over,
});

const byId = <C extends HouseholdContext | CommunityContext>(
  list: ReadonlyArray<{ id: string; applies(c: C): boolean; build(c: C): Impact }>,
  id: string,
) => list.find((s) => s.id === id)!;
const household$ = (id: string) => byId(HOUSEHOLD_STRATEGIES, id);
const community$ = (id: string) => byId(COMMUNITY_STRATEGIES, id);

describe('dose maths', () => {
  it('rounds and formats numbers for formulas', () => {
    expect(round1(2.25)).toBe(2.3);
    expect(fmt(12)).toBe('12');
    expect(fmt(0.6)).toBe('0.6');
    expect(fmt(84.48)).toBe('84.5');
  });

  it('computes inhaled PM2.5 as concentration × rate × hours', () => {
    expect(inhaledUg(100, 0.5, 8)).toBe(400);
  });

  it('computes monthly commute emissions for a round trip every working day', () => {
    expect(monthlyKg('car', 10)).toBeCloseTo(84.48, 5);
    expect(commuteCo2KgPerMonth('car', 10)).toBe(84.5);
    expect(exportedCommute('car', 10)).toBe(84.5);
  });

  it('is zero for walking, cycling and working from home', () => {
    for (const mode of ['walk', 'bike', 'wfh'] as const) expect(commuteCo2KgPerMonth(mode, 20)).toBe(0);
  });

  it('handles negative and invalid distances safely', () => {
    expect(commuteCo2KgPerMonth('car', -5)).toBe(0);
    expect(commuteCo2KgPerMonth('car', Number.NaN)).toBe(0);
  });

  it('reports savings when shifting to a cleaner mode, never negative', () => {
    expect(savingsByShifting('car', 'metro', 10)).toBe(66.4);
    expect(savingsByShifting('metro', 'car', 10)).toBe(0);
  });
});

describe('factor table', () => {
  it('labels every factor and gives it a source', () => {
    const all = [...Object.values(FACTORS), ...Object.values(EMISSION)];
    for (const factor of all) {
      expect(['published', 'assumption']).toContain(factor.kind);
      expect(factor.source.length).toBeGreaterThan(10);
      expect(factor.unit.length).toBeGreaterThan(0);
    }
  });

  it('marks only the EPA conversion as a published figure', () => {
    const published = [...Object.values(FACTORS), ...Object.values(EMISSION)].filter((f) => f.kind === 'published');
    expect(published.map((f) => f.id)).toEqual(['epaBreakpoints']);
  });

  it('has an emission factor for every commute mode, with public transport below cars', () => {
    expect(Object.keys(EMISSION).sort()).toEqual(['bike', 'bus', 'car', 'metro', 'motorbike', 'walk', 'wfh']);
    expect(EMISSION.metro.value).toBeLessThan(EMISSION.car.value);
  });
});

describe('common helpers', () => {
  it('lists the published EPA conversion only when PM2.5 was converted from the AQI', () => {
    expect(pm25Factors(hCtx())).toEqual([]);
    expect(pm25Factors(hCtx(household(), { pm25Source: 'converted' }))).toEqual([FACTORS.epaBreakpoints]);
  });

  it('works out the saving from moving outdoor time to the cleanest hour', () => {
    expect(outdoorShift(hCtx())).toEqual({ average: 80, cleanest: 30, perPersonUg: 60 });
  });

  it.each([
    ['there is no forecast', { forecast: null }],
    ['no PM2.5 is available to average', { forecast: summarizeForecast(hours([[100, null]])) }],
    [
      'the cleanest hour has no PM2.5',
      {
        forecast: summarizeForecast(
          hours([
            [50, null],
            [90, 40],
          ]),
        ),
      },
    ],
    [
      'no hour is cleaner than the average',
      {
        forecast: summarizeForecast(
          hours([
            [100, 50],
            [100, 50],
          ]),
        ),
      },
    ],
  ])('offers no saving when %s', (_name, over) => {
    expect(outdoorShift(hCtx(household(), over))).toBeNull();
  });

  it('builds qualitative impacts without a number', () => {
    expect(qualitative('x', 'Title', 'Effect')).toMatchObject({
      id: 'x',
      metric: 'qualitative',
      value: null,
      countsInTotal: false,
      factors: [],
    });
  });
});

describe('household strategies', () => {
  it('purifier: applies only without a purifier, and avoids 168 µg a day at 100 µg/m³', () => {
    const s = household$('purifier-bedroom');
    expect(s.applies(hCtx(household({ hasPurifier: true })))).toBe(false);
    expect(s.applies(hCtx(household({ hasPurifier: false })))).toBe(true);
    const impact = s.build(hCtx(household({ hasPurifier: false })));
    expect(impact.value).toBe(168);
    expect(impact.metric).toBe('pm25_ug_per_day');
    expect(impact.formula).toBe('100 µg/m³ × 0.7 (indoor share) × 0.6 (purifier cut) × 0.5 m³/h × 8 h = 168 µg');
    expect(impact.factors).toHaveLength(4);
  });

  it('purifier: lists the published EPA conversion when PM2.5 was estimated', () => {
    const impact = household$('purifier-bedroom').build(hCtx(household({ hasPurifier: false }), { pm25Source: 'converted' }));
    expect(impact.factors[0]).toBe(FACTORS.epaBreakpoints);
    expect(impact.factors.some((f) => f.kind === 'published')).toBe(true);
  });

  it('shift outdoor time: needs a useful forecast and names the cleanest hour', () => {
    const s = household$('shift-outdoor-time');
    expect(s.applies(hCtx())).toBe(true);
    expect(s.applies(hCtx(household(), { forecast: null }))).toBe(false);
    const impact = s.build(hCtx());
    expect(impact.title).toContain('3 am');
    expect(impact.value).toBe(60);
    expect(impact.formula).toBe('(80 − 30) µg/m³ × 1.2 m³/h × 1 h = 60 µg');
  });

  it('mask: applies to open-air commutes only, and counts the round trip', () => {
    const s = household$('mask-on-commute');
    for (const mode of ['walk', 'bike', 'motorbike'] as const) expect(s.applies(hCtx(household({ commuteMode: mode })))).toBe(true);
    for (const mode of ['car', 'bus', 'metro', 'wfh'] as const) expect(s.applies(hCtx(household({ commuteMode: mode })))).toBe(false);
    expect(s.applies(hCtx(household({ commuteMode: 'walk', commuteKm: 0 })))).toBe(false);
    const impact = s.build(hCtx(household({ commuteMode: 'walk', commuteKm: 5 }), { pm25: 50 }));
    // 50 × 1.2 × (2 × 5 ÷ 5 = 2 h) × 0.8 = 96
    expect(impact.value).toBe(96);
    expect(impact.formula).toContain('2 h (2 × 5 km ÷ 5 km/h)');
    expect(impact.factors).toContain(FACTORS.walkingSpeed);
  });

  it('metro: saves 66.4 kg CO2e a month on a 10 km car commute', () => {
    const s = household$('commute-metro');
    expect(s.applies(hCtx(household({ commuteMode: 'bus' })))).toBe(false);
    expect(s.applies(hCtx(household({ commuteMode: 'car', commuteKm: 0 })))).toBe(false);
    expect(s.applies(hCtx(household({ commuteMode: 'motorbike' })))).toBe(true);
    const impact = s.build(hCtx(household({ commuteMode: 'car', commuteKm: 10 })));
    expect(impact.value).toBe(66.4);
    expect(impact.metric).toBe('co2e_kg_per_month');
    expect(impact.exclusiveGroup).toBe('commute');
    expect(impact.formula).toBe('(0.192 − 0.041) kg/km × 10 km × 2 trips × 22 days = 66.4 kg');
  });

  it('carpool: saves 25.3 kg CO2e a month on a 10 km car commute', () => {
    const s = household$('commute-carpool');
    expect(s.applies(hCtx(household({ commuteMode: 'metro' })))).toBe(false);
    const impact = s.build(hCtx(household({ commuteMode: 'car', commuteKm: 10 })));
    expect(impact.value).toBe(25.3);
    expect(impact.exclusiveGroup).toBe('commute');
  });

  it('stay home: applies to remote workers and zero-distance commutes', () => {
    const s = household$('stay-home');
    expect(s.applies(hCtx(household({ commuteMode: 'wfh' })))).toBe(true);
    expect(s.applies(hCtx(household({ commuteMode: 'car', commuteKm: 0 })))).toBe(true);
    expect(s.applies(hCtx(household({ commuteMode: 'car', commuteKm: 5 })))).toBe(false);
    expect(s.build(hCtx()).metric).toBe('qualitative');
  });

  it('fuel and heating advice follows the household profile', () => {
    expect(household$('clean-cooking').applies(hCtx(household({ cooking: 'biomass' })))).toBe(true);
    expect(household$('clean-cooking').applies(hCtx(household({ cooking: 'lpg' })))).toBe(false);
    expect(household$('induction-cooking').applies(hCtx(household({ cooking: 'lpg' })))).toBe(true);
    expect(household$('induction-cooking').applies(hCtx(household({ cooking: 'induction' })))).toBe(false);
    expect(household$('clean-heating').applies(hCtx(household({ heating: 'biomass' })))).toBe(true);
    expect(household$('clean-heating').applies(hCtx(household({ heating: 'gas' })))).toBe(false);
    for (const id of ['clean-cooking', 'induction-cooking', 'clean-heating']) {
      expect(household$(id).build(hCtx()).metric).toBe('qualitative');
    }
  });

  it('always suggests ending open burning', () => {
    expect(household$('stop-open-burning').applies(hCtx())).toBe(true);
    expect(household$('stop-open-burning').build(hCtx()).value).toBeNull();
  });

  it('gives every strategy a unique id', () => {
    const ids = HOUSEHOLD_STRATEGIES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('community strategies', () => {
  it('stagger outdoor time: multiplies the per-person saving by the group size', () => {
    const s = community$('community-stagger-outdoor');
    expect(s.applies(cCtx(community(), { forecast: null }))).toBe(false);
    const impact = s.build(cCtx());
    expect(impact.value).toBe(12_000);
    expect(impact.title).toContain('3 am');
    expect(impact.formula).toBe('(80 − 30) µg/m³ × 1.2 m³/h × 1 h × 200 people = 12000 µg');
    expect(impact.unit).toContain('whole group');
  });

  it('transit shift: counts drivers from the driving share', () => {
    const s = community$('community-transit-shift');
    expect(s.applies(cCtx())).toBe(true);
    expect(s.applies(cCtx(community({ drivingSharePercent: 0 })))).toBe(false);
    expect(s.applies(cCtx(community({ members: 5, drivingSharePercent: 5 })))).toBe(false);
    expect(s.applies(cCtx(community({ commuteKm: 0 })))).toBe(false);
    // 100 drivers × (84.48 − 18.04) kg × 0.4
    expect(s.build(cCtx()).value).toBe(2657.6);
    expect(s.build(cCtx()).formula).toContain('100 drivers');
  });

  it('carpool: shares cars between four', () => {
    const s = community$('community-carpool');
    expect(s.applies(cCtx())).toBe(true);
    expect(s.build(cCtx()).value).toBe(2534.4);
    expect(s.build(cCtx()).exclusiveGroup).toBe('commute');
  });

  it('clean-air room: applies without one, gives a per-person figure and stays out of totals', () => {
    const s = community$('community-clean-air-room');
    expect(s.applies(cCtx(community({ hasCleanAirRoom: true })))).toBe(false);
    expect(s.applies(cCtx(community({ hasCleanAirRoom: false })))).toBe(true);
    const impact = s.build(cCtx(community({ hasCleanAirRoom: false })));
    expect(impact.value).toBe(84);
    expect(impact.countsInTotal).toBe(false);
    expect(impact.unit).toContain('each person who uses the room');
    expect(s.build(cCtx(community({ hasCleanAirRoom: false }), { pm25Source: 'converted' })).factors[0]).toBe(FACTORS.epaBreakpoints);
  });

  it('idling rules: worded for schools and societies, skipped for neighbourhoods', () => {
    const s = community$('community-no-idling');
    expect(s.applies(cCtx(community({ groupType: 'neighbourhood' })))).toBe(false);
    expect(s.build(cCtx(community({ groupType: 'school' }))).title).toMatch(/pick-up and drop-off/);
    expect(s.build(cCtx(community({ groupType: 'housing-society' }))).title).toMatch(/society gates/);
  });

  it('always suggests a no open-burning rule', () => {
    expect(community$('community-no-open-burning').applies(cCtx())).toBe(true);
    expect(community$('community-no-open-burning').build(cCtx()).metric).toBe('qualitative');
  });

  it('gives every strategy a unique id', () => {
    const ids = COMMUNITY_STRATEGIES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('computeImpacts', () => {
  it('uses the measured PM2.5 when there is one', () => {
    const impacts = computeImpacts(household({ hasPurifier: false }), air({ pm25: 100 }), forecast);
    const purifier = impacts.find((i) => i.id === 'purifier-bedroom')!;
    expect(purifier.value).toBe(168);
    expect(purifier.factors.some((f) => f.kind === 'published')).toBe(false);
  });

  it('estimates PM2.5 from the AQI when there is no measurement, and says so', () => {
    const noPm = air({ pm25: undefined, usAqi: 180, source: 'user-provided' });
    const impacts = computeImpacts(household({ hasPurifier: false }), noPm, null);
    const purifier = impacts.find((i) => i.id === 'purifier-bedroom')!;
    const expected = round1(inhaledUg(aqiToPm25(180), 0.5, 8) * 0.7 * 0.6);
    expect(purifier.value).toBe(expected);
    expect(purifier.factors.some((f) => f.id === 'epaBreakpoints' && f.kind === 'published')).toBe(true);
  });

  it('lists impacts for a household in registry order, skipping those that do not apply', () => {
    const ids = computeImpacts(household({ hasPurifier: false, cooking: 'biomass', heating: 'biomass' }), air(), forecast).map((i) => i.id);
    expect(ids).toEqual([
      'shift-outdoor-time',
      'purifier-bedroom',
      'commute-metro',
      'commute-carpool',
      'clean-cooking',
      'clean-heating',
      'stop-open-burning',
    ]);
  });

  it('lists impacts for a community group', () => {
    const ids = computeImpacts(community({ hasCleanAirRoom: false, groupType: 'school' }), air(), forecast).map((i) => i.id);
    expect(ids).toEqual([
      'community-stagger-outdoor',
      'community-clean-air-room',
      'community-transit-shift',
      'community-carpool',
      'community-no-idling',
      'community-no-open-burning',
    ]);
  });

  it('keeps every number labelled: each quantified impact lists its factors and a formula', () => {
    const profiles = [household({ hasPurifier: false, commuteMode: 'motorbike' }), community({ hasCleanAirRoom: false })];
    for (const profile of profiles) {
      for (const impact of computeImpacts(profile, air(), forecast)) {
        if (impact.metric === 'qualitative') {
          expect(impact.value).toBeNull();
        } else {
          expect(impact.factors.length).toBeGreaterThan(0);
          expect(impact.formula.length).toBeGreaterThan(0);
          expect(impact.value).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('totalImpacts', () => {
  const impact = (over: Partial<Impact>): Impact => ({
    id: 'x',
    title: 'X',
    metric: 'pm25_ug_per_day',
    value: 10,
    unit: 'u',
    formula: 'f',
    factors: [],
    exposureEffect: 'e',
    countsInTotal: true,
    ...over,
  });

  it('returns zeros for no impacts', () => {
    expect(totalImpacts([])).toEqual({ pm25UgPerDay: 0, co2eKgPerMonth: 0 });
  });

  it('adds PM2.5 impacts together', () => {
    expect(totalImpacts([impact({ value: 168 }), impact({ id: 'y', value: 60.2 })]).pm25UgPerDay).toBe(228.2);
  });

  it('counts only the largest of alternatives in the same exclusive group', () => {
    const metro = impact({ id: 'm', metric: 'co2e_kg_per_month', value: 66.4, exclusiveGroup: 'commute' });
    const carpool = impact({ id: 'c', metric: 'co2e_kg_per_month', value: 25.3, exclusiveGroup: 'commute' });
    expect(totalImpacts([metro, carpool]).co2eKgPerMonth).toBe(66.4);
    expect(totalImpacts([carpool, metro]).co2eKgPerMonth).toBe(66.4);
  });

  it('adds CO2e impacts that are not alternatives to each other', () => {
    const a = impact({ id: 'a', metric: 'co2e_kg_per_month', value: 5 });
    const b = impact({ id: 'b', metric: 'co2e_kg_per_month', value: 7.5 });
    expect(totalImpacts([a, b]).co2eKgPerMonth).toBe(12.5);
  });

  it('ignores impacts that are per person, qualitative or without a value', () => {
    const perPerson = impact({ countsInTotal: false, value: 999 });
    const noValue = impact({ value: null });
    expect(totalImpacts([perPerson, noValue])).toEqual({ pm25UgPerDay: 0, co2eKgPerMonth: 0 });
  });

  it('adds up a real household plan without double counting commute alternatives', () => {
    const impacts = computeImpacts(household({ hasPurifier: false }), air(), forecast);
    const totals = totalImpacts(impacts);
    // shift (60) + purifier (168) PM2.5; commute counts once (66.4, the larger of metro and carpool)
    expect(totals).toEqual({ pm25UgPerDay: 228, co2eKgPerMonth: 66.4 });
  });
});

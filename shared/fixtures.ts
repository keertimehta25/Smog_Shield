import type { AirQuality, CommunityProfile, HouseholdProfile, HourPoint } from './schemas';

/** Test helpers: realistic default profiles and air readings that each test can override. */
export const household = (over: Partial<HouseholdProfile> = {}): HouseholdProfile => ({
  audience: 'household',
  city: 'Delhi',
  adults: 2,
  children: 0,
  seniors: 0,
  respiratoryCondition: false,
  commuteMode: 'car',
  commuteKm: 10,
  cooking: 'induction',
  heating: 'none',
  hasPurifier: true,
  ...over,
});

export const community = (over: Partial<CommunityProfile> = {}): CommunityProfile => ({
  audience: 'community',
  city: 'Delhi',
  groupType: 'housing-society',
  members: 200,
  drivingSharePercent: 50,
  commuteKm: 10,
  hasCleanAirRoom: true,
  ...over,
});

export const air = (over: Partial<AirQuality> = {}): AirQuality => ({
  city: 'Delhi',
  usAqi: 180,
  pm25: 100,
  source: 'open-meteo',
  fetchedAt: '2026-11-22T00:00:00Z',
  ...over,
});

/** Builds hourly points for 22 Nov 2026 from [usAqi, pm25] pairs, starting at `startHour`. */
export const hours = (values: Array<[number, number | null]>, startHour = 0): HourPoint[] =>
  values.map(([usAqi, pm25], i) => ({
    time: `2026-11-22T${String((startHour + i) % 24).padStart(2, '0')}:00`,
    usAqi,
    pm25,
  }));

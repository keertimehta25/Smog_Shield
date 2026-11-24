import type { Profile } from './schemas';

export interface AqiCategory {
  label: string;
  /** 0 (good) to 5 (hazardous) */
  level: number;
  advice: string;
}

const CATEGORIES: ReadonlyArray<{ max: number; category: AqiCategory }> = [
  { max: 50, category: { label: 'Good', level: 0, advice: 'Air is clean. Enjoy normal outdoor activity and ventilate your home.' } },
  {
    max: 100,
    category: {
      label: 'Moderate',
      level: 1,
      advice: 'Acceptable for most people. Unusually sensitive people should limit long hard exercise outdoors.',
    },
  },
  {
    max: 150,
    category: {
      label: 'Unhealthy for Sensitive Groups',
      level: 2,
      advice: 'Children, older adults and people with lung or heart conditions should reduce prolonged outdoor effort.',
    },
  },
  {
    max: 200,
    category: {
      label: 'Unhealthy',
      level: 3,
      advice: 'Everyone should reduce prolonged outdoor exertion. Keep windows closed during peak hours.',
    },
  },
  {
    max: 300,
    category: {
      label: 'Very Unhealthy',
      level: 4,
      advice: 'Avoid outdoor exercise. Wear a well-fitted N95/FFP2 mask if you must go out. Run an air purifier indoors.',
    },
  },
  {
    max: Infinity,
    category: {
      label: 'Hazardous',
      level: 5,
      advice: 'Stay indoors with windows sealed. Avoid all outdoor exertion and seek medical help if you feel unwell.',
    },
  },
];

/** Maps a US AQI value (EPA scale) to its health category. Invalid values are clamped to 0. */
export function categorizeAqi(aqi: number): AqiCategory {
  const value = Number.isFinite(aqi) ? Math.max(0, aqi) : 0;
  // The last band has max = Infinity, so a match always exists.
  return CATEGORIES.find((c) => value <= c.max)!.category;
}

/** US EPA PM2.5 breakpoints (2012 table): AQI low/high and PM2.5 low/high in µg/m³. */
const PM25_BREAKPOINTS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 50, 0, 12],
  [51, 100, 12.1, 35.4],
  [101, 150, 35.5, 55.4],
  [151, 200, 55.5, 150.4],
  [201, 300, 150.5, 250.4],
  [301, 400, 250.5, 350.4],
  [401, 500, 350.5, 500.4],
];

/** Approximate PM2.5 (µg/m³) for a US AQI value, by interpolating the EPA breakpoints. Used only when no measured PM2.5 exists. */
export function aqiToPm25(aqi: number): number {
  const value = Number.isFinite(aqi) ? Math.min(Math.max(aqi, 0), 500) : 0;
  // The value is clamped to 500, the top of the last band, so a band always matches.
  const [aqiLow, aqiHigh, pmLow, pmHigh] = PM25_BREAKPOINTS.find(([, high]) => value <= high)!;
  const share = (value - aqiLow) / (aqiHigh - aqiLow);
  return Math.round((pmLow + share * (pmHigh - pmLow)) * 10) / 10;
}

export interface Risk {
  score: number;
  label: 'Low' | 'Moderate' | 'High' | 'Severe';
}

type RiskInputs = { children: number; seniors: number; respiratoryCondition: boolean; hasPurifier: boolean };

/**
 * Exposure risk, 0-100. Air quality sets the base; each vulnerable group raises it because
 * they are harmed at lower concentrations; a purifier lowers it a little.
 */
export function householdRisk(aqi: number, profile: RiskInputs): Risk {
  const base = (Math.min(Math.max(aqi, 0), 300) / 300) * 70;
  let bonus = 0;
  if (profile.children > 0) bonus += 10;
  if (profile.seniors > 0) bonus += 10;
  if (profile.respiratoryCondition) bonus += 10;
  const mitigation = profile.hasPurifier ? 8 : 0;
  const score = Math.round(Math.min(100, Math.max(0, base + bonus - mitigation)));
  const label = score >= 75 ? 'Severe' : score >= 50 ? 'High' : score >= 25 ? 'Moderate' : 'Low';
  return { score, label };
}

/** Any group of people includes children or older adults, so one vulnerable group is assumed. */
export function groupRisk(aqi: number, hasCleanAirRoom: boolean): Risk {
  return householdRisk(aqi, { children: 1, seniors: 0, respiratoryCondition: false, hasPurifier: hasCleanAirRoom });
}

/** Exposure risk for either kind of profile. */
export function riskFor(aqi: number, profile: Profile): Risk {
  return profile.audience === 'household' ? householdRisk(aqi, profile) : groupRisk(aqi, profile.hasCleanAirRoom);
}

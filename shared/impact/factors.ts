import type { CommuteMode } from '../schemas';
import type { Factor } from './types';

const assumption = (id: string, label: string, value: number, unit: string, source: string): Factor => ({
  id,
  label,
  value,
  unit,
  kind: 'assumption',
  source,
});

const EMISSION_SOURCE =
  'Rounded typical per-passenger-km value. National conversion-factor tables (for example UK DESNZ/DEFRA) publish figures of the same order; this is not an exact published number.';

/**
 * Every number the impact engine uses lives here, labelled as published or assumed, so the app
 * never presents a guess as a fact. Change a value here and every formula and test follows.
 */
export const FACTORS = {
  sleepBreathing: assumption(
    'sleepBreathing',
    'Breathing rate while asleep',
    0.5,
    'm³ of air per hour',
    'Resting adults breathe roughly 0.4 to 0.6 m³ of air per hour; 0.5 is assumed.',
  ),
  walkBreathing: assumption(
    'walkBreathing',
    'Breathing rate while walking, cycling or exercising lightly',
    1.2,
    'm³ of air per hour',
    'Light activity about doubles resting breathing; 1.2 is assumed.',
  ),
  sleepHours: assumption('sleepHours', 'Hours asleep in the room', 8, 'hours per day', 'A typical night; people differ.'),
  outdoorHours: assumption(
    'outdoorHours',
    'Outdoor exercise or play moved to a cleaner hour',
    1,
    'hours per day',
    'One hour is a simple, realistic block to move.',
  ),
  cleanRoomHours: assumption(
    'cleanRoomHours',
    'Time spent in a clean-air room',
    4,
    'hours per day',
    'A few hours of shared time, for example during the worst of the day.',
  ),
  indoorInfiltration: assumption(
    'indoorInfiltration',
    'Indoor share of outdoor PM2.5 with windows closed',
    0.7,
    'ratio',
    'Indoor PM2.5 is often about 30 to 80 percent of the outdoor level when windows are closed; 0.7 is assumed.',
  ),
  purifierReduction: assumption(
    'purifierReduction',
    'Indoor PM2.5 removed by a correctly sized HEPA purifier',
    0.6,
    'fraction',
    'Purifiers are commonly reported to remove about half or more of indoor fine particles; 0.6 is assumed.',
  ),
  maskEffectiveness: assumption(
    'maskEffectiveness',
    'Protection from a well-fitted N95/FFP2 mask in real use',
    0.8,
    'fraction',
    'Certified N95/FFP2 masks must filter at least 95 percent of test particles (a published standard), but gaps at the edges lower real-world protection, so 0.8 is assumed.',
  ),
  walkingSpeed: assumption('walkingSpeed', 'Walking speed', 5, 'km per hour', 'Typical adult walking pace.'),
  cyclingSpeed: assumption('cyclingSpeed', 'Cycling speed', 15, 'km per hour', 'Typical city cycling pace.'),
  motorbikeSpeed: assumption('motorbikeSpeed', 'Motorbike speed in traffic', 30, 'km per hour', 'Typical urban average.'),
  workDays: assumption('workDays', 'Working days per month', 22, 'days', 'Five days a week over a month.'),
  shiftFraction: assumption(
    'shiftFraction',
    'Share of working days switched to a cleaner option',
    0.4,
    'fraction',
    'Two days out of five each week.',
  ),
  carpoolOccupancy: assumption('carpoolOccupancy', 'People per car when carpooling', 4, 'people', 'A full car with four people.'),
  epaBreakpoints: {
    id: 'epaBreakpoints',
    label: 'US EPA PM2.5 to AQI breakpoints, used to estimate PM2.5 from the AQI',
    value: 1,
    unit: 'table',
    kind: 'published',
    source:
      'US EPA Air Quality Index breakpoints for PM2.5 (2012 table), interpolated between bands. Used only when a measured PM2.5 is not available.',
  } satisfies Factor,
} as const;

/** Emissions per passenger-km, in kg CO2e. */
export const EMISSION: Record<CommuteMode, Factor> = {
  car: assumption('emission-car', 'Car emissions', 0.192, 'kg CO2e per km', EMISSION_SOURCE),
  motorbike: assumption('emission-motorbike', 'Motorbike emissions', 0.103, 'kg CO2e per km', EMISSION_SOURCE),
  bus: assumption('emission-bus', 'Bus emissions', 0.105, 'kg CO2e per km', EMISSION_SOURCE),
  metro: assumption('emission-metro', 'Metro or train emissions', 0.041, 'kg CO2e per km', EMISSION_SOURCE),
  bike: assumption('emission-bike', 'Cycling emissions', 0, 'kg CO2e per km', 'No tailpipe emissions.'),
  walk: assumption('emission-walk', 'Walking emissions', 0, 'kg CO2e per km', 'No tailpipe emissions.'),
  wfh: assumption('emission-wfh', 'Working from home emissions', 0, 'kg CO2e per km', 'No commute.'),
};

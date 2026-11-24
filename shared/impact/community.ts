import { hourLabel } from '../forecast';
import { fmt, inhaledUg, monthlyKg, round1 } from './dose';
import { outdoorShift, pm25Factors, qualitative, shiftFactors } from './common';
import { EMISSION, FACTORS } from './factors';
import type { CommunityContext, Strategy } from './types';

/** People in the group who drive, from the share who do. */
const drivers = (ctx: CommunityContext): number => Math.round((ctx.profile.members * ctx.profile.drivingSharePercent) / 100);

const hasDrives = (ctx: CommunityContext): boolean => drivers(ctx) > 0 && ctx.profile.commuteKm > 0;

const staggerOutdoor: Strategy<CommunityContext> = {
  id: 'community-stagger-outdoor',
  applies: (ctx) => outdoorShift(ctx) !== null,
  build: (ctx) => {
    const shift = outdoorShift(ctx)!;
    const { members } = ctx.profile;
    const value = round1(shift.perPersonUg * members);
    const hour = hourLabel(ctx.forecast!.cleanest.time);
    return {
      id: 'community-stagger-outdoor',
      title: `Schedule sports, assemblies, markets and play around ${hour}, the cleanest hour in the next 24`,
      metric: 'pm25_ug_per_day',
      value,
      unit: 'µg of PM2.5 not breathed in per day, across the whole group',
      formula: `(${fmt(shift.average)} − ${fmt(shift.cleanest)}) µg/m³ × ${FACTORS.walkBreathing.value} m³/h × ${FACTORS.outdoorHours.value} h × ${members} people = ${fmt(value)} µg`,
      factors: shiftFactors,
      exposureEffect:
        'Moving shared outdoor time to the cleanest hour lowers what every child and adult in the group breathes in, with no cost.',
      countsInTotal: true,
    };
  },
};

const transitShift: Strategy<CommunityContext> = {
  id: 'community-transit-shift',
  applies: hasDrives,
  build: (ctx) => {
    const { commuteKm: km } = ctx.profile;
    const people = drivers(ctx);
    const { shiftFraction, workDays } = FACTORS;
    const value = round1(people * (monthlyKg('car', km) - monthlyKg('metro', km)) * shiftFraction.value);
    return {
      id: 'community-transit-shift',
      title: 'Organise a two-days-a-week metro or bus switch for people who drive',
      metric: 'co2e_kg_per_month',
      value,
      unit: 'kg CO2e saved per month, across the whole group',
      formula: `${people} drivers × (${EMISSION.car.value} − ${EMISSION.metro.value}) kg/km × ${km} km × 2 trips × ${workDays.value} days × ${shiftFraction.value} = ${fmt(value)} kg`,
      factors: [EMISSION.car, EMISSION.metro, workDays, shiftFraction],
      exposureEffect:
        'Fewer cars at the gate and on the neighbouring roads lowers local fine-particle and nitrogen-oxide levels, as well as CO2e.',
      countsInTotal: true,
      exclusiveGroup: 'commute',
    };
  },
};

const carpool: Strategy<CommunityContext> = {
  id: 'community-carpool',
  applies: hasDrives,
  build: (ctx) => {
    const { commuteKm: km } = ctx.profile;
    const people = drivers(ctx);
    const { shiftFraction, carpoolOccupancy, workDays } = FACTORS;
    const value = round1(people * monthlyKg('car', km) * shiftFraction.value * (1 - 1 / carpoolOccupancy.value));
    return {
      id: 'community-carpool',
      title: 'Run a carpool board so four people share each car two days a week',
      metric: 'co2e_kg_per_month',
      value,
      unit: 'kg CO2e saved per month, across the whole group',
      formula: `${people} drivers × ${EMISSION.car.value} kg/km × ${km} km × 2 trips × ${workDays.value} days × ${shiftFraction.value} × (1 − 1/${carpoolOccupancy.value}) = ${fmt(value)} kg`,
      factors: [EMISSION.car, workDays, shiftFraction, carpoolOccupancy],
      exposureEffect: 'Four people per car puts a quarter of the vehicles on the road for the same trips.',
      countsInTotal: true,
      exclusiveGroup: 'commute',
    };
  },
};

const cleanAirRoom: Strategy<CommunityContext> = {
  id: 'community-clean-air-room',
  applies: (ctx) => !ctx.profile.hasCleanAirRoom,
  build: (ctx) => {
    const { indoorInfiltration, purifierReduction, sleepBreathing, cleanRoomHours } = FACTORS;
    const value = round1(
      inhaledUg(ctx.pm25, sleepBreathing.value, cleanRoomHours.value) * indoorInfiltration.value * purifierReduction.value,
    );
    return {
      id: 'community-clean-air-room',
      title: 'Set up a clean-air room with HEPA purifiers in the hall, school library or community centre',
      metric: 'pm25_ug_per_day',
      value,
      unit: 'µg of PM2.5 not breathed in per day, for each person who uses the room',
      formula: `${fmt(ctx.pm25)} µg/m³ × ${indoorInfiltration.value} (indoor share) × ${purifierReduction.value} (purifier cut) × ${sleepBreathing.value} m³/h × ${cleanRoomHours.value} h = ${fmt(value)} µg`,
      factors: [...pm25Factors(ctx), indoorInfiltration, purifierReduction, sleepBreathing, cleanRoomHours],
      exposureEffect:
        'A shared clean room gives children, older adults and anyone with breathing problems a safe place on the worst days, including people who cannot buy a purifier.',
      countsInTotal: false,
    };
  },
};

const quietGates: Strategy<CommunityContext> = {
  id: 'community-no-idling',
  applies: (ctx) => ctx.profile.groupType !== 'neighbourhood',
  build: (ctx) =>
    qualitative(
      'community-no-idling',
      ctx.profile.groupType === 'school'
        ? 'Ask parents to switch engines off during school pick-up and drop-off'
        : 'Enforce engines-off at the society gates and parking',
      'Idling engines pour fumes out at exactly the height where children and older people breathe, and where crowds gather.',
    ),
};

const stopOpenBurning: Strategy<CommunityContext> = {
  id: 'community-no-open-burning',
  applies: () => true,
  build: () =>
    qualitative(
      'community-no-open-burning',
      'Agree a no open-burning rule for waste, leaves and wood, with composting or municipal collection instead',
      'Open burning is a visible, local, preventable source of dense smoke that everyone nearby breathes.',
    ),
};

/** Order matters: the plan lists impacts in this order. */
export const COMMUNITY_STRATEGIES: ReadonlyArray<Strategy<CommunityContext>> = [
  staggerOutdoor,
  cleanAirRoom,
  transitShift,
  carpool,
  quietGates,
  stopOpenBurning,
];

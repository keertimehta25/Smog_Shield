import { hourLabel } from '../forecast';
import type { CommuteMode } from '../schemas';
import { fmt, inhaledUg, monthlyKg, round1 } from './dose';
import { outdoorShift, pm25Factors, qualitative, shiftFactors } from './common';
import { EMISSION, FACTORS } from './factors';
import type { HouseholdContext, Strategy } from './types';

const OPEN_AIR_SPEED: Partial<Record<CommuteMode, typeof FACTORS.walkingSpeed>> = {
  walk: FACTORS.walkingSpeed,
  bike: FACTORS.cyclingSpeed,
  motorbike: FACTORS.motorbikeSpeed,
};

const purifierBedroom: Strategy<HouseholdContext> = {
  id: 'purifier-bedroom',
  applies: (ctx) => !ctx.profile.hasPurifier,
  build: (ctx) => {
    const { indoorInfiltration, purifierReduction, sleepBreathing, sleepHours } = FACTORS;
    const value = round1(inhaledUg(ctx.pm25, sleepBreathing.value, sleepHours.value) * indoorInfiltration.value * purifierReduction.value);
    return {
      id: 'purifier-bedroom',
      title: 'Run a HEPA purifier in the room where you sleep',
      metric: 'pm25_ug_per_day',
      value,
      unit: 'µg of PM2.5 not breathed in per day, per person sleeping in the room',
      formula: `${fmt(ctx.pm25)} µg/m³ × ${indoorInfiltration.value} (indoor share) × ${purifierReduction.value} (purifier cut) × ${sleepBreathing.value} m³/h × ${sleepHours.value} h = ${fmt(value)} µg`,
      factors: [...pm25Factors(ctx), indoorInfiltration, purifierReduction, sleepBreathing, sleepHours],
      exposureEffect:
        'Clean bedroom air covers the hours you spend asleep, about a third of your day, when your body is trying to recover.',
      countsInTotal: true,
    };
  },
};

const shiftOutdoorTime: Strategy<HouseholdContext> = {
  id: 'shift-outdoor-time',
  applies: (ctx) => outdoorShift(ctx) !== null,
  build: (ctx) => {
    const shift = outdoorShift(ctx)!;
    const hour = hourLabel(ctx.forecast!.cleanest.time);
    return {
      id: 'shift-outdoor-time',
      title: `Do outdoor walks, play and exercise around ${hour}, the cleanest hour in the next 24`,
      metric: 'pm25_ug_per_day',
      value: shift.perPersonUg,
      unit: 'µg of PM2.5 not breathed in per day, per person',
      formula: `(${fmt(shift.average)} − ${fmt(shift.cleanest)}) µg/m³ × ${FACTORS.walkBreathing.value} m³/h × ${FACTORS.outdoorHours.value} h = ${fmt(shift.perPersonUg)} µg`,
      factors: shiftFactors,
      exposureEffect:
        'Fine-particle levels rise and fall through the day. The same activity in a cleaner hour means less pollution reaches your lungs.',
      countsInTotal: true,
    };
  },
};

const maskOnCommute: Strategy<HouseholdContext> = {
  id: 'mask-on-commute',
  applies: (ctx) => ctx.profile.commuteMode in OPEN_AIR_SPEED && ctx.profile.commuteKm > 0,
  build: (ctx) => {
    const speed = OPEN_AIR_SPEED[ctx.profile.commuteMode]!;
    const hours = round1((2 * ctx.profile.commuteKm) / speed.value);
    const { walkBreathing, maskEffectiveness } = FACTORS;
    const value = round1(ctx.pm25 * walkBreathing.value * hours * maskEffectiveness.value);
    return {
      id: 'mask-on-commute',
      title: 'Wear a well-fitted N95/FFP2 mask on your open-air commute',
      metric: 'pm25_ug_per_day',
      value,
      unit: 'µg of PM2.5 not breathed in per day, per commuter',
      formula: `${fmt(ctx.pm25)} µg/m³ × ${walkBreathing.value} m³/h × ${fmt(hours)} h (2 × ${ctx.profile.commuteKm} km ÷ ${speed.value} km/h) × ${maskEffectiveness.value} = ${fmt(value)} µg`,
      factors: [...pm25Factors(ctx), walkBreathing, maskEffectiveness, speed],
      exposureEffect:
        'Riding, walking or cycling in traffic means breathing fast, close to the tailpipes. A sealed mask removes most of the fine particles before they reach your lungs.',
      countsInTotal: true,
    };
  },
};

const isDriving = (mode: CommuteMode) => mode === 'car' || mode === 'motorbike';

const commuteMetro: Strategy<HouseholdContext> = {
  id: 'commute-metro',
  applies: (ctx) => isDriving(ctx.profile.commuteMode) && ctx.profile.commuteKm > 0,
  build: (ctx) => {
    const { commuteMode: mode, commuteKm: km } = ctx.profile;
    const value = round1(monthlyKg(mode, km) - monthlyKg('metro', km));
    return {
      id: 'commute-metro',
      title: 'Use metro or bus for your commute',
      metric: 'co2e_kg_per_month',
      value,
      unit: 'kg CO2e saved per month, per commuter',
      formula: `(${EMISSION[mode].value} − ${EMISSION.metro.value}) kg/km × ${km} km × 2 trips × ${FACTORS.workDays.value} days = ${fmt(value)} kg`,
      factors: [EMISSION[mode], EMISSION.metro, FACTORS.workDays],
      exposureEffect:
        'Fewer private vehicles on the road lowers the traffic share of fine particles and nitrogen oxides in your neighbourhood, as well as CO2e.',
      countsInTotal: true,
      exclusiveGroup: 'commute',
    };
  },
};

const commuteCarpool: Strategy<HouseholdContext> = {
  id: 'commute-carpool',
  applies: (ctx) => isDriving(ctx.profile.commuteMode) && ctx.profile.commuteKm > 0,
  build: (ctx) => {
    const { commuteMode: mode, commuteKm: km } = ctx.profile;
    const { shiftFraction, carpoolOccupancy, workDays } = FACTORS;
    const value = round1(monthlyKg(mode, km) * shiftFraction.value * (1 - 1 / carpoolOccupancy.value));
    return {
      id: 'commute-carpool',
      title: 'Carpool with three colleagues two days a week',
      metric: 'co2e_kg_per_month',
      value,
      unit: 'kg CO2e saved per month, per commuter',
      formula: `${EMISSION[mode].value} kg/km × ${km} km × 2 trips × ${workDays.value} days × ${shiftFraction.value} × (1 − 1/${carpoolOccupancy.value}) = ${fmt(value)} kg`,
      factors: [EMISSION[mode], workDays, shiftFraction, carpoolOccupancy],
      exposureEffect: 'Four people in one car put a quarter of the vehicles on the road for the same trip.',
      countsInTotal: true,
      exclusiveGroup: 'commute',
    };
  },
};

const stayHome: Strategy<HouseholdContext> = {
  id: 'stay-home',
  applies: (ctx) => ctx.profile.commuteMode === 'wfh' || ctx.profile.commuteKm === 0,
  build: () =>
    qualitative(
      'stay-home',
      'Keep working from home on severe smog days',
      'Skipping the commute removes your exposure to roadside air, where pollution is usually highest.',
    ),
};

const cleanCooking: Strategy<HouseholdContext> = {
  id: 'clean-cooking',
  applies: (ctx) => ctx.profile.cooking === 'biomass',
  build: () =>
    qualitative(
      'clean-cooking',
      'Switch from wood, dung or coal cooking to LPG or induction',
      'Burning solid fuel indoors is a leading source of indoor fine particles; clean fuels remove most of it from your kitchen.',
    ),
};

const inductionCooking: Strategy<HouseholdContext> = {
  id: 'induction-cooking',
  applies: (ctx) => ctx.profile.cooking === 'lpg',
  build: () =>
    qualitative(
      'induction-cooking',
      'Use an induction cooktop for part of your cooking',
      'Gas flames release nitrogen dioxide and fine particles indoors; induction releases none where you cook.',
    ),
};

const cleanHeating: Strategy<HouseholdContext> = {
  id: 'clean-heating',
  applies: (ctx) => ctx.profile.heating === 'biomass',
  build: () =>
    qualitative(
      'clean-heating',
      'Replace wood or coal heating with electric heating or better insulation',
      'Burning solid fuel for warmth is a major winter source of local smoke.',
    ),
};

const stopOpenBurning: Strategy<HouseholdContext> = {
  id: 'stop-open-burning',
  applies: () => true,
  build: () =>
    qualitative(
      'stop-open-burning',
      'Never burn leaves, waste or wood in the open',
      'Open burning releases dense smoke at ground level, right where your neighbours breathe it. Composting or municipal collection avoids it.',
    ),
};

/** Order matters: the plan lists impacts in this order. */
export const HOUSEHOLD_STRATEGIES: ReadonlyArray<Strategy<HouseholdContext>> = [
  shiftOutdoorTime,
  purifierBedroom,
  maskOnCommute,
  commuteMetro,
  commuteCarpool,
  stayHome,
  cleanCooking,
  inductionCooking,
  cleanHeating,
  stopOpenBurning,
];

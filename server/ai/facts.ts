import { categorizeAqi } from '../../shared/aqi';
import { hourLabel } from '../../shared/forecast';
import type { AdviceContext } from './aiService';

/**
 * The only data the model sees, as JSON. It is also the source of the numbers the model is
 * allowed to quote (see numberFirewall.ts), so what we send and what we allow cannot drift apart.
 */
export function buildFacts(ctx: AdviceContext): string {
  const { profile, air, forecast } = ctx;
  return JSON.stringify({
    audience: profile.audience,
    place: air.city,
    usAqi: air.usAqi,
    aqiCategory: categorizeAqi(air.usAqi).label,
    pm25: air.pm25 ?? null,
    next24Hours: forecast && {
      cleanestHour: hourLabel(forecast.cleanest.time),
      cleanestAqi: forecast.cleanest.usAqi,
      worstHour: hourLabel(forecast.worst.time),
      worstAqi: forecast.worst.usAqi,
      averagePm25: forecast.averagePm25,
    },
    people:
      profile.audience === 'household'
        ? {
            adults: profile.adults,
            children: profile.children,
            seniors: profile.seniors,
            respiratoryCondition: profile.respiratoryCondition,
          }
        : { groupType: profile.groupType, members: profile.members, drivingSharePercent: profile.drivingSharePercent },
    lifestyle:
      profile.audience === 'household'
        ? {
            commuteMode: profile.commuteMode,
            commuteKmOneWay: profile.commuteKm,
            cooking: profile.cooking,
            heating: profile.heating,
            hasPurifier: profile.hasPurifier,
          }
        : { commuteKmOneWay: profile.commuteKm, hasCleanAirRoom: profile.hasCleanAirRoom },
    exposureRisk: ctx.risk,
    impactEstimates: ctx.impacts.map((i) => ({
      id: i.id,
      title: i.title,
      value: i.value,
      unit: i.unit,
      formula: i.formula,
      factors: i.factors.map((f) => ({ label: f.label, value: f.value, unit: f.unit, kind: f.kind })),
    })),
    totals: ctx.totals,
  });
}

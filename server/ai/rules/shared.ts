import { categorizeAqi } from '../../../shared/aqi';
import { hourLabel } from '../../../shared/forecast';
import { fmt } from '../../../shared/impact/dose';
import type { Plan } from '../../../shared/schemas';
import type { AdviceContext } from '../aiService';

/** When to go out, from the next 24 hours of air quality. */
export function timingAdvice(ctx: AdviceContext): string {
  const { forecast } = ctx;
  if (!forecast) {
    return 'An hour-by-hour forecast is not available for this reading. Smog is usually densest around dawn and after sunset, so keep outdoor time to late morning and the afternoon.';
  }
  const { cleanest, worst } = forecast;
  if (cleanest.usAqi === worst.usAqi) {
    return `Air quality stays at about US AQI ${cleanest.usAqi} through the next 24 hours, so there is no cleaner hour to wait for. Keep outdoor time short and avoid heavy exertion.`;
  }
  return `The cleanest hour in the next 24 is about ${hourLabel(cleanest.time)} (US AQI ${cleanest.usAqi}) and the worst is about ${hourLabel(worst.time)} (US AQI ${worst.usAqi}). Do outdoor walks, play and exercise in the cleanest hour, and stay in during the worst.`;
}

/** One explanation per impact, quoting only the numbers the engine produced. */
export function impactExplanations(ctx: AdviceContext): Plan['impactExplanations'] {
  return ctx.impacts.slice(0, 10).map((impact) => ({
    choice: impact.title,
    effect:
      impact.value === null ? impact.exposureEffect : `About ${fmt(impact.value)} ${impact.unit} (estimate). ${impact.exposureEffect}`,
  }));
}

/** The headline sentence about today's air. */
export function airSentence(ctx: AdviceContext): string {
  return `Air in ${ctx.air.city} is ${categorizeAqi(ctx.air.usAqi).label.toLowerCase()} (US AQI ${ctx.air.usAqi}).`;
}

import { categorizeAqi } from '../../shared/aqi';
import type { PlanResponse, Profile } from '../../shared/schemas';
import { RuleBasedService } from '../../server/ai/ruleBasedService';
import { advice } from '../../server/fixtures';
import { community, household } from '../../shared/fixtures';

/** A realistic response, built with the real engine and the offline advisor. */
export async function planResponse(profile: Profile = household({ hasPurifier: false }), withForecast = true): Promise<PlanResponse> {
  const ctx = advice(profile, { hours: withForecast ? undefined : null });
  return {
    audience: profile.audience,
    air: ctx.air,
    category: categorizeAqi(ctx.air.usAqi),
    risk: ctx.risk,
    forecast: ctx.forecast,
    impacts: ctx.impacts,
    totals: ctx.totals,
    plan: await new RuleBasedService().generatePlan(ctx),
    aiSource: 'rules',
  };
}

export const groupResponse = () => planResponse(community({ hasCleanAirRoom: false }));

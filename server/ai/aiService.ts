import type { ForecastSummary } from '../../shared/forecast';
import type { Risk } from '../../shared/aqi';
import type { Impact, Totals } from '../../shared/impact';
import type { AirQuality, Plan, Profile } from '../../shared/schemas';

/** Everything an advisor needs to produce guidance for one household or community group. */
export interface AdviceContext {
  profile: Profile;
  air: AirQuality;
  forecast: ForecastSummary | null;
  impacts: Impact[];
  totals: Totals;
  risk: Risk;
}

/** Contract implemented by both the Gemini advisor and the offline rule-based advisor. */
export interface AiService {
  readonly name: 'gemini' | 'rules';
  generatePlan(ctx: AdviceContext): Promise<Plan>;
  chat(ctx: AdviceContext, message: string): Promise<string>;
}

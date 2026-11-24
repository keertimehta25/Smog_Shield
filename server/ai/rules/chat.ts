import { categorizeAqi } from '../../../shared/aqi';
import type { AdviceContext } from '../aiService';
import { timingAdvice } from './shared';

/** Keyword-based answers for the questions families ask most. Used when Gemini is not available. */
export function ruleBasedChat(ctx: AdviceContext, message: string): string {
  const category = categorizeAqi(ctx.air.usAqi);
  const text = message.toLowerCase();
  if (/(mask|n95|ffp2)/.test(text)) {
    return `At US AQI ${ctx.air.usAqi} (${category.label}), choose an N95/FFP2 mask with a snug seal. Cloth and surgical masks let most fine particles through.`;
  }
  if (/(purifier|hepa|filter)/.test(text)) {
    return "Use a true HEPA purifier sized for the room, keep doors and windows closed, and start with the bedroom or a shared clean-air room. Replace filters on the maker's schedule.";
  }
  if (/(when|time|hour|walk|run|exercise|jog|outdoor|outside|play)/.test(text)) {
    return category.level >= 3
      ? `Move exercise and play indoors today. If you must go out, keep it light and wear a fitted N95. ${timingAdvice(ctx)}`
      : `Outdoor activity is fine today with some care. ${timingAdvice(ctx)}`;
  }
  return `${category.advice} Ask me about masks, purifiers, the best time to go out, commuting or cooking and I will tailor the advice to ${ctx.air.city}.`;
}

import type { Plan } from '../../shared/schemas';
import type { AdviceContext, AiService } from './aiService';
import { ruleBasedChat } from './rules/chat';
import { communityPlan } from './rules/community';
import { householdPlan } from './rules/household';

/**
 * Offline advisor. It is used when no Gemini key is configured or when every model fails, so the
 * app always returns useful, safe guidance for households and community groups alike.
 */
export class RuleBasedService implements AiService {
  readonly name = 'rules' as const;

  async generatePlan(ctx: AdviceContext): Promise<Plan> {
    const { profile } = ctx;
    return profile.audience === 'household' ? householdPlan(ctx, profile) : communityPlan(ctx, profile);
  }

  async chat(ctx: AdviceContext, message: string): Promise<string> {
    return ruleBasedChat(ctx, message);
  }
}

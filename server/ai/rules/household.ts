import { categorizeAqi } from '../../../shared/aqi';
import type { HouseholdProfile, Plan } from '../../../shared/schemas';
import type { AdviceContext } from '../aiService';
import { airSentence, impactExplanations, timingAdvice } from './shared';

export function householdPlan(ctx: AdviceContext, profile: HouseholdProfile): Plan {
  const { risk } = ctx;
  const category = categorizeAqi(ctx.air.usAqi);
  const vulnerable = profile.children > 0 || profile.seniors > 0 || profile.respiratoryCondition;
  const bad = category.level >= 3;
  const driving = profile.commuteMode === 'car' || profile.commuteMode === 'motorbike';

  return {
    summary: `${airSentence(ctx)} Your household's exposure risk is ${risk.label.toLowerCase()} (${risk.score}/100).`,
    healthAlert:
      vulnerable && category.level >= 2
        ? `Because your household includes children, older adults or someone with a breathing or heart condition, treat today as one level worse than the headline AQI. ${category.advice}`
        : category.advice,
    timingAdvice: timingAdvice(ctx),
    routines: [
      {
        title: bad ? 'Skip the early-morning outdoor walk' : 'Ventilate briefly at midday',
        when: 'morning',
        detail: bad
          ? 'Winter inversions trap smog near the ground at dawn. Postpone outdoor exercise, or move it indoors.'
          : 'Open windows for about ten minutes when the air is cleanest, then close them again.',
        whyItHelps: 'Pollution is typically worst at dawn and after sunset, when cold air traps it near the ground.',
      },
      {
        title: 'Plan trips for the cleanest hours',
        when: 'daytime',
        detail: 'Run errands in the cleanest hours and combine them into one trip.',
        whyItHelps: 'Fewer, shorter trips mean fewer cold starts and less time breathing roadside air.',
      },
      {
        title: bad ? 'Wear a fitted N95/FFP2 mask outdoors' : 'Carry a mask for high-traffic stretches',
        when: 'evening',
        detail: 'Choose a mask that seals around the nose and cheeks. Cloth and surgical masks filter far fewer fine particles.',
        whyItHelps: 'A well-fitted N95 filters most fine particles; loose masks leak around the edges.',
      },
      {
        title: 'Shut windows and run the purifier overnight',
        when: 'night',
        detail: 'Keep the bedroom closed with the purifier on a low setting while you sleep.',
        whyItHelps: 'You spend about a third of your day asleep, so clean bedroom air has an outsized effect.',
      },
    ],
    indoorHacks: [
      {
        title: 'Seal gaps around doors and windows',
        detail: 'Use draught strips or rolled towels on the windward side of the home.',
        cost: 'low',
        whyItHelps: 'Leaky homes let outdoor smog straight in, which undoes the benefit of a purifier.',
      },
      {
        title: 'Damp-mop and wet-wipe instead of dry sweeping',
        detail: 'Wipe surfaces with a damp cloth once a day.',
        cost: 'free',
        whyItHelps: 'Dry sweeping lifts settled fine particles back into the air you breathe.',
      },
      {
        title: profile.hasPurifier ? 'Place your purifier away from walls' : 'Start with one HEPA purifier for the bedroom',
        detail: profile.hasPurifier
          ? 'Leave about 30 cm of clear space around it and replace filters on schedule.'
          : 'Pick a model whose clean air delivery rate suits your room size, and look for a true HEPA filter.',
        cost: profile.hasPurifier ? 'free' : 'medium',
        whyItHelps: 'Filters only work when air can flow through them and they are not clogged.',
      },
      {
        title: 'Use the kitchen exhaust while cooking',
        detail: 'Switch on the hood or open a small window in the kitchen only, and close the door to other rooms.',
        cost: 'free',
        whyItHelps: 'Cooking is a major source of indoor fine particles and gases.',
      },
    ],
    sustainableAlternatives: [
      driving
        ? {
            title: 'Swap two commute days a week for metro or bus',
            detail: 'Start with the days when parking is hardest or the weather is clearest.',
            whyItHelps: 'Public transport cuts per-person emissions and takes cars off crowded roads.',
          }
        : {
            title: 'Keep walking, cycling or taking public transport',
            detail: 'Share your routine with neighbours and colleagues who still drive.',
            whyItHelps: 'Your low-emission commute is already one of the strongest choices for cleaner air.',
          },
      {
        title: 'Avoid burning leaves, waste or wood',
        detail: 'Report open burning to your local authority and use composting or municipal collection instead.',
        whyItHelps: 'Open burning releases dense smoke at ground level where families breathe it.',
      },
    ],
    impactExplanations: impactExplanations(ctx),
  };
}

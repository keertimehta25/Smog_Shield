import { categorizeAqi } from '../../../shared/aqi';
import type { CommunityProfile, GroupType, Plan } from '../../../shared/schemas';
import type { AdviceContext } from '../aiService';
import { airSentence, impactExplanations, timingAdvice } from './shared';

const GROUP_NOUN: Record<GroupType, string> = {
  'housing-society': 'housing society',
  school: 'school',
  neighbourhood: 'neighbourhood group',
};

export function communityPlan(ctx: AdviceContext, profile: CommunityProfile): Plan {
  const { risk } = ctx;
  const category = categorizeAqi(ctx.air.usAqi);
  const bad = category.level >= 3;
  const noun = GROUP_NOUN[profile.groupType];
  const hasDrivers = profile.drivingSharePercent > 0;

  return {
    summary: `${airSentence(ctx)} For your ${noun} of ${profile.members} people, the exposure risk is ${risk.label.toLowerCase()} (${risk.score}/100).`,
    healthAlert:
      profile.groupType === 'school' && category.level >= 2
        ? `Children breathe faster and are more sensitive than adults, so treat today as one level worse than the headline AQI for students. ${category.advice}`
        : category.advice,
    timingAdvice: timingAdvice(ctx),
    routines: [
      {
        title: bad ? 'Move outdoor assemblies, sports and markets indoors' : 'Hold outdoor activities in the cleanest hour',
        when: 'morning',
        detail: bad
          ? 'Cancel or shorten outdoor events today. Use halls and classrooms with windows closed.'
          : 'Schedule shared outdoor time for the cleanest hour shown above, and keep it short.',
        whyItHelps: 'Every person in the group breathes less pollution when shared outdoor time moves to cleaner air.',
      },
      {
        title: 'Stagger arrival and departure',
        when: 'daytime',
        detail: 'Spread arrivals over a longer window and keep engines off while waiting at the gate.',
        whyItHelps: 'Crowds of idling vehicles at the gate pour fumes out right where people gather.',
      },
      {
        title: "Post today's air quality where everyone can see it",
        when: 'evening',
        detail: 'Put the AQI and the advice on the gate, the notice board and the group chat each morning.',
        whyItHelps: 'People change their habits when they can see the air is bad and know what to do.',
      },
      {
        title: 'Keep shared rooms closed overnight',
        when: 'night',
        detail: 'Close windows and vents in halls and common rooms in the evening so they start the day with cleaner air.',
        whyItHelps: 'Closed rooms keep out the overnight smog that settles when the air cools.',
      },
    ],
    indoorHacks: [
      {
        title: profile.hasCleanAirRoom
          ? 'Keep the clean-air room staffed and its filters fresh'
          : 'Set up one clean-air room with HEPA purifiers',
        detail:
          'Choose a hall, library or office with the fewest windows and run purifiers sized for the room. Invite children, older people and anyone with breathing problems.',
        cost: profile.hasCleanAirRoom ? 'free' : 'medium',
        whyItHelps: 'A shared clean room protects people who cannot buy a purifier of their own.',
      },
      {
        title: 'Seal gaps in shared buildings',
        detail: 'Fit draught strips to common doors and windows and keep doors to the outside shut.',
        cost: 'low',
        whyItHelps: 'Leaky buildings let outdoor smog straight in.',
      },
      {
        title: 'Damp-mop halls and corridors',
        detail: 'Replace dry sweeping with damp mopping and wet wiping.',
        cost: 'free',
        whyItHelps: 'Dry sweeping lifts settled fine particles back into the air.',
      },
      {
        title: 'Check filters on shared air conditioners and purifiers',
        detail: 'Clean or replace filters on a set schedule and write the date on them.',
        cost: 'low',
        whyItHelps: 'Clogged filters stop cleaning the air.',
      },
    ],
    sustainableAlternatives: [
      hasDrivers
        ? {
            title: 'Start a carpool board and a shared metro or bus plan',
            detail: 'Match neighbours, parents or colleagues who travel the same way, and agree two days a week to start.',
            whyItHelps: 'Fewer vehicles on the same roads cut fine particles, nitrogen oxides and CO2e.',
          }
        : {
            title: 'Keep and celebrate low-car habits',
            detail: 'Share what works with other groups nearby.',
            whyItHelps: 'A group that already travels cleanly is one of the strongest local examples.',
          },
      {
        title: 'Agree a no open-burning rule',
        detail: 'Set up composting or municipal waste collection, and agree who reports burning to the local authority.',
        whyItHelps: 'Open burning is a visible, local, preventable source of dense smoke.',
      },
    ],
    impactExplanations: impactExplanations(ctx),
  };
}

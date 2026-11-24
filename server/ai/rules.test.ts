import { describe, expect, it } from 'vitest';
import { community, household } from '../../shared/fixtures';
import { PlanSchema, type Profile } from '../../shared/schemas';
import { advice } from '../fixtures';
import { buildFacts } from './facts';
import { allowedNumbers, findInventedNumbers } from './numberFirewall';
import { ruleBasedChat } from './rules/chat';
import { airSentence, impactExplanations, timingAdvice } from './rules/shared';
import { RuleBasedService } from './ruleBasedService';

const svc = new RuleBasedService();
const AQI_BANDS = [10, 80, 130, 180, 250, 400];

const profiles: Array<[string, Profile]> = [
  [
    'a vulnerable car-commuting household',
    household({ children: 1, seniors: 1, respiratoryCondition: true, hasPurifier: false, cooking: 'biomass', heating: 'biomass' }),
  ],
  ['a healthy walking household with a purifier', household({ commuteMode: 'walk', hasPurifier: true, cooking: 'induction' })],
  ['a remote-working household', household({ commuteMode: 'wfh', commuteKm: 0, cooking: 'lpg' })],
  ['a housing society', community({ groupType: 'housing-society', hasCleanAirRoom: false })],
  ['a school with no drivers', community({ groupType: 'school', drivingSharePercent: 0, hasCleanAirRoom: true })],
  ['a neighbourhood group', community({ groupType: 'neighbourhood' })],
];

describe('RuleBasedService plans', () => {
  it.each(profiles)('produces a schema-valid plan for %s in every AQI band', async (_name, profile) => {
    for (const usAqi of AQI_BANDS) {
      const plan = await svc.generatePlan(advice(profile, { air: { usAqi } }));
      expect(PlanSchema.safeParse(plan).success).toBe(true);
    }
  });

  it.each(profiles)('never states a figure the engine did not produce, for %s', async (_name, profile) => {
    for (const hours of [undefined, null] as const) {
      const ctx = advice(profile, { hours });
      const plan = await svc.generatePlan(ctx);
      expect(findInventedNumbers(JSON.stringify(plan), allowedNumbers(buildFacts(ctx)))).toEqual([]);
    }
  });

  it('escalates the health alert for vulnerable households, but not for healthy ones', async () => {
    const vulnerable = await svc.generatePlan(advice(household({ children: 1 }), { air: { usAqi: 160 } }));
    expect(vulnerable.healthAlert).toMatch(/one level worse/);
    const healthy = await svc.generatePlan(advice(household({ commuteMode: 'walk' }), { air: { usAqi: 30 } }));
    expect(healthy.healthAlert).not.toMatch(/one level worse/);
    expect(healthy.sustainableAlternatives[0]!.title).toMatch(/Keep walking/);
  });

  it('adapts household advice to the air and the purifier', async () => {
    const clean = await svc.generatePlan(advice(household({ hasPurifier: true }), { air: { usAqi: 30 } }));
    expect(clean.routines[0]!.title).toMatch(/Ventilate/);
    expect(clean.indoorHacks[2]!.title).toMatch(/away from walls/);
    const smoggy = await svc.generatePlan(advice(household({ hasPurifier: false }), { air: { usAqi: 250 } }));
    expect(smoggy.routines[0]!.title).toMatch(/Skip the early-morning/);
    expect(smoggy.routines[2]!.title).toMatch(/fitted N95/);
    expect(smoggy.indoorHacks[2]!.title).toMatch(/HEPA purifier for the bedroom/);
  });

  it('writes community advice for each kind of group', async () => {
    const society = await svc.generatePlan(advice(community({ groupType: 'housing-society', members: 120, hasCleanAirRoom: false })));
    expect(society.summary).toMatch(/housing society of 120 people/);
    expect(society.indoorHacks[0]!.title).toMatch(/Set up one clean-air room/);
    expect(society.sustainableAlternatives[0]!.title).toMatch(/carpool board/);

    const school = await svc.generatePlan(
      advice(community({ groupType: 'school', hasCleanAirRoom: true, drivingSharePercent: 0 }), { air: { usAqi: 160 } }),
    );
    expect(school.summary).toMatch(/school of/);
    expect(school.healthAlert).toMatch(/Children breathe faster/);
    expect(school.routines[0]!.title).toMatch(/indoors/);
    expect(school.indoorHacks[0]!.title).toMatch(/Keep the clean-air room staffed/);
    expect(school.sustainableAlternatives[0]!.title).toMatch(/Keep and celebrate/);

    const clean = await svc.generatePlan(advice(community({ groupType: 'neighbourhood' }), { air: { usAqi: 30 } }));
    expect(clean.summary).toMatch(/neighbourhood group/);
    expect(clean.healthAlert).not.toMatch(/Children breathe faster/);
    expect(clean.routines[0]!.title).toMatch(/cleanest hour/);
  });
});

describe('shared rule text', () => {
  it('names the cleanest and worst hours', () => {
    expect(timingAdvice(advice())).toBe(
      'The cleanest hour in the next 24 is about 3 am (US AQI 90) and the worst is about 5 am (US AQI 170). Do outdoor walks, play and exercise in the cleanest hour, and stay in during the worst.',
    );
  });

  it('says so when the air is flat, or when there is no forecast', () => {
    const flat = advice(household(), {
      hours: [
        { time: '2026-11-22T10:00', usAqi: 120, pm25: 40 },
        { time: '2026-11-22T11:00', usAqi: 120, pm25: 40 },
      ],
    });
    expect(timingAdvice(flat)).toMatch(/no cleaner hour to wait for/);
    expect(timingAdvice(advice(household(), { hours: null }))).toMatch(/not available/);
  });

  it('writes one explanation per impact, with a number only where the engine gave one', () => {
    const ctx = advice(household({ hasPurifier: false, cooking: 'biomass' }));
    const explanations = impactExplanations(ctx);
    expect(explanations).toHaveLength(ctx.impacts.length);
    expect(explanations.find((e) => e.choice.includes('HEPA'))!.effect).toMatch(/^About 168 µg of PM2\.5/);
    expect(explanations.find((e) => e.choice.includes('wood, dung'))!.effect).not.toMatch(/About/);
  });

  it('opens with the air in plain words', () => {
    expect(airSentence(advice(household(), { air: { usAqi: 180 } }))).toBe('Air in Delhi is unhealthy (US AQI 180).');
  });
});

describe('rule-based chat', () => {
  const ctx = advice(household(), { air: { usAqi: 220 } });

  it.each([
    ['Which mask should I buy?', /N95/],
    ['Do I need a HEPA purifier?', /HEPA/],
    ['When is the best time to go out?', /cleanest hour in the next 24/],
    ['Can my child play outside?', /indoors/],
    ['What about dinner?', /Delhi/],
  ])('answers "%s"', async (question, pattern) => {
    expect(await svc.chat(ctx, question)).toMatch(pattern);
  });

  it('is relaxed about outdoor activity in clean air', () => {
    expect(ruleBasedChat(advice(household(), { air: { usAqi: 30 } }), 'Can I jog outside?')).toMatch(/fine today/);
  });
});

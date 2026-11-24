import { describe, expect, it } from 'vitest';
import { ChatRequestSchema, CommunitySchema, HouseholdSchema, PlanSchema, ProfileSchema } from './schemas';
import { community, household } from './fixtures';

describe('ProfileSchema', () => {
  it('accepts a valid household and a valid community', () => {
    expect(ProfileSchema.safeParse(household()).success).toBe(true);
    expect(ProfileSchema.safeParse(community()).success).toBe(true);
  });

  it('accepts a city that is a PIN code', () => {
    expect(ProfileSchema.safeParse(household({ city: '110001' })).success).toBe(true);
  });

  it('accepts matching coordinates and rejects a lone latitude or longitude', () => {
    expect(ProfileSchema.safeParse(household({ latitude: 28.61, longitude: 77.21 })).success).toBe(true);
    const lone = ProfileSchema.safeParse(household({ latitude: 28.61 }));
    expect(lone.success).toBe(false);
    expect(ProfileSchema.safeParse(household({ longitude: 77.21 })).success).toBe(false);
    expect(lone.success ? '' : lone.error.issues[0]!.message).toMatch(/together/);
  });

  it.each([
    ['empty city', household({ city: '' })],
    ['city with script characters', household({ city: '<script>alert(1)</script>' })],
    ['zero adults', household({ adults: 0 })],
    ['fractional children', household({ children: 1.5 })],
    ['negative distance', household({ commuteKm: -1 })],
    ['AQI above 500', household({ aqiOverride: 900 })],
    ['latitude out of range', household({ latitude: 95, longitude: 10 })],
    ['group of 4', community({ members: 4 })],
    ['group above 50000', community({ members: 50_001 })],
    ['driving share above 100', community({ drivingSharePercent: 101 })],
    ['fractional driving share', community({ drivingSharePercent: 10.5 })],
  ])('rejects %s', (_name, profile) => {
    expect(ProfileSchema.safeParse(profile).success).toBe(false);
  });

  it('rejects an unknown audience, an unknown commute mode and an unknown group type', () => {
    expect(ProfileSchema.safeParse({ ...household(), audience: 'company' }).success).toBe(false);
    expect(HouseholdSchema.safeParse({ ...household(), commuteMode: 'rocket' }).success).toBe(false);
    expect(CommunitySchema.safeParse({ ...community(), groupType: 'castle' }).success).toBe(false);
  });

  it('does not accept household fields without an audience', () => {
    const { audience: _audience, ...withoutAudience } = household();
    expect(ProfileSchema.safeParse(withoutAudience).success).toBe(false);
  });

  it('trims the city name', () => {
    expect(ProfileSchema.parse(household({ city: '  Mumbai  ' })).city).toBe('Mumbai');
  });
});

describe('ChatRequestSchema', () => {
  it('requires a message of 1 to 500 characters and a valid profile', () => {
    expect(ChatRequestSchema.safeParse({ message: 'Which mask?', profile: household() }).success).toBe(true);
    expect(ChatRequestSchema.safeParse({ message: '  ', profile: household() }).success).toBe(false);
    expect(ChatRequestSchema.safeParse({ message: 'x'.repeat(501), profile: household() }).success).toBe(false);
    expect(ChatRequestSchema.safeParse({ message: 'hi', profile: { audience: 'household' } }).success).toBe(false);
  });
});

describe('PlanSchema', () => {
  const plan = {
    summary: 'Air is poor.',
    healthAlert: 'Limit outdoor time.',
    timingAdvice: 'Go out around 3 pm.',
    routines: [{ title: 'Stay in', when: 'morning', detail: 'Windows closed.', whyItHelps: 'Less exposure.' }],
    indoorHacks: [{ title: 'Purifier', detail: 'Run it.', cost: 'medium', whyItHelps: 'Cleans air.' }],
    sustainableAlternatives: [{ title: 'Metro', detail: 'Ride it.', whyItHelps: 'Fewer cars.' }],
    impactExplanations: [{ choice: 'Metro', effect: 'Fewer cars.' }],
  };

  it('accepts a complete plan', () => {
    expect(PlanSchema.safeParse(plan).success).toBe(true);
  });

  it('rejects a plan without timing advice or with an empty list', () => {
    const { timingAdvice: _t, ...missing } = plan;
    expect(PlanSchema.safeParse(missing).success).toBe(false);
    expect(PlanSchema.safeParse({ ...plan, routines: [] }).success).toBe(false);
  });
});

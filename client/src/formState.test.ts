import { describe, expect, it } from 'vitest';
import { DEFAULT_FORM, describeIssues, toProfile } from './formState';

describe('toProfile', () => {
  it('turns the default household form into a valid profile', () => {
    const result = toProfile(DEFAULT_FORM);
    expect(result).toMatchObject({ ok: true, profile: { audience: 'household', city: 'Delhi', adults: 2 } });
  });

  it('builds a community profile, with device coordinates and an AQI override when given', () => {
    const result = toProfile({ ...DEFAULT_FORM, audience: 'community', coords: { latitude: 28.61, longitude: 77.2 }, aqiOverride: '150' });
    expect(result).toMatchObject({
      ok: true,
      profile: { audience: 'community', members: 200, latitude: 28.61, longitude: 77.2, aqiOverride: 150 },
    });
  });

  it('reports problems with friendly field names', () => {
    const result = toProfile({ ...DEFAULT_FORM, adults: 0 });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('Adults');
  });

  it('falls back to the raw path for fields without a label', () => {
    expect(describeIssues([{ code: 'custom', path: ['mystery'], message: 'bad' }])).toBe('mystery: bad');
  });
});

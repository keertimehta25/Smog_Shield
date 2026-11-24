import { describe, expect, it, vi } from 'vitest';
import { community, household } from '../../shared/fixtures';
import { advice } from '../fixtures';
import type { AiService } from './aiService';
import { CachedAiService, planKey } from './cachedAiService';
import { RuleBasedService } from './ruleBasedService';

const stub = () => {
  const inner: AiService = {
    name: 'gemini',
    generatePlan: vi.fn(async (ctx) => new RuleBasedService().generatePlan(ctx)),
    chat: vi.fn(async () => 'answer'),
  };
  return inner;
};

describe('planKey', () => {
  it('ignores the fetch time but notices any change to the household or the air', () => {
    const a = advice();
    expect(planKey(a)).toBe(planKey({ ...a, air: { ...a.air, fetchedAt: 'later' } }));
    expect(planKey(a)).not.toBe(planKey(advice(household({ children: 2 }))));
    expect(planKey(a)).not.toBe(planKey(advice(household(), { air: { usAqi: 300 } })));
  });
});

describe('CachedAiService', () => {
  it('reuses a plan for the same request, and reports the wrapped advisor name', async () => {
    const inner = stub();
    const cached = new CachedAiService(inner);
    expect(cached.name).toBe('gemini');
    const first = await cached.generatePlan(advice());
    expect(await cached.generatePlan(advice())).toBe(first);
    expect(inner.generatePlan).toHaveBeenCalledTimes(1);
    await cached.generatePlan(advice(community()));
    expect(inner.generatePlan).toHaveBeenCalledTimes(2);
  });

  it('shares one model call between requests that arrive at the same time', async () => {
    const inner = stub();
    const cached = new CachedAiService(inner);
    await Promise.all([cached.generatePlan(advice()), cached.generatePlan(advice())]);
    expect(inner.generatePlan).toHaveBeenCalledTimes(1);
  });

  it('asks again after the time limit', async () => {
    let time = 0;
    const inner = stub();
    const cached = new CachedAiService(inner, { ttlMs: 1000, now: () => time });
    await cached.generatePlan(advice());
    time = 999;
    await cached.generatePlan(advice());
    expect(inner.generatePlan).toHaveBeenCalledTimes(1);
    time = 1000;
    await cached.generatePlan(advice());
    expect(inner.generatePlan).toHaveBeenCalledTimes(2);
  });

  it('does not keep failures', async () => {
    const inner = stub();
    vi.mocked(inner.generatePlan).mockRejectedValueOnce(new Error('down'));
    const cached = new CachedAiService(inner);
    await expect(cached.generatePlan(advice())).rejects.toThrow('down');
    await cached.generatePlan(advice());
    expect(inner.generatePlan).toHaveBeenCalledTimes(2);
  });

  it('drops the oldest plan when full', async () => {
    const inner = stub();
    const cached = new CachedAiService(inner, { maxEntries: 1 });
    await cached.generatePlan(advice(household({ children: 1 })));
    await cached.generatePlan(advice(household({ children: 2 })));
    await cached.generatePlan(advice(household({ children: 1 })));
    expect(inner.generatePlan).toHaveBeenCalledTimes(3);
  });

  it('never caches chat answers', async () => {
    const inner = stub();
    const cached = new CachedAiService(inner);
    await cached.chat(advice(), 'hi');
    await cached.chat(advice(), 'hi');
    expect(inner.chat).toHaveBeenCalledTimes(2);
  });
});

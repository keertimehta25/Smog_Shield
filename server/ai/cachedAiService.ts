import { createHash } from 'node:crypto';
import type { Plan } from '../../shared/schemas';
import type { AdviceContext, AiService } from './aiService';

export interface AiCacheOptions {
  /** How long a plan is reused, in milliseconds. */
  ttlMs?: number;
  /** The most plans remembered at once; the oldest is dropped first. */
  maxEntries?: number;
  now?: () => number;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 100;

/** Same household, same air, same forecast: same key. The fetch time is left out because it never changes the advice. */
export function planKey(ctx: AdviceContext): string {
  const { fetchedAt: _ignored, ...air } = ctx.air;
  return createHash('sha256')
    .update(JSON.stringify({ ...ctx, air }))
    .digest('hex');
}

/**
 * Decorator: identical plan requests within a few minutes reuse one model call, which saves latency and
 * API quota. Requests that arrive while the first is still running share its answer. Failures are not
 * kept, so the next request tries again. Chat answers are never cached because each question differs.
 */
export class CachedAiService implements AiService {
  private readonly entries = new Map<string, { at: number; plan: Promise<Plan> }>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(
    private readonly inner: AiService,
    options: AiCacheOptions = {},
  ) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.now = options.now ?? Date.now;
  }

  get name(): AiService['name'] {
    return this.inner.name;
  }

  generatePlan(ctx: AdviceContext): Promise<Plan> {
    const key = planKey(ctx);
    const hit = this.entries.get(key);
    if (hit && this.now() - hit.at < this.ttlMs) return hit.plan;

    const plan = this.inner.generatePlan(ctx);
    this.entries.delete(key);
    this.entries.set(key, { at: this.now(), plan });
    if (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value as string);
    plan.catch(() => this.entries.delete(key));
    return plan;
  }

  chat(ctx: AdviceContext, message: string): Promise<string> {
    return this.inner.chat(ctx, message);
  }
}

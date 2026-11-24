import { describe, expect, it, vi } from 'vitest';
import { FatalAiError, withFailover } from './failover';

const options = { budgetMs: 1000 };

describe('withFailover', () => {
  it('returns the first success without trying the rest', async () => {
    const attempt = vi.fn(async (model: string) => `ok:${model}`);
    await expect(withFailover(['a', 'b'], attempt, options)).resolves.toBe('ok:a');
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('moves to the next model when one fails', async () => {
    const attempt = vi.fn(async (model: string) => {
      if (model === 'a') throw new Error('404 not found');
      return `ok:${model}`;
    });
    await expect(withFailover(['a', 'b', 'c'], attempt, options)).resolves.toBe('ok:b');
    expect(attempt.mock.calls.map((c) => c[0])).toEqual(['a', 'b']);
  });

  it('stops at once on a fatal error such as a rejected key', async () => {
    const attempt = vi.fn(async () => {
      throw new FatalAiError('API key not valid');
    });
    await expect(withFailover(['a', 'b'], attempt, options)).rejects.toThrow(FatalAiError);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('explains every failure when all models fail, including non-Error rejections', async () => {
    const attempt = vi.fn(async (model: string) => {
      if (model === 'a') throw new Error('overloaded');
      throw 'plain text failure';
    });
    await expect(withFailover(['a', 'b'], attempt, options)).rejects.toThrow(
      'All Gemini models failed (a: overloaded; b: plain text failure)',
    );
  });

  it('shortens very long error messages', async () => {
    const attempt = vi.fn(async () => {
      throw new Error('x'.repeat(500));
    });
    const error = await withFailover(['a'], attempt, options).catch((e: Error) => e);
    expect((error as Error).message.length).toBeLessThan(260);
    expect((error as Error).message).toContain('…');
  });

  it('stops trying new models once the time budget is used, but always tries the first', async () => {
    let time = 0;
    const attempt = vi.fn(async () => {
      time += 50;
      throw new Error('slow');
    });
    await expect(withFailover(['a', 'b', 'c'], attempt, { budgetMs: 10, now: () => time })).rejects.toThrow('a: slow; time budget used up');
    expect(attempt).toHaveBeenCalledTimes(1);
    time = 0;
    await expect(withFailover(['a'], attempt, { budgetMs: 0, now: () => time })).rejects.toThrow('a: slow');
  });

  it('reports a clear error when no model is configured, and uses the real clock by default', async () => {
    await expect(withFailover([], async () => 'x', options)).rejects.toThrow('All Gemini models failed (none configured)');
    await expect(withFailover(['a'], async () => 'fine', { budgetMs: 5 })).resolves.toBe('fine');
  });
});

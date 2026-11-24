/** An error that trying another model cannot fix, such as a rejected API key. */
export class FatalAiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FatalAiError';
  }
}

export interface FailoverOptions {
  /** After this many milliseconds no further model is tried (the first model is always tried). */
  budgetMs: number;
  now?: () => number;
}

const shorten = (text: string, max = 160) => (text.length > max ? `${text.slice(0, max)}…` : text);

/**
 * Tries each model in order and returns the first success. Models can be retired, overloaded or
 * rate-limited at any time, so a single bad name must not take the AI feature down.
 * Fatal errors (a bad key) stop immediately. If every model fails, one error lists why each did.
 */
export async function withFailover<T>(
  models: readonly string[],
  attempt: (model: string) => Promise<T>,
  options: FailoverOptions,
): Promise<T> {
  const now = options.now ?? Date.now;
  const started = now();
  const failures: string[] = [];
  for (const [index, model] of models.entries()) {
    if (index > 0 && now() - started >= options.budgetMs) {
      failures.push('time budget used up');
      break;
    }
    try {
      return await attempt(model);
    } catch (error) {
      if (error instanceof FatalAiError) throw error;
      failures.push(`${model}: ${shorten(error instanceof Error ? error.message : String(error))}`);
    }
  }
  throw new Error(`All Gemini models failed (${failures.join('; ') || 'none configured'})`);
}

import { PlanSchema, type Plan } from '../../shared/schemas';
import type { AdviceContext, AiService } from './aiService';
import { buildFacts } from './facts';
import { FatalAiError, withFailover } from './failover';
import { allowedNumbers, assertNoInventedNumbers } from './numberFirewall';
import { chatPrompt, planPrompt } from './prompt';

export interface GeminiConfig {
  apiKey: string;
  /** Per-request timeout in milliseconds. */
  timeoutMs: number;
  /** Injectable for tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

/** Google's own explanation of a failed request (for example "model not found"), shortened for logs. */
async function errorDetail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    return body.error?.message?.slice(0, 200) ?? '';
  } catch {
    return '';
  }
}

/** Thin client around the Gemini generateContent REST endpoint. One call, one model. */
export class GeminiClient {
  constructor(private readonly config: GeminiConfig) {}

  async generate(prompt: string, json: boolean, model: string): Promise<string> {
    const doFetch = this.config.fetchImpl ?? fetch;
    // Accept "models/gemini-x" as copied from Google's model list; the URL already contains "/models/".
    const name = model.trim().replace(/^models\//, '');
    const res = await doFetch(`${ENDPOINT}/${encodeURIComponent(name)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': this.config.apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, ...(json ? { responseMimeType: 'application/json' } : {}) },
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });
    if (!res.ok) {
      const detail = await errorDetail(res);
      const message = `Gemini request failed with status ${res.status}${detail ? `: ${detail}` : ''}`;
      // A rejected or unauthorised key will fail on every model, so stop instead of trying the rest.
      if (res.status === 401 || res.status === 403) throw new FatalAiError(message);
      throw new Error(message);
    }
    const data = (await res.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text.trim()) throw new Error('Gemini returned an empty response');
    return text;
  }
}

export interface GeminiServiceOptions {
  /** Models to try in order. */
  models: readonly string[];
  /** Total time allowed across all models before giving up on the rest. */
  budgetMs?: number;
  now?: () => number;
}

const DEFAULT_BUDGET_MS = 45_000;

/**
 * Gemini-backed advisor. Every reply is validated before it is trusted: plans must match PlanSchema,
 * and neither plans nor chat answers may quote a figure that is not in the data we supplied.
 */
export class GeminiService implements AiService {
  readonly name = 'gemini' as const;

  constructor(
    private readonly client: GeminiClient,
    private readonly options: GeminiServiceOptions,
  ) {}

  private run<T>(attempt: (model: string) => Promise<T>): Promise<T> {
    return withFailover(this.options.models, attempt, { budgetMs: this.options.budgetMs ?? DEFAULT_BUDGET_MS, now: this.options.now });
  }

  generatePlan(ctx: AdviceContext): Promise<Plan> {
    const prompt = planPrompt(ctx);
    const allowed = allowedNumbers(buildFacts(ctx));
    return this.run(async (model) => {
      const plan = PlanSchema.parse(JSON.parse(await this.client.generate(prompt, true, model)));
      assertNoInventedNumbers(JSON.stringify(plan), allowed);
      return plan;
    });
  }

  chat(ctx: AdviceContext, message: string): Promise<string> {
    const prompt = chatPrompt(ctx, message);
    const allowed = allowedNumbers(buildFacts(ctx));
    return this.run(async (model) => {
      const reply = (await this.client.generate(prompt, false, model)).trim();
      assertNoInventedNumbers(reply, allowed);
      return reply;
    });
  }
}

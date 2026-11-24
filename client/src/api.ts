import type { PlanResponse, Profile } from '../../shared/schemas';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(data.error ?? 'Request failed. Please try again.');
  return data;
}

export const fetchPlan = (profile: Profile, signal?: AbortSignal) => post<PlanResponse>('/api/plan', profile, signal);

export const askQuestion = (message: string, profile: Profile, signal?: AbortSignal) =>
  post<{ reply: string; advisor: string }>('/api/chat', { message, profile }, signal);

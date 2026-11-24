// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { household } from '../../shared/fixtures';

const okJson = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

const profile = household();

describe('client api', () => {
  it('posts the profile to /api/plan and returns the JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ aiSource: 'rules' }));
    vi.stubGlobal('fetch', fetchMock);
    const { fetchPlan } = await import('./api');
    const data = await fetchPlan(profile);
    expect(data).toEqual({ aiSource: 'rules' });
    expect(fetchMock).toHaveBeenCalledWith('/api/plan', expect.objectContaining({ method: 'POST' }));
  });

  it('posts questions to /api/chat', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ reply: 'Wear a mask', advisor: 'rules' }));
    vi.stubGlobal('fetch', fetchMock);
    const { askQuestion } = await import('./api');
    expect((await askQuestion('mask?', profile)).reply).toBe('Wear a mask');
    const body = JSON.parse(String((fetchMock.mock.calls[0]![1] as RequestInit).body));
    expect(body.message).toBe('mask?');
  });

  it('uses VITE_API_URL as a prefix when it is set', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.com');
    const fetchMock = vi.fn().mockResolvedValue(okJson({}));
    vi.stubGlobal('fetch', fetchMock);
    const { fetchPlan } = await import('./api');
    await fetchPlan(profile);
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.example.com/api/plan');
  });

  it('throws the server error message when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ error: 'City not found' }, 502)));
    const { fetchPlan } = await import('./api');
    await expect(fetchPlan(profile)).rejects.toThrow('City not found');
  });

  it('falls back to a generic message when the error body is not JSON or has no message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>oops</html>', { status: 500 })));
    const { fetchPlan } = await import('./api');
    await expect(fetchPlan(profile)).rejects.toThrow('Request failed. Please try again.');
  });
});

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { PlanResponse } from '../../shared/schemas';
import { askQuestion, fetchPlan } from './api';
import { Results } from './components/Results';
import { ProfileForm } from './components/ProfileForm';
import { DEFAULT_FORM, toProfile, type FormState } from './formState';
import { getDeviceLocation } from './location';

export function App() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [result, setResult] = useState<PlanResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (result) resultsRef.current?.focus();
  }, [result]);

  const update = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  async function onLocate() {
    setLocating(true);
    setLocationNote('');
    try {
      const coords = await getDeviceLocation(navigator.geolocation);
      update({ coords, city: 'Your location' });
    } catch (err) {
      setLocationNote((err as Error).message);
    } finally {
      setLocating(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const parsed = toProfile(form);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    try {
      setResult(await fetchPlan(parsed.profile, abortRef.current.signal));
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function ask(question: string): Promise<string | null> {
    setError('');
    const parsed = toProfile(form);
    if (!parsed.ok) {
      setError(parsed.error);
      return null;
    }
    return (await askQuestion(question, parsed.profile)).reply;
  }

  return (
    <>
      <a className="skip" href="#main">
        Skip to main content
      </a>
      <header className="hero">
        <h1>Smog Shield: clean-air plans for families and communities</h1>
        <p>
          Tell us about your home, or your housing society, school or neighbourhood. We check live air quality and the next 24 hours, then
          give you practical steps, with a clear explanation and the working behind every number.
        </p>
      </header>

      <main id="main">
        <ProfileForm
          form={form}
          onChange={update}
          onSubmit={onSubmit}
          onLocate={onLocate}
          locating={locating}
          locationNote={locationNote}
          loading={loading}
        />

        <div role="alert" aria-live="assertive">
          {error && <p className="error">{error}</p>}
        </div>

        <div aria-live="polite" ref={resultsRef} tabIndex={-1} className="results">
          {result && <Results result={result} ask={ask} onError={setError} />}
        </div>
      </main>
    </>
  );
}

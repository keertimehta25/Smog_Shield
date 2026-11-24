import type { PlanResponse } from '../../../shared/schemas';

export function AirCard({ result }: { result: PlanResponse }) {
  const { air, category, risk, plan } = result;
  const who = result.audience === 'household' ? 'Household' : 'Group';
  return (
    <section className={`card level-${category.level}`} aria-labelledby="h-air">
      <h2 id="h-air">Air today in {air.city}</h2>
      <p className="aqi">
        <span className="aqi-number">{air.usAqi}</span> US AQI: <strong>{category.label}</strong>
      </p>
      <p>{plan.summary}</p>
      <p>
        <strong>Health note:</strong> {plan.healthAlert}
      </p>
      <label htmlFor="risk">
        {who} exposure risk: {risk.label} ({risk.score}/100)
      </label>
      <progress id="risk" max={100} value={risk.score} />
      <p className="hint">
        Data source: {air.source === 'open-meteo' ? 'Open-Meteo live air quality' : 'the AQI you entered'}. Advice written by{' '}
        {result.aiSource === 'gemini' ? 'Google Gemini' : 'our built-in rule-based advisor'}.
      </p>
    </section>
  );
}

import type { Plan } from '../../../shared/schemas';
import { Section } from './fields';

export function PlanSections({ plan }: { plan: Plan }) {
  return (
    <>
      <Section title="Your daily low-emission routine">
        <ul className="items">
          {plan.routines.map((r) => (
            <li key={r.title}>
              <h3>
                {r.title} <span className="tag">{r.when}</span>
              </h3>
              <p>{r.detail}</p>
              <p className="why">Why it helps: {r.whyItHelps}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Indoor air quality hacks">
        <ul className="items">
          {plan.indoorHacks.map((h) => (
            <li key={h.title}>
              <h3>
                {h.title} <span className="tag">cost: {h.cost}</span>
              </h3>
              <p>{h.detail}</p>
              <p className="why">Why it helps: {h.whyItHelps}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Sustainable alternatives">
        <ul className="items">
          {plan.sustainableAlternatives.map((a) => (
            <li key={a.title}>
              <h3>{a.title}</h3>
              <p>{a.detail}</p>
              <p className="why">Why it helps: {a.whyItHelps}</p>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

import type { Impact } from '../../../shared/impact/types';
import type { PlanResponse } from '../../../shared/schemas';
import { Section } from './fields';

const KIND_LABEL = { published: 'Published figure', assumption: 'Assumption' } as const;

function Maths({ impact }: { impact: Impact }) {
  return (
    <details>
      <summary>
        {impact.title}: <strong>{impact.value}</strong> {impact.unit}
      </summary>
      <p>
        <strong>Calculation:</strong> <code>{impact.formula}</code>
      </p>
      <ul className="factors">
        {impact.factors.map((factor) => (
          <li key={factor.id}>
            <span className={`badge ${factor.kind}`}>{KIND_LABEL[factor.kind]}</span> {factor.label}: {factor.value} {factor.unit}.{' '}
            <span className="why">{factor.source}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** What each choice changes, in words and in numbers, with every number's working shown. */
export function ImpactSection({ result }: { result: PlanResponse }) {
  const { totals, impacts, plan, audience } = result;
  const quantified = impacts.filter((i) => i.metric !== 'qualitative');
  const scope = audience === 'household' ? 'for you' : 'across the whole group';
  return (
    <Section title="The direct impact of your choices">
      {totals.pm25UgPerDay > 0 && (
        <p>
          Together, the air changes below could keep about <strong>{totals.pm25UgPerDay} µg of fine particles (PM2.5)</strong> out of the
          lungs of the people they cover each day, {scope} (estimate).
        </p>
      )}
      {totals.co2eKgPerMonth > 0 && (
        <p>
          The transport changes could save about <strong>{totals.co2eKgPerMonth} kg of CO2e per month</strong> (estimate; alternatives such
          as metro or carpool are not added together).
        </p>
      )}
      <table>
        <caption className="sr-only">Estimated effect of each suggested change</caption>
        <thead>
          <tr>
            <th scope="col">Choice</th>
            <th scope="col">Estimated effect</th>
          </tr>
        </thead>
        <tbody>
          {plan.impactExplanations.map((i) => (
            <tr key={i.choice}>
              <th scope="row">{i.choice}</th>
              <td>{i.effect}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {quantified.length > 0 && (
        <>
          <h3>Show the maths</h3>
          <p className="hint">
            Every number is worked out by tested code, not written by the AI. Each factor says whether it is a published figure or our
            assumption.
          </p>
          {quantified.map((impact) => (
            <Maths key={impact.id} impact={impact} />
          ))}
        </>
      )}
      <p className="hint">Estimates use typical values and are meant for guidance, not exact measurement.</p>
    </Section>
  );
}

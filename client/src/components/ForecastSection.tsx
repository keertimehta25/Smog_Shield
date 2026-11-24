import { categorizeAqi } from '../../../shared/aqi';
import { hourLabel } from '../../../shared/forecast';
import type { HourPoint, PlanResponse } from '../../../shared/schemas';
import { Section } from './fields';

const describeHour = (hour: HourPoint) => `${hourLabel(hour.time)} (US AQI ${hour.usAqi}, ${categorizeAqi(hour.usAqi).label})`;

/** When to go out: the cleanest and worst hour of the next 24, with the full hourly table one click away. */
export function ForecastSection({ result }: { result: PlanResponse }) {
  const { forecast, plan } = result;
  return (
    <Section title="Best time to go out">
      <p>{plan.timingAdvice}</p>
      {forecast && (
        <>
          <ul className="hours-summary">
            <li>
              <strong>Cleanest hour:</strong> {describeHour(forecast.cleanest)}
            </li>
            <li>
              <strong>Worst hour:</strong> {describeHour(forecast.worst)}
            </li>
          </ul>
          <details>
            <summary>Show all {forecast.hours.length} hours</summary>
            <table>
              <caption className="sr-only">US AQI for each of the next {forecast.hours.length} hours</caption>
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">US AQI</th>
                  <th scope="col">Level</th>
                </tr>
              </thead>
              <tbody>
                {forecast.hours.map((hour) => (
                  <tr key={hour.time}>
                    <th scope="row">{hourLabel(hour.time)}</th>
                    <td>{hour.usAqi}</td>
                    <td>{categorizeAqi(hour.usAqi).label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </Section>
  );
}

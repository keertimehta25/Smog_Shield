import type { PlanResponse } from '../../../shared/schemas';
import { AirCard } from './AirCard';
import { ChatSection } from './ChatSection';
import { ForecastSection } from './ForecastSection';
import { ImpactSection } from './ImpactSection';
import { PlanSections } from './PlanSections';

interface ResultsProps {
  result: PlanResponse;
  ask: (question: string) => Promise<string | null>;
  onError: (message: string) => void;
}

export function Results({ result, ask, onError }: ResultsProps) {
  return (
    <>
      <AirCard result={result} />
      <ForecastSection result={result} />
      <PlanSections plan={result.plan} />
      <ImpactSection result={result} />
      <ChatSection ask={ask} onError={onError} />
      <p className="hint disclaimer">
        This tool gives general guidance, not medical advice. If you or a family member has trouble breathing, chest pain or severe
        symptoms, contact a doctor or emergency services.
      </p>
    </>
  );
}

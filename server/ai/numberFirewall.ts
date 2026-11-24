/** Units that turn a bare number into a factual claim: "40%", "12 kg", "168 µg". */
const CLAIM = /(\d+(?:\.\d+)?)\s?(?:%|kg\b|µg|ug\b|g\b)/gi;

/** Guideline numbers a reply may quote even though they are not in the data (the N95 test standard). */
const GENERAL_KNOWLEDGE = [95];

const stripThousands = (text: string) => text.replace(/(\d),(?=\d{3}(?!\d))/g, '$1');

/** Every number that appears in the facts the model was given, plus percent forms of fractions (0.6 is 60%). */
export function allowedNumbers(facts: string): number[] {
  const found = (stripThousands(facts).match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  const percents = found.filter((n) => n > 0 && n <= 1).map((n) => Math.round(n * 100));
  return [...found, ...percents, ...GENERAL_KNOWLEDGE];
}

/**
 * A claim must be a figure from the facts, or that figure rounded to a whole number or one decimal
 * (2657.6 may be written 2658). Looser matching would let an invented 73% pass because 70 is in the data.
 */
const matches = (claimed: number, allowed: number) => Math.abs(claimed - allowed) < 0.051 || claimed === Math.round(allowed);

/** Claims with units (%, kg, µg, g) whose number is not in the facts. */
export function findInventedNumbers(text: string, allowed: number[]): string[] {
  const invented: string[] = [];
  for (const match of stripThousands(text).matchAll(CLAIM)) {
    const claimed = Number(match[1]);
    if (!allowed.some((a) => matches(claimed, a))) invented.push(match[0].trim());
  }
  return invented;
}

export class InventedNumberError extends Error {
  constructor(readonly claims: string[]) {
    super(`The model quoted figures that were not in the data: ${claims.join(', ')}`);
    this.name = 'InventedNumberError';
  }
}

/**
 * The model explains; the engine computes. A reply that states a figure the engine never produced
 * is rejected, so the app can never present an AI-invented statistic as fact.
 */
export function assertNoInventedNumbers(text: string, allowed: number[]): void {
  const invented = findInventedNumbers(text, allowed);
  if (invented.length) throw new InventedNumberError(invented);
}

import type { ForecastSummary } from '../forecast';
import type { CommunityProfile, HouseholdProfile } from '../schemas';

/** "published" means the number is taken from a named public standard; "assumption" means we chose it. */
export type FactorKind = 'published' | 'assumption';

export interface Factor {
  id: string;
  label: string;
  value: number;
  unit: string;
  kind: FactorKind;
  /** Where the number comes from, or why we chose it. */
  source: string;
}

export type ImpactMetric = 'pm25_ug_per_day' | 'co2e_kg_per_month' | 'qualitative';

/** One suggested change and what it does, with the arithmetic written out so it can be checked. */
export interface Impact {
  id: string;
  title: string;
  metric: ImpactMetric;
  /** Null for choices we explain but do not put a number on. */
  value: number | null;
  /** Says exactly who or what the value covers, for example "per person" or "across the whole group". */
  unit: string;
  formula: string;
  factors: Factor[];
  exposureEffect: string;
  /** False when the value is per person and cannot be added to group totals. */
  countsInTotal: boolean;
  /** Impacts that share a group are alternatives, so only the largest counts towards the total. */
  exclusiveGroup?: string;
}

export interface Totals {
  pm25UgPerDay: number;
  co2eKgPerMonth: number;
}

interface BaseContext {
  /** PM2.5 in µg/m³: measured, or converted from the AQI when no measurement exists. */
  pm25: number;
  pm25Source: 'measured' | 'converted';
  forecast: ForecastSummary | null;
}

export interface HouseholdContext extends BaseContext {
  profile: HouseholdProfile;
}

export interface CommunityContext extends BaseContext {
  profile: CommunityProfile;
}

export type Context = HouseholdContext | CommunityContext;

/** Open/closed: a new kind of advice is a new entry in a registry; nothing else changes. */
export interface Strategy<C extends Context> {
  id: string;
  applies(ctx: C): boolean;
  build(ctx: C): Impact;
}

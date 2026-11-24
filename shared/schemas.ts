import { z } from 'zod';
import type { ForecastSummary } from './forecast';
import type { Impact, Totals } from './impact/types';

export const COMMUTE_MODES = ['car', 'motorbike', 'bus', 'metro', 'bike', 'walk', 'wfh'] as const;
export const COOKING_FUELS = ['lpg', 'induction', 'electric', 'biomass'] as const;
export const HEATING_TYPES = ['none', 'electric', 'gas', 'biomass'] as const;
export const GROUP_TYPES = ['housing-society', 'school', 'neighbourhood'] as const;

export type CommuteMode = (typeof COMMUTE_MODES)[number];
export type CookingFuel = (typeof COOKING_FUELS)[number];
export type HeatingType = (typeof HEATING_TYPES)[number];
export type GroupType = (typeof GROUP_TYPES)[number];

/** Letters, numbers, spaces and a few punctuation marks only: keeps free text out of prompts. */
const CITY_PATTERN = /^[\p{L}\p{N} .,'-]+$/u;

/** Fields every request shares: where the people are, and an optional manual AQI. */
const locationFields = {
  /** A city name, or a PIN/ZIP code. When device coordinates are given this is only a display label. */
  city: z.string().trim().min(2).max(80).regex(CITY_PATTERN, 'City contains unsupported characters'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  /** Optional manual US AQI (0-500), used when live data is unavailable. */
  aqiOverride: z.number().min(0).max(500).optional(),
};

export const HouseholdSchema = z.object({
  audience: z.literal('household'),
  ...locationFields,
  adults: z.number().int().min(1).max(20),
  children: z.number().int().min(0).max(20),
  seniors: z.number().int().min(0).max(20),
  respiratoryCondition: z.boolean(),
  commuteMode: z.enum(COMMUTE_MODES),
  commuteKm: z.number().min(0).max(200),
  cooking: z.enum(COOKING_FUELS),
  heating: z.enum(HEATING_TYPES),
  hasPurifier: z.boolean(),
});

export const CommunitySchema = z.object({
  audience: z.literal('community'),
  ...locationFields,
  groupType: z.enum(GROUP_TYPES),
  members: z.number().int().min(5).max(50_000),
  /** Share of members who drive to work or school, 0-100. */
  drivingSharePercent: z.number().int().min(0).max(100),
  /** Typical one-way distance of those drives. */
  commuteKm: z.number().min(0).max(200),
  hasCleanAirRoom: z.boolean(),
});

export const ProfileSchema = z.discriminatedUnion('audience', [HouseholdSchema, CommunitySchema]).superRefine((profile, ctx) => {
  if ((profile.latitude === undefined) !== (profile.longitude === undefined)) {
    ctx.addIssue({ code: 'custom', path: ['latitude'], message: 'Latitude and longitude must be given together' });
  }
});

export type Profile = z.infer<typeof ProfileSchema>;
export type HouseholdProfile = z.infer<typeof HouseholdSchema>;
export type CommunityProfile = z.infer<typeof CommunitySchema>;

export const ChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(500),
  profile: ProfileSchema,
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

const Text = z.string().trim().min(1).max(600);

export const PlanSchema = z.object({
  summary: Text,
  healthAlert: Text,
  /** When to go out, based on the next 24 hours of air quality. */
  timingAdvice: Text,
  routines: z
    .array(z.object({ title: Text, when: z.enum(['morning', 'daytime', 'evening', 'night']), detail: Text, whyItHelps: Text }))
    .min(1)
    .max(8),
  indoorHacks: z
    .array(z.object({ title: Text, detail: Text, cost: z.enum(['free', 'low', 'medium']), whyItHelps: Text }))
    .min(1)
    .max(8),
  sustainableAlternatives: z
    .array(z.object({ title: Text, detail: Text, whyItHelps: Text }))
    .min(1)
    .max(6),
  impactExplanations: z
    .array(z.object({ choice: Text, effect: Text }))
    .min(1)
    .max(10),
});
export type Plan = z.infer<typeof PlanSchema>;

export interface HourPoint {
  /** Local time of the place, as "YYYY-MM-DDTHH:MM". */
  time: string;
  usAqi: number;
  pm25: number | null;
}

export interface AirQuality {
  city: string;
  country?: string;
  usAqi: number;
  pm25?: number;
  pm10?: number;
  /** The next hours, when the data source provides them. */
  forecast?: HourPoint[];
  source: 'open-meteo' | 'user-provided';
  fetchedAt: string;
}

export interface PlanResponse {
  audience: Profile['audience'];
  air: AirQuality;
  category: { label: string; level: number; advice: string };
  risk: { score: number; label: string };
  forecast: ForecastSummary | null;
  impacts: Impact[];
  totals: Totals;
  plan: Plan;
  aiSource: 'gemini' | 'rules';
}

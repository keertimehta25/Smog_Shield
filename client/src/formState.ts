import type { ZodIssue } from 'zod';
import { ProfileSchema, type Profile } from '../../shared/schemas';
import { FIELD_LABELS } from './labels';
import type { Coordinates } from './location';

export type Audience = 'household' | 'community';

/** Everything the form holds. Selects are plain strings until the schema checks them on submit. */
export interface FormState {
  audience: Audience;
  city: string;
  coords: Coordinates | null;
  aqiOverride: string;
  commuteKm: number;
  // household
  adults: number;
  children: number;
  seniors: number;
  respiratoryCondition: boolean;
  commuteMode: string;
  cooking: string;
  heating: string;
  hasPurifier: boolean;
  // community
  groupType: string;
  members: number;
  drivingSharePercent: number;
  hasCleanAirRoom: boolean;
}

export const DEFAULT_FORM: FormState = {
  audience: 'household',
  city: 'Delhi',
  coords: null,
  aqiOverride: '',
  commuteKm: 12,
  adults: 2,
  children: 1,
  seniors: 0,
  respiratoryCondition: false,
  commuteMode: 'car',
  cooking: 'lpg',
  heating: 'none',
  hasPurifier: false,
  groupType: 'housing-society',
  members: 200,
  drivingSharePercent: 40,
  hasCleanAirRoom: false,
};

/** "Adults: Number must be greater than or equal to 1". Unknown fields fall back to their path. */
export function describeIssues(issues: ZodIssue[]): string {
  return issues
    .map((issue) => {
      const path = issue.path.join('.');
      return `${FIELD_LABELS[path] ?? path}: ${issue.message}`;
    })
    .join('. ');
}

export type ProfileResult = { ok: true; profile: Profile } | { ok: false; error: string };

/** Turns the form into a request, using the same schema the server enforces. */
export function toProfile(form: FormState): ProfileResult {
  const common = {
    city: form.city,
    latitude: form.coords?.latitude,
    longitude: form.coords?.longitude,
    aqiOverride: form.aqiOverride === '' ? undefined : Number(form.aqiOverride),
    commuteKm: form.commuteKm,
  };
  const candidate =
    form.audience === 'household'
      ? {
          audience: 'household',
          ...common,
          adults: form.adults,
          children: form.children,
          seniors: form.seniors,
          respiratoryCondition: form.respiratoryCondition,
          commuteMode: form.commuteMode,
          cooking: form.cooking,
          heating: form.heating,
          hasPurifier: form.hasPurifier,
        }
      : {
          audience: 'community',
          ...common,
          groupType: form.groupType,
          members: form.members,
          drivingSharePercent: form.drivingSharePercent,
          hasCleanAirRoom: form.hasCleanAirRoom,
        };
  const parsed = ProfileSchema.safeParse(candidate);
  return parsed.success ? { ok: true, profile: parsed.data } : { ok: false, error: describeIssues(parsed.error.issues) };
}

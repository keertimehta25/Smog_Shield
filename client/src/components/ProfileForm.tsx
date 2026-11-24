import type { FormEvent } from 'react';
import { COMMUTE_MODES, COOKING_FUELS, GROUP_TYPES, HEATING_TYPES } from '../../../shared/schemas';
import type { FormState } from '../formState';
import { CheckField, Field, NumberField, SelectField } from './fields';

export interface ProfileFormProps {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  onSubmit: (event: FormEvent) => void;
  onLocate: () => void;
  locating: boolean;
  /** A status or error message about device location, announced politely. */
  locationNote: string;
  loading: boolean;
}

function ModeToggle({ form, onChange }: Pick<ProfileFormProps, 'form' | 'onChange'>) {
  return (
    <fieldset className="mode">
      <legend>Who is this plan for?</legend>
      <label className="check">
        <input type="radio" name="audience" checked={form.audience === 'household'} onChange={() => onChange({ audience: 'household' })} />
        My household
      </label>
      <label className="check">
        <input type="radio" name="audience" checked={form.audience === 'community'} onChange={() => onChange({ audience: 'community' })} />A
        community group (housing society, school or neighbourhood)
      </label>
    </fieldset>
  );
}

function LocationFields({ form, onChange, onLocate, locating, locationNote }: ProfileFormProps) {
  return (
    <div className="grid">
      <Field id="city" label="City or PIN code" hint="We look up live air quality for this place.">
        {(aria) => (
          <input
            {...aria}
            value={form.city}
            onChange={(e) => onChange({ city: e.target.value, coords: null })}
            autoComplete="address-level2"
            required
          />
        )}
      </Field>
      <div className="field">
        <span className="label-like" id="locate-label">
          Or use your device
        </span>
        <button type="button" className="secondary" onClick={onLocate} disabled={locating} aria-describedby="locate-note">
          {locating ? 'Finding your location…' : 'Use my device location'}
        </button>
        <p className="hint" id="locate-note" aria-live="polite">
          {form.coords
            ? 'Using your device location, rounded to about 1 km. Typing a place above switches back.'
            : locationNote || 'Optional. Your position is rounded before it is used and is never stored.'}
        </p>
      </div>
      <Field id="aqiOverride" label="Today's AQI (optional)" hint="Only fill this if live data fails for your place.">
        {(aria) => (
          <input
            {...aria}
            type="number"
            min={0}
            max={500}
            value={form.aqiOverride}
            onChange={(e) => onChange({ aqiOverride: e.target.value })}
          />
        )}
      </Field>
    </div>
  );
}

function HouseholdFields({ form, onChange }: Pick<ProfileFormProps, 'form' | 'onChange'>) {
  return (
    <>
      <div className="grid">
        <NumberField id="adults" label="Adults" value={form.adults} min={1} max={20} onChange={(adults) => onChange({ adults })} />
        <NumberField
          id="children"
          label="Children"
          value={form.children}
          min={0}
          max={20}
          onChange={(children) => onChange({ children })}
        />
        <NumberField
          id="seniors"
          label="Older adults (65+)"
          value={form.seniors}
          min={0}
          max={20}
          onChange={(seniors) => onChange({ seniors })}
        />
        <SelectField
          id="commuteMode"
          label="Main way you travel to work or school"
          value={form.commuteMode}
          options={COMMUTE_MODES}
          onChange={(commuteMode) => onChange({ commuteMode })}
        />
        <NumberField
          id="commuteKm"
          label="One-way distance (km)"
          value={form.commuteKm}
          min={0}
          max={200}
          onChange={(commuteKm) => onChange({ commuteKm })}
        />
        <SelectField
          id="cooking"
          label="Cooking fuel"
          value={form.cooking}
          options={COOKING_FUELS}
          onChange={(cooking) => onChange({ cooking })}
        />
        <SelectField
          id="heating"
          label="Winter heating"
          value={form.heating}
          options={HEATING_TYPES}
          onChange={(heating) => onChange({ heating })}
        />
      </div>
      <fieldset>
        <legend>Health and home</legend>
        <CheckField
          label="Someone has asthma or another breathing or heart condition"
          checked={form.respiratoryCondition}
          onChange={(respiratoryCondition) => onChange({ respiratoryCondition })}
        />
        <CheckField
          label="We already own an air purifier"
          checked={form.hasPurifier}
          onChange={(hasPurifier) => onChange({ hasPurifier })}
        />
      </fieldset>
    </>
  );
}

function CommunityFields({ form, onChange }: Pick<ProfileFormProps, 'form' | 'onChange'>) {
  return (
    <>
      <div className="grid">
        <SelectField
          id="groupType"
          label="Type of group"
          value={form.groupType}
          options={GROUP_TYPES}
          onChange={(groupType) => onChange({ groupType })}
        />
        <NumberField
          id="members"
          label="Number of people"
          value={form.members}
          min={5}
          max={50000}
          hint="Residents, students and staff together."
          onChange={(members) => onChange({ members })}
        />
        <NumberField
          id="drivingSharePercent"
          label="Share who drive to work or school (%)"
          value={form.drivingSharePercent}
          min={0}
          max={100}
          onChange={(drivingSharePercent) => onChange({ drivingSharePercent })}
        />
        <NumberField
          id="commuteKm"
          label="Typical one-way drive (km)"
          value={form.commuteKm}
          min={0}
          max={200}
          onChange={(commuteKm) => onChange({ commuteKm })}
        />
      </div>
      <fieldset>
        <legend>Facilities</legend>
        <CheckField
          label="We already have a clean-air room with air purifiers"
          checked={form.hasCleanAirRoom}
          onChange={(hasCleanAirRoom) => onChange({ hasCleanAirRoom })}
        />
      </fieldset>
    </>
  );
}

export function ProfileForm(props: ProfileFormProps) {
  const { form, onChange, onSubmit, loading } = props;
  return (
    <form onSubmit={onSubmit} className="card" aria-labelledby="form-title" noValidate>
      <h2 id="form-title">{form.audience === 'household' ? 'About your household' : 'About your community group'}</h2>
      <ModeToggle form={form} onChange={onChange} />
      <LocationFields {...props} />
      {form.audience === 'household' ? (
        <HouseholdFields form={form} onChange={onChange} />
      ) : (
        <CommunityFields form={form} onChange={onChange} />
      )}
      <button type="submit" disabled={loading}>
        {loading ? 'Checking air and building your plan…' : 'Get my smog plan'}
      </button>
    </form>
  );
}

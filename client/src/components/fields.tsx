import type { ReactNode } from 'react';
import { LABELS } from '../labels';

export interface FieldAria {
  id: string;
  'aria-describedby'?: string;
}

/** A labelled control. The hint, when there is one, is linked to the control for screen readers. */
export function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: (aria: FieldAria) => ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children({ id, 'aria-describedby': hint ? `${id}-hint` : undefined })}
      {hint && (
        <p className="hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
}

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  hint?: string;
  onChange: (value: number) => void;
}

export function NumberField({ id, label, value, min, max, hint, onChange }: NumberFieldProps) {
  return (
    <Field id={id} label={label} hint={hint}>
      {(aria) => <input {...aria} type="number" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />}
    </Field>
  );
}

interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}

export function SelectField({ id, label, value, options, onChange }: SelectFieldProps) {
  return (
    <Field id={id} label={label}>
      {(aria) => (
        <select {...aria} value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((option) => (
            <option key={option} value={option}>
              {LABELS[option]}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/** A titled card whose heading labels the region for screen readers. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = `h-${title.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <section aria-labelledby={id} className="card">
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

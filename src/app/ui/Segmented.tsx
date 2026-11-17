'use client';

import React from 'react';
import styles from './Segmented.module.css';

// A segmented control, for a setting with a few named choices (a tier list's Label Width:
// S, M and L): a setting's row (.tierbinder-prop), its label muted at the left and the
// segments at the right, joined in one box in the fields' colors, the chosen one lit.
// Native radio buttons underneath, so Tab reaches the group once, the arrows move the
// choice, and screen readers hear each choice's full `label` ("Large: 170 pixels wide")
// rather than its `short` one. `compact`: the segments alone, without the row, `label`
// naming the group for screen readers only (the search results' size).

export default function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  compact = false,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; short?: string }[];
  onChange: (value: T) => void;
  compact?: boolean;
}) {
  const id = React.useId();
  const group = (
    <div
      role="radiogroup"
      aria-labelledby={compact ? undefined : `${id}-label`}
      aria-label={compact ? label : undefined}
      className={styles.group}
    >
      {options.map((option) => (
        <label key={option.value} className={styles.option} title={option.label}>
          <input
            type="radio"
            name={id}
            className="sr-only"
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          <span aria-hidden>{option.short ?? option.label}</span>
          <span className="sr-only">{option.label}</span>
        </label>
      ))}
    </div>
  );
  if (compact) return group;
  return (
    <div className="tierbinder-prop min-w-0">
      <span id={`${id}-label`}>{label}</span>
      {group}
    </div>
  );
}

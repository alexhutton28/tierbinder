'use client';

import React from 'react';
import { PETREL_950, darkReadsBetter } from '../color';
import styles from './Checkbox.module.css';

// A checkbox and its label, drawn in CSS instead of the browser's own: a box in the
// fields' colors, filled when ticked with `color` (the primary color unless given) under
// Feather's check. The check is white or Petrel 950: `check` picks, or else whichever
// reads better on `color` (dark on the primary color, as the primary button's text is).
// The whole row is the label, so clicking the words ticks it; on touch screens it's a
// full touch target.

export default function Checkbox({
  checked,
  onChange,
  disabled,
  color,
  check,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  color?: string;
  check?: 'light' | 'dark';
  children: React.ReactNode;
}) {
  const mark = check ?? (!color || darkReadsBetter(color, PETREL_950) ? 'dark' : 'light');
  return (
    <label className={styles.row} data-disabled={disabled || undefined}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        className={styles.box}
        data-check={mark}
        style={color ? ({ '--tick': color } as React.CSSProperties) : undefined}
        onChange={(e) => onChange(e.target.checked)}
      />
      {children}
    </label>
  );
}

'use client';

import type React from 'react';
import styles from './Toggle.module.css';

// A switch and its label, for settings that turn something on the board on or off: a
// pill track in the fields' colors with a knob that slides across, filled with the
// primary color when on (as a ticked checkbox is). The switch comes first and the whole
// row, switch and words, is the button; on touch screens it's a full touch target.
// Checkbox stays for picking from a list (the Sets popup).

export default function Toggle({
  ref,
  checked,
  onChange,
  children,
}: {
  ref?: React.Ref<HTMLButtonElement>;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      className={styles.row}
      onClick={() => onChange(!checked)}
    >
      <span aria-hidden className={styles.track}>
        <span className={styles.knob} />
      </span>
      {children}
    </button>
  );
}

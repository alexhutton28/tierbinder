'use client';

import type React from 'react';
import styles from './Toggle.module.css';

// A switch and its label, for settings that turn something on the board on or off: a
// pill track in the fields' colors with a knob that slides across, filled with the
// primary color when on (as a ticked checkbox is). The switch comes first and the whole
// row, switch and words, is the button; on touch screens it's a full touch target.
// Checkbox stays for picking from a list (the Sets popup).
// Without children it's the switch alone, named by `label`, for a section's header when it
// turns the whole section on or off (the Card Tray's): as small as the switch, so the
// header keeps its height, with a full touch target around it on touch screens.

export default function Toggle({
  ref,
  checked,
  onChange,
  children,
  label,
}: {
  ref?: React.Ref<HTMLButtonElement>;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: React.ReactNode;
  label?: string;
}) {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={children ? undefined : label}
      title={children ? undefined : label}
      className={children ? styles.row : styles.bare}
      onClick={() => onChange(!checked)}
    >
      <span aria-hidden className={styles.track}>
        <span className={styles.knob} />
      </span>
      {children}
    </button>
  );
}

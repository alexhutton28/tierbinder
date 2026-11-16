'use client';

import type React from 'react';
import styles from './Toggle.module.css';

// A switch and its label, for settings that turn something on the board on or off: a
// pill track in the fields' colors with a knob that slides across, filled with the
// primary color when on (as a ticked checkbox is). The switch comes first and the switch
// and words together are the button, hugging them; on touch screens it's a full touch
// target. Checkbox stays for picking from a list (the Sets popup).
// As a section's `heading` (one that turns the whole section on or off: the Card Tray's),
// the words come first in the heading's style, the switch right after them, and it's no
// taller than the heading's line, so the section keeps its spacing.

export default function Toggle({
  ref,
  checked,
  onChange,
  children,
  heading = false,
}: {
  ref?: React.Ref<HTMLButtonElement>;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
  heading?: boolean;
}) {
  const track = (
    <span aria-hidden className={styles.track}>
      <span className={styles.knob} />
    </span>
  );
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      className={`${styles.row} ${heading ? styles.heading : ''}`}
      onClick={() => onChange(!checked)}
    >
      {heading ? (
        <>
          {children}
          {track}
        </>
      ) : (
        <>
          {track}
          {children}
        </>
      )}
    </button>
  );
}

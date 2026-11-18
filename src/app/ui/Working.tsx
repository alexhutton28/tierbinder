import type { CSSProperties, ReactNode } from 'react';
import styles from './Working.module.css';

// A button's words while what it started is under way: "Downloading" and three bouncing
// dots in place of "Download". Both are laid out in one cell, so the button keeps the
// wider one's width and doesn't jump; the one not showing is hidden from screen readers too.
// One round of the dots hopping in turn (ms), and how many a button shows at least: it
// keeps working until a whole number of rounds have played, two or more
export const DOTS_CYCLE = 1000;
export const DOTS_SHOWN = 2;

export default function Working({
  active,
  label,
  children,
}: {
  active: boolean;
  // What it's doing, as in "Downloading"
  label: string;
  // The button's own contents
  children: ReactNode;
}) {
  return (
    <span className={styles.stack}>
      <span className={styles.layer} data-shown={!active || undefined}>
        {children}
      </span>
      <span className={styles.layer} data-shown={active || undefined}>
        {label}
        {/* Remounted as it starts, so the dots hop from the start of a cycle */}
        <span
          key={String(active)}
          aria-hidden
          className={styles.dots}
          style={{ '--dots-cycle': `${DOTS_CYCLE}ms` } as CSSProperties}
        >
          <span />
          <span />
          <span />
        </span>
      </span>
    </span>
  );
}

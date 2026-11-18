import type { ReactNode } from 'react';
import styles from './Working.module.css';

// A button's words while what it started is under way: "Downloading" and three bouncing
// dots in place of "Download". Both are laid out in one cell, so the button keeps the
// wider one's width and doesn't jump; the one not showing is hidden from screen readers too.
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
        <span aria-hidden className={styles.dots}>
          <span />
          <span />
          <span />
        </span>
      </span>
    </span>
  );
}

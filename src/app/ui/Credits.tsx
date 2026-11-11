'use client';

import React from 'react';
import { useAnchored } from './anchored';
import { FOLD_CLEARANCE } from './motion';
import styles from './Credits.module.css';

// The sidebar's foot: one line naming the card source, with an info button right after it
// that opens the full credits and the trademark disclaimer in a popup, floating like the
// dropdowns (useAnchored). Escape or a press outside closes it.
export default function Credits() {
  const [open, setOpen] = React.useState(false);
  // Stays on screen while it folds closed, as the other popups do
  const [shown, setShown] = React.useState(false);
  if (open && !shown) setShown(true);
  const closing = shown && !open;
  React.useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => setShown(false), FOLD_CLEARANCE);
    return () => clearTimeout(timer);
  }, [closing]);

  const id = React.useId();
  const boxRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const popupRef = React.useRef<HTMLDivElement>(null);
  useAnchored(shown, buttonRef, popupRef);

  // Opening moves focus into the popup, so screen readers read it and Escape closes it
  React.useEffect(() => {
    if (open) popupRef.current?.focus({ preventScroll: true });
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target instanceof Node && boxRef.current?.contains(e.target))) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  const tcgdex = (
    <a href="https://tcgdex.dev" target="_blank" rel="noopener noreferrer">
      TCGdex<span className="sr-only"> (opens in a new tab)</span>
    </a>
  );

  return (
    <div ref={boxRef} className={`${styles.credits} text-caption`}>
      Cards from{' '}
      <span className={styles.source}>
        {tcgdex}
        <button
          ref={buttonRef}
          type="button"
          className={styles.info}
          aria-label="Credits"
          title="Credits"
          aria-expanded={open}
          aria-controls={`${id}-popup`}
          onClick={() => setOpen((o) => !o)}
        >
          <span aria-hidden className={styles.icon} />
        </button>
      </span>
      {shown && (
        <div
          ref={popupRef}
          id={`${id}-popup`}
          popover="manual"
          role="dialog"
          tabIndex={-1}
          aria-label="Credits"
          onKeyDown={(e) => {
            // Kept from the page's own Escape handling, which would also deselect the card
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              buttonRef.current?.focus();
            }
          }}
          className={`tierbinder-menu dropdown tierbinder-popup tierbinder-anchored text-caption ${styles.popup} ${closing ? 'closing pointer-events-none' : ''}`}
        >
          <p>Card data and images from {tcgdex}.</p>
          <p>
            Pokémon is a trademark of Nintendo, Creatures, GAME FREAK and The Pokémon Company.
            TierBinder isn&apos;t affiliated with them.
          </p>
        </div>
      )}
    </div>
  );
}

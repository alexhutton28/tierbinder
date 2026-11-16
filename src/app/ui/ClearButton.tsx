'use client';

import React from 'react';
import { flushSync } from 'react-dom';
import { useAnchored, usePopup } from './anchored';
import Button from './Button';
import styles from './ClearButton.module.css';

// A clear button that asks first, as the card menu's Clear Card Tray does: Feather's trash
// before its words, opening a menu under it whose choices each name a clear ("Clear Card
// Tray", "Reset Board Styles") and do it; with no choices it's disabled. A second click
// on the button, Escape, Tab or a press outside closes it. Opening focuses the first
// choice, and the arrows, Home and End move through them. Once one's done, focus goes
// back to the button, or to `onEmptied` when nothing's left to clear, unless the choice
// moved it. It floats like a dropdown's list (useAnchored), so it's never squeezed by a
// narrow sidebar. As `quiet`, it's a muted text button (Customize's Clear, at the end of the
// Board heading), and `label` names it for screen readers ("Clear board").

export type ClearChoice = { label: string; onSelect: () => void };

export default function ClearButton({
  choices,
  onEmptied,
  quiet = false,
  label,
  children,
}: {
  choices: ClearChoice[];
  // Where focus goes when a choice leaves nothing to clear (the button is disabled)
  onEmptied?: () => void;
  quiet?: boolean;
  // Its name, when its words alone don't say what it clears
  label?: string;
  children: string;
}) {
  const id = React.useId();
  const boxRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const { open, setOpen, shown, closing } = usePopup(boxRef);
  useAnchored(shown, buttonRef, menuRef);

  React.useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus();
  }, [open]);

  return (
    <div ref={boxRef} className="relative">
      <Button
        ref={buttonRef}
        variant={quiet ? 'text' : 'default'}
        aria-label={label}
        disabled={!choices.length}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={shown ? `${id}-menu` : undefined}
        className={`flex gap-2 items-center ${quiet ? styles.quiet : ''}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          // As a menu button: the arrows open it, focusing its item
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span aria-hidden className={styles.icon} />
        {children}
      </Button>
      {shown && (
        <div
          ref={menuRef}
          id={`${id}-menu`}
          popover="manual"
          role="menu"
          aria-label={label ?? children}
          // A quiet Clear ends its row: its menu lines up with its right edge
          data-align={quiet ? 'end' : undefined}
          onKeyDown={(e) => {
            // Kept from the page's own Escape handling, which would also deselect the card
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              buttonRef.current?.focus();
            }
            if (e.key === 'Tab') setOpen(false);
            // The page's Delete and Backspace (removing the selected card) don't reach it
            if (e.key === 'Delete' || e.key === 'Backspace') e.stopPropagation();
            const items = [
              ...(menuRef.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? []),
            ];
            const at = items.indexOf(document.activeElement as HTMLElement);
            const next =
              e.key === 'ArrowDown'
                ? (at + 1) % items.length
                : e.key === 'ArrowUp'
                  ? (at - 1 + items.length) % items.length
                  : e.key === 'Home'
                    ? 0
                    : e.key === 'End'
                      ? items.length - 1
                      : null;
            if (next !== null) {
              e.preventDefault();
              items[next]?.focus();
            }
          }}
          className={`${styles.menu} tierbinder-menu dropdown tierbinder-popup tierbinder-list tierbinder-anchored flex flex-col ${closing ? 'closing pointer-events-none' : ''}`}
        >
          {choices.map((choice) => (
            <button
              key={choice.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="tierbinder-option whitespace-nowrap"
              onClick={() => {
                flushSync(() => {
                  setOpen(false);
                  choice.onSelect();
                });
                // Back to the button (or onEmptied, if it's now disabled), unless the choice
                // sent focus somewhere else
                // (the choice itself may be gone, its label changed, leaving focus nowhere)
                const at = document.activeElement;
                if (at && at !== document.body && !menuRef.current?.contains(at)) return;
                if (buttonRef.current?.disabled) onEmptied?.();
                else buttonRef.current?.focus();
              }}
            >
              {choice.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

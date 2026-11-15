'use client';

import React from 'react';
import { useAnchored, usePopup } from './anchored';
import Button from './Button';
import styles from './ClearButton.module.css';

// A clear button that asks first, as the card menu's Clear Card Tray does: Feather's trash
// before its words, opening a one-item menu under it that says what goes ("Clear 12
// Cards"), which does it. A second click on the button, Escape, Tab or a press outside
// closes it. Opening focuses the item; once it's done, focus goes back to the button,
// unless `onConfirm` moved it elsewhere (the button may be gone). It floats like a
// dropdown's list (useAnchored), so it's never squeezed by a narrow sidebar.

export default function ClearButton({
  confirm,
  onConfirm,
  children,
}: {
  confirm: string;
  onConfirm: () => void;
  children: string;
}) {
  const id = React.useId();
  const boxRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const itemRef = React.useRef<HTMLButtonElement>(null);
  const { open, setOpen, shown, closing } = usePopup(boxRef);
  useAnchored(shown, buttonRef, menuRef);

  React.useEffect(() => {
    if (open) itemRef.current?.focus();
  }, [open]);

  return (
    <div ref={boxRef} className="relative self-start">
      <Button
        ref={buttonRef}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={shown ? `${id}-menu` : undefined}
        className="flex gap-2 items-center"
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
          aria-label={children}
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
          }}
          className={`${styles.menu} tierbinder-menu dropdown tierbinder-popup tierbinder-list tierbinder-anchored flex flex-col ${closing ? 'closing pointer-events-none' : ''}`}
        >
          <button
            ref={itemRef}
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="tierbinder-option whitespace-nowrap"
            onClick={() => {
              setOpen(false);
              onConfirm();
              // Back to the button, unless onConfirm sent focus somewhere else
              if (menuRef.current?.contains(document.activeElement)) buttonRef.current?.focus();
            }}
          >
            {confirm}
          </button>
        </div>
      )}
    </div>
  );
}

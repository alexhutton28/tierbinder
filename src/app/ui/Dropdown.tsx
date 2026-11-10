'use client';

import React from 'react';
import { useAnchored } from './anchored';
import Button from './Button';
import styles from './Dropdown.module.css';

// A labeled dropdown that opens and closes with the card menu's animation, top to
// bottom (.tierbinder-menu.dropdown in globals.css), which a native <select> can't do. Arrow keys move
// through the options, Enter or Space picks one, Escape closes. An option with a color
// shows it as a swatch before its name (the tiers); a hidden label is still the button's
// tooltip. The list floats over the board, in the top layer (useAnchored), so a narrow
// sidebar doesn't clip it.

export default function Dropdown<T extends string | number>({
  label,
  hideLabel = false,
  chevron = true,
  value,
  options,
  onChange,
}: {
  label: string;
  hideLabel?: boolean;
  chevron?: boolean;
  value: T;
  options: { value: T; label: string; color?: string }[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = React.useState(false);
  // Stays on screen while it folds closed; removed on a timer just after the 180ms fold,
  // as the card menu is
  const [shown, setShown] = React.useState(false);
  if (open && !shown) setShown(true);
  const closing = shown && !open;
  React.useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => setShown(false), 220);
    return () => clearTimeout(timer);
  }, [closing]);

  const id = React.useId();
  const boxRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const optionRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  useAnchored(shown, buttonRef, listRef);
  const selected = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );

  // Opening focuses the current option
  React.useEffect(() => {
    if (open) optionRefs.current[selected]?.focus();
  }, [open, selected]);

  // Closes on any press outside it
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target instanceof Node && boxRef.current?.contains(e.target))) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onListKey = (e: React.KeyboardEvent) => {
    const focused = optionRefs.current.findIndex((el) => el === document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : options.length - 1;
      optionRefs.current[(focused + step) % options.length]?.focus();
    }
    // Kept from the page's own Escape handling, which would also deselect the card
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
    if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div className="flex gap-3 items-center">
      <span id={`${id}-label`} className={hideLabel ? 'sr-only' : undefined}>
        {label}
      </span>
      <div ref={boxRef} className="relative">
        <Button
          ref={buttonRef}
          id={`${id}-button`}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={`${id}-label ${id}-button`}
          title={hideLabel ? label : undefined}
          className="flex gap-2 items-center"
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              setOpen(true);
            }
          }}
        >
          <Swatch color={options[selected]?.color} />
          {options[selected]?.label}
          {chevron && <span aria-hidden className={styles.chevron} />}
        </Button>
        {shown && (
          <div
            ref={listRef}
            popover="manual"
            role="listbox"
            aria-labelledby={`${id}-label`}
            onKeyDown={onListKey}
            className={`tierbinder-menu dropdown tierbinder-popup tierbinder-list tierbinder-anchored flex flex-col ${closing ? 'closing pointer-events-none' : ''}`}
          >
            {options.map((option, i) => (
              <button
                key={option.value}
                ref={(el) => {
                  optionRefs.current[i] = el;
                }}
                type="button"
                role="option"
                aria-selected={i === selected}
                tabIndex={-1}
                className="tierbinder-option flex gap-2 items-center whitespace-nowrap aria-selected:font-semibold"
                onClick={() => {
                  onChange(option.value);
                  close();
                }}
              >
                <Swatch color={option.color} />
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Swatch({ color }: { color?: string }) {
  return color ? (
    <span aria-hidden className={styles.swatchBox}>
      <span className={styles.swatch} style={{ background: color }} />
    </span>
  ) : null;
}

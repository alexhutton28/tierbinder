'use client';

import React from 'react';
import { useAnchored, usePopup } from './anchored';
import Button from './Button';
import styles from './Dropdown.module.css';
import { CARD_HEIGHT, CARD_WIDTH } from '../canvas/size';

// A labeled dropdown that opens and closes with the card menu's animation, top to
// bottom (.tierbinder-menu.dropdown in globals.css), which a native <select> can't do. Arrow keys move
// through the options, Enter or Space picks one, Escape closes. An option with a color
// shows it as a swatch before its name (the tiers); a hidden label is still the button's
// tooltip. `labelledBy` names it by an element on the page instead (a heading over it), with
// no label or tooltip of its own. The list floats over the board, in the top layer (useAnchored), so a narrow
// sidebar doesn't clip it. `current` shows something else on the button than any option
// (a mode, as in "Splitting Pikachu"), with no option selected; picking any option ends it.

type Look = { color?: string; outlined?: boolean; shape?: 'square' | 'card' };

export default function Dropdown<T extends string | number>({
  label,
  labelledBy,
  hideLabel = false,
  chevron = true,
  value,
  options,
  current,
  onChange,
}: ({ label: string; labelledBy?: undefined } | { label?: undefined; labelledBy: string }) & {
  hideLabel?: boolean;
  chevron?: boolean;
  value: T;
  // `outlined` gives the swatch a light stroke; a `card` shape draws it card-shaped
  options: ({ value: T; label: string } & Look)[];
  current?: { label: string } & Look;
  onChange: (value: T) => void;
}) {
  const id = React.useId();
  const labelId = labelledBy ?? `${id}-label`;
  const boxRef = React.useRef<HTMLDivElement>(null);
  // Stays on screen while it folds closed; a press outside closes it
  const { open, setOpen, shown, closing } = usePopup(boxRef);
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
    // Shrinks to fit (its button's words cut short with an ellipsis) rather than overflowing
    <div className="flex gap-3 items-center min-w-0">
      {label !== undefined && (
        <span id={labelId} className={hideLabel ? 'sr-only' : undefined}>
          {label}
        </span>
      )}
      <div ref={boxRef} className="relative min-w-0">
        <Button
          ref={buttonRef}
          id={`${id}-button`}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={`${labelId} ${id}-button`}
          title={hideLabel ? label : undefined}
          className="flex gap-2 items-center max-w-full"
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              setOpen(true);
            }
          }}
        >
          <Swatch {...(current ?? options[selected])} />
          <span className="truncate">{(current ?? options[selected])?.label}</span>
          {chevron && <span aria-hidden className={styles.chevron} />}
        </Button>
        {shown && (
          <div
            ref={listRef}
            popover="manual"
            role="listbox"
            aria-labelledby={labelId}
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
                aria-selected={!current && i === selected}
                tabIndex={-1}
                className="tierbinder-option flex gap-2 items-center whitespace-nowrap aria-selected:font-semibold"
                onClick={() => {
                  onChange(option.value);
                  close();
                }}
              >
                <Swatch {...option} />
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// An option's color as a swatch (also used by the search results' menu)
export function Swatch({ color, outlined, shape = 'square' }: Look) {
  return color ? (
    <span aria-hidden className={styles.swatchBox}>
      <span
        className={`${shape === 'card' ? styles.cardSwatch : styles.swatch} ${outlined ? styles.outlined : ''}`}
        style={
          {
            background: color,
            '--card-ratio': `${CARD_WIDTH} / ${CARD_HEIGHT}`,
          } as React.CSSProperties
        }
      />
    </span>
  ) : null;
}

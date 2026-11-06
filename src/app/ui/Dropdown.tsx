'use client';

import React from 'react';
import Button from './Button';

// A labeled dropdown that opens and closes with the card menu's animation, top to
// bottom (.tier-stack-menu.dropdown in globals.css), which a native <select> can't do. Arrow keys move
// through the options, Enter or Space picks one, Escape closes.

export default function Dropdown<T extends string | number>({
  label,
  hideLabel = false,
  value,
  options,
  onChange,
}: {
  label: string;
  hideLabel?: boolean;
  value: T;
  options: { value: T; label: string }[];
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
  const optionRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
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
          className="flex gap-2 items-center"
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              setOpen(true);
            }
          }}
        >
          {options[selected]?.label}
          <span aria-hidden className="tier-stack-chevron" />
        </Button>
        {shown && (
          <div
            role="listbox"
            aria-labelledby={`${id}-label`}
            onKeyDown={onListKey}
            className={`tier-stack-menu dropdown absolute left-0 top-full mt-1 z-10 tier-stack-popup flex flex-col min-w-full ${closing ? 'closing pointer-events-none' : ''}`}
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
                className="tier-stack-option whitespace-nowrap aria-selected:font-bold"
                onClick={() => {
                  onChange(option.value);
                  close();
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

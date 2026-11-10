'use client';

import React from 'react';
import {
  activeFilters,
  CARD_TYPES,
  DEFAULT_SEARCH,
  FORMATS,
  type SearchOptions,
} from '../searchOptions';
import Button from './Button';
import styles from './SearchFilters.module.css';

// The card search's Filters button and its popup: format, card type and newest print
// only. Each change applies at once. The popup opens and closes like a dropdown
// (.tierbinder-menu.dropdown in globals.css); Escape or a press outside closes it.

export default function SearchFilters({
  options,
  onChange,
}: {
  options: SearchOptions;
  onChange: (options: SearchOptions) => void;
}) {
  const [open, setOpen] = React.useState(false);
  // Stays on screen while it folds closed, as the dropdowns do
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
  const popupRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  // Opening focuses the first control
  React.useEffect(() => {
    if (open) popupRef.current?.querySelector<HTMLInputElement>('input:checked')?.focus();
  }, [open]);

  // Closes on any press outside it
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target instanceof Node && boxRef.current?.contains(e.target))) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  const count = activeFilters(options);
  const set = (change: Partial<SearchOptions>) => onChange({ ...options, ...change });

  return (
    <div ref={boxRef} className="relative">
      <Button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-popup`}
        className="flex gap-2 items-center"
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden className={styles.icon} />
        {count ? `Filters (${count})` : 'Filters'}
      </Button>
      {shown && (
        <div
          ref={popupRef}
          id={`${id}-popup`}
          role="dialog"
          aria-label="Search filters"
          onKeyDown={(e) => {
            // Kept from the page's own Escape handling, which would also deselect the card
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              buttonRef.current?.focus();
            }
          }}
          className={`tierbinder-menu dropdown tierbinder-popup ${styles.popup} ${closing ? 'closing pointer-events-none' : ''}`}
        >
          <Choices
            legend="Format"
            name={`${id}-format`}
            choices={FORMATS}
            value={options.format}
            onChange={(format) => set({ format })}
          />
          <Choices
            legend="Card type"
            name={`${id}-type`}
            choices={CARD_TYPES}
            value={options.type}
            onChange={(type) => set({ type })}
          />
          <label className={styles.choice}>
            <input
              type="checkbox"
              checked={options.newestOnly}
              onChange={(e) => set({ newestOnly: e.target.checked })}
            />
            Newest print only
          </label>
          {count > 0 && (
            <Button
              type="button"
              className="self-start"
              onClick={() =>
                set({
                  format: DEFAULT_SEARCH.format,
                  type: DEFAULT_SEARCH.type,
                  newestOnly: DEFAULT_SEARCH.newestOnly,
                })
              }
            >
              Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function Choices<T extends string>({
  legend,
  name,
  choices,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  choices: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{legend}</legend>
      {choices.map((choice) => (
        <label key={choice.value} className={styles.choice}>
          <input
            type="radio"
            name={name}
            checked={value === choice.value}
            onChange={() => onChange(choice.value)}
          />
          {choice.label}
        </label>
      ))}
    </fieldset>
  );
}

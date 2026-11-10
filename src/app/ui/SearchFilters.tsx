'use client';

import React from 'react';
import { activeFilters, type SearchOptions } from '../searchOptions';
import { CARD_SETS } from '../sets';
import Button from './Button';
import styles from './SearchFilters.module.css';

// The card search's Filter button and its popup: which sets to search, from a list of
// every set (newest first) narrowed by a search of their names and codes. None ticked
// means every set. Each change applies at once. The popup opens and closes like a
// dropdown (.tierbinder-menu.dropdown in globals.css); Escape or a press outside closes it.

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

  const [query, setQuery] = React.useState('');
  const id = React.useId();
  const boxRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  // Opening focuses the set search
  React.useEffect(() => {
    if (open) searchRef.current?.focus();
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
  const term = query.trim().toLowerCase();
  const sets = term
    ? CARD_SETS.filter(
        (s) => s.name.toLowerCase().includes(term) || s.code.toLowerCase().includes(term)
      )
    : CARD_SETS;
  const toggle = (code: string, on: boolean) =>
    onChange({
      ...options,
      sets: on ? [...options.sets, code] : options.sets.filter((c) => c !== code),
    });

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
        {count ? `Filter (${count})` : 'Filter'}
      </Button>
      {shown && (
        <div
          id={`${id}-popup`}
          role="dialog"
          aria-label="Filter by set"
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
          <input
            ref={searchRef}
            className="tierbinder-field"
            aria-label="Search sets"
            placeholder="Search sets"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <fieldset className={styles.sets}>
            <legend className="sr-only">Sets</legend>
            {sets.map((s) => (
              <label key={s.code} className={styles.choice}>
                <input
                  type="checkbox"
                  checked={options.sets.includes(s.code)}
                  onChange={(e) => toggle(s.code, e.target.checked)}
                />
                <span className={styles.setName}>{s.name}</span>
                <span className={styles.code}>{s.code}</span>
              </label>
            ))}
            {!sets.length && <p className={styles.code}>No sets match.</p>}
          </fieldset>
          {count > 0 && (
            <Button
              type="button"
              className="self-start"
              onClick={() => onChange({ ...options, sets: [] })}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

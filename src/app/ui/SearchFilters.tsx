'use client';

import React from 'react';
import { DEFAULT_TIERS } from '../graphics/tier-list/model';
import { activeFilters, MAX_SETS, type SearchOptions } from '../searchOptions';
import { CARD_SETS } from '../sets';
import { useAnchored, usePopup } from './anchored';
import Button from './Button';
import Checkbox from './Checkbox';
import styles from './SearchFilters.module.css';
import { PETREL_950, darkReadsBetter } from '../color';

// The card search's Sets button (a filter) and its popup: which sets to search, from a list of
// every set (newest first) narrowed by a search of their names and codes. None ticked
// means every set. Each change applies at once. The popup opens and closes like a
// dropdown (.tierbinder-menu.dropdown in globals.css); Escape or a press outside closes it.
// It floats over the board, in the top layer (useAnchored).
// Ticked sets' checkboxes take `colors` in the order they were ticked (the board's tier
// colors: the first ticked in the first tier's, the second in the second's), starting
// over once they run out.

// The check on a tick of this color: white on the default tier colors (by choice, though
// it's faint on yellow), and on any other color whichever of white and the page's
// darkest color (petrel 950, as in check-dark.svg) contrasts more
const DEFAULT_COLORS = new Set(DEFAULT_TIERS.map(([, color]) => color));
// Petrel 950, which check-dark.svg also draws in (an SVG used as a background can't read
// CSS variables, and the contrast is worked out here)
const DARK = PETREL_950;

function checkOn(color: string): 'light' | 'dark' {
  if (DEFAULT_COLORS.has(color.toLowerCase())) return 'light';
  return darkReadsBetter(color, DARK) ? 'dark' : 'light';
}

export default function SearchFilters({
  options,
  colors,
  onChange,
}: {
  options: SearchOptions;
  colors: string[];
  onChange: (options: SearchOptions) => void;
}) {
  const [query, setQuery] = React.useState('');
  const id = React.useId();
  const boxRef = React.useRef<HTMLDivElement>(null);
  // Stays on screen while it folds closed; a press outside closes it
  const { open, setOpen, shown, closing } = usePopup(boxRef);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const popupRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  useAnchored(shown, buttonRef, popupRef);

  // Opening scrolls the list to the first ticked set in it, at the top
  const listRef = React.useRef<HTMLFieldSetElement>(null);
  React.useLayoutEffect(() => {
    const list = listRef.current;
    if (!open || !list) return;
    const first = list.querySelector('input:checked')?.closest('label');
    // Both measured from the popup (offsetTop isn't changed by its opening transform)
    list.scrollTop = first instanceof HTMLElement ? first.offsetTop - list.offsetTop : 0;
  }, [open]);

  // Opening focuses the set search, except on touch screens, where that would bring up the
  // keyboard over the list (tapping the field does): there the popup itself takes focus,
  // so screen readers move into it and Escape closes it
  React.useEffect(() => {
    if (!open) return;
    if (matchMedia('(pointer: fine)').matches) searchRef.current?.focus();
    else popupRef.current?.focus({ preventScroll: true });
  }, [open]);

  const count = activeFilters(options);
  const full = count >= MAX_SETS;
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
    // Sets and its clear button, joined as one split button
    <div ref={boxRef} className="relative flex items-center">
      <Button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-popup`}
        className={`${styles.splitMain} flex gap-2 items-center`}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden className={styles.icon} />
        {/* The ticked set's code, or the first one's and how many more ("TWM +2") */}
        {/* Screen readers hear what it filters and every ticked code, around the words shown */}
        {count > 0 && <span className="sr-only">Sets: </span>}
        {count ? `${options.sets[0]}${count > 1 ? ` +${count - 1}` : ''}` : 'Sets'}
        {count > 1 && <span className="sr-only"> ({options.sets.join(', ')})</span>}
      </Button>
      {/* Always there, so the row never shifts; while sets are ticked, one press unticks them
          all (a set's featured pool ticks one, maybe by accident), closing the popup if it's
          open, focus going back to Sets. With none ticked it's dimmed and does nothing. */}
      <Button
        type="button"
        variant="icon"
        className={`${styles.splitEnd} ${styles.clear}`}
        aria-label="Clear sets"
        title="Clear sets"
        disabled={count === 0}
        onClick={() => {
          onChange({ ...options, sets: [] });
          setOpen(false);
          buttonRef.current?.focus();
        }}
      >
        <span aria-hidden className={styles.clearIcon} />
      </Button>
      {shown && (
        <div
          ref={popupRef}
          id={`${id}-popup`}
          popover="manual"
          role="dialog"
          tabIndex={-1}
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
          className={`tierbinder-menu dropdown tierbinder-popup tierbinder-anchored ${styles.popup} ${closing ? 'closing pointer-events-none' : ''}`}
        >
          <span className={styles.searchField}>
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
            {/* Empties the search, as the card search's does, while it has text */}
            {query && (
              <button
                type="button"
                className="tierbinder-clear"
                aria-label="Clear set search"
                title="Clear set search"
                onClick={() => {
                  setQuery('');
                  searchRef.current?.focus();
                }}
              >
                <span aria-hidden />
              </button>
            )}
          </span>
          <fieldset ref={listRef} className={styles.sets}>
            <legend className="sr-only">Sets</legend>
            {sets.map((s) => {
              const ticked = options.sets.indexOf(s.code);
              const tick = ticked >= 0 && colors.length ? colors[ticked % colors.length] : null;
              return (
                <Checkbox
                  key={s.code}
                  checked={ticked >= 0}
                  // At the limit, only ticked sets can change
                  disabled={ticked < 0 && full}
                  color={tick ?? undefined}
                  check={tick ? checkOn(tick) : undefined}
                  onChange={(on) => toggle(s.code, on)}
                >
                  <span className={styles.setName}>{s.name}</span>
                  <span className={styles.code}>{s.code}</span>
                </Checkbox>
              );
            })}
            {!sets.length && <p className={styles.code}>No Sets Match</p>}
          </fieldset>
          {full && <p className={styles.code}>Up to {MAX_SETS} Sets at a Time</p>}
          {count > 0 && (
            <Button
              type="button"
              className="self-start"
              onClick={() => onChange({ ...options, sets: [] })}
            >
              Clear Sets
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

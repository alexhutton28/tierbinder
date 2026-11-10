'use client';

import React from 'react';
import { DEFAULT_TIERS } from '../graphics/tier-list/model';
import { activeFilters, type SearchOptions } from '../searchOptions';
import { CARD_SETS } from '../sets';
import { useAnchored } from './anchored';
import Button from './Button';
import styles from './SearchFilters.module.css';

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
const DARK = '#12171a';

function checkOn(color: string): 'light' | 'dark' {
  const hex = color.toLowerCase();
  if (DEFAULT_COLORS.has(hex) || !/^#[0-9a-f]{6}$/.test(hex)) return 'light';
  const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const tick = luminance(hex);
  return contrast(tick, luminance(DARK)) > contrast(tick, 1) ? 'dark' : 'light';
}

// WCAG's relative luminance of a #rrggbb color
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
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
        aria-label={count ? `Sets: ${options.sets.join(', ')}` : 'Sets'}
        className="flex gap-2 items-center"
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden className={styles.icon} />
        {/* The ticked set's code, or the first one's and how many more ("TWM +2") */}
        {count ? `${options.sets[0]}${count > 1 ? ` +${count - 1}` : ''}` : 'Sets'}
      </Button>
      {shown && (
        <div
          ref={popupRef}
          id={`${id}-popup`}
          popover="manual"
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
          className={`tierbinder-menu dropdown tierbinder-popup tierbinder-anchored ${styles.popup} ${closing ? 'closing pointer-events-none' : ''}`}
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
          <fieldset ref={listRef} className={styles.sets}>
            <legend className="sr-only">Sets</legend>
            {sets.map((s) => {
              const ticked = options.sets.indexOf(s.code);
              const tick = ticked >= 0 && colors.length ? colors[ticked % colors.length] : null;
              return (
                <label key={s.code} className={styles.choice}>
                  <input
                    type="checkbox"
                    checked={ticked >= 0}
                    className={styles.check}
                    data-check={tick ? checkOn(tick) : undefined}
                    style={tick ? ({ '--tick': tick } as React.CSSProperties) : undefined}
                    onChange={(e) => toggle(s.code, e.target.checked)}
                  />
                  <span className={styles.setName}>{s.name}</span>
                  <span className={styles.code}>{s.code}</span>
                </label>
              );
            })}
            {!sets.length && <p className={styles.code}>No sets match.</p>}
          </fieldset>
          {count > 0 && (
            <Button
              type="button"
              className="self-start"
              onClick={() => onChange({ ...options, sets: [] })}
            >
              Clear sets
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import React from 'react';
import { HexColorPicker } from 'react-colorful';
import { useAnchored, usePopup } from './anchored';
import styles from './ColorField.module.css';
import Segmented from './Segmented';
import { SWATCHES, SWATCH_COLUMNS, SWATCH_ROWS } from './swatches';

// A color as a swatch that opens our own picker in a popup like a dropdown's, floating over
// the board: a switch between two views, Swatches (a grid of recommended colors, ui/swatches.ts)
// and Custom (react-colorful's saturation and brightness square over a hue bar, restyled in
// ColorField.module.css, its handles kept inside them), the last one used remembered on the
// device; then the board's own colors to pick in one click (BoardColors, given by the
// editor), then its hex field. With a `name`, it's a
// setting's row, the name at the left and the swatch at the right, that opens it (the
// Customize tab's colors); without, the swatch alone (a tier's, beside its name field; the
// pen's).
// Typing applies as soon as the text is a full hex color (#rgb or #rrggbb, # optional);
// dragging in the picker applies as it goes, once per frame. Escape, a press outside or
// focus leaving it (Tab past the last field) closes it.

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalize(text: string) {
  const match = text.trim().match(HEX);
  if (!match) return null;
  const digits = match[1].length === 3 ? [...match[1]].map((c) => c + c).join('') : match[1];
  return `#${digits.toLowerCase()}`;
}

export type BoardColor = { name: string; color: string };

type View = 'swatches' | 'custom';
const VIEWS = [
  { value: 'swatches', label: 'Swatches' },
  { value: 'custom', label: 'Custom' },
] as const satisfies readonly { value: View; label: string }[];
const VIEW_KEY = 'tierbinder-color-view';
// Swatches' columns on touch screens, where ten would be too small to tap: the hues in
// blocks of four, so each is a 44px touch target across the picker
const TOUCH_COLUMNS = 4;

// The view in use, shared by every color field on the page (switching in one switches the
// others) and saved on the device
let sharedView: View | null = null;
const viewListeners = new Set<() => void>();
function currentView(): View {
  if (sharedView) return sharedView;
  try {
    sharedView = localStorage.getItem(VIEW_KEY) === 'custom' ? 'custom' : 'swatches';
  } catch {
    sharedView = 'swatches';
  }
  return sharedView;
}
function setSharedView(next: View) {
  sharedView = next;
  try {
    localStorage.setItem(VIEW_KEY, next);
  } catch {}
  viewListeners.forEach((listener) => listener());
}
function subscribeView(listener: () => void) {
  viewListeners.add(listener);
  return () => viewListeners.delete(listener);
}

// The board's colors (its tiers', background, border and card tray's, and white), one of
// each, for every color field on the page
export const BoardColors = React.createContext<BoardColor[]>([]);

export function boardColors(colors: BoardColor[]): BoardColor[] {
  const seen = new Set<string>();
  return colors.flatMap(({ name, color }) => {
    const hex = normalize(color);
    if (!hex || seen.has(hex)) return [];
    seen.add(hex);
    return [{ name, color: hex }];
  });
}

export default function ColorField({
  value,
  onChange,
  label,
  name,
}: {
  value: string;
  onChange: (color: string) => void;
  label: string;
  name?: string;
}) {
  const id = React.useId();
  const boxRef = React.useRef<HTMLSpanElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const swatchRef = React.useRef<HTMLSpanElement>(null);
  const popupRef = React.useRef<HTMLDivElement>(null);
  const popup = usePopup(boxRef);
  // Placed from the swatch, not a named row (as wide as the sidebar, which would stretch
  // the popup), so every picker opens the same size from its swatch
  useAnchored(popup.shown, name ? swatchRef : buttonRef, popupRef);
  // The board's colors as they were when the picker opened, so they hold still while a
  // drag changes this field's own (which stays one click away)
  const boardNow = React.useContext(BoardColors);
  const [presets, setPresets] = React.useState(boardNow);
  const current = normalize(value);
  const view = React.useSyncExternalStore(subscribeView, currentView, () => 'swatches' as View);
  const changeView = setSharedView;

  // The picker reports every pointer move; the board (and its autosave) takes the latest
  // color once a frame
  const pending = React.useRef<string | null>(null);
  const frame = React.useRef(0);
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  });
  React.useEffect(() => () => cancelAnimationFrame(frame.current), []);
  // A click or typed hex wins over a drag color still waiting for its frame
  const apply = (color: string) => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    pending.current = null;
    onChange(color);
  };
  const pick = (color: string) => {
    pending.current = color;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      if (pending.current) onChangeRef.current(pending.current);
      pending.current = null;
    });
  };

  // Opening focuses the view's own control: the swatch in use (or the first), or the square,
  // whose arrow keys move the color; except on touch screens, where the popup itself takes
  // focus (as the Sets popup does), so screen readers move into it and Escape closes it
  React.useEffect(() => {
    if (!popup.open) return;
    const start = popupRef.current?.querySelector<HTMLElement>(
      '[data-swatches] [tabindex="0"], [role="slider"]'
    );
    if (matchMedia('(pointer: fine)').matches && start) start.focus();
    else popupRef.current?.focus({ preventScroll: true });
    // Only as it opens, not when the view switches
  }, [popup.open]);

  return (
    <span
      ref={boxRef}
      className={name ? 'flex' : 'inline-flex'}
      // Closes once focus moves on past it, as a dropdown does
      onBlur={(e) => {
        if (!(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)))
          popup.setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={name ? styles.row : styles.swatch}
        style={name ? undefined : { background: value }}
        // A named row is read by its name; a lone swatch needs one
        aria-label={name ? undefined : label}
        title={name ? undefined : label}
        aria-haspopup="dialog"
        aria-expanded={popup.open}
        aria-controls={popup.shown ? `${id}-picker` : undefined}
        onClick={() => {
          if (!popup.open) setPresets(boardNow);
          popup.setOpen(!popup.open);
        }}
      >
        {name && (
          <>
            {name}
            <span
              ref={swatchRef}
              aria-hidden
              className={styles.swatch}
              style={{ background: value }}
            />
            {/* The value, which the swatch shows only to the eye */}
            <span className="sr-only">{value}</span>
          </>
        )}
      </button>
      {popup.shown && (
        <div
          ref={popupRef}
          id={`${id}-picker`}
          popover="manual"
          role="dialog"
          tabIndex={-1}
          aria-label={label}
          onKeyDown={(e) => {
            // The page's Delete and Backspace (removing the selected card) don't reach the
            // board from here: the picker's handles aren't text fields
            if (e.key === 'Delete' || e.key === 'Backspace') e.stopPropagation();
            // Kept from the page's own Escape handling, which would also deselect the card
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              popup.setOpen(false);
              buttonRef.current?.focus();
            }
          }}
          className={`tierbinder-menu dropdown tierbinder-popup tierbinder-anchored ${styles.popup} ${popup.closing ? 'closing pointer-events-none' : ''}`}
        >
          {/* Sized to its two choices, at the left */}
          <div className="flex">
            <Segmented compact label="Picker" value={view} options={VIEWS} onChange={changeView} />
          </div>
          {view === 'swatches' ? (
            <Swatches current={current} label={label} onPick={apply} />
          ) : (
            <HexColorPicker
              className={styles.picker}
              color={value}
              onChange={(color) => {
                const next = normalize(color);
                if (next && next !== value) pick(next);
              }}
            />
          )}
          {presets.length > 0 && (
            <div className={styles.presetsBox}>
              <span id={`${id}-presets`} className="tierbinder-caption">
                Board Colors
              </span>
              <div role="group" aria-labelledby={`${id}-presets`} className={styles.presets}>
                {/* Two tiers can share a name; the list holds still while it's open */}
                {presets.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    className={styles.preset}
                    style={{ background: p.color }}
                    aria-label={p.name}
                    title={p.name}
                    aria-pressed={p.color === current}
                    onClick={() => {
                      if (p.color !== current) apply(p.color);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          <label className={styles.hexBox}>
            <span className="tierbinder-caption">Hex</span>
            <HexInput value={value} onChange={apply} />
          </label>
        </div>
      )}
    </span>
  );
}

// The Swatches view: a grid of recommended colors, a column per hue, palest at the top. A
// radio group, as the WAI-ARIA pattern has it: one Tab stop (the color in use, else the
// first), the arrows (as laid out), Home and End moving and picking, as do a click, Enter
// and Space; picking keeps the popup open. The color in use is ringed.
function Swatches({
  current,
  label,
  onPick,
}: {
  current: string | null;
  label: string;
  onPick: (color: string) => void;
}) {
  const chosen = SWATCHES.findIndex((s) => s.color === current);
  const [focused, setFocused] = React.useState(Math.max(0, chosen));
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const at = (column: number, row: number) =>
    SWATCHES.findIndex((s) => s.column === column && s.row === row);
  const move = (index: number) => {
    setFocused(index);
    refs.current[index]?.focus();
    if (SWATCHES[index].color !== current) onPick(SWATCHES[index].color);
  };
  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const { column, row } = SWATCHES[i];
    const step: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    if (e.key in step) {
      e.preventDefault();
      const [dx, dy] = step[e.key];
      const next = at(
        Math.min(SWATCH_COLUMNS - 1, Math.max(0, column + dx)),
        Math.min(SWATCH_ROWS - 1, Math.max(0, row + dy))
      );
      if (next >= 0) move(next);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      move(e.key === 'Home' ? 0 : SWATCHES.length - 1);
    }
  };
  return (
    <div
      role="radiogroup"
      aria-label={`${label}: swatches`}
      className={styles.swatches}
      style={
        { '--columns': SWATCH_COLUMNS, '--touch-columns': TOUCH_COLUMNS } as React.CSSProperties
      }
      data-swatches
    >
      {SWATCHES.map((s, i) => (
        <button
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={i === chosen}
          aria-label={s.name}
          title={s.name}
          tabIndex={i === (chosen >= 0 ? chosen : focused) ? 0 : -1}
          className={styles.preset}
          style={
            {
              background: s.color,
              // Its place: as listed, or on touch screens in blocks of TOUCH_COLUMNS hues
              '--column': s.column + 1,
              '--row': s.row + 1,
              '--touch-column': (s.column % TOUCH_COLUMNS) + 1,
              '--touch-row': s.row + 1 + Math.floor(s.column / TOUCH_COLUMNS) * SWATCH_ROWS,
            } as React.CSSProperties
          }
          onFocus={() => setFocused(i)}
          onKeyDown={(e) => onKeyDown(e, i)}
          onClick={() => {
            if (s.color !== current) onPick(s.color);
          }}
        />
      ))}
    </div>
  );
}

// The picker's hex text field: typing applies once it's a full hex color; leaving it shows
// the color in use
function HexInput({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const [draft, setDraft] = React.useState(value);
  const [shown, setShown] = React.useState(value);
  // Follow changes from outside (the picker, a board color) without losing typing
  if (value !== shown) {
    setShown(value);
    setDraft(value);
  }
  return (
    <input
      className={`tierbinder-field ${styles.hex} font-mono`}
      spellCheck={false}
      autoComplete="off"
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        const color = normalize(e.target.value);
        if (color && color !== value) {
          setShown(color);
          onChange(color);
        }
      }}
      onBlur={() => setDraft(value)}
    />
  );
}

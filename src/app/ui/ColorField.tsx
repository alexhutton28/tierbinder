'use client';

import React from 'react';
import { HexColorPicker } from 'react-colorful';
import { useAnchored, usePopup } from './anchored';
import styles from './ColorField.module.css';
import Dropdown from './Dropdown';
import Segmented from './Segmented';
import { SWATCHES, SWATCH_COLUMNS, SWATCH_ROWS } from './swatches';

// A color as a swatch that opens our own picker in a popup like a dropdown's, floating over
// the board: a switch between two views, Swatches (a grid of recommended colors, ui/swatches.ts)
// and Custom (react-colorful's saturation and brightness square over a hue bar, restyled in
// ColorField.module.css, its handles kept inside them), the last one used remembered on the
// device; then its hex field. With a `name`, it's a
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

type View = 'swatches' | 'custom';
const VIEWS = [
  { value: 'swatches', label: 'Swatches', icon: '/grid.svg' },
  { value: 'custom', label: 'Spectrum', icon: '/droplet.svg' },
] as const satisfies readonly { value: View; label: string; icon: string }[];

// How the color is typed: a hex code, or its red, green and blue, or its hue, saturation
// and lightness
type Format = 'hex' | 'rgb' | 'hsl';
const FORMATS = [
  { value: 'hex', label: 'Hex' },
  { value: 'rgb', label: 'RGB' },
  { value: 'hsl', label: 'HSL' },
] as const satisfies readonly { value: Format; label: string }[];

// A choice shared by every color field on the page (switching in one switches the others)
// and saved on the device: the view, and the format
function sharedChoice<T extends string>(key: string, choices: readonly T[], fallback: T) {
  let value: T | null = null;
  const listeners = new Set<() => void>();
  return {
    get(): T {
      if (value) return value;
      try {
        const saved = localStorage.getItem(key) as T | null;
        value = saved && choices.includes(saved) ? saved : fallback;
      } catch {
        value = fallback;
      }
      return value;
    },
    set(next: T) {
      value = next;
      try {
        localStorage.setItem(key, next);
      } catch {}
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    fallback,
  };
}
const viewChoice = sharedChoice<View>('tierbinder-color-view', ['swatches', 'custom'], 'swatches');
const formatChoice = sharedChoice<Format>('tierbinder-color-format', ['hex', 'rgb', 'hsl'], 'hex');
const useChoice = <T extends string>(choice: ReturnType<typeof sharedChoice<T>>) =>
  React.useSyncExternalStore(choice.subscribe, choice.get, () => choice.fallback);

// Converting between a #rrggbb color and its channels: red, green and blue (0-255), or hue
// (0-360), saturation and lightness (0-100), rounded to whole numbers
function toRgb(hex: string) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
function fromRgb([r, g, b]: number[]) {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}
function toHsl(hex: string) {
  const [r, g, b] = toRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  const sat = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return [Math.round((h * 60 + 360) % 360), Math.round(sat * 100), Math.round(l * 100)];
}
function fromHsl([h, sat, l]: number[]) {
  const s1 = sat / 100;
  const l1 = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s1 * Math.min(l1, 1 - l1);
  const f = (n: number) => l1 - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return fromRgb([f(0), f(8), f(4)].map((c) => c * 255));
}
// Each format's channels: their names (for screen readers and tooltips) and ranges
const CHANNELS = {
  rgb: {
    names: ['Red', 'Green', 'Blue'],
    max: [255, 255, 255],
    read: toRgb,
    write: fromRgb,
  },
  hsl: {
    names: ['Hue', 'Saturation', 'Lightness'],
    max: [360, 100, 100],
    read: toHsl,
    write: fromHsl,
  },
};

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
  const current = normalize(value);
  const view = useChoice(viewChoice);
  const format = useChoice(formatChoice);

  // Switching views grows or shrinks the picker: both views stay mounted, stacked, the
  // box easing from one's height to the other's (over --duration-move, on --ease-slide) as
  // the new one grows in from its top and the old one shrinks away (.view, data-active);
  // at once under reduced motion. The box keeps the shown view's height, measured here.
  const viewsRef = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const box = viewsRef.current;
    const shown = box?.querySelector<HTMLElement>('[data-active]');
    if (!box || !shown) return;
    box.style.height = `${shown.offsetHeight}px`;
  }, [view, popup.shown]);

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
      '[data-active] [data-swatches] [tabindex="0"], [data-active] [role="slider"]'
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
          {/* The view's name, muted at the left on the switch's foot, and the switch
          between them, as icons, at the right */}
          <div className={styles.viewHead}>
            <span aria-hidden className="tierbinder-caption">
              {VIEWS.find((v) => v.value === view)?.label}
            </span>
            <Segmented
              compact
              small
              label="Picker"
              value={view}
              options={VIEWS}
              onChange={viewChoice.set}
            />
          </div>
          <div ref={viewsRef} className={styles.views}>
            {/* The view not in use is kept, unseen and out of reach (inert), to shrink away */}
            <div
              className={styles.view}
              data-active={view === 'swatches' || undefined}
              inert={view !== 'swatches'}
            >
              <Swatches current={current} label={label} onPick={apply} />
            </div>
            <div
              className={styles.view}
              data-active={view === 'custom' || undefined}
              inert={view !== 'custom'}
            >
              <HexColorPicker
                className={styles.picker}
                color={value}
                onChange={(color) => {
                  const next = normalize(color);
                  if (next && next !== value) pick(next);
                }}
              />
            </div>
          </div>
          {/* The color typed in, one field: its format (Hex, RGB, HSL) a menu at its left
          edge, then the hex code or the three channels */}
          <div className={styles.colorField}>
            <Dropdown
              label="Color format"
              hideLabel
              variant="text"
              buttonClassName={styles.formatButton}
              value={format}
              options={[...FORMATS]}
              onChange={formatChoice.set}
            />
            {format === 'hex' ? (
              <HexInput value={value} onChange={apply} />
            ) : (
              <ChannelInputs key={format} format={format} value={value} onChange={apply} />
            )}
          </div>
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
      style={{ '--columns': SWATCH_COLUMNS } as React.CSSProperties}
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
              // Its place: a column per hue, palest at the top
              '--column': s.column + 1,
              '--row': s.row + 1,
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

// The color's channels, three number fields side by side in the color field (red, green
// and blue; or hue, saturation and lightness, as the format says; each its tooltip):
// typing applies once all three are whole numbers in range; leaving one shows
// the color in use. A color it sent itself doesn't reset the fields, so HSL's rounding
// doesn't change the other two while one is typed.
function ChannelInputs({
  format,
  value,
  onChange,
}: {
  format: 'rgb' | 'hsl';
  value: string;
  onChange: (color: string) => void;
}) {
  const channels = CHANNELS[format];
  const read = (color: string) => (normalize(color) ? channels.read(color).map(String) : []);
  const [drafts, setDrafts] = React.useState(() => read(value));
  const [shown, setShown] = React.useState(value);
  const [sent, setSent] = React.useState<string | null>(null);
  if (value !== shown) {
    setShown(value);
    if (value !== sent) setDrafts(read(value));
  }
  return (
    <div className={styles.channels}>
      {channels.names.map((name, i) => (
        <label key={name} className={styles.channel} title={name}>
          <input
            className={styles.bare}
            aria-label={name}
            inputMode="numeric"
            spellCheck={false}
            autoComplete="off"
            value={drafts[i] ?? ''}
            onChange={(e) => {
              const next = drafts.map((d, j) => (j === i ? e.target.value : d));
              setDrafts(next);
              const numbers = next.map((d) => (/^\d+$/.test(d.trim()) ? Number(d) : NaN));
              if (numbers.some((n, j) => !(n <= channels.max[j]))) return;
              const color = channels.write(numbers);
              if (color === value) return;
              setSent(color);
              setShown(color);
              onChange(color);
            }}
            onBlur={() => {
              setSent(null);
              setDrafts(read(value));
            }}
          />
        </label>
      ))}
    </div>
  );
}

// The picker's hex text field: typing applies once it's a full hex color; leaving it shows
// the color in use
function HexInput({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const [draft, setDraft] = React.useState(value);
  const [shown, setShown] = React.useState(value);
  // Follow changes from outside (the picker, a swatch) without losing typing
  if (value !== shown) {
    setShown(value);
    setDraft(value);
  }
  return (
    <input
      className={styles.bare}
      aria-label="Hex"
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

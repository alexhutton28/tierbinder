'use client';

import React from 'react';
import { HexColorPicker } from 'react-colorful';
import { useAnchored, usePopup } from './anchored';
import styles from './ColorField.module.css';

// A color as a hex text field, with a swatch before it that opens our own picker in a
// popup like a dropdown's, floating over the board: react-colorful's saturation and
// brightness square over a hue bar (restyled in ColorField.module.css, its handles kept
// inside them), then the board's own colors to pick in one click (BoardColors, given by
// the editor), then the hex again.
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
}: {
  value: string;
  onChange: (color: string) => void;
  label: string;
}) {
  const id = React.useId();
  const boxRef = React.useRef<HTMLSpanElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const popupRef = React.useRef<HTMLDivElement>(null);
  const popup = usePopup(boxRef);
  useAnchored(popup.shown, buttonRef, popupRef);
  // The board's colors as they were when the picker opened, so they hold still while a
  // drag changes this field's own (which stays one click away)
  const boardNow = React.useContext(BoardColors);
  const [presets, setPresets] = React.useState(boardNow);
  const current = normalize(value);

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

  // Opening focuses the square, whose arrow keys move the color, except on touch screens,
  // where the popup itself takes focus (as the Sets popup does), so screen readers move
  // into it and Escape closes it
  React.useEffect(() => {
    if (!popup.open) return;
    const square = popupRef.current?.querySelector<HTMLElement>('[role="slider"]');
    if (matchMedia('(pointer: fine)').matches && square) square.focus();
    else popupRef.current?.focus({ preventScroll: true });
  }, [popup.open]);

  return (
    <span
      ref={boxRef}
      className="inline-flex items-center gap-2"
      // Closes once focus moves on past it, as a dropdown does
      onBlur={(e) => {
        if (!(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)))
          popup.setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={styles.swatch}
        style={{ background: value }}
        aria-label={`${label} picker`}
        title={`${label} picker`}
        aria-haspopup="dialog"
        aria-expanded={popup.open}
        aria-controls={popup.shown ? `${id}-picker` : undefined}
        onClick={() => {
          if (!popup.open) setPresets(boardNow);
          popup.setOpen(!popup.open);
        }}
      />
      {popup.shown && (
        <div
          ref={popupRef}
          id={`${id}-picker`}
          popover="manual"
          role="dialog"
          tabIndex={-1}
          aria-label={`${label} picker`}
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
          <HexColorPicker
            className={styles.picker}
            color={value}
            onChange={(color) => {
              const next = normalize(color);
              if (next && next !== value) pick(next);
            }}
          />
          {presets.length > 0 && (
            <div className={styles.presetsBox}>
              <span id={`${id}-presets`} className={styles.caption}>
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
          <label className={styles.hexRow}>
            <span className={styles.caption}>Hex</span>
            <HexInput value={value} onChange={apply} />
          </label>
        </div>
      )}
      <HexInput value={value} onChange={apply} label={label} />
    </span>
  );
}

// The hex text field: typing applies once it's a full hex color; leaving it shows the
// color in use
function HexInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}) {
  const [draft, setDraft] = React.useState(value);
  const [shown, setShown] = React.useState(value);
  // Follow changes from outside (the picker, the other field) without losing typing
  if (value !== shown) {
    setShown(value);
    setDraft(value);
  }
  return (
    <input
      aria-label={label}
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

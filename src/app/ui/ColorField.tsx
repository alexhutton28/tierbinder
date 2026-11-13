'use client';

import React from 'react';
import { HexColorPicker } from 'react-colorful';
import { useAnchored, usePopup } from './anchored';
import styles from './ColorField.module.css';

// A color as a hex text field, with a swatch before it that opens our own picker
// (react-colorful: a saturation and brightness square over a hue bar, styled in
// ColorField.module.css) in a popup like a dropdown's, floating over the board.
// Typing applies as soon as the text is a full hex color (#rgb or #rrggbb, # optional);
// dragging in the picker applies as it goes, once per frame. Escape, a press outside or
// focus leaving it (Tab past the hue bar) closes it.

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalize(text: string) {
  const match = text.trim().match(HEX);
  if (!match) return null;
  const digits = match[1].length === 3 ? [...match[1]].map((c) => c + c).join('') : match[1];
  return `#${digits.toLowerCase()}`;
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
  const [draft, setDraft] = React.useState(value);
  const [shown, setShown] = React.useState(value);
  // Follow changes from outside (the picker, loading a file) without losing typing
  if (value !== shown) {
    setShown(value);
    setDraft(value);
  }

  const id = React.useId();
  const boxRef = React.useRef<HTMLSpanElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const popupRef = React.useRef<HTMLDivElement>(null);
  const popup = usePopup(boxRef);
  useAnchored(popup.shown, buttonRef, popupRef);

  // The picker reports every pointer move; the board (and its autosave) takes the latest
  // color once a frame
  const pending = React.useRef<string | null>(null);
  const frame = React.useRef(0);
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  });
  React.useEffect(() => () => cancelAnimationFrame(frame.current), []);
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
      // Closes once focus moves on past it (Tab from the hue bar), as a dropdown does
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
        onClick={() => popup.setOpen((o) => !o)}
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
        </div>
      )}
      <input
        aria-label={label}
        className={`tierbinder-field ${styles.hex} font-mono`}
        spellCheck={false}
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
    </span>
  );
}

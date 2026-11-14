'use client';

import React from 'react';
import ColorField from '../../ui/ColorField';
import Toggle from '../../ui/Toggle';
import type { SettingsProps } from '../types';
import { MAX_CARD_WIDTH, MIN_CARD_WIDTH, setCardShape, type BlankCanvas } from './model';

// The blank canvas's part of the Customize tab: its background and split cards' border in
// the Board section, and the Cards section (card size and top halves)

export default function BlankSettings({ graphic: canvas, onChange }: SettingsProps<BlankCanvas>) {
  return (
    // Sections as the editor lays them out: a heading over its controls
    <>
      <div className="flex flex-col gap-3">
        <h3 className="tierbinder-heading">Cards</h3>
        <CardSizeField
          value={canvas.cardWidth}
          onChange={(cardWidth) => onChange((c) => setCardShape(c, { cardWidth }))}
        />
        <Toggle
          checked={canvas.topHalf}
          onChange={(topHalf) => onChange((c) => setCardShape(c, { topHalf }))}
        >
          Show only top half of cards
        </Toggle>
      </div>
    </>
  );
}

// Its colors, in the editor's Board section
export function BlankBoardSettings({ graphic: canvas, onChange }: SettingsProps<BlankCanvas>) {
  return (
    <>
      <ColorField
        name="Background"
        label="Background color"
        value={canvas.background}
        onChange={(background) => onChange((c) => ({ ...c, background }))}
      />
      <ColorField
        name="Split Card Border"
        label="Split card border color"
        value={canvas.border}
        onChange={(border) => onChange((c) => ({ ...c, border }))}
      />
    </>
  );
}

// Card width in pixels. Typing applies as soon as the number is in range, so a size can be
// typed digit by digit; leaving the field shows the size in use.
function CardSizeField({ value, onChange }: { value: number; onChange: (width: number) => void }) {
  const [draft, setDraft] = React.useState(String(value));
  const [shown, setShown] = React.useState(value);
  // Follow changes from outside without losing typing
  if (value !== shown) {
    setShown(value);
    setDraft(String(value));
  }

  return (
    // Its name at the left and the field at the right, as the color settings are
    <label className="tierbinder-prop">
      Card Size
      <span className="flex gap-3 items-center">
        <input
          type="number"
          min={MIN_CARD_WIDTH}
          max={MAX_CARD_WIDTH}
          className="tierbinder-field tierbinder-number-field tabular-nums"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            const width = Number(e.target.value);
            if (Number.isInteger(width) && width >= MIN_CARD_WIDTH && width <= MAX_CARD_WIDTH) {
              setShown(width);
              onChange(width);
            }
          }}
          onBlur={() => setDraft(String(value))}
        />
        px wide
      </span>
    </label>
  );
}

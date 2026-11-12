'use client';

import React from 'react';
import ColorField from '../../ui/ColorField';
import type { SettingsProps } from '../types';
import { MAX_CARD_WIDTH, MIN_CARD_WIDTH, setCardShape, type BlankCanvas } from './model';

// The blank canvas's part of the Customize tab: card size and top halves, background, and
// split cards' border

export default function BlankSettings({ graphic: canvas, onChange }: SettingsProps<BlankCanvas>) {
  return (
    <>
      <h3 className="tierbinder-heading">Cards</h3>
      <CardSizeField
        value={canvas.cardWidth}
        onChange={(cardWidth) => onChange((c) => setCardShape(c, { cardWidth }))}
      />
      <label className="flex gap-3 items-center">
        <input
          type="checkbox"
          checked={canvas.topHalf}
          onChange={(e) => onChange((c) => setCardShape(c, { topHalf: e.target.checked }))}
        />
        Show only top half of cards
      </label>
      <h3 className="tierbinder-heading">Board</h3>
      <div className="tierbinder-prop">
        Background
        <ColorField
          label="Background color"
          value={canvas.background}
          onChange={(background) => onChange((c) => ({ ...c, background }))}
        />
      </div>
      <div className="tierbinder-prop">
        Split Card Border
        <ColorField
          label="Split card border color"
          value={canvas.border}
          onChange={(border) => onChange((c) => ({ ...c, border }))}
        />
      </div>
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
    <label className="flex gap-3 items-center">
      Card Size
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
    </label>
  );
}

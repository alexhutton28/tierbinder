'use client';

import React from 'react';
import ColorField from '../../ui/ColorField';
import type { SettingsProps } from '../types';
import { MAX_CARD_WIDTH, MIN_CARD_WIDTH, setCardShape, type BlankCanvas } from './model';

// The blank canvas's part of Customize Board: card size and top halves, background, and
// split cards' border

export default function BlankSettings({ graphic: canvas, onChange }: SettingsProps<BlankCanvas>) {
  return (
    <>
      <h3 className="font-bold">Cards</h3>
      <CardSizeField
        value={canvas.cardWidth}
        onChange={(cardWidth) => onChange((c) => setCardShape(c, { cardWidth }))}
      />
      <label className="flex gap-[8px] items-center">
        <input
          type="checkbox"
          checked={canvas.topHalf}
          onChange={(e) => onChange((c) => setCardShape(c, { topHalf: e.target.checked }))}
        />
        Show only top half of cards
      </label>
      <h3 className="font-bold">Background</h3>
      <ColorField
        label="Background color"
        value={canvas.background}
        onChange={(background) => onChange((c) => ({ ...c, background }))}
      />
      <h3 className="font-bold">Split card border</h3>
      <ColorField
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
    <label className="flex gap-[8px] items-center">
      Card size
      <input
        type="number"
        min={MIN_CARD_WIDTH}
        max={MAX_CARD_WIDTH}
        className="border border-black px-[4px] w-[64px]"
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

'use client';

import React from 'react';

// A color as a hex text field, with the browser's picker on the swatch beside it.
// Typing applies as soon as the text is a full hex color (#rgb or #rrggbb, # optional).

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

  return (
    <span className="inline-flex items-center gap-[4px]">
      <input
        type="color"
        aria-label={`${label} picker`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        aria-label={label}
        className="border border-black px-[4px] w-[80px] font-mono"
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

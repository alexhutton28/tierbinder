'use client';

import React from 'react';
import Button from '../../ui/Button';
import ColorField from '../../ui/ColorField';
import { DEFAULT_TOOL, type ToolbarProps } from '../types';
import { MAX_STROKE_WIDTH, MIN_STROKE_WIDTH, type BlankCanvas } from './model';

// The blank canvas's tools, under the board: Move (cards), Pen and Eraser, with the active
// tool's settings beside them

const TOOLS = [
  [DEFAULT_TOOL, 'Move'],
  ['pen', 'Pen'],
  ['eraser', 'Eraser'],
] as const;

export default function BlankToolbar({
  graphic: canvas,
  onChange,
  tool,
  onTool,
}: ToolbarProps<BlankCanvas>) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      {TOOLS.map(([id, label]) => (
        <Button key={id} variant="tool" aria-pressed={tool === id} onClick={() => onTool(id)}>
          {label}
        </Button>
      ))}
      {tool === 'pen' && (
        <>
          <ColorField
            label="Pen color"
            value={canvas.penColor}
            onChange={(penColor) => onChange((c) => ({ ...c, penColor }))}
          />
          <SizeField
            label="Pen size"
            value={canvas.penWidth}
            onChange={(penWidth) => onChange((c) => ({ ...c, penWidth }))}
          />
        </>
      )}
      {tool === 'eraser' && (
        <SizeField
          label="Eraser size"
          value={canvas.eraserWidth}
          onChange={(eraserWidth) => onChange((c) => ({ ...c, eraserWidth }))}
        />
      )}
    </div>
  );
}

// A stroke width in pixels. Typing applies as soon as the number is in range; leaving the
// field shows the size in use.
function SizeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (width: number) => void;
}) {
  const [draft, setDraft] = React.useState(String(value));
  const [shown, setShown] = React.useState(value);
  // Follow changes from outside without losing typing
  if (value !== shown) {
    setShown(value);
    setDraft(String(value));
  }

  return (
    <label className="flex gap-2 items-center">
      Size
      <input
        type="number"
        aria-label={label}
        min={MIN_STROKE_WIDTH}
        max={MAX_STROKE_WIDTH}
        className="tierbinder-field tierbinder-number-field tabular-nums"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          const width = Number(e.target.value);
          if (Number.isInteger(width) && width >= MIN_STROKE_WIDTH && width <= MAX_STROKE_WIDTH) {
            setShown(width);
            onChange(width);
          }
        }}
        onBlur={() => setDraft(String(value))}
      />
      px
    </label>
  );
}

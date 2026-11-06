'use client';

import React from 'react';

type Option<T extends string> = { value: T; label: string; color: string };

type BlockBox = { top: number; left: number; width: number; height: number; transition?: string };

type Props<T extends string> = {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

// The sidebar's main nav: a block of the selected option's color hugs its word, and
// springs to the next word. The block is measured from the word, so it fits any label.
export default function RadioBar<T extends string>({ label, options, value, onChange }: Props<T>) {
  const barRef = React.useRef<HTMLDivElement>(null);
  const wordRefs = React.useRef(new Map<T, HTMLSpanElement>());
  const [block, setBlock] = React.useState<BlockBox | null>(null);
  const moved = React.useRef(value);
  const selected = options.find((option) => option.value === value);

  React.useLayoutEffect(() => {
    const bar = barRef.current;
    const word = wordRefs.current.get(value);
    if (!bar || !word) return;
    const measure = (animate: boolean) => {
      const from = bar.getBoundingClientRect();
      const to = word.getBoundingClientRect();
      const top = to.top - from.top;
      const left = to.left - from.left;
      const { width, height } = to;
      setBlock((old) =>
        old && old.top === top && old.left === left && old.width === width && old.height === height
          ? old
          : { top, left, width, height, transition: animate ? undefined : 'none' }
      );
    };
    // Only a new selection springs: the first placement doesn't
    measure(moved.current !== value);
    moved.current = value;
    // Word widths change when the font loads and when the sidebar resizes
    const observer = new ResizeObserver(() => measure(false));
    observer.observe(word);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [value]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const at = options.findIndex((option) => option.value === value);
    const step = e.key === 'ArrowRight' ? 1 : -1;
    const next = options[(at + step + options.length) % options.length];
    onChange(next.value);
    wordRefs.current.get(next.value)?.closest('button')?.focus();
  };

  return (
    <div
      ref={barRef}
      role="tablist"
      aria-label={label}
      className="tier-stack-radio"
      onKeyDown={onKeyDown}
    >
      {block && (
        <span
          aria-hidden
          className="tier-stack-radio-block"
          style={{ ...block, background: selected?.color }}
        />
      )}
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          tabIndex={option.value === value ? 0 : -1}
          className="tier-stack-radio-option"
          onClick={() => onChange(option.value)}
        >
          <span
            ref={(el) => {
              if (el) wordRefs.current.set(option.value, el);
              else wordRefs.current.delete(option.value);
            }}
          >
            {option.label}
          </span>
        </button>
      ))}
    </div>
  );
}

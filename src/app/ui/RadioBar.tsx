'use client';

import React from 'react';

// `icon` is an SVG's name in public/, drawn in the text color
type Option<T extends string> = { value: T; label: string; icon: string; color: string };

// How the tabs show, from widest to narrowest: icon and label; label only; icons, with
// the selected tab's label too; icons only. The bar uses the widest one that fits.
type Mode = 'full' | 'label' | 'selected' | 'icon';
const TRIED_MODES = ['full', 'label', 'selected'] as const;

type BlockBox = { top: number; left: number; width: number; height: number; transition?: string };

type Props<T extends string> = {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

// The sidebar's main nav: a block of the selected option's color hugs its word, and
// springs to the next word. The block is measured from the word, so it fits any label.
// When the tabs don't fit their space they drop their icons, then show icons with only
// the selected tab named, then only icons (hidden labels are tooltips and stay for screen
// readers). Hidden copies of the bar in the wider modes are measured against the space,
// so the switch follows the real text widths. 'selected' is measured with each tab
// selected in turn and needs the widest, so switching tabs never changes the mode.
export default function RadioBar<T extends string>({ label, options, value, onChange }: Props<T>) {
  const fitRef = React.useRef<HTMLDivElement>(null);
  const sizerRefs = React.useRef(new Map<string, HTMLDivElement>());
  const [mode, setMode] = React.useState<Mode>('full');
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

  React.useLayoutEffect(() => {
    const fit = fitRef.current;
    if (!fit) return;
    const choose = () => {
      const room = fit.clientWidth;
      const needs = (m: Mode) =>
        Math.max(
          ...[...sizerRefs.current]
            .filter(([key]) => key.startsWith(`${m} `))
            .map(([, sizer]) => sizer.offsetWidth)
        );
      setMode(TRIED_MODES.find((m) => needs(m) <= room) ?? 'icon');
    };
    choose();
    // The space changes as the sidebar resizes; the copies change when the font loads
    const observer = new ResizeObserver(choose);
    observer.observe(fit);
    sizerRefs.current.forEach((sizer) => observer.observe(sizer));
    return () => observer.disconnect();
  }, []);

  const content = (option: Option<T>) => (
    <>
      <span
        aria-hidden
        className="tierbinder-radio-icon"
        style={{ maskImage: `url('/${option.icon}.svg')` }}
      />
      <span className="tierbinder-radio-label" data-label={option.label}>
        {option.label}
      </span>
    </>
  );

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
    <div ref={fitRef} className="tierbinder-radio-fit">
      <div className="tierbinder-radio-sizers">
        {TRIED_MODES.flatMap((m) =>
          // Keyed by mode and the tab shown as selected
          (m === 'selected' ? options.map((o) => o.value) : [value]).map((shown) => (
            <div
              key={`${m} ${shown}`}
              ref={(el) => {
                if (el) sizerRefs.current.set(`${m} ${shown}`, el);
                else sizerRefs.current.delete(`${m} ${shown}`);
              }}
              aria-hidden
              className="tierbinder-radio tierbinder-radio-sizer"
              data-mode={m}
            >
              {options.map((option) => (
                <span
                  key={option.value}
                  className="tierbinder-radio-option"
                  data-selected={option.value === shown ? '' : undefined}
                >
                  <span>{content(option)}</span>
                </span>
              ))}
            </div>
          ))
        )}
      </div>
      <div
        ref={barRef}
        role="tablist"
        aria-label={label}
        className="tierbinder-radio"
        data-mode={mode}
        onKeyDown={onKeyDown}
      >
        {block && (
          <span
            aria-hidden
            className="tierbinder-radio-block"
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
            className="tierbinder-radio-option"
            data-selected={option.value === value ? '' : undefined}
            title={
              mode === 'icon' || (mode === 'selected' && option.value !== value)
                ? option.label
                : undefined
            }
            onClick={() => onChange(option.value)}
          >
            <span
              ref={(el) => {
                if (el) wordRefs.current.set(option.value, el);
                else wordRefs.current.delete(option.value);
              }}
            >
              {content(option)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

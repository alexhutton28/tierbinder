'use client';

import React from 'react';
import styles from './RadioBar.module.css';

// `icon` is an SVG's name in public/, drawn in the text color
type Option<T extends string> = { value: T; label: string; icon: string; color: string };

// How the tabs show, from widest to narrowest: icon and label; icons, with the selected
// tab's label too; icons only. The bar uses the widest one that fits.
type Mode = 'full' | 'selected' | 'icon';
const TRIED_MODES = ['full', 'selected'] as const;

type BlockBox = { top: number; left: number; width: number; height: number; transition?: string };

type Props<T extends string> = {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

// The sidebar's main nav: a block of the selected option's color hugs its word, and
// springs to the next word. The block is measured from the word, so it fits any label.
// When the tabs don't fit their space they show icons with only the selected tab named,
// then only icons (hidden labels are tooltips and stay for screen
// readers). Hidden copies of the bar in the wider modes are measured against the space,
// so the switch follows the real text widths. 'selected' is measured with each tab
// selected in turn and needs the widest, so switching tabs never changes the mode.
export default function RadioBar<T extends string>({ label, options, value, onChange }: Props<T>) {
  const fitRef = React.useRef<HTMLDivElement>(null);
  const sizerRefs = React.useRef(new Map<string, HTMLDivElement>());
  const [mode, setMode] = React.useState<Mode>('full');
  // Each label's full width, measured from the hidden copy, so labels can fold to 0 and
  // back out to it with a transition (CSS can't transition to an automatic width)
  const [labelWidths, setLabelWidths] = React.useState<number[] | null>(null);
  const barRef = React.useRef<HTMLDivElement>(null);
  const wordRefs = React.useRef(new Map<T, HTMLSpanElement>());
  const [block, setBlock] = React.useState<BlockBox | null>(null);
  const moved = React.useRef({ value, mode });
  const selected = options.find((option) => option.value === value);

  // The block goes where the selected word will be once the bar settles. While labels
  // fold and open the bar's own words are moving, so the target comes from the hidden copy
  // laid out for this mode and selection, and the block slides there on the spring, as
  // the tabs do (with icons only nothing moves, so the bar is measured directly).
  React.useLayoutEffect(() => {
    const bar = barRef.current;
    const index = options.findIndex((option) => option.value === value);
    const sizer =
      mode === 'icon'
        ? undefined
        : sizerRefs.current.get(mode === 'full' ? 'full ' : `selected ${value}`);
    const box = sizer ?? bar;
    const word = sizer
      ? (sizer.children[index]?.firstElementChild as HTMLElement | undefined)
      : wordRefs.current.get(value);
    if (!bar || !box || !word) return;
    const measure = (animate: boolean) => {
      const from = box.getBoundingClientRect();
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
    // A new selection or step slides; the first placement doesn't
    measure(moved.current.value !== value || moved.current.mode !== mode);
    moved.current = { value, mode };
    // Word widths change when the font loads and when the sidebar resizes
    const observer = new ResizeObserver(() => measure(false));
    observer.observe(word);
    observer.observe(box);
    return () => observer.disconnect();
  }, [value, mode, options]);

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
      const labels = sizerRefs.current.get('full ')?.querySelectorAll(`.${styles.label}`);
      const widths = [...(labels ?? [])].map((l) => (l as HTMLElement).offsetWidth);
      setLabelWidths((old) => (old && old.join() === widths.join() ? old : widths));
    };
    choose();
    // The space changes as the sidebar resizes; the copies change when the font loads
    const observer = new ResizeObserver(choose);
    observer.observe(fit);
    sizerRefs.current.forEach((sizer) => observer.observe(sizer));
    return () => observer.disconnect();
  }, []);

  // The label folds to nothing (the clip) around its text; labelWidth is its open width
  const content = (option: Option<T>, labelWidth?: number) => (
    <>
      <span
        aria-hidden
        className={styles.icon}
        style={{ maskImage: `url('/${option.icon}.svg')` }}
      />
      <span
        className={styles.label}
        style={
          labelWidth === undefined
            ? undefined
            : ({ '--label-width': `${labelWidth}px` } as React.CSSProperties)
        }
      >
        <span className={styles.text} data-label={option.label}>
          {option.label}
        </span>
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
    <div ref={fitRef} className={styles.fit}>
      <div className={styles.sizers}>
        {TRIED_MODES.flatMap((m) =>
          // Keyed by mode and the tab shown as selected
          (m === 'selected' ? options.map((o) => o.value) : ['']).map((shown) => (
            <div
              key={`${m} ${shown}`}
              ref={(el) => {
                if (el) sizerRefs.current.set(`${m} ${shown}`, el);
                else sizerRefs.current.delete(`${m} ${shown}`);
              }}
              aria-hidden
              className={`${styles.bar} ${styles.sizer}`}
              data-mode={m}
            >
              {options.map((option) => (
                <span
                  key={option.value}
                  className={styles.option}
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
        className={styles.bar}
        data-mode={mode}
        onKeyDown={onKeyDown}
      >
        {block && (
          <span
            aria-hidden
            className={styles.block}
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
            className={styles.option}
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
              {content(option, labelWidths?.[options.indexOf(option)])}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

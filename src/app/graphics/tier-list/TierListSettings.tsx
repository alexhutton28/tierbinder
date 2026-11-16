'use client';

import React from 'react';
import Button from '../../ui/Button';
import ColorField from '../../ui/ColorField';
import Slider from '../../ui/Slider';
import Toggle from '../../ui/Toggle';
import styles from './TierListSettings.module.css';
import type { SettingsProps } from '../types';
import {
  LABEL_WIDTHS,
  MAX_TIERS,
  MIN_TIERS,
  addTier,
  removeTier,
  type Tier,
  type TierList,
} from './model';

// The tier list's part of the Customize tab: its background and border in the Appearance
// section, and the Tiers section (tier colors and names, removing and adding tiers, tier
// card borders). Double-clicking a tier label focuses its name (`tier:<index>`).

const plural = (count: number) => `${count} ${count === 1 ? 'Card' : 'Cards'}`;

export default function TierListSettings({
  graphic: list,
  onChange,
  focus,
  onNotify,
}: SettingsProps<TierList>) {
  const hintId = React.useId();
  const tierNameRefs = React.useRef<(HTMLTextAreaElement | null)[]>([]);
  const removeRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const addRef = React.useRef<HTMLButtonElement>(null);
  // Where focus goes once the tiers change: a new tier's name, or from a removed tier's
  // button to the one that took its place
  const focusNext = React.useRef<{ added: true } | { removed: number } | null>(null);

  React.useEffect(() => {
    const tier = focus?.key.match(/^tier:(\d+)$/)?.[1];
    if (tier !== undefined) tierNameRefs.current[Number(tier)]?.focus();
  }, [focus]);

  const count = list.tiers.length;
  React.useEffect(() => {
    const next = focusNext.current;
    focusNext.current = null;
    if (!next) return;
    if ('added' in next) {
      // Its name, selected, ready to type over (not on touch screens, where it would
      // bring up the keyboard)
      const name = tierNameRefs.current[count - 1];
      if (matchMedia('(pointer: coarse)').matches) return;
      name?.focus();
      name?.select();
      return;
    }
    // The last tier left can't be removed, so its button is disabled
    if (count <= MIN_TIERS) addRef.current?.focus();
    else removeRefs.current[Math.min(next.removed, count - 1)]?.focus();
  }, [count]);

  // Its cards go to the card tray, as many as fit; the toast says so, and offers Undo
  const remove = (index: number) => {
    const removed = removeTier(list, index);
    if (!removed) return;
    focusNext.current = { removed: index };
    onChange((l) => removeTier(l, index)?.list ?? l);
    onNotify(
      [
        removed.moved
          ? `Tier Removed; Moved ${plural(removed.moved)} to the Card Tray`
          : 'Tier Removed',
        ...(removed.left
          ? [`${plural(removed.left)} Didn't Fit in the Card Tray and Were Removed`]
          : []),
      ].join('\n'),
      { undo: true }
    );
  };

  const updateTier = (index: number, change: Partial<Tier>) =>
    onChange((l) => ({
      ...l,
      tiers: l.tiers.map((t, i) => (i === index ? { ...t, ...change } : t)),
    }));

  return (
    // Sections as the editor lays them out: a heading over its controls
    <>
      <div className="flex flex-col gap-3">
        <h3 className="tierbinder-heading">Tiers</h3>
        <span id={hintId} className="sr-only">
          Shift+Enter for a new line
        </span>
        {list.tiers.map((tier, i) => (
          <div key={tier.id} className="flex gap-3 items-start">
            <div className={styles.swatch}>
              <ColorField
                label={`${tier.name.replace(/\s+/g, ' ')} color`}
                value={tier.color}
                onChange={(color) => updateTier(i, { color })}
              />
            </div>
            {/* Shift+Enter starts a new line, the field growing a line at a time; Enter
                alone does nothing. Lines don't wrap in it, so it shows them as the label
                breaks them. */}
            <textarea
              ref={(el) => {
                tierNameRefs.current[i] = el;
              }}
              aria-label={`Tier ${i + 1} name`}
              aria-describedby={hintId}
              title="Shift+Enter for a new line"
              rows={tier.name.split('\n').length}
              wrap="off"
              spellCheck={false}
              className={`tierbinder-field ${styles.name} flex-1 min-w-0`}
              value={tier.name}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) e.preventDefault();
              }}
              onChange={(e) => updateTier(i, { name: e.target.value })}
            />
            <Button
              ref={(el) => {
                removeRefs.current[i] = el;
              }}
              variant="icon"
              className={styles.touch}
              disabled={count <= MIN_TIERS}
              // A tier with no name is "Tier 2", as its color is in the picker
              aria-label={`Remove tier ${i + 1}${tier.name.trim() ? `: ${tier.name.replace(/\s+/g, ' ').trim()}` : ''}`}
              title={count <= MIN_TIERS ? 'A tier list needs at least one tier' : 'Remove tier'}
              // A double click's second click would land on the tier that took its place
              onClick={(e) => {
                if (e.detail <= 1) remove(i);
              }}
            >
              <span aria-hidden className={styles.removeIcon} />
            </Button>
          </div>
        ))}
        <Button
          ref={addRef}
          disabled={count >= MAX_TIERS}
          title={count >= MAX_TIERS ? `${MAX_TIERS} tiers at most` : undefined}
          className={`${styles.touch} flex gap-2 items-center self-start`}
          onClick={() => {
            focusNext.current = { added: true };
            onChange((l) => addTier(l) ?? l);
          }}
        >
          <span aria-hidden className={styles.addIcon} />
          Add Tier
        </Button>
        {/* How wide the tiers' labels are: narrower gives a narrow board's cards more room */}
        <Slider
          label="Tier Size"
          values={LABEL_WIDTHS}
          value={list.labelWidth}
          describe={(width) => `${width} pixels wide`}
          onChange={(labelWidth) => onChange((l) => ({ ...l, labelWidth }))}
        />
        <Toggle
          checked={list.tierCardBorders}
          onChange={(tierCardBorders) => onChange((l) => ({ ...l, tierCardBorders }))}
        >
          Tier Card Borders
        </Toggle>
      </div>
    </>
  );
}

// Its colors, in the editor's Appearance section
export function TierListBoardSettings({ graphic: list, onChange }: SettingsProps<TierList>) {
  return (
    <>
      <ColorField
        name="Background"
        label="Background color"
        value={list.background}
        onChange={(background) => onChange((l) => ({ ...l, background }))}
      />
      {/* The lines between tiers, and split cards' divider and edge */}
      <ColorField
        name="Tier Dividers"
        label="Tier dividers color"
        value={list.border}
        onChange={(border) => onChange((l) => ({ ...l, border }))}
      />
    </>
  );
}

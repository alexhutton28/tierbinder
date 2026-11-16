'use client';

import React from 'react';
import ColorField from '../../ui/ColorField';
import Toggle from '../../ui/Toggle';
import styles from './TierListSettings.module.css';
import type { SettingsProps } from '../types';
import type { Tier, TierList } from './model';

// The tier list's part of the Customize tab: its background and border in the Board
// section, and the Tiers section (tier colors and names, tier card borders).
// Double-clicking a tier label focuses its name (`tier:<index>`).

export default function TierListSettings({
  graphic: list,
  onChange,
  focus,
}: SettingsProps<TierList>) {
  const hintId = React.useId();
  const tierNameRefs = React.useRef<(HTMLTextAreaElement | null)[]>([]);

  React.useEffect(() => {
    const tier = focus?.key.match(/^tier:(\d+)$/)?.[1];
    if (tier !== undefined) tierNameRefs.current[Number(tier)]?.focus();
  }, [focus]);

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
          </div>
        ))}
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

// Its colors, in the editor's Board section
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

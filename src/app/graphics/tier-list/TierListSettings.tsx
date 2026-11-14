'use client';

import React from 'react';
import ColorField from '../../ui/ColorField';
import Toggle from '../../ui/Toggle';
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
  const tierNameRefs = React.useRef<(HTMLInputElement | null)[]>([]);

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
        {list.tiers.map((tier, i) => (
          <div key={tier.id} className="flex gap-3 items-center">
            <ColorField
              label={`${tier.name} color`}
              value={tier.color}
              onChange={(color) => updateTier(i, { color })}
            />
            {/* One line, so line breaks are typed as \n (as in bulk import) */}
            <input
              ref={(el) => {
                tierNameRefs.current[i] = el;
              }}
              aria-label={`Tier ${i + 1} name`}
              className="tierbinder-field flex-1 min-w-0"
              value={tier.name.replaceAll('\n', '\\n')}
              onChange={(e) => updateTier(i, { name: e.target.value.replaceAll('\\n', '\n') })}
            />
          </div>
        ))}
        <Toggle
          checked={list.tierCardBorders}
          onChange={(tierCardBorders) => onChange((l) => ({ ...l, tierCardBorders }))}
        >
          Tier colored card borders
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
      <ColorField
        name="Border"
        label="Border color"
        value={list.border}
        onChange={(border) => onChange((l) => ({ ...l, border }))}
      />
    </>
  );
}

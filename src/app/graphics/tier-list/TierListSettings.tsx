'use client';

import React from 'react';
import ColorField from '../../ui/ColorField';
import Checkbox from '../../ui/Checkbox';
import type { SettingsProps } from '../types';
import type { Tier, TierList } from './model';

// The tier list's part of the Customize tab: tier colors and names, tier card borders,
// background and border. Double-clicking a tier label focuses its name (`tier:<index>`).

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
        <Checkbox
          checked={list.tierCardBorders}
          onChange={(tierCardBorders) => onChange((l) => ({ ...l, tierCardBorders }))}
        >
          Add tier colored border to cards
        </Checkbox>
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="tierbinder-heading">Board</h3>
        <div className="tierbinder-prop">
          Background
          <ColorField
            label="Background color"
            value={list.background}
            onChange={(background) => onChange((l) => ({ ...l, background }))}
          />
        </div>
        <div className="tierbinder-prop">
          Border
          <ColorField
            label="Border color"
            value={list.border}
            onChange={(border) => onChange((l) => ({ ...l, border }))}
          />
        </div>
      </div>
    </>
  );
}

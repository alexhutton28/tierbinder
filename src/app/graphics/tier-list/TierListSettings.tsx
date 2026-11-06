'use client';

import React from 'react';
import ColorField from '../../ui/ColorField';
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
    <>
      <h3 className="tier-stack-heading">Tiers</h3>
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
            className="tier-stack-field flex-1 min-w-0"
            value={tier.name.replaceAll('\n', '\\n')}
            onChange={(e) => updateTier(i, { name: e.target.value.replaceAll('\\n', '\n') })}
          />
        </div>
      ))}
      <label className="flex gap-3 items-center">
        <input
          type="checkbox"
          checked={list.tierCardBorders}
          onChange={(e) => onChange((l) => ({ ...l, tierCardBorders: e.target.checked }))}
        />
        Add tier colored border to cards
      </label>
      <h3 className="tier-stack-heading">Board</h3>
      <div className="tier-stack-prop">
        Background
        <ColorField
          label="Background color"
          value={list.background}
          onChange={(background) => onChange((l) => ({ ...l, background }))}
        />
      </div>
      <div className="tier-stack-prop">
        Border
        <ColorField
          label="Border color"
          value={list.border}
          onChange={(border) => onChange((l) => ({ ...l, border }))}
        />
      </div>
    </>
  );
}

import type { GraphicType } from '../types';
import TierListCanvas from './TierListCanvas';
import TierListSettings from './TierListSettings';
import {
  defaultTierList,
  dropTarget,
  importCards,
  insertCard,
  layoutCards,
  parseTierList,
  type TierList,
} from './model';

const tierList: GraphicType<TierList> = {
  kind: 'tier-list',
  label: 'Tier list',
  targetNoun: 'tier',
  create: defaultTierList,
  parse: parseTierList,
  Canvas: TierListCanvas,
  Settings: TierListSettings,
  layout: layoutCards,
  mapCards: (list, change) => ({
    ...list,
    tiers: list.tiers.map((t) => ({ ...t, items: t.items.flatMap((i) => change(i) ?? []) })),
  }),
  targets: (list) => list.tiers.map((t) => ({ name: t.name, color: t.color })),
  // At the end of the tier
  addCard: (list, item, tier) => insertCard(list, item, tier, list.tiers[tier].items.length),
  // In the tier under the pointer, before the first card whose center is to its right
  dropCard: (list, item, point) => {
    const target = dropTarget(list, '', point.x, point.y);
    return insertCard(list, item, target.tierIndex, target.index);
  },
  importCards,
};

export default tierList;

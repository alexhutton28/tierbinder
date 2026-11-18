import type { GraphicType } from '../types';
import TierListCanvas from './TierListCanvas';
import TierListSettings, { TierListBoardSettings } from './TierListSettings';
import {
  defaultTierList,
  defaultTierStyle,
  dropTarget,
  importCards,
  moveCard,
  insertCard,
  layoutCards,
  parseTierList,
  tierCardWidth,
  type TierList,
} from './model';

const tierList: GraphicType<TierList> = {
  kind: 'tier-list',
  label: 'Tier List',
  icon: '/tier-list.svg',
  targetNoun: 'tier',
  create: defaultTierList,
  parse: parseTierList,
  Canvas: TierListCanvas,
  BoardSettings: TierListBoardSettings,
  Settings: TierListSettings,
  layout: layoutCards,
  describe: (list) => list.tiers.map((t) => ({ name: t.name, items: t.items })),
  mapCards: (list, change) => ({
    ...list,
    tiers: list.tiers.map((t) => ({ ...t, items: t.items.flatMap((i) => change(i) ?? []) })),
  }),
  hasContents: (list) => list.tiers.some((t) => t.items.length),
  clear: (list) => ({ ...list, tiers: list.tiers.map((t) => ({ ...t, items: [] })) }),
  restyle: (list) => {
    const fresh = defaultTierList();
    return {
      ...list,
      background: fresh.background,
      border: fresh.border,
      labelWidth: fresh.labelWidth,
      tierCardBorders: fresh.tierCardBorders,
      // However many tiers it has: they hold its cards, which it keeps
      tiers: list.tiers.map((t, i) => ({ ...t, ...defaultTierStyle(i, list.tiers.length) })),
      tray: { ...list.tray, color: fresh.tray.color },
    };
  },
  // Its cards stay in their tiers, closer together on a narrower board
  reshape: (list, shape) => ({ ...list, shape }),
  cardWidth: (list) => tierCardWidth(list.tiers.length),
  targets: (list) => list.tiers.map((t) => ({ id: t.id, name: t.name, color: t.color })),
  // At the end of the tier
  addCard: (list, item, tier) => insertCard(list, item, tier, list.tiers[tier].items.length),
  // At the end of the tier, from wherever it is on the board
  // (the list as it was when it's already last there)
  moveCardTo: (list, id, tier) =>
    list.tiers[tier].items.at(-1)?.id === id
      ? list
      : moveCard(list, id, tier, list.tiers[tier].items.filter((i) => i.id !== id).length),
  // In the tier under the pointer, before the first card whose center is to its right
  dropCard: (list, item, point) => {
    const target = dropTarget(list, '', point.x, point.y);
    return insertCard(list, item, target.tierIndex, target.index);
  },
  ungroupedImport: 'tray',
  importCards,
};

export default tierList;
